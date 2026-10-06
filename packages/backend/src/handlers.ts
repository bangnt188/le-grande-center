import { AccessError } from "./access.js";
import { BackendError } from "./errors.js";
import { jsonError, jsonSuccess } from "./response.js";
import { readJson } from "./validation.js";
export type VersionedDTO = { id: string; version: number };
export type CrudHttpService<DTO extends VersionedDTO> = {
  list: (request: Request, page?: { page?: number; pageSize?: number }) => Promise<{ items: DTO[]; page: number; pageSize: number; totalItems: number; totalPages: number }>;
  get: (request: Request, id: string) => Promise<DTO>;
  create: (request: Request, input: unknown) => Promise<DTO>;
  update: (request: Request, id: string, expectedVersion: number, input: unknown) => Promise<DTO>;
  delete: (request: Request, id: string, expectedVersion: number) => Promise<void>;
};
export type ItemRouteContext = { params: Promise<{ id: string }> };
/** Cookie/session browser API. Strict configured Origin on writes; bearer/server integrations use their own routes. */
export function createCrudHandlers<DTO extends VersionedDTO>(service: CrudHttpService<DTO>, options: { origin: string }) {
  let origin: string;
  try {
    const url = new URL(options.origin);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid origin");
    origin = url.origin;
  } catch { throw new BackendError("INVALID_INPUT"); }
  const write = (request: Request, method: string) => {
    if (request.method !== method) throw new BackendError("INVALID_INPUT");
    if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") throw new AccessError("FORBIDDEN");
  };
  const expectedVersion = (request: Request) => {
    const match = request.headers.get("if-match");
    if (!match || !/^"[1-9][0-9]{0,15}"$/.test(match)) throw new BackendError("INVALID_INPUT");
    const value = Number(match.slice(1, -1));
    if (!Number.isSafeInteger(value)) throw new BackendError("INVALID_INPUT");
    return value;
  };
  const success = (dto: DTO, status: 200 | 201 = 200) => {
    if (!Number.isSafeInteger(dto.version) || dto.version < 1) throw new BackendError("UNAVAILABLE");
    const response = jsonSuccess(dto, { status }); response.headers.set("etag", `"${dto.version}"`); return response;
  };
  return {
    collection: {
      async GET(request: Request): Promise<Response> {
        try {
          const query = new URL(request.url).searchParams;
          if ([...query.keys()].some(key => !["page", "pageSize"].includes(key) || query.getAll(key).length !== 1)) throw new BackendError("INVALID_INPUT");
          const integer = (name: string, fallback: number) => {
            const value = query.get(name);
            if (value === null) return fallback;
            if (!/^[1-9][0-9]{0,15}$/.test(value)) throw new BackendError("INVALID_INPUT");
            return Number(value);
          };
          return jsonSuccess(await service.list(request, { page: integer("page", 1), pageSize: integer("pageSize", 20) }));
        } catch (error) { return jsonError(error); }
      },
      async POST(request: Request): Promise<Response> {
        try { write(request, "POST"); return success(await service.create(request, await readJson(request, value => value)), 201); }
        catch (error) { return jsonError(error); }
      },
    },
    item: {
      async DELETE(request: Request, context: ItemRouteContext): Promise<Response> {
        try {
          write(request, "DELETE"); const version = expectedVersion(request); const { id } = await context.params;
          await service.delete(request, id, version);
          return new Response(null, { status: 204, headers: { "cache-control": "private, no-store" } });
        } catch (error) { return jsonError(error); }
      },
      async PATCH(request: Request, context: ItemRouteContext): Promise<Response> {
        try {
          write(request, "PATCH");
          const version = expectedVersion(request);
          const { id } = await context.params;
          return success(await service.update(request, id, version, await readJson(request, value => value)));
        } catch (error) { return jsonError(error); }
      },
      async GET(request: Request, context: ItemRouteContext): Promise<Response> {
        try { const { id } = await context.params; return success(await service.get(request, id)); }
        catch (error) { return jsonError(error); }
      },
    },
  };
}
