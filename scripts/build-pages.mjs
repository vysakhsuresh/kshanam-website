/**
 * Builds the GitHub Pages preview into docs/.
 *
 * docs/ is shared: it holds the built site *and* docs/mockup/, the design
 * files from the planning chat that CLAUDE.md points at. A plain
 * `vite build --outDir ../docs --emptyOutDir` deletes the mockups, so this
 * builds into dist/ and then mirrors it into docs/, leaving anything the
 * build does not own exactly where it was.
 *
 *   node scripts/build-pages.mjs
 */
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const DOCS = join(ROOT, 'docs');

/** Everything in docs/ that is build output, and therefore ours to replace. */
const KEEP = new Set(['mockup']);

const BASE = process.env.KSHANAM_BASE || '/kshanam-website/';

async function main() {
  process.env.KSHANAM_BASE = BASE;
  await build({ configFile: join(ROOT, 'vite.config.js'), base: BASE, logLevel: 'warn' });

  await mkdir(DOCS, { recursive: true });
  for (const name of await readdir(DOCS)) {
    if (!KEEP.has(name)) await rm(join(DOCS, name), { recursive: true, force: true });
  }

  for (const name of await readdir(DIST)) {
    await cp(join(DIST, name), join(DOCS, name), { recursive: true });
  }

  // Without this, Pages runs the output through Jekyll, which ignores paths
  // beginning with an underscore.
  await writeFile(join(DOCS, '.nojekyll'), '');

  const kept = [...KEEP].filter(Boolean).join(', ');
  console.log(`docs/ rebuilt at base ${BASE}` + (kept ? ` (kept: ${kept})` : ''));
}

main().catch((err) => { console.error(err); process.exit(1); });
