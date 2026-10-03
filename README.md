# Festa — free invitation video maker

A website where a family makes an invitation video for any celebration and
sends it on WhatsApp. Weddings, birthdays, naming days, housewarmings,
graduations, festivals — DESIGN_COUNT designs across CATEGORY_COUNT kinds of occasion.

Everything happens in the browser. No server, no database, no account. The
photos and names somebody types never leave their device.

The brief is in [CLAUDE.md](./CLAUDE.md), with the decisions taken since it
was written recorded at the bottom. The repository is still named
`kshanam-website`; the product is called Festa.

---

## The promises, and where they live in the code

| Promise | Where |
| --- | --- |
| Free forever | There is no payment code in the repository at all |
| No sign-up | No auth, no cookies, no user records |
| No watermark, no end card | Nothing is drawn over the invitation, and the "made free on" card was removed outright |
| Nothing is uploaded | `app/src/engine/worker.js` renders on the device; the only requests are the page, its fonts, and ads on browsing pages |
| Ads on browsing pages only | `.ad-slot` exists on the home page. `studio.html` has none, and a test asserts it |

---

## Running it

```sh
npm install
npm run dev            # http://127.0.0.1:5173
npm run build          # static files into dist/
npm run build:pages    # the GitHub Pages preview, into docs/
npm run fonts          # re-download and self-host the typefaces
npm run designs        # regenerate the design library from its specs

npm test               # every suite below, in order
npm run test:templates # the design format
npm run test:render    # make a real MP4, check it with ffprobe
npm run test:screens   # drive the site at phone, tablet and laptop widths
npm run test:built     # drive the built bundle from a sub-path
```

The browser suites need `npx playwright install chromium`; the render suite
also needs `ffprobe` and `ffmpeg`.

---

## How it is put together

```
app/
  index.html      home: categories, gallery, hero
  studio.html     the editor: play, storyboard, fields, photo, music, export
  help.html       help, privacy, why it is free, support
  guest.html      landing for someone sent an invitation
  src/
    engine/       the renderer — one engine, many designs
      render.js     timeline, scenes, frame drawing
      draw.js       the layer types a design can use
      ornaments.js  35 motifs, 11 frames, 8 textures, all drawn as paths
      text.js       fitting and wrapping, so long names still look right
      anim.js       entrance/exit animations and continuous motion
      fonts.js      loads only the faces a design actually uses
      music.js      nine synthesised beds
      encode.js     WebCodecs -> MP4, with codec detection
      worker.js     all of the above, off the main thread
    templates/    one JSON file per design, plus fieldsets and categories
    ui/           the screens
  public/fonts/   self-hosted woff2 and the OFL licence for each family
scripts/
  gen-templates.mjs  the layout recipes and the quality gates
  design-specs.json  the library itself: one compact spec per design
  fetch-fonts.mjs    downloads and self-hosts the typefaces
  build-pages.mjs    builds docs/ for the GitHub Pages preview
```

### Adding a design

Two ways, both supported:

1. **By hand.** Drop a JSON file in `app/src/templates/`. It is picked up
   automatically — the catalogue globs the folder — and `npm run test:templates`
   checks it against the format and against the taste rules below.
2. **From a spec.** Add an entry to `scripts/design-specs.json` (palette,
   typefaces, ornaments, one of eight layout recipes, and its own sample copy)
   and run `npm run designs`. This is how the current library was made, and it
   is why they look like one family rather than DESIGN_COUNT arguments.

### The eight recipes

| Recipe | What it is |
| --- | --- |
| `classic` | A centred column inside a hairline frame. The formal default. |
| `arch` | A hairline arch over the content. Churches, mandapams, doorways. |
| `banner` | Woven kasavu bands top and bottom. Kerala weddings. |
| `modern` | Left rail, large type, one short bar. Letterheads. |
| `masthead` | No frame; one enormous name across the full measure and two thirds of the sheet empty. |
| `panel` | A sheet floating on a slightly deeper ground — a card on a table. |
| `band` | One deep band through the middle with the type reversed out of it. |
| `photoLed` | The photograph is the design, text in the lower third over a gradient scrim. |

### What "ultra premium" means here, as rules a machine can check

A style guide nobody reads is worth less than a gate that fails the build.
Both `scripts/gen-templates.mjs` and `npm run test:templates` enforce these,
the second against the committed JSON, because designs are meant to be
editable by hand:

- `ink`, `muted` and `accentDark` each clear **4.5:1** against the ground —
  and against the worse end of a gradient, not the end that flatters it.
- No pure white and no pure black in any palette. Grounds are oyster, bone,
  ivory, shell, smoke — off by a few degrees, with `paper` or `linen` over
  them, because flat colour reads as an empty div.
- **No scatter.** Confetti, dots, stars and rays are banned outright: scatter
  is what a design does instead of having a composition.
- **Foil is a hairline.** Metal lands on 1px rules and 1.3px motif strokes,
  never inside a letterform and never across a filled bar. Real foil is a flat
  ink that catches light at its edge; a gradient through a glyph is WordArt.
- Two ornamental marks per slide, three type sizes, one line of capitals, and
  capitals always tracked.
- Motifs between 10 and 72px, stroked no heavier than 1.6.
- 40px gutters, so the live measure is 280px and about 55% of every frame
  carries no mark. Blocks sit at y=302, not 320 — a truly centred block reads
  as sunken in a tall portrait frame.
- Every design writes its **own sample copy**, no two designs show the same
  names, and a closing may not end in a full stop or an exclamation mark.
- Every design states its **idea** in one sentence. If the idea cannot be said
  in a sentence there is no idea, only arrangement.
- On `photoLed`, the text colour and the accent are checked against the photo
  scrim rather than against a background no viewer ever sees.

Either way the renderer is untouched. That is the rule the format exists to
protect.

### Fields, and why switching design keeps your typing

A design names a *fieldset* — `couple`, `person` or `event` — and supplies its
own defaults. The editor renders whatever the fieldset declares, so it knows
nothing about any individual design, and the values carry across when somebody
changes their mind about the look.

### The video pipeline

Design JSON → canvas frames → `VideoEncoder` → MP4 muxer → `Blob` → Web Share
or download. 720x1280, 30 fps, about 31 seconds. Codecs are chosen by
capability, H.264 + AAC first because that is what WhatsApp wants, then
VP9/AV1/VP8 and Opus. `MediaRecorder` is deliberately unused.

---

## What is not done

- **The H.264 encode has never run on a real phone.** CI's Chromium ships
  without proprietary codecs, so the tests exercise the VP9/Opus fallback. The
  codec *selection* is tested; the encode itself needs a real Android.
- Photo slots exist on every design but only one per design is used so far.
- No design ships Malayalam sample copy. Typed Malayalam shapes correctly on
  every design through the script font stack, and a test proves it by drawing
  Malayalam into a design built around a Latin serif — but the words the site
  itself puts on a design are English, because a translation written without a
  native speaker is worse than none.
- "Same function, more invites" — the reception invite and the status picture
  — is not built.
- SEO occasion pages, the sitemap and Open Graph images are not built.
- No `ffmpeg.wasm` fallback for browsers without WebCodecs.

## Waiting on the owner

In `app/src/config.js`, all empty on purpose, because a guessed value ships as
if it were right:

- `SITE_DOMAIN` — still the placeholder.
- `SUPPORT_URL` — the "buy us a coffee" button stays hidden until this is set.
- `FEEDBACK_EMAIL` — the help page says plainly that feedback is not switched
  on yet. The brief says to ask before adding a third-party form service, so
  none has been added.
- `ADSENSE_CLIENT` — no ad code loads at all while this is empty.

---

## Looking at it on a phone

A built copy lives in `docs/` so GitHub Pages can serve it with no CI.
Settings -> Pages -> branch `claude/gifted-bardeen-fnv928`, folder `/docs`,
then it appears at **https://vysakhsuresh.github.io/kshanam-website/**.

Refresh it with `npm run build:pages` and commit `docs/`. Everything in there
is build output; never edit it by hand.

## Deploying properly

Cloudflare Pages, free plan. Build command `npm run build`, output `dist`,
Node 20+. Well inside the 20,000 file and 25 MiB limits. Nothing here needs an
environment variable or a secret.
