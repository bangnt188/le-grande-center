"""Prepare the two remaining WebP gallery assets for static builds.

The other two WebP photos are already versioned in public/images.
Original hero is versioned in assets/source-images; third DJI photo is in Drive.
"""
from pathlib import Path
from PIL import Image, ImageOps
import io
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
target = root / "public" / "images"
target.mkdir(parents=True, exist_ok=True)

hero_src = root / "assets" / "source-images" / "le-grande-hero-drive.png"
hero_out = target / "le-grande-hero-drive.webp"
third_out = target / "le-grande-aerial-third.webp"

def optimize(source, output, quality=78, max_edge=2400):
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        scale = min(1, max_edge / max(image.size))
        if scale < 1:
            image = image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
        image.save(output, "WEBP", quality=quality, method=6)
        print(f"{output.name}: {output.stat().st_size} bytes")

if not hero_out.exists():
    optimize(hero_src, hero_out)

if not third_out.exists():
    try:
        import gdown
    except ImportError as exc:
        raise SystemExit("Install gdown and Pillow or copy le-grande-aerial-third.webp to public/images.") from exc
    from tempfile import TemporaryDirectory
    with TemporaryDirectory() as temp:
        original = Path(temp) / "drone.jpg"
        downloaded = gdown.download(id="17hGy3euZz90ZwRy4vO6DoOYwO2EzmaSX", output=str(original), quiet=False)
        if not downloaded or not original.exists():
            raise SystemExit("Could not download third photo from shared Google Drive.")
        optimize(original, third_out)
for output in [hero_out,third_out]:
    if not output.is_file() or output.stat().st_size == 0:
        raise SystemExit(f"Missing gallery asset: {output}")
