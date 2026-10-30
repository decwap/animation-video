// Compile one look-agnostic scene source into a scene for one look:
//   1. expand <av-*> primitives with the look's renderers (innermost first),
//   2. turn data-at / data-out word refs into scene-local seconds (data-t / data-tout),
//   3. add a sound clip for every timed element the look (or data-sfx) gives a sound,
//   4. stamp the scene's start and length on its root and make sure AV.scene() runs.
import fs from 'node:fs';
import path from 'node:path';
import { KIT_DIR, SFX_LENGTH } from './config.mjs';
import { resolveRef } from './refs.mjs';
import { PRIMITIVES, defaultVerb } from './table.mjs';
import { escapeHtml, parseAttrs, attrsObject, attrsString, mapTags, mapOutsideCode } from './html.mjs';

export { PRIMITIVES };

const PRIM = /<av-([a-z][a-z0-9-]*)((?:\s+[^\s>"'=/]+(?:\s*=\s*"[^"]*")?)*)\s*(?:\/>|>((?:(?!<av-)[\s\S])*?)<\/av-\1\s*>)/;
const FIRST_TAG = /^\s*<([a-zA-Z][\w-]*)((?:\s+[^\s>"'=/]+(?:\s*=\s*"[^"]*")?)*)\s*(\/?)>/;
const r3 = (t) => +t.toFixed(3);

const iconCache = new Map();
export function icon(name) {
  if (!iconCache.has(name)) {
    const file = path.join(KIT_DIR, 'icons', `${name}.svg`);
    if (!fs.existsSync(file)) throw new Error(`unknown icon "${name}" (see kit/icons/)`);
    iconCache.set(name, fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim());
  }
  return iconCache.get(name);
}

// Give a renderer's first element the primitive's id, classes, data-* and style.
function stampRoot(out, name, attrs) {
  const m = FIRST_TAG.exec(out);
  if (!m) throw new Error(`primitive ${name} rendered no element`);
  const existing = parseAttrs(m[2]);
  const get = (k) => (existing.find(([n]) => n === k) || [])[1];
  const lead = [];
  const id = get('id') || attrs.id;
  if (id) lead.push(['id', id]);
  const cls = ['av-p', `av-${name}`, ...(get('class') || '').split(/\s+/), ...(attrs.class || '').split(/\s+/)].filter(Boolean);
  lead.push(['class', [...new Set(cls)].join(' ')]);
  const rest = existing.filter(([n]) => n !== 'id' && n !== 'class');
  for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-') && !rest.some(([n]) => n === k)) rest.push([k, v]);
  if (attrs.style) {
    const s = rest.find(([n]) => n === 'style');
    if (s) s[1] = `${s[1]};${attrs.style}`; else rest.push(['style', attrs.style]);
  }
  return `${out.slice(0, m.index)}<${m[1]}${attrsString([...lead, ...rest])}${m[3] ? ' /' : ''}>${out.slice(m.index + m[0].length)}`;
}

function expand(html, look, helpers) {
  for (let guard = 0; ; guard++) {
    const m = PRIM.exec(html);
    if (!m) return html;
    if (guard > 5000) throw new Error('primitive expansion did not finish');
    const [whole, name, rawAttrs, inner = ''] = m;
    const render = look.primitives[name];
    if (!PRIMITIVES.includes(name) || typeof render !== 'function') {
      throw new Error(`unknown primitive ${name} (known: ${PRIMITIVES.join(', ')})`);
    }
    const attrs = attrsObject(parseAttrs(rawAttrs));
    const out = stampRoot(render(attrs, inner, helpers), name, attrs);
    html = html.slice(0, m.index) + out + html.slice(m.index + whole.length);
  }
}

const primitiveOf = (list) => {
  const cls = (list.find(([n]) => n === 'class') || [])[1] || '';
  return cls.split(/\s+/).map((c) => /^av-([a-z0-9-]+)$/.exec(c)?.[1]).find((n) => n && PRIMITIVES.includes(n)) || null;
};

export function compileScene(src, { scene, look, words, brand = {}, trackBase = 9, last = false }) {
  src = src.replace(/<!--[\s\S]*?-->/g, ''); // comments neither expand nor count as a scene script
  const warnings = [];
  const cues = [];
  const dur = r3(scene.end - scene.start);
  const ctx = { words, sceneStart: scene.start, sceneEnd: scene.end, wordRange: scene.wordRange, sceneId: scene.id };
  const helpers = { esc: escapeHtml, icon, split: (s) => String(s ?? '').split('|').map((x) => x.trim()).filter(Boolean), brand, look: look.id, scene };

  let rootId;
  mapTags(src, (tag, list) => {
    const id = attrsObject(list)['data-composition-id'];
    if (tag === 'div' && id && rootId === undefined) rootId = id;
    return null;
  });
  if (rootId !== scene.id) {
    throw new Error(`scene file ${scene.src || ''} has composition id "${rootId}" but the storyboard calls it "${scene.id}"`);
  }

  let html = expand(src, look, helpers);
  // A primitive the patterns can't read would otherwise reach every look as a raw <av-*> tag.
  unreadable(html, /<\/?av-[a-z][^>]*>?/, scene, 'write each primitive as <av-name attr="value">…</av-name> or <av-name … />, with values in double quotes');

  const at = (ref, who, attr) => {
    let t = resolveRef(ref, ctx);
    if (t > dur - 0.05) { warnings.push(`${scene.id}/${who}: ${attr}="${ref}" lands at ${t} s, past the scene end (${dur} s); clamped`); t = r3(dur - 0.05); }
    if (t < 0) { warnings.push(`${scene.id}/${who}: ${attr}="${ref}" lands before the scene starts; clamped to 0`); t = 0; }
    return t;
  };

  html = mapTags(html, (tag, list, selfClosing) => {
    const a = attrsObject(list);
    if (!('data-at' in a) && !('data-out' in a)) return null;
    const who = a.id || tag;
    const out = [];
    let t = null;
    for (const [k, v] of list) {
      if (k === 'data-t' || k === 'data-tout') continue;
      out.push([k, v]);
      if (k === 'data-at') { t = at(v, who, k); out.push(['data-t', t.toFixed(3)]); }
      if (k === 'data-out') out.push(['data-tout', at(v, who, k).toFixed(3)]);
    }
    if (t !== null) {
      const name = primitiveOf(list);
      const verb = a['data-verb'] || defaultVerb(name);
      let sfx = 'data-sfx' in a ? a['data-sfx'] : look.sfxFor?.(verb, name);
      let offset = 0;
      if (sfx && typeof sfx === 'object') { offset = sfx.at || 0; sfx = sfx.name; }
      if (sfx && sfx !== 'none') {
        if (look.sfxBank && !(sfx in look.sfxBank)) warnings.push(`${scene.id}/${who}: no sound "${sfx}" in the ${look.id} look; skipped`);
        else cues.push({ t: r3(Math.max(0, t + offset)), sfx, id: who });
      }
    }
    return `<${tag}${attrsString(out)}${selfClosing ? ' /' : ''}>`;
  });

  unreadable(html, /<[a-zA-Z][^>]*\sdata-at\s*=(?![^>]*\sdata-t=")[^>]*>/, scene, 'put attribute values in double quotes');
  unreadable(html, /<[a-zA-Z][^>]*\sdata-out\s*=(?![^>]*\sdata-tout=")[^>]*>/, scene, 'put attribute values in double quotes');
  html = prefixIds(html, scene.id);

  // Each sound gets its length and the first of four tracks free at its start (HyperFrames
  // flags overlapping audio on one track). Neighbouring scenes use different blocks of tracks.
  const busy = [0, 0, 0, 0].map(() => -Infinity);
  const audio = cues.map((c, k) => {
    const len = look.sfxLength?.[c.sfx] ?? SFX_LENGTH[c.sfx] ?? 1;
    let lane = busy.findIndex((end) => end <= c.t + 1e-6);
    if (lane < 0) lane = busy.indexOf(Math.min(...busy));
    busy[lane] = c.t + len;
    return `<audio id="sfx-${scene.id}-${k + 1}" src="assets/sfx/${c.sfx}.wav" data-start="${c.t.toFixed(3)}" data-duration="${len.toFixed(3)}" data-track-index="${trackBase + lane}" data-volume="${look.sfxGain?.[c.sfx] ?? 0.8}" data-hf-media-start-basis="local"></audio>`;
  });
  let stamped = false;
  html = mapTags(html, (tag, list) => {
    if (stamped || tag !== 'div' || !attrsObject(list)['data-composition-id']) return null;
    stamped = true;
    const keep = list.filter(([k]) => !['data-av-scene', 'data-av-start', 'data-av-dur', 'data-av-last'].includes(k));
    const marks = [['data-av-scene', scene.id], ['data-av-start', scene.start.toFixed(3)], ['data-av-dur', dur.toFixed(3)], ...(last ? [['data-av-last', '1']] : [])];
    return `<div${attrsString([...keep, ...marks])}>${audio.length ? `\n    ${audio.join('\n    ')}` : ''}\n    <div class="av-scene">`;
  });
  html = closeSceneWrapper(html);
  // The scene's own script registers the timeline: HyperFrames scopes window.__timelines per scene.
  const register = `window.__timelines["${scene.id}"] = AV.timelines["${scene.id}"];`;
  const scripted = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].some((m) => /AV\.scene\(/.test(m[1]));
  if (!scripted) html = html.replace('</template>', `  <script>AV.scene("${scene.id}");\n  ${register}</script>\n</template>`);
  else if (!html.includes(register)) html = html.replace('</template>', `  <script>${register}</script>\n</template>`);
  return { html, cues, warnings };
}

function unreadable(html, pattern, scene, how) {
  mapOutsideCode(html, (seg) => {
    const m = pattern.exec(seg);
    if (m) throw new Error(`scene "${scene.id}": could not read ${m[0].slice(0, 90)} (${how})`);
    return seg;
  });
}

// Close .av-scene just inside the scene root: the root's own </div> is the template's last
// </div> outside <script>/<style>. Scene transitions animate .av-scene, because HyperFrames
// manages the scene root itself.
function closeSceneWrapper(html) {
  const start = html.indexOf('<template>');
  const body = html.slice(start, html.lastIndexOf('</template>'));
  let offset = 0;
  let last = -1;
  body.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/i).forEach((part, i) => {
    if (i % 2 === 0 && part.lastIndexOf('</div>') >= 0) last = offset + part.lastIndexOf('</div>');
    offset += part.length;
  });
  if (last < 0) throw new Error('scene root has no closing </div>');
  const at = start + last;
  return `${html.slice(0, at)}</div>\n  ${html.slice(at)}`;
}

// All scenes mount into one document, so ids inside a scene get a "<scene>--" prefix:
// on the elements, in the scene's <style>, and in url(#id) / href="#id" references.
// The scene root keeps id="root" (HyperFrames styles it as #root). Scripts use AV.scene's q().
function prefixIds(html, sceneId) {
  const ids = new Set();
  mapTags(html, (tag, list) => {
    const a = attrsObject(list);
    if (a.id && a.id !== 'root' && !a['data-composition-id']) ids.add(a.id);
    return null;
  });
  if (!ids.size) return html;
  const p = (id) => `${sceneId}--${id}`;
  html = mapTags(html, (tag, list, selfClosing) => {
    let changed = false;
    const out = list.map(([k, v]) => {
      let nv = k === 'id' && ids.has(v) ? p(v) : v.replace(/url\(#([\w-]+)\)/g, (m, id) => (ids.has(id) ? `url(#${p(id)})` : m));
      if ((k === 'href' || k === 'xlink:href') && /^#[\w-]+$/.test(nv) && ids.has(nv.slice(1))) nv = `#${p(nv.slice(1))}`;
      if (nv !== v) changed = true;
      return [k, nv];
    });
    return changed ? `<${tag}${attrsString(out)}${selfClosing ? ' /' : ''}>` : null;
  });
  return html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, css, close) =>
    open + css.replace(/#([A-Za-z_][\w-]*)/g, (mm, id) => (ids.has(id) ? `#${p(id)}` : mm)) + close);
}
