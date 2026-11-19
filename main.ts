// NEON CUT's entrypoint (Node 22, the standard library only, no build step).
//
// The studio itself is app/: plain static files — app/index.html and its ES modules, the two OFL fonts, two
// sample photos — that a desktop browser opens offline and makes no request for. This program hands the entry
// in: it copies app/ and screenshots/ from beside itself into the output directory and writes the dossier the
// judge reads with the kit's vendored library, so the file is byte for byte the one the scorer builds from the
// same folders.
//
// Serve the studio with `node serve.ts` and open localhost:8080. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The scorer's own caps (its reference/gate.json). Only text_max_bytes shapes the dossier's bytes; the rest
// make this program refuse what the scorer would refuse: more than 4 screenshots or one over 256 KiB, more
// than 993 entries or 48 MiB under app/, or a path under app/ over 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const HTML_CAP_BYTES = 1048576;

const here = fileURLToPath(new URL('.', import.meta.url));
const appDir = join(here, 'app');
const shotDir = join(here, 'screenshots');
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

/** One clear line on stderr and a non-zero exit: the entry is not handed in at all. */
function refuse(reason: string): never {
  process.stderr.write(`main.ts: ${reason}\n`);
  process.exit(1);
}

if (!existsSync(join(appDir, 'index.html'))) {
  refuse('app/index.html is missing, so there is no app to hand in');
}
if (statSync(join(appDir, 'index.html')).size > HTML_CAP_BYTES) {
  refuse(`app/index.html is over ${HTML_CAP_BYTES} bytes, past the scorer's cap`);
}

const shots = existsSync(shotDir)
  ? readdirSync(shotDir)
      .filter((name) => !name.startsWith('.') && IMAGE_EXTENSIONS.has(extname(name).toLowerCase()))
      .sort()
  : [];
if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
  refuse(`screenshots/ holds ${shots.length} PNG or JPEG images; the bounty asks for 3 or 4`);
}
for (const name of shots) {
  const bytes = statSync(join(shotDir, name)).size;
  if (bytes > CAPS.screenshots.max_bytes) {
    refuse(`screenshots/${name} is ${bytes} B, past the ${CAPS.screenshots.max_bytes}-byte image cap`);
  }
}

// The app tree is measured before anything is written, so an entry the scorer would refuse fails here, by
// name, instead of leaving half a copy behind.
const appEntries = readdirSync(appDir, { recursive: true }) as string[];
let appBytes = 0;
for (const entry of appEntries) {
  const full = join(appDir, entry);
  if (statSync(full).isFile()) appBytes += statSync(full).size;
}
if (appEntries.length > CAPS.app_max_files) {
  refuse(`app/ holds ${appEntries.length} entries, past the ${CAPS.app_max_files}-entry cap`);
}
if (appBytes > CAPS.app_max_bytes) {
  refuse(`app/ holds ${appBytes} B, past the ${CAPS.app_max_bytes}-byte cap`);
}

// Copying app/ into a folder inside app/ (or into the repository root itself) would feed the copy back into
// itself on the next run, so that output directory is refused rather than written.
if (out === here.replace(/[\\/]$/, '') || out === appDir || out.startsWith(appDir + sep)) {
  refuse(`refusing to write the entry into ${out}: it is the repository or inside app/`);
}

mkdirSync(join(out, 'app'), { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
for (const name of shots) cpSync(join(shotDir, name), join(out, 'screenshots', name));

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

// One line, the same on every run of an unchanged repository.
process.stdout.write(
  `NEON CUT · app ${appEntries.length} entries / ${appBytes} B · ` +
    `screenshots ${shots.length} (${shots.join(', ')}) · dossier ${dossier.length} B\n`,
);
