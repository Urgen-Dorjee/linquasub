"""
generate-icon.py
Generates a professional ICO icon for the LinguaSub desktop application.

The icon features:
  - A rounded-square background with a blue/indigo gradient (#4F46E5 -> #7C3AED)
  - A bold, clean white letter "L" centered on the background
  - Multiple sizes bundled into a single .ico file
"""

import io
import os
import math
import struct
from PIL import Image, ImageDraw, ImageFont


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "resources",
    "icon.ico",
)
SIZES = [16, 32, 48, 64, 128, 256]
RENDER_SIZE = 512  # High-res canvas; we downsample for each target size

# Gradient colours
COLOR_TOP_LEFT = (79, 70, 229)       # #4F46E5  (indigo-600)
COLOR_BOTTOM_RIGHT = (124, 58, 237)  # #7C3AED  (violet-600)

LETTER_COLOR = (255, 255, 255)       # white
CORNER_RADIUS_RATIO = 0.22           # proportion of size used for corner radius


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _lerp_color(c1, c2, t):
    """Linearly interpolate between two RGB tuples."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def make_gradient(size, c1, c2):
    """Create a diagonal linear gradient image (top-left -> bottom-right)."""
    img = Image.new("RGB", (size, size))
    pixels = img.load()
    diag = math.sqrt(2)
    for y in range(size):
        for x in range(size):
            t = ((x / size) + (y / size)) / diag
            t = max(0.0, min(1.0, t))
            pixels[x, y] = _lerp_color(c1, c2, t)
    return img


def rounded_rect_mask(size, radius):
    """Return an L-mode mask with a rounded rectangle."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=radius,
        fill=255,
    )
    return mask


def pick_font(target_pixel_height):
    """
    Try to load a bold sans-serif system font.
    """
    candidates = [
        "arialbd.ttf",
        "segoeui.ttf",
        "calibrib.ttf",
        "verdanab.ttf",
    ]
    for name in candidates:
        try:
            font = ImageFont.truetype(name, size=target_pixel_height)
            return font
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def render_icon(canvas_size):
    """Render the icon at *canvas_size* and return an RGBA Image."""
    radius = int(canvas_size * CORNER_RADIUS_RATIO)

    # 1. Gradient background
    gradient = make_gradient(canvas_size, COLOR_TOP_LEFT, COLOR_BOTTOM_RIGHT)

    # 2. Apply rounded-rectangle mask
    mask = rounded_rect_mask(canvas_size, radius)
    bg = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    bg.paste(gradient, mask=mask)

    # 3. Draw the letter "L"
    draw = ImageDraw.Draw(bg)
    font_height = int(canvas_size * 0.55)
    font = pick_font(font_height)

    bbox = draw.textbbox((0, 0), "L", font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    x = (canvas_size - text_w) / 2 - bbox[0]
    y = (canvas_size - text_h) / 2 - bbox[1] - canvas_size * 0.02

    draw.text((x, y), "L", fill=LETTER_COLOR, font=font)

    return bg


def build_ico_manually(frames, output_path):
    """
    Build an ICO file by hand from a list of RGBA PIL Images.

    ICO format:
      - 6-byte header: reserved(2), type(2)=1, count(2)
      - N x 16-byte directory entries
      - N x PNG blobs (one per size)
    """
    num = len(frames)
    header = struct.pack("<HHH", 0, 1, num)

    png_blobs = []
    for frame in frames:
        buf = io.BytesIO()
        frame.save(buf, format="PNG")
        png_blobs.append(buf.getvalue())

    # Offset to first image data = header(6) + entries(16 * num)
    data_offset = 6 + 16 * num

    directory = b""
    current_offset = data_offset
    for i, frame in enumerate(frames):
        w = frame.width if frame.width < 256 else 0
        h = frame.height if frame.height < 256 else 0
        blob_size = len(png_blobs[i])
        # ICONDIRENTRY: width(1) height(1) palette(1) reserved(1)
        #               planes(2) bpp(2) size(4) offset(4)
        entry = struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, blob_size, current_offset)
        directory += entry
        current_offset += blob_size

    with open(output_path, "wb") as f:
        f.write(header)
        f.write(directory)
        for blob in png_blobs:
            f.write(blob)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Rendering master icon at {RENDER_SIZE}x{RENDER_SIZE} ...")
    master = render_icon(RENDER_SIZE)

    frames = []
    for s in SIZES:
        resized = master.resize((s, s), Image.LANCZOS)
        frames.append(resized)
        print(f"  -> {s}x{s}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    build_ico_manually(frames, OUTPUT_PATH)

    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"\nIcon saved to: {OUTPUT_PATH}")
    print(f"File size:     {file_size:,} bytes ({file_size / 1024:.1f} KB)")
    print(f"Embedded sizes: {', '.join(f'{s}x{s}' for s in SIZES)}")


if __name__ == "__main__":
    main()
