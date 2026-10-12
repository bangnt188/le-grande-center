import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const formats = { ".png": ["Ảnh", "image/png"], ".jpg": ["Ảnh", "image/jpeg"], ".jpeg": ["Ảnh", "image/jpeg"], ".webp": ["Ảnh", "image/webp"], ".gif": ["Ảnh", "image/gif"], ".avif": ["Ảnh", "image/avif"], ".svg": ["Ảnh", "image/svg+xml"], ".pdf": ["Tài liệu", "application/pdf"], ".mp4": ["Video", "video/mp4"], ".webm": ["Video", "video/webm"], ".glb": ["Model 3D", "model/gltf-binary"], ".gltf": ["Model 3D", "model/gltf+json"], ".hdr": ["Tài nguyên", "image/vnd.radiance"] };
const files = await readdir(resolve(root, "public"), { recursive: true, withFileTypes: true });
const rows = [];
for (const file of files) {
  if (!file.isFile()) continue;
  const format = formats[extname(file.name).toLowerCase()];
  if (!format) continue;
  const absolute = resolve(file.parentPath, file.name);
  const path = absolute.slice(resolve(root, "public").length).replaceAll("\\", "/");
  rows.push({ path, name: file.name, kind: format[0], mimeType: format[1], sizeBytes: (await stat(absolute)).size });
}
rows.sort((a, b) => a.path.localeCompare(b.path, "en"));
const output = resolve(root, "src/features/admin/demo/project-media.json");
const content = JSON.stringify(rows, null, 2) + "\n";
if (await readFile(output, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; }) !== content) await writeFile(output, content);
console.log("Admin media catalog: " + rows.length + " local assets");
