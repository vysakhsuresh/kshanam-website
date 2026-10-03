#!/usr/bin/env python3
"""Renders the raster brand assets: the PWA icons and the social preview card.

Drawn with ImageMagick primitives rather than by rasterising favicon.svg,
because the SVG delegate is not reliably present and the geometry is simple
enough to state directly. The shapes match favicon.svg and the brand mark in
src/partials/header.html; change one and change all three.

Not part of build.py - these outputs are committed and only need regenerating
when the mark or the wording changes:

  python3 scripts/gen_brand.py      (needs ImageMagick on PATH)
"""
import os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

INK = "#0a0a0b"
INK_2 = "#15151a"
TEXT = "#f1ede6"
BRASS = "#c8a46b"

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# The mark in its own 32-unit space, as favicon.svg draws it.
HEX = [(16, 4.6), (25.8, 10.3), (25.8, 21.7), (16, 27.4), (6.2, 21.7), (6.2, 10.3)]


def mark_args(size, pad_ratio=0.655, stroke_scale=1.0):
    """ImageMagick -draw arguments placing the mark centred in a square."""
    f = size * pad_ratio / 32.0
    off = (size - 32 * f) / 2.0
    def pt(x, y):
        return "%.1f,%.1f" % (off + x * f, off + y * f)
    poly = " ".join(pt(x, y) for x, y in HEX)
    sw = max(1.0, 1.35 * f * stroke_scale)
    return [
        "-stroke", TEXT, "-strokewidth", "%.2f" % sw, "-fill", "none",
        "-draw", "circle %s %s" % (pt(16, 16), pt(16, 1.8)),
        "-draw", "polygon %s" % poly,
        "-stroke", "none", "-fill", BRASS,
        "-draw", "circle %s %s" % (pt(16, 16), pt(16, 13.2)),
    ]


def icon(path, size):
    cmd = ["convert", "-size", "%dx%d" % (size, size), "xc:" + INK]
    cmd += mark_args(size)
    cmd += [path]
    subprocess.run(cmd, check=True)
    return path


def og_image(path):
    w, h = 1200, 630
    cmd = [
        "convert",
        "-size", "%dx%d" % (w, h),
        "gradient:%s-%s" % (INK_2, INK),
    ]
    # the mark, top left of the text block
    f = 118.0 / 32.0
    ox, oy = 96.0, 150.0
    def pt(x, y):
        return "%.1f,%.1f" % (ox + x * f, oy + y * f)
    cmd += [
        "-stroke", TEXT, "-strokewidth", "4.6", "-fill", "none",
        "-draw", "circle %s %s" % (pt(16, 16), pt(16, 1.8)),
        "-draw", "polygon %s" % " ".join(pt(x, y) for x, y in HEX),
        "-stroke", "none", "-fill", BRASS,
        "-draw", "circle %s %s" % (pt(16, 16), pt(16, 13.2)),
    ]
    cmd += [
        "-font", SERIF, "-pointsize", "96", "-kerning", "16",
        "-fill", TEXT, "-annotate", "+250+300", "KSHANAM",
        "-font", SANS, "-pointsize", "31", "-kerning", "0",
        "-fill", "#a6a19a",
        "-annotate", "+254+356", "Photography and film for the moments that stay",
        "-fill", BRASS,
        "-draw", "rectangle 254,404 338,406",
        "-font", SANS, "-pointsize", "25", "-fill", "#7d7871",
        "-annotate", "+254+462", "Kochi, Kerala  ·  kshanam.in",
        path,
    ]
    subprocess.run(cmd, check=True)
    return path


def main():
    if not shutil.which("convert"):
        print("ImageMagick 'convert' not found on PATH; cannot render brand assets.",
              file=sys.stderr)
        return 1
    for f in (SERIF, SANS):
        if not os.path.exists(f):
            print("missing font: " + f, file=sys.stderr)
            return 1

    made = [icon("icon-512.png", 512), icon("icon-192.png", 192),
            icon("apple-touch-icon.png", 180), og_image("og-image.png")]
    for p in made:
        print("  %-22s %7d bytes" % (p, os.path.getsize(p)))
    print("Wrote %d brand assets." % len(made))
    return 0


if __name__ == "__main__":
    sys.exit(main())
