import imageData from "./responsive-image-data.json";

type ImageVariant = { path: string; width: number; height: number };
type ResponsiveImage = {
  width: number;
  height: number;
  previews: readonly ImageVariant[];
  thumbnails: readonly ImageVariant[];
  mobileHero?: readonly ImageVariant[];
};
const images: Readonly<Record<string, ResponsiveImage>> = imageData;
const url = (assetBase: string, path: string) => assetBase.replace(/\/$/, "") + path;
const srcSet = (variants: readonly ImageVariant[], assetBase: string) => variants.map(image => `${url(assetBase, image.path)} ${image.width}w`).join(", ");

/** Static derivatives only. Unregistered small sources retain their published URL. */
export function responsiveImageProps(path: string, assetBase: string, sizes: string, fallbackWidth = 1080) {
  const image = images[path];
  if (!image) return { src: url(assetBase, path) };
  return {
    src: url(assetBase, (image.previews.find(variant => variant.width >= fallbackWidth) ?? image.previews[image.previews.length - 1]).path),
    srcSet: srcSet(image.previews, assetBase),
    sizes,
    width: image.width,
    height: image.height,
  };
}

/** Square derivatives preserve the centre cover crop of project gallery controls. */
export function projectThumbnailProps(path: string, assetBase: string, sizes: string) {
  const variants = images[path]?.thumbnails;
  if (!variants?.length) return { src: url(assetBase, path) };
  return {
    src: url(assetBase, (variants.find(variant => variant.width >= 192) ?? variants[variants.length - 1]).path),
    srcSet: srcSet(variants, assetBase),
    sizes,
    width: 192,
    height: 192,
  };
}

/** Shared ImagePreview keeps full originals for zoom, but never for its small rail. */
export function projectLightboxImage(path: string, assetBase: string, alt: string) {
  return { src: url(assetBase, path), alt, thumbnailSrc: projectThumbnailProps(path, assetBase, "64px").src };
}

export const LEASING_GALLERY_SIZES = "(max-width: 760px) calc(119vw - 86px), (max-width: 1320px) 60vw, 800px";

/** Keep the existing 62%-positioned mobile crop and full desktop composition. */
export function homepageHeroSources(assetBase: string) {
  const path = "/images/home-v2/hero.webp";
  const image = images[path];
  return {
    mobile: { media: "(max-width: 720px)", srcSet: srcSet(image.mobileHero!, assetBase), sizes: "max(100vw, 720px)" },
    desktop: responsiveImageProps(path, assetBase, "max(100vw, 1510px)"),
  };
}
