// Entry point for the gta6-cover-art-01 submission: hand the studio in.
//
// The app under app/ is a plain static page — no build step, no dependency, no network call — so the program does
// three things and stops: it copies app/ and screenshots/ beside this file into the output directory, refuses an
// incomplete entry with one line on stderr, and writes dossier.json (the manifest the judge reads) with the
// vendored make.fun helper.
//
//   node serve.ts                                   the studio on localhost:8080
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The caps below are the grader's own (reference/gate.json). Only text_max_bytes shapes the dossier; the rest
// make this program fail exactly where the grader would.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

const SHOT = /\.(png|jpe?g)$/i;

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const appDir = join(here, 'app');
const shotsDir = join(here, 'screenshots');

function fail(message: string): never {
  process.stderr.write(`main.ts: ${message}\n`);
  process.exit(1);
}

if (!existsSync(join(appDir, 'index.html'))) fail('app/index.html is missing — the studio has nothing to show.');
if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) fail('screenshots/ is missing — the entry needs 3 or 4 captures.');
const shots = readdirSync(shotsDir).filter((name) => SHOT.test(name));
if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
  fail(`screenshots/ holds ${shots.length} image(s); the entry needs 3 or 4.`);
}

mkdirSync(out, { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

// The judge's contact sheet reads the first screenshot by name, so report it to prove both sides agree.
const entries = readdirSync(join(out, 'app'), { recursive: true }) as string[];
let appBytes = 0;
for (const entry of entries) {
  try {
    const stats = statSync(join(out, 'app', entry));
    if (stats.isFile()) appBytes += stats.size;
  } catch {
    // a directory entry read as a file: nothing to add
  }
}

const ordered = [...shots].sort();
process.stdout.write(
  `app ${entries.length} entries · ${appBytes} bytes · screenshots ${ordered.length} (${ordered[0]}) · dossier ${dossier.byteLength} bytes -> ${out}\n`,
);
