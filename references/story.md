# Story: scripts that teach and hold attention

## The shape of a 30–60 s explainer

1. **Hook (0–2 s):** a surprising fact, a question the viewer wants answered, or a promise of a
   result. "Did you know…", "Most people get X wrong", "Here's how X really works".
2. **Proof or stakes (2–8 s):** why it matters to this viewer. A number from the research, a
   before/after, a cost.
3. **Teach (the middle):** 3–5 steps or points, one per line. Number them ("One:", "Two:") when the
   order matters; the step blueprint shows progress dots.
4. **Payoff:** the result, a recap, or a quick quiz moment ("Which one would you pick?").
5. **Call to action (last 3 s+):** from the brand kit, for example "Comment ANIMATE and I'll send you
   the skill, free." Only promise what the person will really do.

## Line rules

- One idea per line, and one line per visual beat. Lines become scenes in the storyboard.
- About 150 words a minute: a 45 s video is about 110 words. Short lines (6–14 words) pace best.
- Say numbers the way the voice will read them; the timing aligner understands both "10,000" and
  "ten thousand", "40%" and "forty percent".
- Mark one or two accent words per line with `*stars*`. They're highlighted in headlines and
  captions, so pick the word that carries the meaning ("turn any *script* into…").
- Write cedis as GH¢ (the fonts have no ₵). Write the currency the brand kit uses.
- Plain words. If a term needs explaining, give it a definition scene ("B-roll: extra footage that
  shows what the voice is saying").
- No filler intros ("Hey guys, in this video…"). Start on the hook.

## From script to storyboard

- `storyboard.json`: `{ "title", "slug", "scenes": [ { "id", "src", "lines": [a, b], "hold" } ] }`.
  Optional `lead` (seconds a scene starts before its first word, 0.15), `overlap` (how long scenes
  cross, 0.35) and `tail` (time after the last word, 2.5).
- Every script line belongs to exactly one scene. Usually one line per scene; two short lines that
  share a visual can share one.
- Pick the blueprint by what the line does: a claim with a number → `big-number`; a contrast →
  `compare`; steps → `step` or `flow`; a list → `list` or `grid-focus`; a term → `definition`; a
  tool in use → `ui-chat`, `ui-terminal` or `phone`; a mood or place → `broll`; a check-in →
  `quiz`; the summary → `recap`; the end → `cta`.
- Plan a new visual every 1–2.5 s. A 5 s line needs two or three elements arriving on its key words.
- Vary the blueprints: don't run three lists in a row.

## Example (Web Asamoah, about 40 s)

```
# Claude animates scripts
1. Did you know Claude can turn any *script* into an animated explainer?
2. Like the one you're watching right now.
3. Here's how it works.
4. One: paste your script. Claude researches it and checks the *facts*.
5. Two: pick a look. Warm paper, midnight glow, storybook doodle or bold editorial.
6. You preview every look in your browser before a single frame *renders*.
7. Three: Claude animates every line. Icons, charts, b-roll, captions and sound effects, all timed to the *voice*.
8. No editing app. No stock footage.
9. Comment ANIMATE and I'll send you the skill, free.
```

Storyboard: 1 hook · 2 phone (this video in a phone) · 3 kicker-only beat into 4 · 4 step with a
doc and a research stamp · 5 grid-focus with four look tiles · 6 ui-chat or browser window · 7 list
of what gets animated · 8 compare (crossed-out app vs code) · 9 cta.
