#!/usr/bin/env python3
"""生成 PWA 图标：与 public/icons/icon.svg 同一套几何。

用法：python3 scripts/make_icons.py
需要：pillow
"""

from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

TOP = (20, 184, 166)  # #14b8a6
BOTTOM = (15, 118, 110)  # #0f766e
PULSE = [
    (96, 272),
    (176, 272),
    (208, 208),
    (256, 320),
    (296, 240),
    (336, 272),
    (416, 272),
]


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (1, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        draw.point(
            (0, y),
            fill=tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)),
        )
    return img.resize((size, size), Image.Resampling.NEAREST)


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius, fill=255)
    return mask


def build(size: int, *, scale: float, corner: Optional[int]) -> Image.Image:
    """scale=1.0 用原图坐标（512 画布）；maskable 需要缩小主体留出安全区。"""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg = gradient(size)
    if corner is None:
        canvas.paste(bg, (0, 0))
    else:
        canvas.paste(bg, (0, 0), rounded_mask(size, round(corner * size / 512)))

    stroke = max(round(28 * size / 512 * scale), 2)
    pts = [((x - 256) * scale + size / 2, (y - 256) * scale + size / 2) for x, y in PULSE]
    line = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(line).line(pts, fill=(255, 255, 255, 255), width=stroke, joint="curve")
    for point in pts:  # 圆角端点
        x, y = point
        ImageDraw.Draw(line).ellipse(
            (x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2),
            fill=(255, 255, 255, 255),
        )
    canvas.alpha_composite(line)
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    targets = [
        ("icon-192.png", 192, 1.0, 112),
        ("icon-512.png", 512, 1.0, 112),
        ("apple-touch-icon.png", 180, 1.0, 0),  # iOS 自己加圆角，这里不切
        ("icon-maskable-512.png", 512, 0.62, None),  # 安全区 80%：主体缩到 62%
    ]
    for name, size, scale, corner in targets:
        build(size, scale=scale, corner=corner).save(OUT / name)
        print(f"wrote {OUT / name}")


if __name__ == "__main__":
    main()
