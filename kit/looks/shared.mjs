// Default markup for every primitive. Each look starts from base(), replaces the primitives it
// draws its own way, and styles the classes in its look.css. Markup is written at build time, so
// what Studio shows is plain, editable HTML. Part of animation-video (by Web Asamoah).

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const list = (s) => String(s ?? '').split('|').map((x) => x.trim()).filter(Boolean);
// Values and labels: comma-separated, or pipe-separated when a label itself has a comma.
export const series = (s) => { const t = String(s ?? ''); return t.split(t.includes('|') ? '|' : ',').map((x) => x.trim()).filter(Boolean); };
export const num = (v, d) => (v === undefined || v === '' || Number.isNaN(+v) ? d : +v);
export const pad2 = (n) => String(n).padStart(2, '0');

// Headline words as .av-w spans; <em> words become accents, <mark> words highlights; <br> kept.
export function splitWords(html) {
  const out = [];
  for (const part of String(html).split(/(<em>[\s\S]*?<\/em>|<mark>[\s\S]*?<\/mark>|<br\s*\/?>)/i)) {
    if (!part) continue;
    if (/^<br/i.test(part)) { out.push('<br>'); continue; }
    const em = /^<em>([\s\S]*?)<\/em>$/i.exec(part);
    const mk = /^<mark>([\s\S]*?)<\/mark>$/i.exec(part);
    const cls = em ? 'av-w av-accent' : mk ? 'av-w av-hl' : 'av-w';
    let text = em ? em[1] : mk ? mk[1] : part;
    // "<em>code</em>." — punctuation right after a word joins that word, not a word of its own
    const tail = !em && !mk && out.length && out.at(-1) !== '<br>' ? /^[.,!?;:…)\]"'’”]+/.exec(text) : null;
    if (tail) { out[out.length - 1] = out.at(-1).replace(/<\/span>$/, `${tail[0]}</span>`); text = text.slice(tail[0].length); }
    for (const w of text.split(/\s+/).filter(Boolean)) out.push(`<span class="${cls}">${w}</span>`);
  }
  return out.join(' ').replace(/\s*<br>\s*/g, '<br>');
}

const SYMBOL = { GHS: 'GH¢ ', USD: '$', EUR: '€', GBP: '£' };
export function fmt(n, a = {}) {
  const dec = num(a.dec, 0);
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return `${n < 0 ? '−' : ''}${a.prefix || ''}${SYMBOL[a.currency] || ''}${s}${a.suffix || ''}`;
}

export const SIZES = { xl: 104, l: 88, m: 72, s: 56 };
const BAR_W = [92, 74, 86, 60, 80, 48, 70, 66];

// ---------------------------------------------------------------- build-time SVG
export function chartSvg(a, { W = 840, H = 420 } = {}) {
  const type = a.type || 'line';
  const vals = series(a.values).map(Number).filter((v) => !Number.isNaN(v));
  const labels = series(a.labels);
  const hl = a.highlight === undefined ? -1 : +a.highlight;
  const unit = a.unit || '';
  const L = 40, R = 40, T = 50, B = 56;
  const ph = H - T - B, pw = W - L - R;
  const out = [];
  if (!vals.length) return `<svg class="av-chart__svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"></svg>`;
  if (type === 'donut') {
    const total = vals.reduce((s, v) => s + v, 0) || 1;
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.36;
    let a0 = -Math.PI / 2;
    vals.forEach((v, k) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (ang) => `${(cx + r * Math.cos(ang)).toFixed(1)} ${(cy + r * Math.sin(ang)).toFixed(1)}`;
      out.push(`<path class="av-chart__line av-chart__seg s${k % 5}${k === hl ? ' is-hl' : ''}" d="M${p(a0)} A${r.toFixed(1)} ${r.toFixed(1)} 0 ${large} 1 ${p(a1 - 0.02)}"/>`);
      a0 = a1;
    });
    const center = hl >= 0 ? `${vals[hl]}${unit}` : `${total}${unit}`;
    out.push(`<text class="av-chart__value" x="${cx}" y="${cy + 14}" text-anchor="middle">${esc(center)}</text>`);
    if (hl >= 0 && labels[hl]) out.push(`<text class="av-chart__label" x="${cx}" y="${cy + 56}" text-anchor="middle">${esc(labels[hl])}</text>`);
  } else {
    const max = Math.max(...vals);
    const min = type === 'line' ? Math.min(...vals) : 0;
    const span = max - min || 1;
    const y = (v) => T + ph - ((v - min) / span) * ph;
    for (let g = 0; g <= 3; g++) out.push(`<line class="av-chart__grid" x1="${L}" x2="${W - R}" y1="${(T + (ph * g) / 3).toFixed(1)}" y2="${(T + (ph * g) / 3).toFixed(1)}"/>`);
    if (type === 'bar') {
      const bw = pw / vals.length;
      vals.forEach((v, k) => {
        const x = L + k * bw + bw * 0.16;
        const top = y(v);
        out.push(`<rect class="av-chart__bar${k === hl ? ' is-hl' : ''}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${(T + ph - top).toFixed(1)}" rx="10"/>`);
        if (labels[k]) out.push(`<text class="av-chart__label" x="${(x + bw * 0.34).toFixed(1)}" y="${H - 18}" text-anchor="middle">${esc(labels[k])}</text>`);
        if (k === hl) out.push(`<text class="av-chart__value" x="${(x + bw * 0.34).toFixed(1)}" y="${(top - 16).toFixed(1)}" text-anchor="middle">${esc(v + unit)}</text>`);
      });
    } else {
      const step = vals.length > 1 ? pw / (vals.length - 1) : 0;
      const pts = vals.map((v, k) => [L + k * step, y(v)]);
      const d = pts.map(([x, yy], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
      out.push(`<path class="av-chart__area" d="${d} L${pts.at(-1)[0].toFixed(1)} ${T + ph} L${L} ${T + ph} Z"/>`);
      out.push(`<path class="av-chart__line" d="${d}"/>`);
      pts.forEach(([x, yy], k) => {
        out.push(`<circle class="av-chart__dot${k === hl ? ' is-hl' : ''}" cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${k === hl ? 14 : 9}"/>`);
        if (labels[k]) out.push(`<text class="av-chart__label" x="${x.toFixed(1)}" y="${H - 18}" text-anchor="middle">${esc(labels[k])}</text>`);
        if (k === hl) out.push(`<text class="av-chart__value" x="${x.toFixed(1)}" y="${(yy - 28).toFixed(1)}" text-anchor="middle">${esc(vals[k] + unit)}</text>`);
      });
    }
  }
  return `<svg class="av-chart__svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${out.join('')}</svg>`;
}

const ARROWS = {
  right: ['0 0 240 120', 240, 120, 'M14 80 C 70 18, 150 18, 212 64', 'M186 48 L214 66 L184 82'],
  left: ['0 0 240 120', 240, 120, 'M226 80 C 170 18, 90 18, 28 64', 'M54 48 L26 66 L56 82'],
  down: ['0 0 120 240', 120, 240, 'M40 14 C 104 70, 104 150, 62 212', 'M40 190 L62 216 L84 190'],
  up: ['0 0 120 240', 120, 240, 'M40 226 C 104 170, 104 90, 62 28', 'M40 50 L62 24 L84 50'],
};
export function arrowSvg(dir = 'right') {
  const [vb, w, h, line, head] = ARROWS[dir] || ARROWS.right;
  return `<svg viewBox="${vb}" width="${w}" height="${h}"><path class="av-arrow__line" d="${line}"/><path class="av-arrow__head" d="${head}"/></svg>`;
}

// ---------------------------------------------------------------- default renderers
export function base() {
  return {
    kicker: (a, inner) => `<div class="av-p av-kicker"><span class="av-kicker__t">${inner}</span></div>`,
    headline: (a, inner) => {
      const size = SIZES[a.size] || num(a.px, SIZES.xl);
      return `<h1 class="av-p av-headline av-headline--${SIZES[a.size] ? a.size : 'xl'}" data-fit="${size}" style="font-size:${size}px">${splitWords(inner)}</h1>`;
    },
    mark: (a, inner) => `<span class="av-p av-mark"><span class="av-mark__bg"></span><span class="av-mark__t">${inner}</span></span>`,
    chip: (a, inner, h) => `<div class="av-p av-chip">${a.icon ? `<span class="av-chip__i">${h.icon(a.icon)}</span>` : ''}<span class="av-chip__t">${inner}</span></div>`,
    note: (a, inner) => `<div class="av-p av-note"><span class="av-note__t">${inner}</span></div>`,
    stamp: (a, inner) => `<div class="av-p av-stamp" data-rot="${num(a.rot, -8)}"><span class="av-stamp__t">${inner}</span></div>`,
    counter: (a) => {
      const data = [['to', num(a.to, 0)], ['from', num(a.from, 0)], ['dec', num(a.dec, 0)], ['prefix', a.prefix], ['suffix', a.suffix], ['currency', a.currency]]
        .filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
      return `<div class="av-p av-counter"><span class="av-counter__num" data-fit ${data.trim()}>${esc(fmt(num(a.to, 0), a))}</span>${a.label ? `<span class="av-counter__label">${esc(a.label)}</span>` : ''}</div>`;
    },
    doc: (a) => {
      const hl = num(a.hl, 0);
      const items = list(a.items);
      const rows = items.length
        ? items.map((t, k) => `<div class="av-doc__line${k + 1 === hl ? ' is-hl' : ''}">${esc(t)}</div>`)
        : Array.from({ length: num(a.lines, 6) }, (_, k) => `<div class="av-doc__bar${k + 1 === hl ? ' is-hl' : ''}" style="width:${BAR_W[k % BAR_W.length]}%"></div>`);
      return `<div class="av-p av-doc"><div class="av-doc__head"><i class="av-doc__dot"></i><span>${esc(a.title || 'notes.txt')}</span></div><div class="av-doc__body">${rows.join('')}</div></div>`;
    },
    video: (a) => `<div class="av-p av-video"><div class="av-video__thumb">${a.src ? `<img src="${esc(a.src)}" alt="" />` : '<i class="av-video__sun"></i><i class="av-video__hill"></i><i class="av-video__hill2"></i>'}${a.title ? `<b class="av-video__title">${esc(a.title)}</b>` : ''}<span class="av-video__play"></span></div>${a.label ? `<div class="av-video__label">${esc(a.label)}</div>` : ''}</div>`,
    phone: (a, inner) => `<div class="av-p av-phone"><div class="av-phone__screen">${inner}</div><i class="av-phone__notch"></i></div>`,
    window: (a, inner) => `<div class="av-p av-window"><div class="av-window__bar"><i></i><i></i><i></i><span>${esc(a.title || '')}</span></div><div class="av-window__body">${inner}</div></div>`,
    chat: (a) => {
      const msgs = list(a.messages).map((m) => { const k = m.indexOf(':'); return k > 0 ? [m.slice(0, k).trim().toLowerCase(), m.slice(k + 1).trim()] : ['ai', m]; });
      return `<div class="av-p av-chat">${msgs.map(([who, text]) => `<div class="av-chat__msg is-${who === 'user' || who === 'me' ? 'user' : 'ai'}"><span data-type>${esc(text)}</span></div>`).join('')}</div>`;
    },
    terminal: (a) => `<div class="av-p av-terminal"><div class="av-terminal__bar"><i></i><i></i><i></i><span>${esc(a.title || 'terminal')}</span></div><div class="av-terminal__body">${list(a.lines).map((l) => `<div class="av-terminal__line${/^[$>]/.test(l) ? ' is-cmd' : ''}"><span data-type>${esc(l)}</span></div>`).join('')}</div></div>`,
    image: (a) => `<figure class="av-p av-image"><div class="av-image__frame"><img src="${esc(a.src || '')}" alt="${esc(a.alt || '')}" /></div>${a.caption ? `<figcaption class="av-image__cap">${esc(a.caption)}</figcaption>` : ''}</figure>`,
    chart: (a) => `<div class="av-p av-chart av-chart--${esc(a.type || 'line')}">${a.title ? `<div class="av-chart__title">${esc(a.title)}</div>` : ''}${chartSvg(a)}${a.source ? `<div class="av-chart__source">${esc(a.source)}</div>` : ''}</div>`,
    arrow: (a) => `<div class="av-p av-arrow av-arrow--${esc(a.dir || 'right')}">${arrowSvg(a.dir)}</div>`,
    track: (a) => {
      const clips = list(a.clips).map((c) => { const [label, w] = c.split(':'); return [label.trim(), num(w, 1)]; });
      return `<div class="av-p av-track"><div class="av-track__clips">${clips.map(([label, w], k) => `<div class="av-track__clip c${k % 4}" style="flex:${w}"><span>${esc(label)}</span></div>`).join('')}</div><i class="av-track__head"></i></div>`;
    },
    progress: (a) => {
      const step = num(a.step, 1);
      const total = num(a.total, step);
      const kind = a.kind || 'dots';
      const label = a.label ?? `STEP ${pad2(step)} / ${pad2(total)}`;
      const body = kind === 'bar'
        ? '<div class="av-progress__bar"><i class="av-progress__fill"></i></div>'
        : kind === 'ring'
          ? `<svg class="av-progress__svg" viewBox="0 0 200 200" width="200" height="200"><circle class="av-progress__track" cx="100" cy="100" r="80"/><circle class="av-progress__ring" cx="100" cy="100" r="80"/><text class="av-progress__num" x="100" y="116" text-anchor="middle">${step}</text></svg>`
          : `<div class="av-progress__dots">${Array.from({ length: total }, (_, k) => `<i class="av-progress__dot${k < step ? ' is-on' : ''}"></i>`).join('')}</div>`;
      return `<div class="av-p av-progress av-progress--${kind}" data-step="${step}" data-total="${total}">${label ? `<span class="av-progress__label">${esc(label)}</span>` : ''}${body}</div>`;
    },
    icon: (a, inner, h) => { const size = num(a.size, 150); return `<div class="av-p av-icon" style="width:${size}px;height:${size}px">${h.icon(a.name || 'sparkles')}</div>`; },
    item: (a, inner, h) => `<div class="av-p av-item">${a.icon ? `<div class="av-item__icon">${h.icon(a.icon)}</div>` : a.num ? `<div class="av-item__num">${esc(a.num)}</div>` : ''}<div class="av-item__body"><b class="av-item__title">${esc(a.title || inner || '')}</b>${a.text ? `<span class="av-item__text">${esc(a.text)}</span>` : ''}</div></div>`,
    split: (a, inner, h) => {
      const side = (k) => `<div class="av-split__side is-${k}">${a[`${k}-icon`] ? `<div class="av-split__icon">${h.icon(a[`${k}-icon`])}</div>` : ''}<b class="av-split__title">${esc(a[`${k}-title`] || '')}</b>${a[`${k}-text`] ? `<span class="av-split__text">${esc(a[`${k}-text`])}</span>` : ''}</div>`;
      return `<div class="av-p av-split">${side('a')}<div class="av-split__vs">${esc(a.label || 'vs')}</div>${side('b')}</div>`;
    },
    mascot: (a) => `<div class="av-p av-mascot av-mascot--${esc(a.pose || 'hop')}"><svg viewBox="0 0 120 120" width="150" height="150"><circle cx="60" cy="60" r="50" fill="var(--av-accent)"/><circle class="av-mascot__eye" cx="44" cy="54" r="7" fill="var(--av-ink)"/><circle class="av-mascot__eye" cx="76" cy="54" r="7" fill="var(--av-ink)"/></svg></div>`,
    broll: (a) => { const w = num(a.w, 900); const h = num(a.h, 720); return `<div class="av-p av-broll" data-broll="${esc(a.name || 'network')}" data-seed="${num(a.seed, 7)}" style="width:${w}px;height:${h}px"><canvas width="${w}" height="${h}"></canvas></div>`; },
    cta: (a, inner, h) => `<div class="av-p av-cta"><div class="av-cta__card"><span class="av-cta__comment">${esc(a.verb || 'Comment')}</span><span class="av-cta__key">“${esc(a.keyword || '')}”</span></div>${a.line ? `<div class="av-cta__line">${esc(a.line)}</div>` : ''}${(a.handle || h.brand?.handle) ? `<div class="av-cta__handle">${esc(a.handle || h.brand.handle)}</div>` : ''}</div>`,
  };
}

// Default sound for each verb; looks adjust the palette, not the mapping.
const BIG = new Set(['doc', 'video', 'phone', 'window', 'image', 'chart', 'track', 'split', 'broll', 'terminal', 'chat']);
export function sfxFor(verb, name) {
  switch (verb) {
    case 'stamp': return 'stamp';
    case 'countUp': return 'tick';
    case 'typeText': return 'type';
    case 'highlight': case 'focus': return 'swish';
    case 'drawPath': return 'draw';
    case 'drawChart': return 'riser';
    case 'progress': return 'click';
    case 'pulse': return 'pop';
    case 'kenBurns': case 'broll': return 'whoosh';
    case 'objectIn': return name === 'cta' ? 'ding' : BIG.has(name) ? 'whoosh' : 'pop';
    default: return null;
  }
}

export const SFX_NAMES = ['pop', 'whoosh', 'swish', 'tick', 'type', 'ding', 'stamp', 'draw', 'riser', 'impact', 'click', 'sparkle'];
