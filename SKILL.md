---
name: animation-video
description: Turn a script or a topic into a short educational animated explainer video (vertical 9:16, 20–75 s) with motion graphics, researched and sourced claims, code-drawn b-roll, icons, charts, UI mock-ups, word-timed captions, an AI voice, an original music bed and a sound effect on every action. Built with HyperFrames in four looks (Warm Paper, Midnight Glow, Storybook Doodle, Bold Editorial) that play side by side in a browser picker before anything renders; only the picked look is reviewed in Studio and rendered. Use this whenever someone wants an explainer, an educational or faceless reel, a TikTok/Reels/Shorts lesson, "script to video", "turn this into an animated video", or says "animation video", even if they don't name a style. Created by Web Asamoah.
---

# animation-video

*A skill by **Web Asamoah**. Follow Web Asamoah for more AI tools.*

You turn a script into a 1080×1920, 30 fps explainer that teaches one idea well. Each line of the
narration gets its own animated visual: kinetic headlines, cards, counters, charts that draw
themselves, phones and chat windows, stamps, code b-roll and a mascot, timed to the spoken words.
It goes out in four looks at once, so the person picks the one they like by watching all four play
in sync. Nothing renders until they say go.

The videos are HyperFrames projects (HTML + GSAP, seeked frame by frame). Read the installed
HyperFrames skills when you need the contract or the CLI (`/hyperframes`, `/hyperframes-core`,
`/hyperframes-cli`); this skill doesn't restate them. In the commands below, `$AV` is this skill's
folder (where this file is) and `$V` is the video's folder.

## Before you start

- **Tools:** Node 22+, ffmpeg with libx264, aac and libmp3lame, Google Chrome, and `whisper-cli`
  (Mac: `brew install whisper-cpp`) with the model `~/.cache/whisper-cpp/ggml-large-v3-turbo-q5_0.bin`
  (or set `AV_WHISPER_MODEL`). HyperFrames runs with `npx --yes hyperframes@0.8.216`, the version
  every generated project pins. Check `node -v`, `ffmpeg -version` and `whisper-cli --help` first.
- **Brand kit:** look in `~/.config/animation-video/brands/` for the person's kits (handle, call to
  action, saved voice, currency, accent colour, logo, disclaimer). `brands/example.json` documents
  every field. Ask which kit to use only if there are several and the brief doesn't say.
- **Where to work:** one folder per video, by default `~/Desktop/VIDEO/<slug>/`.
  `node $AV/scripts/new-video.mjs $V --brand <kit.json>` makes the brief, a starter script, the
  fact-check table, a storyboard, two starter scenes, `voice/`, `assets/` and `brand.json`
  (the scaffold is `scripts/new-video.mjs`).

## Workflow

### 1. Brief: ask only for what's missing
Topic or script, audience, length (default 30–60 s), brand kit, call to action, and anything that
must or mustn't appear. Write the answers into `brief.md`.

### 2. Script and fact-check, then approval
- Write or tighten `script.md`: a `# Title`, then numbered lines, one idea per line. Put the hook in
  the first 2 s, keep to about 150 words a minute, and mark one or two accent words per line
  `*like this*` (they get the look's highlight in headlines and captions). Write cedis as GH¢.
- Check every factual claim on the web and fill `research.md`: the claim, a verdict (verified /
  needs nuance / unverifiable / false), the source URL with the date you read it, and a rewrite
  when needed. Every number that will appear on screen must be in that table.
- Show the person the final script and the fact-check, and wait for their OK.
- How to write lines that hold attention: `references/story.md`. How to fact-check:
  `references/research.md`.

### 3. Voice
- Default: vidIQ voices (`vidiq_voiceover_list_voices` for 2–3 options with preview links, or the
  kit's saved voice). Check the balance first (`vidiq_balance`, free), then **say the cost before
  generating**: about 14 credits per 1,000 characters of script. Generate one take of the whole
  script (`vidiq_voiceover_generate`), poll it (`vidiq_job_poll`), and pass its MP3 URL on:
  `node $AV/engine/voice.mjs $V --mp3 <url-or-file>` (that is `engine/voice.mjs`).
- It writes `voice/vo.wav` (levelled to −16 LUFS) and `voice/words.json` (every script word with
  its spoken time, from local Whisper), and prints `{duration, words, unmatched}`. If `unmatched`
  lists more than a couple of words, check those lines for a mispronunciation or a changed word,
  then fix the script or re-voice.
- Other voices (their own recording, an ElevenLabs key, local Kokoro): `references/audio.md`.

### 4. Storyboard and scenes
- `storyboard.json` lists the scenes in order: `{ "id", "src", "lines": [first, last], "hold" }`.
  Each scene owns whole script lines; the last scene's `hold` keeps the call to action on screen
  (at least 3 s). Aim for a new visual every 1–2.5 s: give a long line several elements.
- Write each scene once, for all four looks, in `scenes/<id>.html`. Start from a blueprint in
  `blueprints/` (hook, step, list, big-number, compare, chart, flow, timeline, definition, ui-chat,
  ui-terminal, phone, broll, grid-focus, quiz, recap, cta; for example `blueprints/hook.html`):
  copy it, rename its `data-composition-id` to the scene id, and change the words.
- Scenes are made of primitives (`<av-headline>`, `<av-counter>`, `<av-phone>`…), timed with
  `data-at` refs to spoken words (`data-at="script"`, `"L4"`, `"end-1.5"`), so a new voice re-times
  everything by itself. Every primitive, attribute, verb and ref: `references/scenes.md`.
- Each look draws the primitives its own way (`references/looks.md`). Icons, images, b-roll and AI
  media: `references/assets.md`.

### 5. Build all four looks and check them
```sh
node $AV/engine/build.mjs $V            # --draft before there is a voice, --silent for quick visual passes
```
The build (`engine/build.mjs`) writes `looks/paper`, `looks/glow`, `looks/doodle` and
`looks/editorial` (complete HyperFrames projects with the voice, the look's music bed and sound
bank) and `picker.html`. Then, for each look:
```sh
npx --yes hyperframes@0.8.216 check $V/looks/<look> --json
npx --yes hyperframes@0.8.216 snapshot $V/looks/<look> --review --json
```
Read the review sheets it lists (every scene's start and middle, each cut, phone width) and fix what
you see before showing anyone. Errors must be zero; explain any warning you leave.
`references/qa.md` covers the checks, the traps and the safe zones.

### 6. Pick a look (no rendering)
`node $AV/engine/serve.mjs $V` (`engine/serve.mjs`) prints the Look Picker's address: four
phone-sized players in sync with the real voice; only the selected one plays sound. Open it in the
browser for the person. They pick with **☆ Make this my pick** on a card, or tell you and you run
`node $AV/engine/pick.mjs $V <look>` (`engine/pick.mjs`; with no look it prints the pick). The pick is
kept in `pick.json` and the picked look is locked (`.av-master`); changing the pick later keeps every
look picked before locked, so its Studio edits stay safe. The build refuses to overwrite a locked look,
because Studio edits live there (it also refuses any look edited since its build, and names the
files). Kit fixes reach it with `--kit`, which leaves compositions and audio alone; other looks
rebuild with `--looks glow,editorial`; `--force` rebuilds it anyway and keeps the old project as
`looks/<look>.bak-<n>/`, so edits can be copied back.

**Quick word "all looks"** (also "all styles", "build all looks"): rebuild every look at once with
`node $AV/engine/build.mjs $V --all`, then open or reload the Look Picker. A picked or edited look
keeps its project and only takes kit fixes; without a voice yet it builds with draft timing. The
picker's **⟳ Build all looks** button does the same from the browser while `engine/serve.mjs` runs.
For one style, say "build glow" (or any look's name): `node $AV/engine/build.mjs $V --all --looks glow`;
each card in the picker has a **⟳ Build this look** button for the same.

### 7. Review in Studio
```sh
cd $V/looks/<look> && npx --yes hyperframes@0.8.216 preview --background
```
Hand over `http://localhost:<port>/#project/<name>` (the port and name it prints). The person plays
it there, edits text or timing, or asks you for changes. Never render before they say go.

### 8. Render, master, verify, deliver
Only after an explicit go:
```sh
node $AV/engine/render.mjs $V --looks <look>
```
`engine/render.mjs` renders the look at delivery quality, masters it (`engine/audio/master.mjs`: −14
LUFS, true peak at or below −1 dBTP) and takes a cover from the end of the hook, giving
`renders/<slug>-<look>.mp4` and `renders/<slug>-<look>-cover.jpg`; it prints the loudness. The Look
Picker's **🎬 Render this look** and **🎬 Render all looks** buttons do the same; the person pressing
one is their go (never render unasked). Each card then links **▶ Watch the render**. Make a 1 fps
contact sheet of the final file and read all of it (`references/qa.md`). Deliver:
- `renders/<slug>-<look>.mp4`;
- its cover (pick a better frame with the hook line clean if the automatic one isn't);
- `renders/caption.txt`: a two-line post caption, the sources from `research.md`, and the kit's
  disclaimer for money or health topics;
- an honest note of what you couldn't check, for example "I haven't listened to the mix; loudness
  was checked by numbers".

## Rules that always hold

- **Honest content.** Never invent statistics, testimonials, reviews, follower or view counts, or
  "first 100 people" scarcity. On-screen numbers come only from `research.md`. Finance lessons carry
  a short "Education, not financial advice." line.
- **Credits are announced.** Say what a vidIQ voice, AI image or AI clip will cost and wait for a yes.
  Code b-roll, icons, music and sound effects are free; prefer them.
- **Review before render.** The picker and Studio come first; render only the picked look, after go.
- **Media as shot.** Generated or supplied footage and photos keep their colours: no grading.
- **Their identity, not the references'.** Reference videos inform structure and pacing; their
  mascots, assets and exact copy are never reused. Real logos and product screens come from the real
  source, never redrawn.
- **Readable on a phone.** Key content inside x 60–960, y 220–1520; captions sit at x 60–960, y 1400–1540;
  content text 36 px and up (only title bars, file tabs and the watermark go down to 28 px).
