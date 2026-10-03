/** Times each step of font loading inside a worker. Diagnosis only. */
import manifest from './src/font-manifest.json';

const step = async (name, fn, ms = 8000) => {
  const started = performance.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), ms)),
    ]);
    return { name, ok: true, ms: Math.round(performance.now() - started) };
  } catch (err) {
    return { name, ok: false, ms: Math.round(performance.now() - started), error: String(err.message || err) };
  }
};

self.onmessage = async (e) => {
  const base = e.data.baseUrl || '/';
  const out = [];
  out.push({ name: 'self.fonts exists', ok: !!self.fonts, ms: 0 });

  const faces = [];
  out.push(await step('load all FontFace objects', async () => {
    await Promise.all(manifest.map(async (f) => {
      const face = new FontFace(f.family, `url(${base}${f.file}) format('woff2')`, {
        weight: f.weight, style: f.style, unicodeRange: f.unicodeRange,
      });
      await face.load();
      faces.push(face);
    }));
  }));

  out.push(await step('add them to self.fonts', async () => {
    for (const f of faces) self.fonts.add(f);
  }));

  out.push(await step('self.fonts.load() for each family', async () => {
    const families = [...new Set(manifest.map((f) => f.family))];
    await Promise.all(families.flatMap((family) =>
      [400, 700].map((w) => self.fonts.load(`${w} 48px "${family}"`, 'വിവാഹ ക്ഷണം Anjali'))));
  }));

  // The suspect: in a worker there is no rendering loop to settle this.
  out.push(await step('await self.fonts.ready', () => self.fonts.ready, 6000));

  out.push(await step('draw Malayalam on an OffscreenCanvas', async () => {
    const c = new OffscreenCanvas(400, 120);
    const ctx = c.getContext('2d');
    ctx.font = '400 48px "Manjari"';
    const withFont = ctx.measureText('വിവാഹ ക്ഷണം').width;
    ctx.font = '400 48px "NoSuchFamilyAtAll"';
    const fallback = ctx.measureText('വിവാഹ ക്ഷണം').width;
    if (Math.abs(withFont - fallback) < 0.5) throw new Error('font not applied in worker');
  }));

  self.postMessage(out);
};
