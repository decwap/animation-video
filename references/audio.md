# Audio: voice, music, sounds, master

## Voice

**Default: vidIQ voices** (ElevenLabs voices through the vidIQ tools).
1. `vidiq_balance` (free) to see the credits left.
2. `vidiq_voiceover_list_voices`: offer 2–3 voices with their preview links, or use the brand kit's
   saved `voice.id`.
3. Say the cost and wait for a yes: about 14 credits per 1,000 characters of `script.md` (count the
   spoken text, not the line numbers).
4. `vidiq_voiceover_generate` with the whole script as one take, then `vidiq_job_poll` until it's
   done. One take keeps the delivery consistent.
5. `node $AV/engine/voice.mjs $V --mp3 <the mp3 url>` downloads it into `voice/vo.mp3`, levels it to
   −16 LUFS (`voice/vo.wav`), runs Whisper (`voice/whisper.json`) and writes `voice/words.json`.

**Other voices**, same last step (`--mp3` takes any audio file):
- the person's own recording: one take, reading the script as written;
- an ElevenLabs API key: generate the MP3 with it;
- local Kokoro through HyperFrames: `npx --yes hyperframes@0.8.216 tts` (needs Python 3.10–3.13
  with `kokoro-onnx`).

**Re-voicing** re-times the whole video: run `voice.mjs` again and rebuild. If the script changed,
the build refuses an old `words.json`; make the voice again.

`unmatched` lists script words Whisper didn't hear as written. One or two (a name, a number said
differently) are fine; their times are shared between the neighbours. More means the voice skipped
or changed words: compare that line with the take.

## Music

Each look composes its own bed in code (`engine/audio/music.mjs`), seeded, so the same video always
gets the same music and nothing needs a licence:
- Paper: warm lo-fi, soft swung drums, sub bass, held chords, a pluck motif.
- Glow: synthwave, four-on-the-floor, pulsing bass, wide pad, 16th-note arps.
- Doodle: warm acoustic, a soft rim and shaker, sub bass, a held pad, a plucked-guitar motif.
- Editorial: news drive, punchy drums, driving bass, bell stabs, a sting on scene changes.

The `music.mjs` composer also has a `playful` feel (marimba, claps on two and four, bouncy bass) for
custom looks.

It fills the video's length, fades in over 0.25 s and out over 1.5 s, and ducks 9 dB under the
voice (words closer than 0.9 s count as one stretch, so it only lifts in real pauses). The build
writes it 8.5 LU under the voice. The look's preset (`music` in `look.mjs`) sets tempo, chords and
feel; set `"music": false` in a custom look for voice and sounds only.

## Sound effects

Each look has a bank of 12 sounds synthesised in code (`engine/audio/bank.mjs` from the cues in
`engine/audio/sfx.mjs`): `pop`, `whoosh`, `swish`, `tick`, `type`, `ding`, `stamp`, `draw`,
`riser`, `impact`, `click`, `sparkle`. Every action gets one automatically (the mapping is in
`references/scenes.md`); `data-sfx` changes or silences it. Each sound plays at the look's level for
it (`sfxGain`), on its own track, from its exact start.

HyperFrames' bundled stock sound effects may be used inside a person's own project, but they're
never copied into this skill.

## Master and verify

`node $AV/engine/audio/master.mjs <rendered.mp4> <final.mp4>`: two-pass loudness normalisation to
−14 LUFS integrated with true peak at or below −1 dBTP (what Reels, TikTok and Shorts play at),
video copied untouched, AAC 256 kbps at 48 kHz. It prints the measured result.

You can't hear the mix, so check it by numbers and say so:
- the master's printout: −14 ± 1 LUFS, true peak ≤ −1 dBTP;
- the voice about 8 LU above the music (measure `assets/audio/vo.wav` and `music.wav` with
  `measureLoudness` from `engine/audio/loudness.mjs`, or `ffmpeg -i f -af ebur128 -f null -`);
- a sound under every visible action (the build places them from the same refs as the visuals).
