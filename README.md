# animation-video

**Animated explainer videos from your script, made by Claude on your own computer.**
A free skill by **Web Asamoah**. Follow Web Asamoah for more AI tools.

Give Claude a script or just a topic. It tightens the script for retention, fact-checks every claim,
voices it, animates every line (headlines, cards, counters, charts, phones, chat windows, stamps,
code-drawn b-roll and a mascot, all timed to the voice), composes the music and sound effects, and
builds the video in **four looks at once**. You watch all four play side by side in your browser,
pick one, review it, and only then does it render.

## What you get

- **1080×1920 vertical video, 20–75 s, 30 fps**, ready for Reels, TikTok and Shorts.
- **Four looks, every time:** Warm Paper, Midnight Glow, Storybook Doodle and Bold Editorial. Same
  words and facts; each look draws its own visuals, motion, captions, music and sounds.
- **A Look Picker:** the four versions play in sync in your browser before anything renders. You
  pick; only your pick is reviewed and rendered. Changed a scene? Press **⟳ Build all looks** in the
  picker, or just tell Claude "all looks", and every style is rebuilt at once. Each style also has its
  own **⟳ Build this look** button (or tell Claude "build glow"), and **🎬 Render this look** turns it
  into a finished MP4 in `renders/`, mastered and with a cover. Changed your mind? **☆ Make this my
  pick** on another card switches the pick; the old one keeps your edits.
- **Claims with sources:** every fact is checked on the web first, and on-screen numbers come only
  from that fact-check. The sources go in your post caption.
- **Captions timed to every word,** with the key words highlighted.
- **An original soundtrack:** a music bed per look and a sound effect on every action, all made in
  code, so there's nothing to license. Mastered to −14 LUFS, the level social platforms play at.
- **Editable before render:** your pick opens in HyperFrames Studio, where you can play it and
  change text or timing, or ask Claude for changes.

## Set up (about 10 minutes on a Mac)

You need **Claude Code** on your computer (the videos build and render there) and **Google Chrome**.
Then, in Terminal:

1. **Tools** (with [Homebrew](https://brew.sh)): Node.js 22 or newer, ffmpeg, and whisper.cpp for word timing.
   ```
   brew install node ffmpeg whisper-cpp
   ```
2. **The word-timing model** (about 570 MB, once):
   ```
   mkdir -p ~/.cache/whisper-cpp && curl -L -o ~/.cache/whisper-cpp/ggml-large-v3-turbo-q5_0.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
   ```
3. **The skill:** download `animation-video.skill` from the
   [latest release](https://github.com/decwap/animation-video/releases/latest), then unzip it into your
   Claude skills folder, so the path ends in `~/.claude/skills/animation-video/SKILL.md`:
   ```
   mkdir -p ~/.claude/skills && unzip ~/Downloads/animation-video.skill -d ~/.claude/skills
   ```
4. **Restart Claude Code.** Type `/animation-video` or just ask for an animated explainer.
5. **Your brand (optional, recommended):** copy `brands/example.json` to
   `~/.config/animation-video/brands/<your-brand>.json` and fill in your handle, call to action, saved
   voice, currency, and optionally your accent colour, logo and disclaimer.

HyperFrames (the video engine) runs through `npx`, so there's nothing else to install. On Windows or
Linux, install Node.js 22+, ffmpeg and whisper.cpp (`whisper-cli`) from their own sites and unzip the
skill into `~/.claude/skills/` the same way. To check the install, run
`cd ~/.claude/skills/animation-video && npm test`.

**A voice:** with the vidIQ connector in Claude you can use AI voices (it uses vidIQ credits; Claude
tells you the cost first). Or record yourself reading the script, or use an ElevenLabs file.

**Claude app / claude.ai:** you can upload the `.skill` file in Settings → Capabilities → Skills to
plan and write videos there, but building and rendering need Claude Code on your computer.

## Make your first video

1. Ask: *"Make a 40-second animated explainer about [your topic] with my brand kit."*
2. Claude writes the script, fact-checks every claim, and shows you both. Say OK or ask for changes.
3. Claude makes the voice (after telling you any cost) and times every word.
4. Claude opens the **Look Picker** in your browser: all four styles play side by side. Click a style
   to hear it, then press **☆ Make this my pick**.
5. Review your pick in HyperFrames Studio (Claude opens it). Change text there or ask Claude.
6. Press **🎬 Render this look** (or tell Claude "render it"). Your MP4, cover and caption land in
   `renders/` in the video's folder (by default `~/Desktop/VIDEO/<name>/`).

## Try it

> Make an animated explainer from this script for my page. Use my brand kit.

> Turn this topic into a 45-second educational reel: how compound interest works, for beginners.
> Write the script, fact-check it, and show me before you make the voice.

> Animation video: "3 ways to use AI for your small business". End with "Comment AI and I'll send
> you the list."

Claude asks only for what's missing, shows you the script and the fact-check before spending
credits on a voice, opens the Look Picker for you, and renders only after you say go.

## Good to know

- **It stays honest.** No invented statistics, testimonials, follower counts or fake scarcity.
  Money lessons carry an "Education, not financial advice" line.
- **Credits are announced.** Claude tells you what an AI voice, image or clip will cost and waits
  for your yes. Code b-roll, icons, music and sound effects are free.
- **Your own voice:** record one take reading the script and give Claude the file. Every animation
  re-times to it automatically.
- **Speed:** building the four looks takes seconds. The 40-second test video rendered in 17 seconds
  on a recent Mac; older machines take longer.

## Credits and licence

Made by **Web Asamoah**. MIT licence (see `LICENSE`): use it for your own and your clients' videos,
change it, share it, and keep the credit.
Built on [HyperFrames](https://hyperframes.heygen.com) (HTML-to-video, Apache-2.0), run with `npx`. Bundled fonts are under the SIL Open
Font License (`kit/fonts`); icons come from Lucide (ISC, `kit/icons`).

*If you make something with it, tag Web Asamoah. I'd love to see it.*
