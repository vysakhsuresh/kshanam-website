# Kshanam — free invitation video maker

Read this whole file before doing anything. It is the brief from the planning
chat. The owner is Vysakh (calls you "buddy"). He prefers plain, simple English
and quick visual progress he can try on his phone.

## What we are building

A free website where families make invitation videos for weddings and other
functions, then send them on WhatsApp. "Kshanam" (ക്ഷണം) means invitation in
Malayalam. It is a working name; the domain is not chosen yet, so use the
placeholder `[YOUR DOMAIN]` wherever the domain appears.

Main audience first: Kerala families (Malayalam + English), then Tamil and
other Indian and Gulf communities.

## Promises we never break

These are the whole reason people will choose us over the market leaders:

1. Free forever. No payment anywhere, especially never at the download step.
2. No sign-up, no account, no login.
3. No watermark on the invite.
4. Photos and details never leave the user's phone. The video is made in the
   browser. Nothing is uploaded.
5. Ads (AdSense) may appear on gallery and occasion pages only. Never inside
   the editor, the rendering screen, or near the download/share buttons.
6. The 2-second "Made free on Kshanam" end card is optional, switched on by
   default, clearly explained, and easy to turn off.

## Who we design for

Picture the bride's mother: 55, a cheap Android phone, comfortable with WhatsApp
but not with apps, needing to send an invite to 300 relatives tonight. Every
screen must work for her. If a step is not essential, remove it.

## Hard technical constraints

- Static site only: HTML, CSS and JavaScript (a build step such as Vite is fine).
  No server, no database, no backend.
- Hosting: Cloudflare Pages free plan. Keep within 20,000 files per site and
  25 MiB per file. A `_headers` file is available if we need custom headers.
- Performance target device: a low-end Android phone on mobile data. Test there,
  not just on a laptop.
- Malayalam text must render correctly on the canvas. Load the web fonts fully
  (`document.fonts.load`) before drawing any frame.

## Video pipeline (client-side)

Template data → draw each frame on a canvas → encode → mux to MP4 → download or share.

- Drawing: Canvas 2D (or WebGL where it clearly helps). Run heavy work in a Web
  Worker with OffscreenCanvas where supported, so the page never freezes.
- Encoding: WebCodecs `VideoEncoder`, H.264, 720×1280 (9:16), 30 fps.
- Audio: mix with Web Audio (`OfflineAudioContext`), encode with `AudioEncoder`.
  AAC support varies by browser, so detect it and test early, because WhatsApp
  prefers H.264 + AAC in MP4.
- Muxing: a small MP4 muxer library (for example Mediabunny or mp4-muxer).
- Fallback: ffmpeg.wasm only for browsers missing WebCodecs, or for one tricky
  step. It is slow and a large download, so never load it by default.
- Do not use MediaRecorder as the main method; it often produces WebM, which
  WhatsApp handles badly.
- Sharing: use the Web Share API with files (`navigator.share({ files })`) on
  Android so the MP4 goes straight to WhatsApp; fall back to download.
- Videos are 30–60 seconds. Show a clear progress bar while rendering.

## Templates: "numerous designs" means data, not code

One shared renderer engine. Each design is a template file (JSON) describing
scenes, timings, text slots, colours, fonts, animations and optional assets.
Adding a design must never require changing the engine. This is how we ship
many designs quickly while keeping quality high.

Each template defines at least:
- id, name, occasion, community/style, supported languages (en, ml, both)
- text slots (names, date, time, venue, custom lines) with sensible defaults
- scenes with durations, transitions and animation presets
- palette and fonts
- optional photo slot(s) and music suggestion

Quality bar for every template: looks right with long and short names, works in
English, Malayalam and both, readable on a small phone, renders smoothly on a
low-end Android, and plays correctly after being sent on WhatsApp.

### Occasions to cover

Wedding, engagement, save the date, housewarming, baptism, naming ceremony,
first birthday, birthday, anniversary, retirement. Weddings come first.

### First four designs (already mocked up, see docs/mockup)

- Kasavu Gold: off-white with gold and maroon kasavu bands, lamp icon,
  Malayalam + English. (Full frame: docs/mockup/Invite.dc.html)
- Nilavilakku: deep maroon, golden lamp, traditional, Malayalam.
- Lily and Bells: soft blue-grey arch, Christian wedding, English.
- Crescent Gold: deep green with gold crescent, Nikah, English.

Build these first and get one of them working end to end before making more.

## Music and assets: licensing rules

- Never include film songs or popular music.
- Only royalty-free tracks whose licence allows use inside a website and inside
  videos users download. Keep each track's licence file in the repo next to it.
- Also let users pick their own song from their phone (their choice, their
  responsibility). Offer "No music" too.
- Fonts: free-licensed only (for example Google Fonts under OFL), self-hosted.
- Template artwork: our own designs only. No copied artwork.

## Screens (see docs/mockup)

The mockup files are from a design canvas. They use that canvas's runtime, so
they will not render on their own; read them for layout, copy, sizes and colours.

1. Home (`Main.dc.html`): language toggle (English / മലയാളം), headline
   "Your invitation video, ready in 2 minutes", trust pills (Free forever, No
   sign-up, No watermark), occasion chips, design gallery, how it works,
   privacy note.
2. Details (`Details.dc.html`): live preview at the top that updates as the user
   types; fields for names, date, muhurtham time, venue; invite language
   (English / Malayalam / Both); optional photo; music choice; end card toggle;
   "Make my video" button. Sample details are prefilled.
3. Ready (`Share.dc.html`): play preview, "Send on WhatsApp", "Download video",
   "Same function, more invites" (reception invite with details kept, WhatsApp
   status picture), feedback ("Looks great" leads to a share-the-site prompt;
   "Something's wrong" leads to a short feedback box), honest note on how the
   site stays free.
4. Guest landing (`GuestLanding.dc.html`): for guests arriving from an invite's
   end card or shared link; same design preselected (for example
   `?t=kasavu-gold`), "Use this design" button.
5. End card (`EndCard.dc.html`): 2 seconds, maroon, "Made free on Kshanam",
   `[YOUR DOMAIN]`.

User details should be saved on the device (localStorage, wrapped in try/catch)
so a refresh or a second invite never loses their typing.

Feedback without a backend: start with a simple link (mailto or a free form
service the owner chooses). Ask the owner before adding any third-party service.

## Design tokens

- Maroon (primary): #7A1F2B, hover #5A1520
- Gold (decorative, kasavu bands): #C9971C
- Dark gold (text on light): #8A5A00
- Ink: #2A1A1F
- Muted text: #5E4C51
- Blush surface: #FBF1EC
- Lines: #EADFD9, input borders #D9CBC4
- Fonts: Anek Malayalam (UI, Latin + Malayalam), Manjari (Malayalam display),
  Marcellus (English names on invites)
- Touch targets at least 44px. Text contrast at least 4.5:1.

## SEO plan (this is how we beat the big sites)

Do not fight for "invitation video maker" alone. Win hundreds of specific
searches with one fast static page each, generated from the template data:
- occasion × language × community, for example "Malayalam wedding invitation
  video", "Christian engagement invite video", "housewarming invitation video
  Tamil"
- each page shows matching designs, a short helpful guide, and goes straight
  into the editor
- proper titles, descriptions, Open Graph previews, sitemap.xml, robots.txt
- pages must load fast on mobile data

Analytics, if any, must be privacy-friendly and cookieless (for example
Cloudflare Web Analytics). Never track the names or details users type.

## Suggested build order

1. Renderer engine + Kasavu Gold exported as a real MP4 that plays in WhatsApp
   on a low-end Android. Prove this first.
2. Site shell: Home, Details with live preview, Ready screen, Guest landing.
3. Template JSON schema, then the other three mocked-up designs.
4. More designs in batches across occasions (good work for parallel agents),
   each checked against the quality bar above.
5. SEO occasion pages, sitemap, Open Graph images.
6. Cloudflare Pages deployment notes in the README.

## Working with the owner

- Show progress he can open on his phone early and often.
- Explain decisions in simple English, no jargon.
- Ask before adding paid services, accounts, trackers or anything that breaks
  the promises above.
- Never commit secrets. Keep the repo clean and the README up to date.

---

# Decisions taken after this brief

The brief above is the original from the planning chat. These changes came
later, from the owner, and override it where they disagree. Recorded here so
the next person does not "fix" them back.

1. **The product is called Festa, not Kshanam.** "Kshanam" reads as an
   invitation only to Malayali families, and this is meant to be the first
   site anyone reaches for, for any celebration, anywhere. The git repository
   is still named `kshanam-website`; only the product name changed.

2. **The "Made free on Kshanam" end card is gone.** Not optional — removed.
   Promise 6 in the brief no longer applies. Growth has to come from the work
   being good, not from a card on the end of somebody's wedding invitation.

3. **The site's own text is English only.** The Malayalam interface strings
   were written without a native speaker and were not good enough to ship.
   Malayalam is still fully supported where it matters: every line on every
   design is a field the family fills in themselves, in any script their
   keyboard produces, and the Malayalam faces are loaded so the canvas shapes
   them properly. There is no "invite language" setting any more, because
   there is nothing left to switch.

4. **Nothing on a design is fixed copy.** The eyebrow, the invitation line,
   the closing line — all of it is editable. That is what makes one design
   work for a Hindu wedding, a Nikah and a christening.

5. **You see it before you make it.** The editor plays the finished
   invitation while you type and shows every slide with the real words on it.
   Touching a field jumps to the slide that line appears on. Exporting a video
   to find out what you got was the single worst thing about the first build.

6. **Designs are generated from compact specs.** `scripts/gen-templates.mjs`
   holds one spec per design — palette, typefaces, ornaments, a layout recipe
   — and writes the JSON the engine reads. The output is committed and safe to
   edit by hand. Six recipes and a kit of 25 drawn motifs, 7 frames and 4
   patterns is what makes a wide, consistent library affordable.

7. **Music is synthesised, not licensed.** Eight instrumental beds are
   generated from scratch in `music.js`, so there is no licence to honour and
   no attribution to carry. Visitors can still pick their own song, or none.

8. **It is a desktop product as much as a phone one.** Laptop, tablet and
   phone layouts are all designed and all tested at their own widths.
