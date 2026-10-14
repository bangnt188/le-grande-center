import "server-only";
import type { PhotonImage } from "@cf-wasm/photon";
import { fileType, imageDimensions, MAX_BATCH_BYTES, MAX_FILE_BYTES, MAX_FILES, MediaError } from "./validation";
import { sha256 } from "./neon-origin";
export type PreparedMedia = { name: string; bytes: Uint8Array<ArrayBuffer>; mime: string; sha256: string; provider: "neon" | "r2"; scan: "clean" | "pending" | "rejected" };
export async function prepareFiles(files: File[]): Promise<PreparedMedia[]> {
  if (!files.length || files.length > MAX_FILES) throw new MediaError("Mỗi lần tải từ 1 đến 4 tệp, tổng tối đa 20 MiB.",413);
  const prepared: PreparedMedia[] = [];
  let total = 0;
  for (const file of files) {
    if (!file.size || file.size > MAX_FILE_BYTES || !file.name.trim() || file.name.length > 160 || /[\x00-\x1f\x7f]/.test(file.name)) throw new MediaError("Tệp phải có tên hợp lệ, không rỗng và tối đa 10 MiB.",413);
    let bytes = new Uint8Array(await file.arrayBuffer());
    const mime = fileType(bytes,file.type);
    if (mime !== "application/pdf") {
      const dimensions = imageDimensions(bytes,mime);
      let image: PhotonImage | undefined;
      try {
        // Platform WASM entrypoints are intentionally lazy: Workers cannot compile inline bytes; Node cannot import a .wasm module.
        const photon = "WebSocketPair" in globalThis ? await import("@cf-wasm/photon/workerd") : await import("@cf-wasm/photon/node");
        image = photon.PhotonImage.new_from_byteslice(bytes);
        if (image.get_width() !== dimensions.width || image.get_height() !== dimensions.height) throw new Error("Image dimensions differ");
        // Re-encode decoded pixels, discarding embedded metadata and trailing/polyglot payloads.
        bytes = new Uint8Array(mime === "image/png" ? image.get_bytes() : mime === "image/jpeg" ? image.get_bytes_jpeg(90) : image.get_bytes_webp());
      } catch { throw new MediaError("Không giải mã được ảnh. Chỉ nhận PNG/JPEG/WebP hợp lệ."); }
      finally { image?.free(); }
    }
    total += bytes.length;
    if (bytes.length > MAX_FILE_BYTES || total > MAX_BATCH_BYTES) throw new MediaError("Ảnh sau xử lý vượt giới hạn dung lượng.",413);
    const digest = await sha256(bytes);
    prepared.push({ name:file.name.trim(),bytes,mime,sha256:digest,provider:mime === "application/pdf" ? "r2" : "neon",scan:mime === "application/pdf" ? "pending" : "clean" });
  }
  return prepared;
}
