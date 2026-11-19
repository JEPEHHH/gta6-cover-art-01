# JEPEHHH/gta6-cover-art-01

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/JEPEHHH/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/JEPEHHH/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**VICE HOUR** is a poster studio that turns your own photos into a GTA-style cover. Drop up to six photos, pick a layout (collage, hero trio, grid, strip, single, quintet), a size (1080×1080, 1080×1350, 1920×1080) and one of four grades, then write a kicker, a two-line title and a tagline — the covers redraw live while you drag a panel's focus, wheel its zoom, or nudge it with the arrow keys. Everything runs offline in the browser: no build step, no npm packages, no upload, and the export is a full-size PNG straight from the canvas.

Each cover is drawn, not assembled from templates. A painted retro scene comes first — a seeded sunset gradient, a striped sun disc over the ocean, a skyline, palm silhouettes and birds, all deterministic from the caption so the same words always paint the same sky. Photos are pasted over it as prints: cover-cropped around each panel's focus point, graded, then measured and pulled towards the frame's mean exposure and saturation so no print looks like a different film stock. The title block is fitted to the same rectangle it is clipped against, so nothing ever overflows.

## Run it

```sh
node serve.ts
# then open http://localhost:8080

mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=7kb24zbe&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
