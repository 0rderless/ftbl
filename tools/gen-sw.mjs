// Regenerates sw.js with the current list of app files and a content hash as the cache version,
// so installed copies of the app pick up every update. Run: npm run build:sw
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = ['index.html', 'manifest.webmanifest', ...['css', 'js', 'icons'].flatMap((d) => walk(join(root, d)).map((p) => relative(root, p)))].sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const version = 'ftbl-' + hash.digest('hex').slice(0, 10);
const tpl = readFileSync(join(root, 'sw.js'), 'utf8');
const out = tpl
  .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
  .replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = [\n  './',\n${files.map((f) => `  './${f}',`).join('\n')}\n];`);
writeFileSync(join(root, 'sw.js'), out);
console.log(`sw.js: ${files.length} files, cache ${version}`);
