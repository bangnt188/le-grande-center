/** Shared bounded stream reader; callers map failures to their own safe error vocabulary. */
export async function readBytes(message: Request | Response, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const declared = message.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new Error("Invalid body size");
  if (!message.body) return new Uint8Array();
  const reader = message.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new Error("Body read aborted");
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Body too large");
      chunks.push(value);
    }
    if (signal?.aborted) throw new Error("Body read aborted");
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) { cancel(); throw error; }
  finally { signal?.removeEventListener("abort", cancel); reader.releaseLock(); }
}

export async function readRequestBytes(request: Request, maxBytes: number, timeoutMs: number): Promise<Uint8Array<ArrayBuffer>> {
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("Body read timeout")); }, timeoutMs);
  });
  try { return await Promise.race([readBytes(request, maxBytes, signal), deadline]); }
  finally { clearTimeout(timer); controller.abort(); }
}
