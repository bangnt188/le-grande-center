type CacheEntry<T> = { data: T; revision: number; fetchedAt: number };
type Pending = { controller: AbortController; promise: Promise<unknown>; users: number };
const TTL_MS = 60_000;

class MemoryCache {
  private entries = new Map<string, CacheEntry<unknown>>();
  private pending = new Map<string, Pending>();
  private listeners = new Set<() => void>();
  private version = 0;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getVersion = () => this.version;

  get<T>(key: string): { data: T; revision: number } | null {
    const entry = this.entries.get(key);
    if (!entry || Date.now() - entry.fetchedAt >= TTL_MS) return null;
    return { data: entry.data as T, revision: entry.revision };
  }
  set<T>(key: string, data: T, revision: number): void {
    this.entries.set(key, { data, revision, fetchedAt: Date.now() });
  }

  /** Shared requests stay alive while any mounted consumer still needs them. */
  async load<T extends { revision: number }>(key: string, loader: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const cached = this.get<T>(key);
    if (cached) return cached.data;
    let pending = this.pending.get(key);
    if (!pending) {
      const controller = new AbortController();
      const request: Pending = { controller, users: 0, promise: Promise.resolve() };
      request.promise = Promise.resolve().then(() => loader(controller.signal)).then(value => {
        if (controller.signal.aborted || this.pending.get(key) !== request) throw new DOMException("Stale request", "AbortError");
        this.set(key, value, value.revision);
        return value;
      }).finally(() => { if (this.pending.get(key) === request) this.pending.delete(key); });
      this.pending.set(key, request);
      pending = request;
    }
    const request = pending;
    request.users++;
    return new Promise<T>((resolve, reject) => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        signal?.removeEventListener("abort", abort);
        request.users--;
        queueMicrotask(() => {
          if (request.users === 0 && this.pending.get(key) === request) {
            this.pending.delete(key);
            request.controller.abort();
          }
        });
      };
      const abort = () => { release(); reject(new DOMException("Aborted", "AbortError")); };
      signal?.addEventListener("abort", abort, { once: true });
      request.promise.then(value => { if (!released) { release(); resolve(value as T); } }, issue => { if (!released) { release(); reject(issue); } });
    });
  }

  /** Mutation invalidation aborts pre-commit reads and only mounted views reload. */
  markAllStale(): void {
    this.entries.clear();
    for (const request of this.pending.values()) request.controller.abort();
    this.pending.clear();
    this.version++;
    for (const listener of this.listeners) listener();
  }
  clear(): void { this.markAllStale(); }
}

export const screenCache = new MemoryCache();
export function stableQueryKey(query: Record<string, unknown> = {}): string {
  return JSON.stringify(Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== "").sort(([a], [b]) => a.localeCompare(b))));
}
export function makeCacheKey(actorId: string, propertyId: string, screen: string, query?: Record<string, unknown>): string {
  return JSON.stringify([actorId, propertyId, screen, stableQueryKey(query)]);
}
