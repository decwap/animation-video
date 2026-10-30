// The edit pack's picture layers: each is the look's own root with one stylesheet that hides what
// that layer leaves out, rendered see-through (except the background). Stacked in order they give
// the video back. The kit animates opacity only, never visibility, so forcing visibility is safe.
// Part of animation-video (by Web Asamoah).

// Standalone type goes on the text layer; type inside a device stays with its device.
export const TEXT_BLOCKS = ['kicker', 'headline', 'mark', 'counter', 'note'];
export const DEVICES = ['phone', 'window', 'chat', 'terminal'];

export const LAYERS = [
  { id: 'background', file: '1-background.mp4', format: 'mp4' },
  { id: 'graphics', file: '2-graphics.mov', format: 'mov' },
  { id: 'text', file: '3-text.mov', format: 'mov' },
  { id: 'captions', file: '4-captions.mov', format: 'mov' },
  { id: 'watermark', file: '5-watermark.mov', format: 'mov' },
];

const M = '[data-composition-id="main"]';
const T = `:is(${TEXT_BLOCKS.map((n) => `.av-${n}`).join(', ')})`;
const D = `:is(${DEVICES.map((n) => `.av-${n}`).join(', ')})`;
const hide = (sel) => `${sel} { visibility: hidden !important; }`;
const show = (sel) => `${sel} { visibility: visible !important; }`;
const clear = [`${M} { background: transparent !important; }`, 'html, body { background: transparent !important; }'];

const RULES = {
  background: [hide(`${M} > :not(#decor)`)],
  // root clips added in Studio land here, since only the three named layers are hidden
  graphics: [...clear, hide('#decor, #captions, #watermark'), hide(`.av-scene ${T}`), show(`.av-scene ${D} ${T}`)],
  text: [...clear, hide(`${M} > :not([id^="scene-"])`), hide('.av-scene, .av-scene *'), show(`.av-scene ${T}, .av-scene ${T} *`), hide(`.av-scene ${D} ${T}, .av-scene ${D} ${T} *`)],
  captions: [...clear, hide(`${M} > :not(#captions)`)],
  watermark: [...clear, hide(`${M} > :not(#watermark)`)],
};

export function layerCss(id) {
  if (!RULES[id]) throw new Error(`unknown layer "${id}" (layers: ${LAYERS.map((l) => l.id).join(', ')})`);
  return RULES[id].join('\n');
}

// The voice and music come as their own stems, so the layers drop them; scene sounds stay, so the
// graphics render carries the sound-effects mix exactly as HyperFrames plays it.
// Left in, they would play inside the sound-effects stem too, so a tag it can't take out stops it.
export function layerHtml(indexHtml, id) {
  const css = layerCss(id);
  const html = indexHtml.replace(/[ \t]*<audio\b[^>]*\sid="(vo|music)"[^>]*>(?:(?!<audio\b)[\s\S])*?<\/audio>[ \t]*\n?/g, '');
  if (/<audio\b[^>]*\sid="(vo|music)"/.test(html)) throw new Error('couldn\'t take the voice and music out of the layers: an <audio id="vo"> or <audio id="music"> tag isn\'t closed');
  return html.replace('</head>', `<style id="av-layer" data-layer="${id}">\n${css}\n</style>\n</head>`);
}
