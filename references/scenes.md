# Scenes: primitives, verbs, word refs

A scene is one HyperFrames sub-composition, written once and built into all four looks. You place
**primitives** (`<av-headline>`, `<av-phone>`…), say **when** each enters with a ref to the spoken
words, and the build turns them into each look's own markup, motion and sound.

## Anatomy

```html
<!doctype html>
<html>
<head><meta charset="UTF-8" /></head>
<body>
<template>
  <style>
    #root { position: absolute; inset: 0; }
    [data-composition-id="why-gse"] .av-doc { width: 380px; }   /* scope custom CSS to the scene */
  </style>
  <div id="root" data-composition-id="why-gse" data-width="1080" data-height="1920">
    <div class="av-stage">
      <av-kicker id="kick" data-at="start+0.1">Quick lesson</av-kicker>
      <av-headline id="head" size="l" data-at="start+0.3">Why the <em>GSE</em> moves slowly</av-headline>
      <av-counter id="n" to="42" label="listed companies" data-at="companies" data-sfx="tick"></av-counter>
    </div>
  </div>
</template>
</body>
</html>
```

- File: `scenes/<id>.html`, listed in `storyboard.json` with the script lines it covers.
- `data-composition-id` is the scene id (lowercase letters, digits, dashes; not `main`, `decor`,
  `captions`, `watermark`, `vo` or `music`).
- Ids inside a scene become `<scene>--<id>` (all scenes share one page). Use `q('#id')` in scripts.
- Captions, the watermark, the decor, the voice, music and sounds are added by the build. Don't
  write them.
- Start from `blueprints/` (17 working scenes; each file's header says what it's for and when).

## Layout helpers

- `.av-stage`: the safe content area (x 60–960, y 220–1380, clear of the platform's buttons on the
  right), a centred column with 44 px gaps. Keep custom elements 900 px wide at most.
  Add `is-top` to stack from the top. Captions sit below it at y 1400–1540.
- `.av-row`, `.av-col`, `.av-grid`: flex row, flex column, grid (set `grid-template-columns`
  yourself), each centred. `.av-spacer` takes the free space.
- Position one-offs with inline `style` (e.g. a mascot at `position:absolute;right:130px;top:700px`;
  keep `right` at 120 px or more so nothing sits under the buttons).

## Timing: `data-at` and other refs

Each primitive with `data-at` enters at that moment (scene-local); without it, it's on from the start.

| Ref | Means |
|---|---|
| `script` | the first "script" spoken in this scene (case and punctuation ignored) |
| `script#2` | the second "script" in this scene |
| `script$` | the end of that word |
| `L4` | the first word of script line 4 |
| `w12` | word 12 of the whole script (0-based) |
| `0.8s` | 0.8 s into the scene |
| `start`, `end` | the scene's edges |
| any of these `+0.2` / `-0.1` | plus or minus seconds |

- A ref to a word the scene doesn't speak fails the build with the scene's words listed.
- A time past the scene's end is pulled to just before it, with a warning.
- `data-out="<ref>"` makes the element leave then (`objectOut`).
- Word refs are what make re-voicing safe: prefer them to seconds for anything tied to speech.
- Leave room before a scene ends: text needs about 0.5 s + 0.3 s a word on screen.

## Attributes every primitive takes

| Attribute | What it does |
|---|---|
| `id` | name it (refs in scripts, scoped CSS) |
| `data-at` | when it enters |
| `data-out` | when it leaves |
| `data-verb` | animate with another verb (e.g. `data-verb="stamp"` on a chip, `data-verb="pulse"`) |
| `data-sfx` | the sound on entry: a sound name, or `none` |
| `data-rot` | settle at a slight tilt, in degrees (Paper, Doodle and Editorial; Glow keeps cards straight) |
| `data-dur` | length of the main move for `countUp`, `drawChart`, `drawPath` |
| `class`, `style` | layout and one-off styling |

## The 24 primitives

Text:
- `<av-kicker>Did you know?</av-kicker>`: a small label above a headline. Verb `textIn`.
- `<av-headline size="l">Turn any <em>script</em> into <mark>video</mark></av-headline>`: the big
  line. `size` = `xl` / `l` / `m` / `s` (104 / 88 / 72 / 56 px; Editorial's slabs run bigger), or
  `px="80"`. `<em>` = accent word, `<mark>` = highlighted word, `<br>` = line break. It shrinks to
  fit its width. Verb `wordsIn`: each word lands when it's spoken, if it's spoken in the scene.
- `<av-mark>the fees</av-mark>`: an inline phrase that gets a marker swipe. Verb `highlight`.
- `<av-chip icon="sparkles">1 script → 4 looks</av-chip>`: a small pill, optional icon.
- `<av-note>obviously.</av-note>`: a short aside in the look's hand/serif voice.
- `<av-stamp rot="-8">NEW</av-stamp>`: slams in at an angle. Verb `stamp`.

Numbers and data:
- `<av-counter to="5942" from="0" dec="0" prefix="" suffix="+" currency="GHS" label="stocks"></av-counter>`:
  counts up to `to`. `currency` = `GHS` (writes GH¢ 1,234), `USD`, `EUR`, `GBP`. Verb `countUp`.
- `<av-chart type="line" values="3,5,4,8,12" labels="M,T,W,T,F" highlight="4" unit="%" title="…" source="…"></av-chart>`:
  `type` = `line` / `bar` / `donut`; `highlight` is the 0-based point to call out; use `|` between
  labels if a label has a comma. Draws itself. Verb `drawChart`.
- `<av-progress step="2" total="7" kind="dots" label="STEP 02 / 07"></av-progress>`: `kind` = `dots`
  / `bar` / `ring`; `label=""` hides the label. Verb `progress`.
- `<av-track clips="Hook:3|Steps:4|Proof:2|CTA:2"></av-track>`: an editor timeline; `label:width`
  per clip, a playhead runs across.

Objects and UI:
- `<av-doc title="script.txt" lines="6" hl="2"></av-doc>`: a document; `lines` = placeholder bars,
  or `items="First line|Second line"` for real text; `hl` = the 1-based highlighted line.
  Editorial adds `dateline="THE EXPLAINER · AI DESK"`.
- `<av-video label="explainer.mp4" title="…" src="assets/media/thumb.jpg"></av-video>`: a video card
  (the look's own thumbnail art unless `src` is given).
- `<av-phone>…</av-phone>`: a phone; put other primitives or HTML inside as its screen.
- `<av-window title="Claude">…</av-window>`: an app/browser window with content inside.
- `<av-chat messages="user: Make a reel about my shop|ai: On it. Writing reel.html"></av-chat>`:
  messages typed one after another (`user:` / `me:` on the right). Verb `typeText`
  (`data-cps` characters a second, default 32; `data-gap` seconds between messages, default 0.3).
- `<av-terminal title="claude" lines="$ claude|> make a reel|✓ done"></av-terminal>`: typed terminal
  lines; lines starting with `$` or `>` are commands. Verb `typeText`.
- `<av-image src="assets/media/photo.jpg" alt="…" caption="…"></av-image>`: a framed photo with a
  slow push. Verb `kenBurns`.
- `<av-icon name="rocket" size="150"></av-icon>`: an icon tile (Lucide names, see `kit/icons`).
- `<av-arrow dir="right"></av-arrow>`: a hand-drawn connector, `right` / `left` / `up` / `down`.
  Verb `drawPath`.
- `<av-item icon="check" title="Scans charts" text="Thousands, in seconds"></av-item>`: a list row,
  with `icon` or `num="1"`.
- `<av-split a-title="Before" a-text="Hours" a-icon="clock" b-title="After" b-text="One prompt" b-icon="sparkles" label="vs"></av-split>`:
  two sides that arrive in turn.

Characters, b-roll, ending:
- `<av-mascot pose="wave"></av-mascot>`: the look's character (pixel camera, orb bot, star, seal).
  Paper's camera hops and blinks; the other characters enter like any object. `pose` is only added as
  a class (`av-mascot--wave`), for your own CSS.
- `<av-broll name="city" seed="7" w="900" h="720"></av-broll>`: a code-drawn moving scene in the
  look's colours: `city`, `money`, `network`, `globe`, `ticker`, `burst`, `docs`. Free and
  unlimited. Verb `broll`.
- `<av-cta keyword="ANIMATE" line="and I'll send you the skill, free" handle="@you" verb="Comment"></av-cta>`:
  the call to action; `handle` defaults to the brand's. Hold it at least 3 s (the last scene's `hold`).

## Verbs

The default verb comes from the primitive (above); `data-verb` swaps it. Each look implements
these its own way.

| Verb | Does | Options |
|---|---|---|
| `sceneIn` / `sceneOut` | the scene's own transition (look-specific: blur dissolve, zoom-through, page slide, clip wipe); the last scene holds instead of leaving | — |
| `textIn` | fades/rises one block of text | — |
| `wordsIn` | headline words, each on its spoken time | `data-sync="off"` for an even stagger, `data-stagger` |
| `objectIn` | the look's entrance for cards and objects, plus the primitive's inner details (doc lines fill, play button pops, split sides arrive) | `data-rot` |
| `objectOut` | leaves at `data-out` | — |
| `countUp` | counts the number | `data-dur` (1.2 s) |
| `typeText` | types chat messages / terminal lines | `data-cps`, `data-gap` |
| `drawPath` | draws strokes (arrows, your own SVG paths) | `data-dur` (0.6 s) |
| `drawChart` | draws lines, grows bars, then labels and dots | `data-dur` (1.2 s) |
| `highlight` | marker swipe behind a phrase | — |
| `stamp` | slams down (Editorial adds a camera shake) | `rot` |
| `focus` | enlarges this element and dims its siblings | — |
| `pulse` | bounces in place to draw the eye | `data-times` (2) |
| `kenBurns` | slow push into an image | — |
| `broll` | runs the b-roll animation for the scene | — |
| `progress` | fills dots, ring or bar to the step | — |
| `captionIn` / `captionOut` | caption groups (automatic) | — |

## Sound on every action

Each entry gets a sound from the look's own bank unless `data-sfx` says otherwise:
`stamp` → stamp, `countUp` → tick, `typeText` → type, `highlight`/`focus` → swish,
`drawPath` → draw, `drawChart` → riser, `progress` → click, `pulse` → pop, `kenBurns`/`broll` →
whoosh, `objectIn` → ding for the call to action, whoosh for big objects (doc, video, phone, window,
image, chart, track, split, b-roll, chat, terminal), pop for the rest. Headline words and kickers are
silent (the voice carries them). Names: `pop`, `whoosh`, `swish`, `tick`, `type`, `ding`, `stamp`,
`draw`, `riser`, `impact`, `click`, `sparkle`. Don't stack more than two sounds in the same 0.2 s.

## Your own moments

Anything the primitives don't cover goes in a scene script, still seek-safe:

```html
<svg id="orbit" width="600" height="600">…</svg>
<script>
  AV.scene("why-gse", (tl, q, { t, dur, rng }) => {
    tl.fromTo(q('#orbit'), { rotation: 0 }, { rotation: 90, duration: dur, ease: 'none' }, 0);
    tl.to(q('#n'), { scale: 1.1, duration: 0.3, yoyo: true, repeat: 1 }, t('liquidity'));
  });
</script>
```

- `t('word')` resolves any ref at run time; `rng()` is a seeded random; `dur` is the scene length.
- Use the look's colour tokens (`var(--av-accent)`, `--av-ink`, `--av-paper`, `--av-bg`,
  `--av-accent2`, `--av-glow`) so every look's treatment still applies.
- No clocks, `Math.random`, network or CSS transitions: HyperFrames seeks frames out of order.
- Put custom moments in all four looks' colours by default; drawing four different versions is the
  exception.
