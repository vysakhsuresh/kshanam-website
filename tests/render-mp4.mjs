/**
 * The proof that matters: Kasavu Gold, rendered through the real worker
 * pipeline in a real browser, comes out as a playable MP4.
 *
 * CLAUDE.md puts this first in the build order, before any of the site, and
 * this is the test that keeps it honest. It checks the container the muxer
 * produced with ffprobe rather than trusting that the encode "worked".
 *
 *   node tests/render-mp4.mjs            full render + ffprobe + frame grabs
 *   node tests/render-mp4.mjs --quick    one short scene, for a fast loop
 */
import { createServer } from 'vite';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'tests/output');
const QUICK = process.argv.includes('--quick');

/** Frames to grab as stills, as a fraction of the whole video. */
const STILL_POINTS = [0.06, 0.2, 0.38, 0.56, 0.72, 0.88, 0.97];

async function launchBrowser() {
  const { chromium } = await import('playwright');
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
}

function ok(results, label, condition, detail = '') {
  results.push({ label, pass: !!condition, detail });
  const mark = condition ? 'ok  ' : 'FAIL';
  console.log(`  ${mark} ${label}${detail ? `  (${detail})` : ''}`);
}

async function ffprobe(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-print_format', 'json',
    '-show_format', '-show_streams', file,
  ]);
  return JSON.parse(stdout);
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

  const browser = await launchBrowser();
  const results = [];
  let browserErrors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    page.on('pageerror', (e) => browserErrors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // Without the URL a bare "Failed to load resource" is undiagnosable.
      const url = (m.location() && m.location().url) || '';
      browserErrors.push(url ? `${m.text()} <- ${url}` : m.text());
    });

    await page.goto(`${base}/dev-render.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__harnessReady === true, { timeout: 30000 });

    console.log('\nCodec support in this browser');
    const caps = await page.evaluate(() => window.capabilities());
    console.log(`  WebCodecs: ${caps.hasWebCodecs}`);
    console.log(`  video:     ${caps.video}`);
    console.log(`  audio:     ${caps.audio}`);
    console.log(`  WhatsApp-ready (H.264 + AAC): ${caps.whatsappReady}`);
    if (!caps.whatsappReady) {
      console.log('  NOTE: this build of Chromium ships without the proprietary');
      console.log('        codecs, so H.264/AAC cannot be exercised here. Real');
      console.log('        Chrome on Android has them; the pipeline picks them');
      console.log('        first and falls back only when they are missing.');
    }

    console.log('\nFonts');
    const fonts = await page.evaluate(() => window.checkFonts(
      ['Space Grotesk', 'Marcellus', 'Great Vibes', 'Anek Malayalam']));
    for (const f of fonts) {
      ok(results, `${f.family} is really being used for drawing`, f.applied,
         `${f.withFont.toFixed(1)}px vs ${f.fallback.toFixed(1)}px fallback`);
    }

    console.log('\nStill frames');
    const info = await page.evaluate(() => window.drawFrame(0));
    const duration = info.duration;
    ok(results, 'timeline has a sensible length', duration > 25 && duration < 70, `${duration}s`);
    ok(results, 'there is no "made free on" end card',
       !info.scenes.some((sc) => /end/i.test(sc.id)),
       info.scenes.map((sc) => sc.id).join(' '));

    for (const point of STILL_POINTS) {
      const t = +(duration * point).toFixed(2);
      const dataUrl = await page.evaluate(async (time) => {
        await window.drawFrame(time);
        return document.getElementById('preview').toDataURL('image/png');
      }, t);
      const name = `frame-${String(Math.round(point * 100)).padStart(3, '0')}.png`;
      await writeFile(resolve(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    console.log(`  wrote ${STILL_POINTS.length} stills to tests/output/`);

    // Typed Malayalam must shape correctly inside a design built around a
    // Latin serif. That is what the script font stack at the end of every
    // design's font list is for.
    const mlUrl = await page.evaluate(async () => {
      await window.drawFrame(12, { entered: { name1: 'അഞ്ജലി', name2: 'രാഹുൽ' } });
      return document.getElementById('preview').toDataURL('image/png');
    });
    await writeFile(resolve(OUT, 'typed-malayalam.png'),
      Buffer.from(mlUrl.split(',')[1], 'base64'));
    console.log('  wrote a Latin design with Malayalam typed into it');

    // A name is shrunk to fit, never broken across lines. "Padmavathy" set as
    // "Padmava / thy" is worse than any font size, and it shipped that way
    // because the wrapper broke the word before the shrink loop ever ran.
    const fits = await page.evaluate(async () => {
      const { layoutText } = await import('/src/engine/text.js');
      const ctx = document.createElement('canvas').getContext('2d');
      const run = (text) => layoutText(ctx, text, {
        family: '"Marcellus", serif', size: 60, maxWidth: 280, maxLines: 2, minSize: 24,
      });
      return ['Padmavathy', 'Harikrishnan', 'Lakshmipriya', 'Venkataraman', 'Unnikrishnan']
        .map((n) => ({ name: n, ...run(n) }));
    });
    const broken = fits.filter((f) => f.lines.length > 1);
    ok(results, 'a long single name shrinks rather than breaking mid-word',
       broken.length === 0,
       broken.length ? broken.map((f) => f.lines.join('/')).join(' ')
                     : fits.map((f) => `${f.name} ${f.size}px`).join(', '));

    // A very long name is the quality-bar case that breaks naive layouts.
    const longUrl = await page.evaluate(async () => {
      await window.drawFrame(12, { entered: {
        name1: 'Lakshmi Priyadarshini',
        name2: 'Venkataraman',
        venue: 'Sree Krishna Swamy Temple Auditorium, East Fort, Thrissur, Kerala',
      } });
      return document.getElementById('preview').toDataURL('image/png');
    });
    await writeFile(resolve(OUT, 'long-names.png'),
      Buffer.from(longUrl.split(',')[1], 'base64'));
    console.log('  wrote the long-name case');

    // Every design has to draw without throwing, not just the default one.
    const ids = await page.evaluate(() => window.designs());
    let drawn = 0;
    for (const id of ids) {
      const okDraw = await page.evaluate(async (designId) => {
        try { await window.drawFrame(12, { id: designId }); return true; }
        catch { return false; }
      }, id);
      if (okDraw) drawn++;
    }
    ok(results, 'every design draws a frame', drawn === ids.length, `${drawn}/${ids.length}`);

    console.log('\nRendering the video through the worker');
    const started = Date.now();
    const render = await page.evaluate((quick) => window.renderViaWorker(
      quick ? { fps: 15 } : {}), QUICK);
    const wall = Date.now() - started;

    const file = resolve(OUT, 'invitation.mp4');
    await writeFile(file, Buffer.from(render.base64, 'base64'));

    console.log(`  ${(render.bytes / 1024).toFixed(0)} KB in ${(wall / 1000).toFixed(1)}s ` +
                `(${render.frames} frames, ${render.codecs.video}/${render.codecs.audio || 'no audio'})`);

    console.log('\nThe file itself, according to ffprobe');
    const probe = await ffprobe(file);
    const video = probe.streams.find((s) => s.codec_type === 'video');
    const audio = probe.streams.find((s) => s.codec_type === 'audio');
    const probedDuration = Number(probe.format.duration);

    console.log(`  container: ${probe.format.format_name}`);
    console.log(`  video:     ${video && video.codec_name} ${video && video.width}x${video && video.height} ` +
                `${video && video.nb_frames} frames`);
    console.log(`  audio:     ${audio ? `${audio.codec_name} ${audio.sample_rate}Hz ${audio.channels}ch` : 'none'}`);
    console.log(`  duration:  ${probedDuration.toFixed(2)}s`);

    ok(results, 'file is an MP4 container',
       String(probe.format.format_name).includes('mp4'), probe.format.format_name);
    ok(results, 'has a video stream', !!video);
    ok(results, 'is 720x1280 portrait', video && video.width === 720 && video.height === 1280,
       video ? `${video.width}x${video.height}` : 'no stream');
    ok(results, 'duration matches the timeline',
       Math.abs(probedDuration - render.duration) < 0.75,
       `file ${probedDuration.toFixed(2)}s vs timeline ${render.duration}s`);
    ok(results, 'frame count matches the timeline',
       !video.nb_frames || Math.abs(Number(video.nb_frames) - render.frames) <= 2,
       `${video.nb_frames} vs ${render.frames}`);
    ok(results, 'has an audio stream', !!audio,
       audio ? audio.codec_name : 'none - check the audio encoder');
    ok(results, 'audio runs the length of the video',
       !audio || Math.abs(Number(audio.duration || probedDuration) - render.duration) < 1.2,
       audio ? `${Number(audio.duration || probedDuration).toFixed(2)}s` : 'n/a');
    ok(results, 'moov atom is at the front (starts playing before it downloads)',
       await startsWithFastStart(file));
    ok(results, 'no browser errors during the render', browserErrors.length === 0,
       browserErrors.slice(0, 2).join(' | '));

    // Decoding it back is the closest we can get to "it plays".
    await run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']);
    ok(results, 'decodes cleanly from start to finish', true);

    console.log('\nA real device still has to confirm this plays in WhatsApp on');
    console.log('a low-end Android. That is the one thing a container cannot do.');
  } finally {
    await browser.close();
    await server.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('Failed:');
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? `: ${f.detail}` : ''}`);
    process.exitCode = 1;
  }
}

/** fastStart means the moov box sits before the mdat box. */
async function startsWithFastStart(file) {
  const { readFile } = await import('node:fs/promises');
  const head = (await readFile(file)).subarray(0, 4096).toString('latin1');
  const moov = head.indexOf('moov');
  const mdat = head.indexOf('mdat');
  if (moov === -1) return false;
  return mdat === -1 || moov < mdat;
}

main().catch((err) => { console.error(err); process.exit(1); });
