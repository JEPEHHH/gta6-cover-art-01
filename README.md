# JEPEHHH/gta6-cover-art-01

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/JEPEHHH/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/JEPEHHH/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

NEON CUT is a poster studio that turns your own photos into GTA-style cover art, entirely offline. Drop up to six pictures into the left rail, and the studio scatters four of them across a hand-painted sunset — the prints sit at three different distances, tilted a degree and a half, with white keylines and hard offset shadows so they read as photographs pasted on a board. Layout, colour grade, framing and caption are all live; the preview redraws on every drag of a slider, and EXPORT PNG renders the same composition at the output size you pick.

Every cover is drawn in one pass: a seeded backdrop paints the sky ramp, the banded sun, the ocean of reflected light, a skyline and leaning palms; each photo is cropped to its panel by focus and zoom, graded, grained and halftoned, then normalised towards the sheet's mean exposure so no panel reads as different stock. On top comes the title block — a magenta kicker ribbon running off frame, an Anton line in cream, a second line as a neon outline with a magenta offset copy, and the studio badge. Nothing is uploaded, nothing is fetched: the whole studio is static files and one canvas.

## Run it

```sh
node serve.ts
```

Then open `http://localhost:8080`. To hand the entry in:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=7kb24zbe&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
