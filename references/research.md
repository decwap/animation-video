# Research: every claim checked before production

An educational video is a promise that what it says is true. Check every factual claim on the web
before the voice is made, because fixing a line afterwards means re-voicing.

## What counts as a claim

Numbers, dates, rankings ("the biggest", "the first"), what a product or tool does, prices and fees,
rules and laws, quotes, and cause-and-effect ("X makes Y go up"). Opinions and the brand's own
offer ("I'll send you the skill") aren't claims to verify, but the offer must be real.

## `research.md`

| # | Claim as scripted | Verdict | Source (URL, accessed) | Rewrite |
|---|---|---|---|---|
| 1 | "The GSE lists 42 companies" | needs nuance | https://gse.com.gh/... (2026-10-29) | "The GSE lists about 40 companies" |

- **Verdicts:** verified (a reliable source says so), needs nuance (true with a condition or a
  date), unverifiable (no reliable source found), false.
- **Sources:** prefer the primary source (the exchange, the regulator, the company's own docs, the
  study) over articles about it. Record the date you read it, because numbers change.
- **Rewrite** anything that isn't plainly verified, and drop what's false or unverifiable.
- Every number shown on screen (counters, charts, chips) must be in this table. Charts drawn for
  illustration say so on screen ("Example numbers").
- Show the table with the final script and get an OK before making the voice.

## Never invent

- statistics, percentages, prices or returns;
- testimonials, reviews, comments or screenshots of them;
- follower, view or customer counts;
- scarcity ("first 100 people", "ends tonight") unless the person says it's true.

## On screen and in the caption

- A source chip in the scene is optional (`<av-chip icon="link">Source: GSE, Oct 2026</av-chip>`).
- The sources go into `renders/caption.txt` under the post caption.
- Money lessons add the brand's disclaimer, or "Education, not financial advice.", as a note on the
  final scene and in the caption. Health topics say to talk to a professional.
- Real logos and product screens come from the real source (the brand's press kit, a real
  screenshot the person provides). Never redraw a real brand's logo.
