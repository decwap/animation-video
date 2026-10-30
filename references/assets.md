# Assets: icons, images, b-roll, AI media

Prefer what costs nothing and can't go off-brand: icons, Claude-drawn SVG, code b-roll. Use AI
images or clips only when a real-looking shot matters, and say the cost first.

## Icons

- 173 Lucide icons (ISC licence) are bundled in `kit/icons` as SVG files; use their file names:
  `<av-icon name="rocket">`, `icon="chart-line"` on chips and items, `a-icon` / `b-icon` on splits.
- An unknown name fails the build with "unknown icon"; list the folder to find a close one.
- To add icons, copy more Lucide SVGs into `kit/icons` (`scripts/fetch-assets.mjs` shows the source).
- Each look styles them (Paper duotone tiles, Glow neon strokes, Doodle roughened ink, Editorial
  solid blocks). Never use emoji as icons.

## Fonts

Every look's fonts ship as local OFL files in `kit/fonts` (`fonts.css` declares them), so the
picker, Studio and the render agree. Don't load web fonts at run time.

## Code b-roll (free, unlimited)

`<av-broll name="…">` draws a moving scene on a canvas in the look's colours, seeded and seekable:

| Name | Shows |
|---|---|
| `city` | a city skyline with lit windows and a sun or moon |
| `money` | coins drifting and spinning past |
| `network` | nodes and links lighting up |
| `globe` | a dotted globe with arcs |
| `ticker` | a scrolling candlestick chart |
| `burst` | a particle burst |
| `docs` | documents flying past |

Change `seed` for another variation; size it with `w` and `h` (pixels). The `broll` blueprint
shows a full-bleed use with a caption overlay.

## Images and the person's own media

- Put files in the video's `assets/` folder; the build copies them to each look as `assets/media/`.
  Reference them as `src="assets/media/<file>"` (`<av-image>`, `<av-video src>`, your own `<img>`).
- Logos: copy the brand kit's `logo` file into `assets/` and place it with `<img>` or `<av-image>`.
- Real brands and products come from the real source. Never redraw someone's logo or UI.
- Photos and footage keep their colours: no grading, no filters.

## AI images and clips (cost first)

When a real-looking shot really matters (a place, a product in use):
1. Say which tool and what it will cost, and wait for a yes.
2. Generate (for example a Higgsfield image or video, or vidIQ b-roll), download into `assets/`.
3. Place it with `<av-image>` (photo) or a HyperFrames `<video>` clip in the scene.
Don't use generated people as "customers" or testimonials.

## Illustrations

Draw anything else as inline SVG in the scene, using the look tokens (`var(--av-ink)`,
`var(--av-accent)`, `var(--av-paper)`) so each look recolours it. Animate strokes with
`data-verb="drawPath"` on an element holding `<path>`s. Keep one drawing for all four looks unless a
moment truly needs four.
