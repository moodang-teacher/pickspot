"""Create small WebP previews for exhibition cards without changing originals."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "works"
DESTINATION = ROOT / "assets" / "work-thumbs"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}
MAX_SIZE = (720, 1024)


def main() -> None:
    count = 0
    before = after = 0
    for source in SOURCE.rglob("*"):
        if not source.is_file() or source.is_symlink() or source.suffix.lower() not in EXTENSIONS:
            continue
        destination = DESTINATION / source.relative_to(SOURCE).parent / f"{source.name}.thumb.webp"
        if destination.exists() and destination.stat().st_mtime >= source.stat().st_mtime:
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            preview = ImageOps.exif_transpose(image)
            preview.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
            if preview.mode not in ("RGB", "RGBA"):
                preview = preview.convert("RGB")
            preview.save(destination, "WEBP", quality=78, method=6)
        count += 1
        before += source.stat().st_size
        after += destination.stat().st_size
    print(f"Created {count} thumbnails ({before / 1048576:.1f} MB → {after / 1048576:.1f} MB).")


if __name__ == "__main__":
    main()
