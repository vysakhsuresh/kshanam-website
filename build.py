#!/usr/bin/env python3
"""Kshanam static site build.

Composes every page in the repo from src/partials/ (head boilerplate, header,
footer) and src/pages/<slug>.* (per-page metadata, optional bespoke JSON-LD,
optional page-specific CSS, and body content with {{COMPONENT}} placeholders),
writing the result to the page's normal path (index.html, journal/*.html, ...) -
the exact paths GitHub Pages serves.

Three things are deliberately derived rather than repeated per page, because
every one of them drifted in hand-maintained sites: the canonical/OG URL and
the relative asset prefix come from the page's own output path, and the
visible FAQ accordion and its FAQPage schema are rendered from the same
`faq` list. Edit a question once and both change.

Usage:
  python3 build.py            build all pages, write them in place
  python3 build.py --check    build in memory and diff against what's
                               committed; exits non-zero if anything differs
                               (CI uses this to catch hand-edited output that
                               was never regenerated from its source)
"""
import re, glob, os, sys, json, html

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

CHECK = "--check" in sys.argv

# ---------------------------------------------------------------------------
# Site configuration - the handful of values that belong in exactly one place.
# ---------------------------------------------------------------------------

# Absolute origin used for canonical links, OG URLs, JSON-LD and the sitemap.
# No CNAME file is committed yet, so GitHub Pages serves this repo at
# vysakhsuresh.github.io/kshanam-website/ - every in-page link and asset is
# written relative to the page (see PREFIX below) so the site works there and
# on the custom domain without a rebuild. Only these absolute URLs care about
# the origin: point this at the real domain and add a CNAME on the same commit.
SITE_ORIGIN = "https://kshanam.in"

# GA4 measurement ID for the Kshanam web data stream, e.g. "G-ABC1234567".
# An empty string omits the analytics snippet entirely, so every page builds
# byte-for-byte as it does without it - which is why this can sit in the repo
# before the Analytics property exists. Filling it in is the only edit needed
# to instrument all pages at once.
#
# IMPORTANT: privacy.html describes what this site collects, and it promises
# the policy is updated *before* a collection change ships. Changing or
# clearing this ID therefore means editing that page in the same commit, or
# the published disclosure becomes false.
GA_MEASUREMENT_ID = ""

# Where the enquiry form POSTs. Empty means the form falls back to opening the
# visitor's mail client with the enquiry pre-filled (see js/shared.js), which
# works on a static host with no account anywhere. Set this to a form endpoint
# (Formspree, Basin, Netlify Forms, a Worker) to receive enquiries server-side.
FORM_ENDPOINT = ""

# Shown in the footer copyright. A literal rather than date.today().year, so
# `build.py --check` cannot start failing on New Year's Day.
FOOTER_YEAR = "2026"

STUDIO = {
    "name": "Kshanam",
    "legal_name": "Kshanam Studio",
    "tagline": "Photography and film for the moments that stay.",
    "email": "hello@kshanam.in",
    # Blank on purpose. An invented phone number or street address would be
    # published as though it were real, so every component that renders these
    # omits its markup while the value is empty. Fill them in and the footer,
    # contact page and LocalBusiness schema all pick them up at once.
    "phone": "",
    "street": "",
    "postal": "",
    "city": "Kochi",
    "region": "Kerala",
    "country": "IN",
    "instagram": "",
}

# Primary navigation, in order. The `nav_active` key in a page's metadata
# matches the second field and marks that item as the current page.
NAV = [
    ("Work", "work", "work.html"),
    ("Services", "services", "services.html"),
    ("Journal", "journal", "journal.html"),
    ("Studio", "about", "about.html"),
]

with open("src/data/work.json", encoding="utf-8") as f:
    WORK = json.load(f)
with open("src/data/testimonials.json", encoding="utf-8") as f:
    TESTIMONIALS = json.load(f)
with open("src/data/packages.json", encoding="utf-8") as f:
    PACKAGES = json.load(f)

IMAGES_BY_SRC = {im["src"]: im for im in WORK["images"]}
COLLECTIONS_BY_SLUG = {c["slug"]: c for c in WORK["collections"]}

with open("src/partials/head.html", encoding="utf-8") as f:
    HEAD_TMPL = f.read()
with open("src/partials/header.html", encoding="utf-8") as f:
    HEADER_TMPL = f.read()
with open("src/partials/footer.html", encoding="utf-8") as f:
    FOOTER_TMPL = f.read()

ANALYTICS_TAG = ((
    "  <!-- Google tag (gtag.js) -->\n"
    '  <script async src="https://www.googletagmanager.com/gtag/js?id=%s"></script>\n'
    "  <script>\n"
    "    window.dataLayer = window.dataLayer || [];\n"
    "    function gtag(){dataLayer.push(arguments);}\n"
    "    gtag('js', new Date());\n"
    "    gtag('config', '%s');\n"
    "  </script>\n"
) % (GA_MEASUREMENT_ID, GA_MEASUREMENT_ID)) if GA_MEASUREMENT_ID else ""


def render(tmpl, **vals):
    out = tmpl
    for k, v in vals.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def esc(s):
    return html.escape(s, quote=True)


def strip_tags(s):
    """Plain text for a schema field whose visible counterpart carries markup."""
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def page_url(rel):
    """Absolute canonical URL for an output path."""
    return SITE_ORIGIN + "/" + ("" if rel == "index.html" else rel)


def page_prefix(rel):
    """Relative path from a page back to the site root ('' or '../')."""
    depth = rel.count("/")
    return "../" * depth


# ---------------------------------------------------------------------------
# Components. Each returns an HTML fragment and may use {{PREFIX}}, which is
# resolved in one final pass after every component has run.
# ---------------------------------------------------------------------------

def parse_args(raw):
    """'featured limit=6' -> (['featured'], {'limit': '6'})"""
    pos, kw = [], {}
    for tok in (raw or "").split():
        if "=" in tok:
            k, v = tok.split("=", 1)
            kw[k] = v
        else:
            pos.append(tok)
    return pos, kw


def orient(im):
    ratio = im["w"] / im["h"]
    if ratio > 1.25:
        return "wide"
    if ratio < 0.85:
        return "tall"
    return "square"


def img_tag(im, eager=False, sizes="(max-width: 700px) 100vw, 50vw"):
    loading = ' loading="eager" fetchpriority="high"' if eager else ' loading="lazy"'
    return (
        '<img src="{{PREFIX}}' + im["src"] + '" alt="' + esc(im["alt"]) + '"'
        ' width="' + str(im["w"]) + '" height="' + str(im["h"]) + '"'
        ' sizes="' + sizes + '"' + loading + ' decoding="async" />'
    )


def select_images(collection):
    if collection == "featured":
        return [im for im in WORK["images"] if im.get("featured")]
    if collection == "all":
        return list(WORK["images"])
    return [im for im in WORK["images"] if im["collection"] == collection]


def render_gallery(pos, kw):
    collection = pos[0] if pos else "all"
    imgs = select_images(collection)
    limit = int(kw["limit"]) if "limit" in kw else None
    if limit:
        imgs = imgs[:limit]
    if not imgs:
        raise SystemExit("GALLERY: no images for collection %r" % collection)

    out = []
    if kw.get("filters") == "yes":
        used = [c for c in WORK["collections"] if select_images(c["slug"])]
        out.append('    <div class="gallery-filters" role="group" aria-label="Filter work by collection">')
        out.append('      <button type="button" class="filter is-active" data-filter="all"'
                   ' aria-pressed="true">Everything</button>')
        for c in used:
            out.append('      <button type="button" class="filter" data-filter="' + c["slug"] + '"'
                       ' aria-pressed="false">' + esc(c["title"]) + '</button>')
        out.append('    </div>')

    out.append('    <div class="gallery" id="gallery">')
    for i, im in enumerate(imgs):
        caption = im.get("caption", "")
        out.append('      <figure class="shot is-' + orient(im) + '" data-collection="' + im["collection"] + '">')
        out.append('        <a class="shot-link" href="{{PREFIX}}' + im["src"] + '"'
                   ' data-caption="' + esc(caption or im["alt"]) + '">')
        out.append('          ' + img_tag(im, eager=(i == 0 and kw.get("eager") == "yes")))
        out.append('          <span class="shot-zoom" aria-hidden="true"></span>')
        out.append('        </a>')
        if caption:
            out.append('        <figcaption>' + esc(caption) + '</figcaption>')
        out.append('      </figure>')
    out.append('    </div>')
    return "\n".join(out)


def render_collection_cards(pos, kw):
    out = ['    <div class="collection-cards">']
    for c in WORK["collections"]:
        imgs = select_images(c["slug"])
        if not imgs:
            continue
        cover = IMAGES_BY_SRC[c["cover"]] if c.get("cover") in IMAGES_BY_SRC else imgs[0]
        out.append('      <a class="collection-card" href="{{PREFIX}}work.html#' + c["slug"] + '">')
        out.append('        <div class="collection-card-media">' + img_tag(cover, sizes="(max-width: 700px) 100vw, 33vw") + '</div>')
        out.append('        <div class="collection-card-text">')
        out.append('          <h3>' + esc(c["title"]) + '</h3>')
        out.append('          <p>' + esc(c["blurb"]) + '</p>')
        out.append('          <span class="link-arrow">See the work</span>')
        out.append('        </div>')
        out.append('      </a>')
    out.append('    </div>')
    return "\n".join(out)


def render_testimonials(pos, kw):
    """The whole section, heading included - or nothing at all.

    src/data/testimonials.json ships empty because the studio has no invented
    quotes to show. Rendering the wrapper here rather than in the page body
    means an empty file leaves no hollow section behind: the page simply does
    not have that band until there is a real quote to put in it.
    """
    items = TESTIMONIALS["items"]
    limit = int(kw["limit"]) if "limit" in kw else None
    if limit:
        items = items[:limit]
    if not items:
        return "  <!-- testimonials: add entries to src/data/testimonials.json -->"
    heading = kw.get("heading", "In their words").replace("_", " ")
    out = ['  <section class="section section-testimonials" aria-labelledby="testimonials-h">']
    out.append('    <h2 class="section-title" id="testimonials-h">' + esc(heading) + '</h2>')
    out.append('    <div class="testimonials">')
    for t in items:
        out.append('      <figure class="testimonial">')
        out.append('        <blockquote><p>' + esc(t["quote"]) + '</p></blockquote>')
        out.append('        <figcaption>' + esc(t["name"])
                   + '<span>' + esc(t["context"]) + '</span></figcaption>')
        out.append('      </figure>')
    out.append('    </div>')
    out.append('  </section>')
    return "\n".join(out)


def render_packages(pos, kw):
    out = ['    <div class="packages">']
    for p in PACKAGES["items"]:
        featured = ' is-featured' if p.get("featured") else ''
        out.append('      <article class="package' + featured + '">')
        if p.get("featured"):
            out.append('        <p class="package-flag">Most booked</p>')
        out.append('        <h3>' + esc(p["name"]) + '</h3>')
        out.append('        <p class="package-summary">' + esc(p["summary"]) + '</p>')
        out.append('        <p class="package-price">' + esc(p["price"]) + '</p>')
        out.append('        <ul class="package-includes">')
        for inc in p["includes"]:
            out.append('          <li>' + esc(inc) + '</li>')
        out.append('        </ul>')
        out.append('        <a class="btn btn-quiet" href="{{PREFIX}}contact.html?package='
                   + p["slug"] + '">Enquire about ' + esc(p["name"]) + '</a>')
        out.append('      </article>')
    out.append('    </div>')
    return "\n".join(out)


def render_faq(pos, kw, faq=None):
    if not faq:
        raise SystemExit("FAQ: page metadata has no 'faq' list")
    out = ['    <div class="faq">']
    for i, item in enumerate(faq):
        out.append('      <div class="faq-item">')
        out.append('        <button type="button" class="faq-question" id="faq-q' + str(i) + '"'
                   ' aria-expanded="false" aria-controls="faq-a' + str(i) + '">')
        out.append('          <span>' + esc(item["q"]) + '</span>')
        out.append('        </button>')
        out.append('        <div class="faq-answer" id="faq-a' + str(i) + '" role="region"'
                   ' aria-labelledby="faq-q' + str(i) + '">')
        out.append('          <div class="faq-answer-inner">' + item["a"] + '</div>')
        out.append('        </div>')
        out.append('      </div>')
    out.append('    </div>')
    return "\n".join(out)


def journal_entries():
    """Every page carrying an `article` block, newest first.

    Derived from the page metadata itself rather than a separate index file,
    so a published article cannot be missing from the journal listing.
    """
    entries = []
    for meta_file in glob.glob("src/pages/*.json"):
        with open(meta_file, encoding="utf-8") as f:
            data = json.load(f)
        if "article" in data:
            entries.append(data)
    entries.sort(key=lambda d: d["article"]["date"], reverse=True)
    return entries


def render_journal_cards(pos, kw):
    entries = journal_entries()
    exclude = kw.get("exclude")
    if exclude:
        entries = [e for e in entries if e["file"] != exclude]
    limit = int(kw["limit"]) if "limit" in kw else None
    if limit:
        entries = entries[:limit]
    out = ['    <div class="journal-cards">']
    for e in entries:
        a = e["article"]
        out.append('      <article class="journal-card">')
        out.append('        <a href="{{PREFIX}}' + e["file"] + '">')
        out.append('          <p class="journal-meta"><time datetime="' + a["date"] + '">'
                   + esc(a["date_label"]) + '</time><span>' + esc(a["read_time"]) + '</span></p>')
        out.append('          <h3>' + esc(a["headline"]) + '</h3>')
        out.append('          <p class="journal-standfirst">' + esc(a["standfirst"]) + '</p>')
        out.append('          <span class="link-arrow">Read it</span>')
        out.append('        </a>')
        out.append('      </article>')
    out.append('    </div>')
    return "\n".join(out)


def render_contact_form(pos, kw):
    action = ' action="' + FORM_ENDPOINT + '" method="post"' if FORM_ENDPOINT else ''
    fallback = '' if FORM_ENDPOINT else ' data-mailto="' + STUDIO["email"] + '"'
    occasions = ["Wedding", "Pre-wedding or engagement", "Portrait sitting",
                 "Film or motion", "Editorial or brand", "Something else"]
    out = []
    out.append('    <form class="enquiry" id="enquiry"' + action + fallback + ' novalidate>')
    out.append('      <div class="field">')
    out.append('        <label for="name">Your name</label>')
    out.append('        <input id="name" name="name" type="text" autocomplete="name" required />')
    out.append('        <p class="field-error" data-for="name"></p>')
    out.append('      </div>')
    out.append('      <div class="field">')
    out.append('        <label for="email">Email</label>')
    out.append('        <input id="email" name="email" type="email" autocomplete="email" required />')
    out.append('        <p class="field-error" data-for="email"></p>')
    out.append('      </div>')
    out.append('      <div class="field">')
    out.append('        <label for="occasion">What is the occasion</label>')
    out.append('        <select id="occasion" name="occasion">')
    for o in occasions:
        out.append('          <option>' + esc(o) + '</option>')
    out.append('        </select>')
    out.append('      </div>')
    out.append('      <div class="field">')
    out.append('        <label for="dates">Date or rough window</label>')
    out.append('        <input id="dates" name="dates" type="text" placeholder="12 February 2027, or &quot;late spring&quot;" />')
    out.append('      </div>')
    out.append('      <div class="field">')
    out.append('        <label for="place">Where</label>')
    out.append('        <input id="place" name="place" type="text" placeholder="Venue, city, or still deciding" />')
    out.append('      </div>')
    out.append('      <div class="field field-wide">')
    out.append('        <label for="message">Tell us about the day</label>')
    out.append('        <textarea id="message" name="message" rows="6" required'
               ' placeholder="Who is there, what matters most to you, anything you are worried about."></textarea>')
    out.append('        <p class="field-error" data-for="message"></p>')
    out.append('      </div>')
    out.append('      <div class="field field-wide form-actions">')
    out.append('        <button type="submit" class="btn btn-solid">Send the enquiry</button>')
    out.append('        <p class="form-note">We reply to every enquiry within two working days.</p>')
    out.append('      </div>')
    out.append('      <p class="form-status" role="status" aria-live="polite"></p>')
    out.append('    </form>')
    return "\n".join(out)


def render_studio_contact(pos, kw):
    out = ['    <ul class="studio-contact">']
    out.append('      <li><span>Email</span><a href="mailto:' + STUDIO["email"] + '">'
               + STUDIO["email"] + '</a></li>')
    if STUDIO["phone"]:
        tel = re.sub(r"[^\d+]", "", STUDIO["phone"])
        out.append('      <li><span>Phone</span><a href="tel:' + tel + '">' + esc(STUDIO["phone"]) + '</a></li>')
    where = ", ".join(p for p in [STUDIO["street"], STUDIO["city"], STUDIO["region"]] if p)
    out.append('      <li><span>Based in</span>' + esc(where) + '</li>')
    out.append('      <li><span>Travelling</span>All of India, and anywhere you are getting married</li>')
    out.append('    </ul>')
    return "\n".join(out)


COMPONENTS = {
    "GALLERY": render_gallery,
    "COLLECTION_CARDS": render_collection_cards,
    "TESTIMONIALS": render_testimonials,
    "PACKAGES": render_packages,
    "JOURNAL_CARDS": render_journal_cards,
    "CONTACT_FORM": render_contact_form,
    "STUDIO_CONTACT": render_studio_contact,
}

SIMPLE = {
    "STUDIO_NAME": lambda: STUDIO["name"],
    "STUDIO_EMAIL": lambda: STUDIO["email"],
    "STUDIO_TAGLINE": lambda: STUDIO["tagline"],
    "STUDIO_CITY": lambda: STUDIO["city"],
    "STUDIO_REGION": lambda: STUDIO["region"],
    "FOOTER_YEAR": lambda: FOOTER_YEAR,
}


def expand_components(text, faq):
    """Replace every {{NAME args}} placeholder with its rendered fragment.

    Leading indentation before a placeholder on its own line is dropped: the
    fragments carry their own indentation, so keeping the marker's would
    double it.
    """
    pattern = re.compile(r"[ \t]*\{\{([A-Z_]+)(?:[ \t]+([^}\n]*))?\}\}")

    def sub(m):
        name, raw = m.group(1), m.group(2)
        if name in SIMPLE:
            return SIMPLE[name]()
        if name == "FAQ":
            return render_faq(*parse_args(raw), faq=faq)
        if name in COMPONENTS:
            pos, kw = parse_args(raw)
            return COMPONENTS[name](pos, kw)
        return m.group(0)

    return pattern.sub(sub, text)


# ---------------------------------------------------------------------------
# Structured data. Generated from the page's own metadata so the schema and
# the visible page cannot disagree.
# ---------------------------------------------------------------------------

def ld(obj):
    return ('  <script type="application/ld+json">\n  '
            + json.dumps(obj, indent=2, ensure_ascii=False).replace("\n", "\n  ")
            + "\n  </script>\n")


def studio_schema():
    addr = {"@type": "PostalAddress", "addressLocality": STUDIO["city"],
            "addressRegion": STUDIO["region"], "addressCountry": STUDIO["country"]}
    if STUDIO["street"]:
        addr["streetAddress"] = STUDIO["street"]
    if STUDIO["postal"]:
        addr["postalCode"] = STUDIO["postal"]
    obj = {
        "@context": "https://schema.org",
        "@type": "ProfessionalService",
        "@id": SITE_ORIGIN + "/#studio",
        "name": STUDIO["name"],
        "legalName": STUDIO["legal_name"],
        "description": STUDIO["tagline"],
        "url": SITE_ORIGIN + "/",
        "email": STUDIO["email"],
        "image": SITE_ORIGIN + "/og-image.png",
        "logo": SITE_ORIGIN + "/icon-512.png",
        "address": addr,
        "areaServed": {"@type": "Country", "name": "India"},
        "knowsLanguage": ["en", "ml"],
        "serviceType": ["Wedding photography", "Portrait photography",
                        "Wedding film", "Editorial photography"],
    }
    if STUDIO["phone"]:
        obj["telephone"] = STUDIO["phone"]
    if STUDIO["instagram"]:
        obj["sameAs"] = [STUDIO["instagram"]]
    return obj


def website_schema():
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": SITE_ORIGIN + "/#website",
        "name": STUDIO["name"],
        "url": SITE_ORIGIN + "/",
        "publisher": {"@id": SITE_ORIGIN + "/#studio"},
        "inLanguage": "en",
    }


def breadcrumb_schema(crumbs, rel):
    items = [{"@type": "ListItem", "position": i, "name": name,
              "item": SITE_ORIGIN + "/" + ("" if href == "index.html" else href)}
             for i, (name, href) in enumerate(crumbs, start=1)]
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": items}


def faq_schema(faq):
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": item["q"],
             "acceptedAnswer": {"@type": "Answer", "text": strip_tags(item["a"])}}
            for item in faq
        ],
    }


def gallery_schema(collection, rel, title):
    imgs = select_images(collection)
    return {
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        "name": title,
        "url": page_url(rel),
        "isPartOf": {"@id": SITE_ORIGIN + "/#website"},
        "associatedMedia": [
            {"@type": "ImageObject",
             "contentUrl": SITE_ORIGIN + "/" + im["src"],
             "name": im.get("caption") or im["alt"],
             "description": im["alt"],
             "width": im["w"], "height": im["h"],
             "creator": {"@id": SITE_ORIGIN + "/#studio"},
             "creditText": STUDIO["name"],
             "copyrightNotice": STUDIO["legal_name"]}
            for im in imgs
        ],
    }


def prose_word_count(body):
    """Words inside the article's .prose block.

    Counted from the body at build time so the figure in the schema cannot
    drift away from the article after an edit.
    """
    m = re.search(r'<div class="prose">(.*?)\n        </div>', body, re.S)
    text = strip_tags(m.group(1)) if m else ""
    return len([w for w in text.split() if any(c.isalnum() for c in w)])


def article_schema(a, rel, description, body):
    words = prose_word_count(body)
    obj = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": a["headline"],
        "description": description,
        "datePublished": a["date"],
        "dateModified": a.get("modified", a["date"]),
        "url": page_url(rel),
        "mainEntityOfPage": {"@type": "WebPage", "@id": page_url(rel)},
        "author": {"@type": "Organization", "name": STUDIO["name"],
                   "url": SITE_ORIGIN + "/"},
        "publisher": {"@id": SITE_ORIGIN + "/#studio"},
        "inLanguage": "en",
        "image": SITE_ORIGIN + "/og-image.png",
    }
    if words:
        obj["wordCount"] = words
    return obj


def build_jsonld(data, rel, body):
    blocks = []
    if data.get("schema_studio"):
        blocks.append(website_schema())
        blocks.append(studio_schema())
    if data.get("breadcrumb"):
        blocks.append(breadcrumb_schema(data["breadcrumb"], rel))
    if data.get("gallery_schema"):
        blocks.append(gallery_schema(data["gallery_schema"], rel, data["title"]))
    if data.get("faq"):
        blocks.append(faq_schema(data["faq"]))
    if data.get("article"):
        blocks.append(article_schema(data["article"], rel, data["description"], body))
    out = "".join(ld(b) for b in blocks)

    bespoke = "src/pages/" + rel.replace("/", "-").replace(".html", "") + ".jsonld.html"
    if os.path.exists(bespoke):
        with open(bespoke, encoding="utf-8") as f:
            extra = f.read().strip()
        if extra:
            out += "  " + extra + "\n"
    return out


# ---------------------------------------------------------------------------

def build_page(meta_file):
    with open(meta_file, encoding="utf-8") as f:
        data = json.load(f)

    base = meta_file[:-len(".json")]
    rel = data["file"]
    prefix = page_prefix(rel)

    with open(base + ".body.html", encoding="utf-8") as f:
        body = f.read()
    style = ""
    if os.path.exists(base + ".style.css"):
        with open(base + ".style.css", encoding="utf-8") as f:
            style = f.read()

    SERP_DIRECTIVES = "max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    robots_value = (data["robots"] + ", " + SERP_DIRECTIVES
                    if data.get("robots") else SERP_DIRECTIVES)
    noindex = "noindex" in (data.get("robots") or "")
    canonical_tag = ("" if noindex
                     else '  <link rel="canonical" href="' + page_url(rel) + '" />\n')

    og_image = SITE_ORIGIN + "/" + data.get("og_image", "og-image.png")
    head = render(
        HEAD_TMPL,
        DESCRIPTION=esc(data["description"]),
        TITLE=esc(data["title"]),
        ANALYTICS_TAG=ANALYTICS_TAG,
        CANONICAL_TAG=canonical_tag,
        ROBOTS_TAG='  <meta name="robots" content="' + robots_value + '" />\n',
        OG_TYPE="article" if data.get("article") else "website",
        OG_URL=page_url(rel),
        OG_IMAGE=og_image,
        OG_IMAGE_ALT=esc(data.get("og_image_alt", STUDIO["name"] + " - " + STUDIO["tagline"])),
        SITE_NAME=STUDIO["name"],
        JSONLD=build_jsonld(data, rel, body),
        PREFIX=prefix,
        PAGE_STYLE=style,
        EXTRA_HEAD=data.get("extra_head", ""),
    )

    nav = []
    for label, key, href in NAV:
        current = ' aria-current="page"' if data.get("nav_active") == key else ''
        cls = ' class="is-current"' if data.get("nav_active") == key else ''
        nav.append('        <li><a href="{{PREFIX}}' + href + '"' + cls + current + '>'
                   + label + '</a></li>')
    header = render(HEADER_TMPL, NAV_LINKS="\n".join(nav))
    footer = render(FOOTER_TMPL, NAV_LINKS="\n".join(nav))

    body = expand_components(body, data.get("faq"))
    body = body.replace("{{HEADER}}", header.strip("\n")).replace("{{FOOTER}}", footer.strip("\n"))
    body = expand_components(body, data.get("faq"))

    page = head + body.rstrip("\n") + "\n</body>\n</html>\n"
    page = page.replace("{{PREFIX}}", prefix)

    leftover = sorted(set(re.findall(r"\{\{[A-Z_]+", page)))
    if leftover:
        raise SystemExit("%s: unresolved placeholder(s): %s" % (rel, ", ".join(leftover)))
    return page, rel


def main():
    meta_files = sorted(glob.glob("src/pages/*.json"))
    if not meta_files:
        raise SystemExit("no pages found in src/pages/")
    mismatches, written = [], 0

    for mf in meta_files:
        page, target = build_page(mf)
        out_bytes = page.encode("utf-8")
        parent = os.path.dirname(target)
        if CHECK:
            current = b""
            if os.path.exists(target):
                with open(target, "rb") as f:
                    current = f.read()
            if current != out_bytes:
                mismatches.append(target)
        else:
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(target, "wb") as f:
                f.write(out_bytes)
            written += 1

    if CHECK:
        if mismatches:
            print("BUILD CHECK FAILED: %d file(s) differ from their generated output:"
                  % len(mismatches))
            for m in mismatches:
                print("  " + m)
            print("\nRun `python3 build.py` and commit the result.")
            sys.exit(1)
        print("Build check OK: all %d pages match their generated output." % len(meta_files))
    else:
        print("Wrote %d pages." % written)


if __name__ == "__main__":
    main()
