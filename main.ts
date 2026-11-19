// VICE HOUR — entrypoint for the make.fun gta6-cover-art-01 bounty (Node 22, standard library only).
//
// This program does one job: it hands the app in. `app/` is a plain static studio (index.html plus ES
// modules, the OFL fonts and two sample photos) that a desktop browser loads with no network request,
// and `screenshots/` holds four real captures of it. Both are copied beside this file into the output
// directory, then the vendored library writes dossier.json — the summary the judge reads.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The scorer's own caps (reference/gate.json): text_max_bytes shapes the dossier bytes, the rest refuse
// an entry the scorer would refuse anyway — more than four screenshots or one over 256 KiB, more than
// 993 files (or 48 MiB) under app/, or a single app path longer than 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const SHOT_PATTERN = /\.(png|jpg|jpeg)$/i;

function refuse(reason: string): never {
  process.stderr.write(`vice-hour: ${reason}\n`);
  process.exit(1);
}

// Total files and bytes under a directory, so the summary reports what was actually handed in.
function weigh(directory: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = weigh(path);
      files += nested.files;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

const appDir = join(ROOT, 'app');
if (!existsSync(join(appDir, 'index.html'))) refuse('app/index.html is missing — nothing to hand in');

const shotsDir = join(ROOT, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => SHOT_PATTERN.test(name)).sort()
  : [];
if (shots.length < 3 || shots.length > 4) {
  refuse(`screenshots/ must hold 3 or 4 .png/.jpg files, found ${shots.length}`);
}

// Fail early with a plain sentence rather than letting the dossier writer trip over one fat frame.
for (const name of shots) {
  const bytes = statSync(join(shotsDir, name)).size;
  if (bytes > CAPS.screenshots.max_bytes) {
    refuse(`screenshots/${name} is ${bytes} bytes, over the ${CAPS.screenshots.max_bytes} byte cap`);
  }
}

mkdirSync(OUT, { recursive: true });
cpSync(appDir, join(OUT, 'app'), { recursive: true });
cpSync(shotsDir, join(OUT, 'screenshots'), { recursive: true });

const dossier = buildDossier(OUT, CAPS);
writeFileSync(join(OUT, 'dossier.json'), dossier);

const app = weigh(join(OUT, 'app'));
const first = shots[0];
process.stdout.write(
  `vice-hour · ${app.files} app files · ${app.bytes} bytes · ` +
    `${shots.length} screenshots (${first} first) · dossier ${dossier.length} bytes\n`,
);
