#!/usr/bin/env python3
"""Generates the placeholder plates referenced by src/data/work.json.

A photography site with broken image boxes is worse than no site, and stock
photographs would be someone else's work passed off as the studio's. So every
slot that has no photograph yet gets a plate instead: a duotone gradient with
film grain, a vignette and the brand mark at low opacity. They look like
deliberate art direction rather than a failed load, and they carry the exact
width and height the real photograph will have, so swapping one in cannot
shift the layout.

Output is deterministic - palette, grain seed and light position all come from
a CRC of the filename - so re-running this produces byte-identical files and
`git status` stays quiet.

  python3 scripts/gen_placeholders.py

Replacing a plate with a real photograph: drop the file into images/, point
that entry's src at it in src/data/work.json, correct w and h, rewrite the alt
text, then run `python3 build.py`.
"""
import json, os, sys, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

PLACEHOLDER_DIR = "images/placeholders"

# Cinematic duotones: a deep shadow, a mid tone, and a warm highlight that
# matches the brass in the brand mark.
PALETTES = [
    ("#0c1a19", "#1b3a34", "#c9a97e"),
    ("#140f1b", "#2e1f33", "#d09a5a"),
    ("#0b111f", "#1d2740", "#c98b86"),
    ("#141710", "#2b3021", "#cbc3a6"),
    ("#121108", "#2c2617", "#c8a46b"),
    ("#0f1220", "#222a44", "#d8a98a"),
    ("#0c160f", "#1d3222", "#c2a662"),
    ("#170d11", "#331c22", "#cf9f95"),
]

# Plates used directly by a page rather than listed in work.json.
EXTRA = [
    ("images/placeholders/hero.svg", 2400, 1350),
    ("images/placeholders/studio.svg", 1600, 1067),
    ("images/placeholders/journal-light.svg", 1600, 900),
]


def plate(name, w, h):
    seed = zlib.crc32(os.path.basename(name).encode()) & 0xFFFFFFF
    dark, mid, warm = PALETTES[seed % len(PALETTES)]
    # light position and size, nudged per file so a grid of plates never
    # reads as the same image repeated
    cx = 0.22 + ((seed >> 4) % 57) / 100.0
    cy = 0.14 + ((seed >> 11) % 48) / 100.0
    rx = 0.38 + ((seed >> 17) % 30) / 100.0
    angle = (seed >> 21) % 4
    x2, y2 = [("1", "1"), ("0", "1"), ("1", "0.35"), ("0.3", "1")][angle]
    grain_seed = seed % 97
    m = min(w, h) * 0.16          # brand mark size
    mx, my = (w - m) / 2.0, (h - m) / 2.0

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="{x2}" y2="{y2}">
      <stop offset="0" stop-color="{dark}"/>
      <stop offset="0.58" stop-color="{mid}"/>
      <stop offset="1" stop-color="{warm}"/>
    </linearGradient>
    <radialGradient id="l" cx="{cx:.3f}" cy="{cy:.3f}" r="{rx:.3f}">
      <stop offset="0" stop-color="#fff" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="v" cx="0.5" cy="0.44" r="0.76">
      <stop offset="0.42" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.46"/>
    </radialGradient>
    <filter id="n" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="{grain_seed}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#g)"/>
  <rect width="{w}" height="{h}" fill="url(#l)"/>
  <rect width="{w}" height="{h}" filter="url(#n)" opacity="0.16"/>
  <rect width="{w}" height="{h}" fill="url(#v)"/>
  <g transform="translate({mx:.1f} {my:.1f}) scale({m / 32.0:.4f})" opacity="0.17">
    <circle cx="16" cy="16" r="14.2" fill="none" stroke="#fff" stroke-width="1.1"/>
    <path d="M16 4.6 L25.8 10.3 L25.8 21.7 L16 27.4 L6.2 21.7 L6.2 10.3 Z" fill="none" stroke="#fff" stroke-width="1.1"/>
    <circle cx="16" cy="16" r="2.5" fill="#fff"/>
  </g>
</svg>
"""


def main():
    with open("src/data/work.json", encoding="utf-8") as f:
        work = json.load(f)

    wanted = [(im["src"], im["w"], im["h"]) for im in work["images"]
              if im["src"].startswith(PLACEHOLDER_DIR + "/")]
    wanted += EXTRA

    os.makedirs(PLACEHOLDER_DIR, exist_ok=True)
    written = 0
    for name, w, h in wanted:
        with open(name, "w", encoding="utf-8", newline="\n") as f:
            f.write(plate(name, w, h))
        written += 1

    # A plate nothing references any more is dead weight in the repo.
    keep = {os.path.basename(n) for n, _, _ in wanted}
    stale = sorted(f for f in os.listdir(PLACEHOLDER_DIR) if f not in keep)
    for f in stale:
        os.remove(os.path.join(PLACEHOLDER_DIR, f))

    print("Wrote %d placeholder plates%s."
          % (written, (", removed %d stale" % len(stale)) if stale else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
