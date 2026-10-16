import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://pub-d9ed63c9208840ee87c1595f4a1077de.r2.dev";
const manifestPath = resolve(root, "scripts/responsive-images.manifest.json");
const previous = JSON.parse(await readFile(manifestPath, "utf8").catch(error => {
  if (error.code === "ENOENT") return '{"sources":[]}';
  throw error;
}));
const cache = resolve(tmpdir(), "le-grande-responsive-image-sources");
await mkdir(cache, { recursive: true });
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const sources = [
  "images/le-grande-aerial-context.webp",
  "images/le-grande-aerial-close.webp",
  "images/home-v2/architecture-detail.jpg",
  "images/home-v2/facade-detail.jpg",
  "images/home-v2/upper-detail.jpg",
  "images/home-v2/introduction.webp",
  "images/home-v2/hero.webp",
  "images/home-v2/reasons-background.webp",
  "images/home-v2/floor-base.webp",
  "images/home-v2/floor-middle.webp",
  "images/home-v2/floor-roof.webp",
  "client-reference/canva/project-perspective.jpg",
  "client-reference/legacy/letter-background.jpg",
];
const manifest = { generator: "node scripts/generate-responsive-images.mjs", sharpVersion: sharp.versions.sharp, origin, sources: [], assets: [] };
const data = {};

for (const key of sources) {
  // Public approved originals are no longer checked into this app. Prefer a local
  // original when available; otherwise cache its exact published bytes outside it.
  const pinned = previous.sources.find(source => source.key === key);
  const cacheFile = resolve(cache, key.replaceAll("/", "__"));
  let input;
  for (const path of [resolve(root, "public", key), cacheFile]) {
    try { input = await readFile(path); break; } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (!input) {
    const response = await fetch(`${origin}/${key}`);
    if (!response.ok) throw new Error(`Cannot read approved source ${key}: HTTP ${response.status}`);
    input = Buffer.from(await response.arrayBuffer());
    await writeFile(cacheFile, input);
  }
  const sha256 = digest(input);
  if (pinned && pinned.sha256 !== sha256) throw new Error(`Approved source checksum changed: ${key}. Review provenance before regenerating.`);
  const metadata = await sharp(input).metadata();
  const { width, height } = metadata;
  if (!width || !height) throw new Error(`Missing dimensions: ${key}`);
  manifest.sources.push({ key, sha256, bytes: input.length, width, height });
  const stem = key.replace(/\.[^.]+$/, "");
  const variants = { width, height, previews: [], thumbnails: [] };
  const isLayer = key.includes("/floor-");

  async function generate(kind, widths, extract) {
    const maxWidth = kind === "thumbnail" ? Math.min(width, height) : extract?.width ?? width;
    const uniqueWidths = [...new Set(widths.map(value => Math.min(value, maxWidth)))].sort((a, b) => a - b);
    const rows = [];
    for (const target of uniqueWidths) {
      let image = sharp(input).rotate();
      if (extract) image = image.extract(extract);
      image = kind === "thumbnail"
        ? image.resize(target, target, { fit: "cover", position: "centre", withoutEnlargement: true })
        : image.resize({ width: target, withoutEnlargement: true });
      const bytes = await image.webp({ quality: isLayer ? 90 : kind === "thumbnail" ? 80 : 84, alphaQuality: 100, effort: 6 }).toBuffer();
      const output = await sharp(bytes).metadata();
      const sha256 = digest(bytes);
      const assetKey = `images/responsive/${stem}-${kind}-${target}-${sha256.slice(0, 16)}.webp`;
      const localPath = `public/${assetKey}`;
      await mkdir(dirname(resolve(root, localPath)), { recursive: true });
      await writeFile(resolve(root, localPath), bytes);
      manifest.assets.push({ source: key, key: assetKey, path: localPath, kind, width: output.width, height: output.height, bytes: bytes.length, sha256, ...(extract ? { extract } : {}) });
      rows.push({ path: `/${assetKey}`, width: output.width, height: output.height });
    }
    return rows;
  }

  variants.previews = await generate("preview", isLayer ? [480, 768, 1080, 1440] : [160, 320, 480, 768, 1080, 1440, 1920, width]);
  if (!isLayer && !key.includes("background")) variants.thumbnails = await generate("thumbnail", [64, 128, 192, 256]);
  if (key === "images/home-v2/hero.webp") {
    // Exact existing mobile cover geometry: at <=720px the hero is >=690px tall,
    // object-position:62% center. A crop at the widest mobile aspect ratio retains
    // every pixel that narrower viewports can expose, without shipping hidden sides.
    const cropWidth = Math.min(width, Math.round(height * 720 / 690));
    const extract = { left: Math.round((width - cropWidth) * .62), top: 0, width: cropWidth, height };
    variants.mobileHero = await generate("mobile-hero", [480, 720, cropWidth], extract);
  }
  data[`/${key}`] = variants;
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
await writeFile(resolve(root, "src/features/public/responsive-image-data.json"), JSON.stringify(data, null, 2) + "\n");
// Only remove obsolete outputs recorded by the previous generation, never originals
// or a generated file changed independently since that manifest was written.
const currentKeys = new Set(manifest.assets.map(asset => asset.key));
for (const asset of previous.assets ?? []) {
  if (currentKeys.has(asset.key)) continue;
  if (!asset.key.startsWith("images/responsive/") || asset.key.includes("..") || asset.path !== `public/${asset.key}`) {
    throw new Error(`Refusing to remove an output outside the derivative namespace: ${asset.key}`);
  }
  const path = resolve(root, asset.path);
  const bytes = await readFile(path).catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!bytes) continue;
  if (digest(bytes) !== asset.sha256) throw new Error(`Obsolete generated file changed independently; preserving ${asset.path}`);
  await unlink(path);
}
console.log(`Generated ${manifest.assets.length} responsive images from ${manifest.sources.length} approved sources; manifest: scripts/responsive-images.manifest.json`);
