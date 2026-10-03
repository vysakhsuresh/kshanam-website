# Kshanam — free invitation video maker

A free website where families make an invitation video for a wedding or any
other function, then send it on WhatsApp. "Kshanam" (ക്ഷണം) means invitation
in Malayalam.

Everything happens in the browser. There is no server, no database and no
account. The photos and names a family types never leave their phone.

The full brief is in [CLAUDE.md](./CLAUDE.md); it is the source of truth for
what this is and what it must never do.

---

## The promises, and where they are kept in the code

| Promise | Where it lives |
| --- | --- |
| Free forever, no payment anywhere | There is no payment code in the repo at all |
| No sign-up, no account | No auth, no cookies, no user records |
| No watermark | Nothing is drawn over the invite; the end card is a separate, optional 2 seconds |
| Nothing is uploaded | `app/src/engine/worker.js` renders on the device. The only network requests are for the page, the fonts and (on gallery pages) ads |
| Ads on gallery pages only | `.ad-slot` exists on the home page only. `app/details.html` has none, and the rendering and ready views have none |
| The end card is optional and explained | A labelled switch on the details screen, on by default, with a line saying why |

---

## Running it

```sh
npm install
npm run dev          # http://127.0.0.1:5173
npm run build        # static files into dist/
npm run preview      # serve the built dist/
npm run fonts        # re-download and self-host the web fonts
node tests/render-mp4.mjs   # render a real MP4 and check it with ffprobe
```

The render test needs `ffprobe` and `ffmpeg` on the PATH.

---

## How it is put together

```
app/
  index.html          home: language toggle, occasion chips, design gallery
  details.html        form -> progress -> ready, all one page
  guest.html          landing for guests arriving from an invite's end card
  dev-render.html     test harness, not part of the site
  src/
    engine/           the renderer. One engine, many designs
      render.js       timeline, scene selection, frame drawing
      draw.js         the layer types a template can use
      text.js         fitting and wrapping, so long names still look right
      anim.js         animation presets
      icons.js        our own artwork, drawn as canvas paths
      fonts.js        loads the self-hosted faces before any frame is drawn
      music.js        the built-in tone bed, synthesised rather than licensed
      encode.js       WebCodecs -> MP4, with codec detection and fallbacks
      worker.js       runs all of the above off the main thread
    templates/        one JSON file per design
    ui/               the screens
  public/fonts/       self-hosted woff2 + the OFL licence for each family
```

### Adding a design is adding a file

A design is data. `app/src/templates/kasavu-gold.json` is the worked example:
a palette, a font mapping, text slots, a persistent background, and a list of
scenes whose layers each have a position, a size and an animation. Adding one
means writing a JSON file and listing it in `app/src/templates/index.js`.
Nothing in `engine/` changes. That is the rule that makes "numerous designs"
possible.

Layer types available today: `rect`, `border`, `line`, `icon`, `text`, `photo`.
Animation presets are in `anim.js`. Colours are written as `"@gold"` and
resolved from the template's palette; text is written as `"{{name1}}"` and
filled from the visitor's details, or as `{ "en": "...", "ml": "..." }` to
switch with the invite language.

A layer can also set `"modes": ["en"]` to appear only in certain invite
languages, which is how a design moves its title up when there is no second
line underneath it.

### The video pipeline

Template JSON → canvas frames → `VideoEncoder` → MP4 muxer → `Blob` → Web Share
or download. 720×1280, 30 fps, about 31 seconds.

Codecs are chosen by capability, most wanted first: **H.264 + AAC**, because
that is what WhatsApp handles best, then VP9, AV1, VP8 and Opus. If the
browser cannot encode at all, the visitor is told plainly instead of being
left with a progress bar that never finishes. `MediaRecorder` is deliberately
not used, because it tends to produce WebM.

---

## State of play

**Working end to end:** the renderer engine, the Kasavu Gold design, the
export to MP4 (verified with ffprobe), self-hosted fonts with correct
Malayalam shaping, the home, details and guest screens, the live preview,
device-local storage of what was typed, and Web Share to WhatsApp with a
download fallback.

**Not built yet**, roughly in the order the brief asks for them:

1. The other three mocked-up designs — Nilavilakku, Lily and Bells, Crescent
   Gold. They are listed in the gallery and clearly marked "Coming next" so
   nobody taps into an editor that cannot render them.
2. Designs for the other occasions: housewarming, baptism, naming ceremony,
   first birthday, birthday, anniversary, retirement.
3. "Same function, more invites" on the ready screen — the reception invite
   and the WhatsApp status picture.
4. The SEO occasion pages, the sitemap and the Open Graph images.
5. An `ffmpeg.wasm` path for browsers with no WebCodecs at all.

---

## Decisions waiting on the owner

These are in `app/src/config.js`, empty on purpose, because a guessed value
ships as if it were correct:

- **`SITE_DOMAIN`** — the end card prints `[YOUR DOMAIN]` until this is set.
- **`FEEDBACK_EMAIL`** — "Something's wrong" says feedback is not switched on
  yet until there is an address. The brief says to ask before adding any
  third-party form service, so nothing has been added.
- **`ADSENSE_CLIENT`** — no ad code is loaded at all while this is empty.

Two more things need a person, not a setting:

- **The Malayalam copy needs a native speaker.** Every string in
  `app/src/ui/i18n.js` and the Malayalam lines inside the template JSON were
  written carefully but have not been checked by anyone who speaks it. Please
  have someone read them before the site is announced.
- **The music.** The built-in "Soft tones" is synthesised from scratch in
  `music.js`, so there is nothing to licence. If you want real recorded
  tracks, they must be royalty-free with a licence that covers use inside
  videos people download, and the licence file goes in the repo next to the
  track.

---

## Testing

`node tests/render-mp4.mjs` is the test that matters. It starts the dev
server, drives the real worker pipeline in a real browser, writes
`tests/output/kasavu-gold.mp4`, and then checks the file with `ffprobe`:
container, dimensions, duration, frame count, audio stream, and that the moov
atom sits at the front so the video starts playing before it has fully
downloaded. It also writes still frames, the title scene in all three invite
languages, and a deliberately long-named couple, so a layout regression is
visible rather than theoretical.

It verifies the fonts by measurement rather than by asking the browser: a
canvas silently falls back to a system font, and on a machine that happens to
have a Malayalam font installed, broken font loading looks perfectly fine.

**One thing a container cannot do:** confirm the MP4 plays in WhatsApp on a
low-end Android. The build of Chromium available in CI ships without the
proprietary codecs, so it reports H.264 and AAC as unavailable and the test
exercises the VP9/Opus fallback instead. The codec *selection* is tested; the
H.264 encode itself needs a real device. Please try it on a phone early.

---

## Looking at it on a phone (GitHub Pages preview)

A built copy lives in `docs/` so GitHub Pages can serve it without any CI.
It is a preview only - Cloudflare Pages is still the real target.

Turn it on once, in the repo's **Settings -> Pages**:

- **Source:** Deploy from a branch
- **Branch:** `claude/gifted-bardeen-fnv928`
- **Folder:** `/docs`   (not `/ (root)`)

Then it appears at **https://vysakhsuresh.github.io/kshanam-website/** a
minute or two later.

To refresh it after a change:

```sh
npm run build:pages     # rebuilds docs/ with the /kshanam-website/ base
npm run test:built      # serves docs' build from a sub-path and drives it
git add docs && git commit -m "Refresh the Pages preview" && git push
```

`docs/` is a build output and is committed on purpose; everything in it comes
from `app/`. Never edit it by hand.

## Deploying to Cloudflare Pages

Static output, free plan, well inside the 20,000 file and 25 MiB limits.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 20 or newer

Add a `public/_headers` file if long-lived caching for `/fonts/*` is wanted;
the fonts are content-hashed by name, not by URL, so they are safe to cache
hard.

Nothing here needs an environment variable or a secret, and nothing should
ever be added that does.
