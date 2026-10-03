/**
 * Drives the site in a browser, at phone, tablet and laptop widths.
 *
 * Catches what static checks cannot: a gallery card that renders blank, a
 * player that does not follow the typing, a storyboard that does not jump
 * when a field is focused, an ad slot that crept into the editor, or a layout
 * that scrolls sideways on a 360px phone.
 *
 *   node tests/screens.mjs [--shots]
 */
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'tests/output');
const SHOTS = process.argv.includes('--shots');

const SIZES = [
  { name: 'phone', width: 360, height: 780, mobile: true },
  { name: 'tablet', width: 820, height: 1100, mobile: false },
  { name: 'laptop', width: 1280, height: 860, mobile: false },
];

const results = [];
const ok = (label, condition, detail = '') => {
  results.push({ label, pass: !!condition });
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
};

/** Distinct colours a canvas drew. A blank one has 1. */
const COLOURS = `(sel) => {
  const c = document.querySelector(sel);
  if (!c) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i+1] << 8) | d[i+2]);
  return seen.size;
}`;

function watch(page, errors) {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    errors.push(url ? `${m.text()} <- ${url}` : m.text());
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const server = await createServer({
    root: resolve(ROOT, 'app'),
    configFile: resolve(ROOT, 'vite.config.js'),
    server: { port: 0, host: '127.0.0.1', hmr: false, watch: null },
    logLevel: 'warn',
  });
  await server.listen();
  const port = server.config.server.port || server.httpServer.address().port;
  const base = `http://127.0.0.1:${port}`;

  const { chromium } = await import('playwright');
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }

  try {
    /* ---------------- every page, at every size ---------------- */
    for (const size of SIZES) {
      const ctx = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.mobile, hasTouch: size.mobile, deviceScaleFactor: size.mobile ? 2 : 1,
      });
      console.log(`\n${size.name} (${size.width}px)`);

      for (const [name, path] of [['home', '/'], ['studio', '/studio.html'],
                                  ['help', '/help.html'], ['guest', '/guest.html']]) {
        const page = await ctx.newPage();
        const errors = [];
        watch(page, errors);
        const res = await page.goto(base + path, { waitUntil: 'networkidle' });

        ok(`${size.name}/${name} loads`, res && res.status() === 200, String(res && res.status()));
        ok(`${size.name}/${name} throws nothing`, errors.length === 0, errors.slice(0, 2).join(' | '));
        ok(`${size.name}/${name} has one h1`, await page.locator('h1').count() === 1);
        ok(`${size.name}/${name} does not scroll sideways`,
           await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
           await page.evaluate(() => `${document.documentElement.scrollWidth} vs ${window.innerWidth}`));

        const small = await page.evaluate(() => {
          const bad = [];
          for (const el of document.querySelectorAll('button, a.btn, input:not([type=range]):not([type=file]), select, .cat, .choice')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.height < 43.5) bad.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.height)}px`);
          }
          return bad;
        });
        ok(`${size.name}/${name} tap targets are 44px+`, small.length === 0, small.slice(0, 2).join(', '));

        if (SHOTS) {
          await page.screenshot({ path: resolve(OUT, `screen-${size.name}-${name}.png`), fullPage: true });
        }
        await page.close();
      }
      await ctx.close();
    }

    /* ---------------- home behaviour ---------------- */
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    let page = await ctx.newPage();
    let errors = [];
    watch(page, errors);
    console.log('\nhome behaviour');
    await page.goto(base + '/', { waitUntil: 'networkidle' });

    ok('categories are offered', await page.locator('#categories .cat').count() > 5,
       String(await page.locator('#categories .cat').count()));

    // The hero cards are canvases. If the code that picks them throws, they
    // render as two blank rectangles at the very top of the page and nothing
    // else on the page looks wrong - which is exactly how it shipped once.
    const heroPainted = await page.evaluate(() => ['hero-a', 'hero-b'].map((id) => {
      const c = document.getElementById(id);
      if (!c) return -1;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 4 * 997) if (d[i + 3] > 0) lit++;
      return lit;
    }));
    ok('the hero cards actually draw', heroPainted.every((n) => n > 50), heroPainted.join(' / '));

    // And the counts on the page come from the library, not from a number
    // somebody typed when the library was a different size.
    const counts = await page.evaluate(() => ({
      shown: [...document.querySelectorAll('[data-count="designs"]')].map((e) => e.textContent.trim()),
      real: document.querySelectorAll('#design-list .design').length,
    }));
    ok('the design count on the page is the real one',
       counts.shown.length > 0 && counts.shown.every((v) => Number(v) === counts.real),
       `page says ${counts.shown.join(', ')}; gallery has ${counts.real}`);
    const total = await page.locator('#design-list .design').count();
    ok('the gallery is full', total >= 25, `${total} designs`);

    await page.waitForFunction(`(${COLOURS})('#design-list canvas') > 4`, null, { timeout: 20000 }).catch(() => {});
    ok('gallery cards really draw', await page.evaluate(`(${COLOURS})('#design-list canvas')`) > 4);

    await page.locator('#categories .cat', { hasText: 'Birthday' }).first().click();
    await page.waitForTimeout(250);
    const filtered = await page.locator('#design-list .design').count();
    ok('choosing a category narrows the gallery', filtered > 0 && filtered < total, `${filtered} of ${total}`);

    const href = await page.locator('#design-list .design').first().getAttribute('href');
    ok('a design links into the studio', (href || '').includes('studio.html?t='), href || 'none');
    ok('no ad markup is rendered while the slot is empty',
       await page.locator('.ad-slot:visible').count() === 0);
    ok('home stayed clean', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();

    /* ---------------- studio behaviour ---------------- */
    page = await ctx.newPage();
    errors = [];
    watch(page, errors);
    console.log('\nstudio behaviour');
    await page.goto(base + '/studio.html?t=ivory-deco', { waitUntil: 'networkidle' });

    await page.waitForFunction(`(${COLOURS})('#player') > 4`, null, { timeout: 20000 }).catch(() => {});
    ok('the player draws the invitation', await page.evaluate(`(${COLOURS})('#player')`) > 4);

    await page.waitForFunction(() => document.querySelectorAll('#slides .slide').length > 3, null, { timeout: 20000 }).catch(() => {});
    const slides = await page.locator('#slides .slide').count();
    ok('the storyboard shows every slide', slides >= 6, `${slides} slides`);
    ok('storyboard slides are drawn, not blank',
       await page.evaluate(`(${COLOURS})('#slides canvas')`) > 4);

    const before = await page.evaluate(() => document.getElementById('player').toDataURL());
    await page.fill('#f-name1', 'Meenakshi');
    await page.waitForTimeout(350);
    ok('the player follows what is typed',
       (await page.evaluate(() => document.getElementById('player').toDataURL())) !== before);

    // Focusing a field should jump to the slide that line appears on.
    await page.locator('#f-venue').focus();
    await page.waitForTimeout(350);
    const current = await page.evaluate(() => {
      const el = document.querySelector('#slides .slide[aria-current="true"]');
      return el ? [...document.querySelectorAll('#slides .slide')].indexOf(el) : -1;
    });
    await page.locator('#f-name1').focus();
    await page.waitForTimeout(350);
    const current2 = await page.evaluate(() => {
      const el = document.querySelector('#slides .slide[aria-current="true"]');
      return el ? [...document.querySelectorAll('#slides .slide')].indexOf(el) : -1;
    });
    ok('touching a field jumps to the slide it appears on',
       current >= 0 && current2 >= 0 && current !== current2, `venue slide ${current}, name slide ${current2}`);

    await page.locator('#play').click();
    await page.waitForTimeout(700);
    const moved = await page.evaluate(() => document.getElementById('time').textContent);
    await page.locator('#play').click();
    ok('play actually plays', moved !== '0:00', `clock reached ${moved}`);

    ok('music can be chosen', await page.locator('#music .choice').count() >= 6,
       String(await page.locator('#music .choice').count()));
    ok('a photo can be added', await page.locator('#photos input[type=file]').count() >= 1);
    ok('photo controls stay hidden until there is a photo',
       await page.locator('.photo-sliders:visible').count() === 0);
    ok('nothing marked hidden is actually on screen',
       await page.locator('[hidden]:visible').count() === 0,
       String(await page.locator('[hidden]:visible').count()));
    ok('there is no end-card switch any more', await page.locator('#endCard').count() === 0);
    ok('no ads anywhere in the editor', await page.locator('.ad-slot').count() === 0);
    ok('studio stayed clean', errors.length === 0, errors.slice(0, 2).join(' | '));

    if (SHOTS) await page.screenshot({ path: resolve(OUT, 'screen-studio-typed.png'), fullPage: true });
    await page.close();
    await ctx.close();
  } finally {
    await browser.close();
    await server.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('Failed:');
    for (const f of failed) console.log(`  - ${f.label}`);
    process.exitCode = 1;
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
