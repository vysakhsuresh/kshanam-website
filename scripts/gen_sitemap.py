#!/usr/bin/env python3
"""Regenerates sitemap.xml from the pages build.py actually produces.

The page list comes from src/pages/*.json rather than from a hand-kept list,
so a new page cannot be forgotten. Pages carrying a noindex directive (404)
are excluded.

Deliberately not part of build.py: lastmod uses today's date, which would
make `build.py --check` fail the day after a build. Run it when pages change:

  python3 scripts/gen_sitemap.py
"""
import glob, json, os, sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

# The origin lives in build.py so there is exactly one place to change it.
import build  # noqa: E402

BASE = build.SITE_ORIGIN.rstrip("/") + "/"

RULES = [
    ("index.html",    "1.0", "monthly"),
    ("work.html",     "0.9", "monthly"),
    ("services.html", "0.9", "monthly"),
    ("journal.html",  "0.8", "monthly"),
    ("journal/",      "0.7", "yearly"),
    ("about.html",    "0.7", "yearly"),
    ("contact.html",  "0.8", "yearly"),
    ("privacy.html",  "0.3", "yearly"),
    ("terms.html",    "0.3", "yearly"),
]


def classify(rel):
    for prefix, prio, freq in RULES:
        if rel == prefix or (prefix.endswith("/") and rel.startswith(prefix)):
            return prio, freq
    return "0.5", "monthly"


def main():
    entries = []
    for meta_file in sorted(glob.glob("src/pages/*.json")):
        with open(meta_file, encoding="utf-8") as f:
            data = json.load(f)
        if "noindex" in (data.get("robots") or "").lower():
            continue
        rel = data["file"]
        prio, freq = classify(rel)
        entries.append((BASE if rel == "index.html" else BASE + rel, prio, freq, rel))

    order = {r[0]: i for i, r in enumerate(RULES)}
    entries.sort(key=lambda e: (order.get(e[3], 50 if not e[3].startswith("journal/") else
                                order.get("journal/", 50)), e[3]))

    today = date.today().isoformat()
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
           '']
    for loc, prio, freq, _ in entries:
        out += ["  <url>",
                "    <loc>%s</loc>" % loc,
                "    <lastmod>%s</lastmod>" % today,
                "    <changefreq>%s</changefreq>" % freq,
                "    <priority>%s</priority>" % prio,
                "  </url>"]
    out += ['', '</urlset>', '']

    with open("sitemap.xml", "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out))

    print("sitemap.xml: %d URLs, lastmod %s" % (len(entries), today))
    return 0


if __name__ == "__main__":
    sys.exit(main())
