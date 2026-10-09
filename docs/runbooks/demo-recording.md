# Recording the demo video automatically

`apps/web/demo/record-demo.mjs` drives a real browser through the 11 segments of
[the demo script](../product/demo-video-script.md) and records it: a visible cursor, click ripples, captions
burned into the page, and an optional macOS voice-over. Re-run it after any UI change and the video is fresh.

## Prerequisites

- The docker compose stack is running with demo data (`seed_demo`, then `seed_demo_history`). Do **not** seed
  `seed_e2e`. The script creates one opportunity, a proposal and an approval each run, so use a throwaway database.
- Real AI, so the provenance badge reads "Generated locally with Ollama". The built-in `fake` provider returns a
  plain sentence, which the API rightly rejects (502), so the AI steps need a real model:
  `AI_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:7b AI_REQUEST_TIMEOUT_SECONDS=120 docker compose up -d api`
  and warm the model once. Restore with `docker compose up -d api` afterwards.
- `ffmpeg` on the PATH (and macOS `say` for `--voice`).

## Run

```bash
cd apps/web
DEMO_FAST=1 npm run demo:record     # quick rehearsal, short pauses, no voice
npm run demo:record                 # real pace, captions only
npm run demo:record -- --voice      # real pace plus a voice-over
```

Output: `apps/web/demo/out/quotedrive-demo.mp4` (1440×900, git-ignored). Each caption stays up until its
voice-over clip has finished. The real AI waits (20 to 60 seconds) are recorded as they happen: trim them in an
editor, or speed those spans up.

## Changing the story

Edit the segment blocks in the script; each one is numbered like the table in the demo script. Helpers:
`click`, `typeInto`, `glide` (human-paced mouse), `caption`, `login`, `logout`.

## Background music (optional)

`apps/web/demo/make_music.py` synthesises an original ambient track with the Python standard library: no
samples and no downloaded audio, so there is nothing to license and nothing for YouTube's Content ID to match.

```bash
python3 apps/web/demo/make_music.py 262 apps/web/demo/out/music-dry.wav   # seconds = video length, about 1 minute
```

Then soften and level it (about -23 LUFS, quiet enough not to compete with the subtitles) and add it to the video:

```bash
ffmpeg -i music-dry.wav -af "pan=stereo|c0=c0|c1=c0,lowpass=f=5500,aecho=0.8:0.75:70|140|230:0.3|0.22|0.15,adelay=0|14,loudnorm=I=-24:TP=-3:LRA=6,afade=t=in:d=3" -ar 48000 music.wav
ffmpeg -i video.mp4 -i music.wav -c:v copy -c:a aac -b:a 192k -map 0:v -map 1:a -shortest video-music.mp4
```
