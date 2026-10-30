# QA: checks, traps, safe zones

Look at the video, constantly. Every build gets a HyperFrames check and a review sheet per look,
and you read the sheets before anyone sees the picker.

## The loop

```sh
node $AV/engine/build.mjs $V
npx --yes hyperframes@0.8.216 check $V/looks/<look> --json          # lint, runtime, layout, motion, contrast, craft
npx --yes hyperframes@0.8.216 snapshot $V/looks/<look> --review --json   # review sheets: scenes, cuts, phone width
npx --yes hyperframes@0.8.216 snapshot $V/looks/<look> --at 12.4,13.0 --no-end   # a closer look at moments
```

- Errors must be zero before the picker. Fix warnings, or say why one stays.
- Read every review sheet (`review-beats-*.jpg`, `review-seam-*.jpg`, `review-phone-*.jpg`): text
  clipped or overlapping, an empty frame, something hidden behind the next scene, a caption covering
  content, a chart that didn't draw, a number that wrapped.
- Check the first frame: it's the thumbnail on most players, so the hook should already be visible.

## Safe zones (1080 × 1920)

- Key content: x 60–960, y 220–1520. The platform's buttons and text own the right edge and the
  bottom. `.av-stage` keeps to x 60–960, y 220–1380, and no content element is wider than 900 px.
- Captions: x 60–960, y 1400–1540, one track, added by the build. Nothing else important there.
- Watermark: top right, under the platform's top bar.
- Text: content text 36 px and up (labels, chips, chart text, handles); headlines 56 px and up.
  Only window title bars, file tabs, the watermark and Editorial's masthead go down to 28 px.

## Traps and what the checks mean

| You see | Why | Fix |
|---|---|---|
| `line_unread` | text leaves (scene ends) before it can be read: about 0.5 s + 0.3 s a word | bring the element in earlier (an earlier word ref), shorten the text, or give the line its own scene |
| `text_below_floor` | text under 28 px (and anything under 36 px is too small for content here) | raise it to 36 px; scale the container instead of the font |
| `contrast_aa_failure` | text against its background under 3:1 (large) or 4.5:1 | darken the text or the panel; if it's mid-animation or the checker sampled the page instead of a panel, confirm with `snapshot --at <time>` and leave it |
| `content_overlap` held | two elements on top of each other for a while | move one, or `data-out` the first before the second arrives |
| `container_overflow`, `escaped_container`, `panel_out_of_canvas` | something extends past its box or the frame | move it in; for decoration that bleeds on purpose, mark it `data-layout-allow-overflow` |
| a ref error at build | the word isn't spoken in that scene (the error lists the scene's words) | use a word from the list, `L<n>`, or seconds |
| "unknown icon" | not in `kit/icons` | pick a bundled name |
| a scene shows nothing | custom CSS clipped its content, or a script threw | check the console in Studio; keep the scene root `position:absolute; inset:0` |
| the voice and visuals drift | `words.json` is from an older take | run `engine/voice.mjs` again, rebuild |
| a long word overflows a headline | very long words in big type | headlines and counters shrink to fit; break the line with `<br>` or pick a smaller `size` |

## Before the render

- Picked look checked and its review sheets read; the person has seen it in Studio and said go.
- Every on-screen number traces to `research.md`.
- The CTA holds at least 3 s and is the last thing on screen (the last scene doesn't fade out).

## After the render

```sh
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration $V/renders/<slug>.mp4
ffmpeg -v error -i $V/renders/<slug>.mp4 -vf "fps=1,scale=270:-1,tile=6x5" $V/renders/sheet-%02d.jpg
```

Expect h264 1080×1920 at 30 fps with AAC audio, and the length the build printed. Read every
contact sheet. The master's printout should say −14 ± 1 LUFS and a true peak at or below −1 dBTP.
For the cover, take a frame where the hook line is fully on screen:
`ffmpeg -v error -ss <t> -i $V/renders/<slug>.mp4 -frames:v 1 $V/renders/cover.jpg`.

## What you can't check

You can't hear it: say that the voice, music and sounds were checked by numbers (loudness, levels,
placement), not by ear. Say which claims are "needs nuance" in the caption, if any.
