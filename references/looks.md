# The four looks

Every video is built in all four. The words, numbers, claims, timing and scene order are the same;
each look draws its own version of every primitive, with its own decor, transitions, captions,
music and sound bank. The person picks one in the Look Picker.

| | Warm Paper | Midnight Glow | Storybook Doodle | Bold Editorial |
|---|---|---|---|---|
| Ground | cream `#F3EDE4`, soft peach glows, dot grid | near-black `#060913`, drifting aurora, faint grid, particles | notebook `#FBF6EA`, ruled lines, red margin | newsprint `#EFE9DD`, halftone corners, black rules, masthead |
| Accent | orange `#D4613A` | cyan → violet → pink | coral `#E85A4F`, marker yellow `#FFD84D`, teal | red `#E3342F`, yellow `#FFE14D` |
| Type | Inter 900 + Instrument Serif italic accents + JetBrains Mono labels | Outfit 800 + glowing accents + mono data | Nunito 900 + Caveat handwriting | League Gothic slabs + Playfair Display + Archivo Black + IBM Plex Mono |
| Motion | words blur-rise, cards swing in on soft springs and settle tilted | blur-to-sharp, glass rises, scan beams and light sweeps | lines draw themselves, bouncy pops, hand-drawn wobble | words slam in, clippings drop, stamps shake the frame |
| Transitions | blur dissolve with a lift | blur zoom-through | page slide with a slight tilt | hard clip wipe |
| Captions | black bold, accent in an orange pill | white, accent glowing cyan | ink, accent in coral | white on black bars, accent yellow |
| Character | pixel camera | orb bot | star with a face | stamp seal |
| Music | warm lo-fi (96 bpm, Fmaj7–Em7–Dm7–Cmaj7, plucks) | synthwave pulse (110 bpm, Am–F–C–G, arps and pads) | warm acoustic (92 bpm, C–G–Am–F, plucked guitar, shaker) | news drive (120 bpm, Dm–B♭–F–C, punchy drums, stings on scene changes) |
| Sounds | soft, warm, woody | synth blips and airy sweeps | gentle pops, paper flips, pencil scribbles, a chime | typewriter keys, paper flips, a heavy stamp |
| Best for | calm tutorials, AI tools, personal finance | tech, AI, data, futures | kids, beginners, light topics | news, hot takes, market moves |

Kit files: `kit/looks/paper`, `kit/looks/glow`, `kit/looks/doodle`, `kit/looks/editorial`, each
with `look.mjs` (markup overrides, sounds, music preset, decor), `look.css` (tokens and styles)
and `motion.js` (verbs). Shared markup lives in `kit/looks/shared.mjs`, the runtime in
`kit/core/av.js`, structure in `kit/core/base.css`.

## How the looks differ per primitive

- **Paper:** white rounded cards with long soft shadows; documents are white `script.txt` cards;
  icons duotone in rounded tiles; the mascot is a pixel camera that hops and blinks.
- **Glow:** glass panels with a light sweep across them; documents get a scan beam; charts and
  timelines glow; the orb bot arrives like the glass panels; particles drift in the decor.
- **Doodle:** thick ink outlines with a wobbly radius and a hard offset shadow; documents are
  hand-drawn pages and videos are a TV with legs; icons are roughened; strokes draw themselves.
- **Editorial:** big condensed slabs; documents are torn newspaper clippings (with a `dateline`);
  stamps hit with a camera shake; a static masthead ("THE EXPLAINER · VOL. 01") tops every frame (no
  scrolling ticker, so it reads as calmly as the other looks).

## Brand on top of a look

From the video's `brand.json`:
- `handle` (or `name` when there's no handle) is the watermark at the top right of every frame.
- `accent` (a hex colour, e.g. `#C32126`) replaces every look's accent colour.
- The call to action, currency, logo and disclaimer are for you to use in the scenes (see
  `brands/example.json`).

Brand decoration (kickers, mastheads, mascots, particles) never carries a claim, so it needs no
fact-check. Anything that states a fact does.

## Choosing and changing

- Build all four every time; let the person choose in the picker. Recommend one only if asked.
- After the pick, that look's project is the master (`.av-master`): Studio edits live in it, and
  the build refuses to overwrite it. To try another look later, build only that one
  (`--looks glow`) and carry the person's text edits across by hand.

## Making a fifth look

Copy a look folder in `kit/looks/`, rename its `id`, then:
- `look.mjs` exports `{ id, label, fonts, primitives, sfxFor, sfxGain, sfxBank, music, decor }`.
  Start `primitives` from `base()` in `kit/looks/shared.mjs` and override what you draw differently.
  `sfxBank` maps the 12 sound names to cue recipes from `engine/audio/sfx.mjs`
  (`{ make: 'pop', d, n, v }`); `music` is `{ bpm, feel: 'lofi' | 'synthwave' | 'playful' | 'news',
  progression: [4 chords], lead, drums, pad, claps, stings }`.
- `look.css` sets the tokens (`--av-bg`, `--av-ink`, `--av-paper`, `--av-accent`, `--av-accent2`,
  `--av-glow`, fonts) and styles every `.av-*` class. Bundle fonts in `kit/fonts` (OFL).
  Don't put SVG filters inside CSS `url()` images: the renderer paints them as solid boxes.
- `motion.js` calls `AV.setPreset({...})` and `AV.defineVerbs({...})` for the verbs it moves
  differently (`sceneIn`, `sceneOut`, `wordsIn`, `objectIn`, `stamp`, `captionIn`, `decorTimeline`…).
- Add its id to `LOOKS` in `engine/config.mjs` and run the suite (`npm test`) and the gallery
  (`node tests/gallery/run.mjs --looks <id>`), then read its review sheets.
