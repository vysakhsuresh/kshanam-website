# Kshanam — photography & film studio

The website for Kshanam, a photography and film studio in Kochi, Kerala.
Static HTML, no framework, no build toolchain beyond Python 3 and a browser
for the tests. Served by GitHub Pages.

Live pages are generated and committed, so what GitHub Pages serves is exactly
what is in the repository — but they are generated, and editing them by hand is
a mistake CI will catch.

---

## Working on it

```sh
python3 build.py                  # regenerate every page from src/
python3 build.py --check          # fail if a committed page is out of date
python3 scripts/validate.py       # HTML, JSON-LD, SEO, images, link graph
python3 scripts/test_pages.py     # drive every page in headless Chromium
python3 scripts/gen_sitemap.py    # rebuild sitemap.xml (run when pages change)
python3 -m http.server 8000       # look at it
```

The browser tests need `pip install playwright && python -m playwright install chromium`.
Add `--shots` to `test_pages.py` to write full-page screenshots into `screenshots/`.

CI runs the first four on every push and pull request.

### How a page is put together

Each page is four files in `src/pages/`, named after the page:

| File | Required | What it holds |
| --- | --- | --- |
| `<name>.json` | yes | Title, description, output path, breadcrumbs, structured-data switches |
| `<name>.body.html` | yes | The page body, with `{{COMPONENT}}` placeholders |
| `<name>.style.css` | no | CSS only this page needs, inlined into its `<head>` |
| `<name>.jsonld.html` | no | Hand-written JSON-LD, on top of what is generated |

`build.py` composes those with `src/partials/` and writes the result to the
path in `"file"`. Three things are derived rather than repeated, because each
one drifted in the site this was modelled on:

- **The canonical and OG URL** come from the output path plus `SITE_ORIGIN`.
- **The relative asset prefix** comes from the output path's depth, so a page
  in `journal/` gets `../` without being told.
- **The FAQ** is written once in `"faq"` and renders as both the visible
  accordion and the `FAQPage` schema. They cannot disagree.

An unresolved `{{PLACEHOLDER}}` fails the build rather than shipping as
literal text.

### Components available in a body

| Placeholder | Renders |
| --- | --- |
| `{{HEADER}}` `{{FOOTER}}` | Site chrome |
| `{{GALLERY <collection> [limit=N] [filters=yes] [eager=yes]}}` | A masonry gallery. Collection is a slug, `featured`, or `all` |
| `{{COLLECTION_CARDS}}` | The four collection cards |
| `{{PACKAGES}}` | Booking options from `src/data/packages.json` |
| `{{FAQ}}` | The accordion, from this page's `"faq"` |
| `{{JOURNAL_CARDS [limit=N] [exclude=<path>]}}` | Article cards, newest first |
| `{{TESTIMONIALS}}` | The whole band, or nothing if there are no quotes |
| `{{CONTACT_FORM}}` `{{STUDIO_CONTACT}}` | Enquiry form and contact details |
| `{{STUDIO_NAME}}` `{{STUDIO_EMAIL}}` `{{STUDIO_CITY}}` … | Studio values from `build.py` |

Journal cards are built by scanning every page metadata file for an
`"article"` block, so a published article cannot be missing from the listing.

---

## Everything configurable, and where

All of it is at the top of `build.py`:

| Setting | Currently | Notes |
| --- | --- | --- |
| `SITE_ORIGIN` | `https://kshanam.in` | Canonical/OG/sitemap URLs. See *Domain* below |
| `GA_MEASUREMENT_ID` | empty | Empty means no analytics snippet at all. **Update `privacy.html` in the same commit if you set it** |
| `FORM_ENDPOINT` | empty | Empty means the enquiry form opens the visitor's mail client. See *The enquiry form* |
| `STUDIO` | — | Name, email, phone, address, Instagram. Blank fields render nothing rather than a placeholder |
| `NAV` | — | Primary navigation, used by the header and the footer |

---

## Before this goes live

The site is complete and correct, but it was built before the real
photographs, the real numbers and the real client quotes existed. These are
the things to settle, roughly in order of how visible they are.

### 1. Replace the placeholder plates

Every image is currently a generated gradient plate, not a photograph. They
look deliberate rather than broken, and they carry the exact dimensions the
real photograph will have, so swapping one in shifts nothing.

For each photograph: drop the file into `images/`, then in
`src/data/work.json` point that entry's `src` at it, correct `w` and `h`, and
**rewrite the `alt` text**. The alt text is currently written for the
photograph that belongs in that slot, which means it describes an image that
is not there yet — fine while the site is unpublished, misleading to a screen
reader user once it is live.

Then `python3 scripts/gen_placeholders.py` (clears plates nothing references)
and `python3 build.py`.

### 2. Check the claims the copy makes

The writing commits the studio to specific things. They are all plausible for
a studio of this kind and they are all editable, but they are claims, and they
should be true before anyone reads them:

| Claim | Where |
| --- | --- |
| Reply to every enquiry within two working days | homepage, contact, services, about |
| ~400 photographs for one day, ~900 for a full wedding | `src/data/packages.json`, services FAQ |
| Previews in 4 days, full gallery in 3 weeks, films in 8 weeks | services FAQ |
| No travel charge within Kerala; travel billed at cost elsewhere | services |
| Files kept for five years; two backups on the night | services, privacy |
| A replacement photographer arranged at our cost if we cannot attend | services FAQ |
| Based in Kochi; the people you speak to are the people who attend | about, footer |
| Print and personal-use rights granted in writing | throughout |

The last one matters most: the booking contract has to actually say it.

### 3. Fill in what is deliberately blank

- **Phone and street address** — blank in `STUDIO`. Nothing renders while they
  are empty, rather than showing an invented number. Fill them and the footer,
  the contact page and the `LocalBusiness` schema all pick them up.
- **Instagram** — blank. Set it and it joins the schema's `sameAs`.
- **Testimonials** — `src/data/testimonials.json` ships with an empty list, so
  the band does not render. Add real quotes and it appears on the homepage and
  the studio page. Do not invent any: fabricated reviews are both a lie to the
  reader and something Google treats as spam.
- **Prices** — `src/data/packages.json` says "On request" throughout. Replace
  with real numbers whenever you are happy to publish them.

### 4. Domain

No `CNAME` file is committed, so Pages currently serves this at
`vysakhsuresh.github.io/kshanam-website/`. Every internal link and asset is
relative, so the site works there *and* on a custom domain with no changes.

When the domain is ready: add a `CNAME` file containing the bare hostname,
set `SITE_ORIGIN` in `build.py` to match, update the `Sitemap:` line in
`robots.txt`, then `python3 build.py && python3 scripts/gen_sitemap.py`.

### 5. The enquiry form

With `FORM_ENDPOINT` empty, submitting the form assembles the enquiry and
opens the visitor's own mail client. That works on a static host with no
account anywhere, and nothing is silently dropped — but it is a worse
experience on a phone, and you never see an enquiry the visitor abandons.

Setting `FORM_ENDPOINT` to a form service (Formspree, Basin, a Cloudflare
Worker) makes the form POST there instead; the JavaScript steps aside
automatically. **That is a change in data collection, so `privacy.html` has to
be updated in the same commit** — it currently states that nothing is posted
to a server.

Also make sure `hello@kshanam.in` exists. It is in the footer, the contact
page, the privacy policy and the structured data.

---

## Adding things later

**A photograph** — drop it in `images/`, add an entry to `src/data/work.json`
with `collection`, `w`, `h`, `alt`, an optional `caption`, and
`"featured": true` if it should appear on the homepage. Run `build.py`.

**A journal article** — copy an existing `src/pages/journal-*.json` and
`.body.html` pair. Give it a `"file"` under `journal/`, an `"article"` block
(headline, standfirst, `date`, `date_label`, `read_time`) and the
`extra_head` line that loads `css/article.css`. It appears in the journal
listing and the homepage teasers automatically; `wordCount` in the schema is
counted from the prose at build time. Run `build.py` then
`scripts/gen_sitemap.py`.

**A package** — add an entry to `src/data/packages.json`. The
`contact.html?package=<slug>` link preselects the right occasion on the
enquiry form; add the slug to the map in `js/shared.js` if it needs a
different one.

---

## Why it is built this way

Three things were worth the extra machinery:

1. **Generated pages with a `--check` in CI.** The alternative is thirteen
   hand-maintained copies of the same `<head>`, which stay consistent for
   about a month.
2. **One source of truth per fact.** The FAQ, the gallery, the journal index
   and the word counts are each written once and rendered everywhere they
   appear, including into structured data.
3. **Tests that drive a real browser.** Static checks cannot tell you the
   lightbox will not close or that the filter hides everything. 110 checks run
   on every push, including that nothing stays invisible when the reveal
   observer runs and that a phone viewport has no horizontal overflow.

The site has no framework, no runtime dependencies and no build step a visitor
pays for. The only JavaScript is `js/shared.js`, and every page is readable
with it blocked: the reveal animations, the FAQ collapse and the mobile menu
are all gated behind a `.js` class that is only set when scripts run.
