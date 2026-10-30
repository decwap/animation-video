// AV — the browser kit every scene runs on. Loaded once in the root <head> after GSAP,
// table.js and refs.js; a look's motion.js loads after it and overrides verbs and the preset.
// A scene declares when things happen (data-t, from data-at word refs) and AV.scene() turns
// that into one paused GSAP timeline. Every visible value is a function of timeline time.
// Part of animation-video (by Web Asamoah).
(function (root) {
  'use strict';
  const AV = (root.AV = root.AV || {});
  const doc = root.document;
  const table = root.AVTable;
  const refs = root.AVRefs;

  AV.look = (doc && doc.documentElement && doc.documentElement.getAttribute('data-av-look')) || 'paper';
  AV.preset = { ease: 'power3.out', pop: 'back.out(1.7)', dur: 0.6, blur: 12, rise: 40, stagger: 0.08, outDur: 0.4 };
  AV.setPreset = (p) => Object.assign(AV.preset, p);
  AV.verbs = {};
  AV.defineVerbs = (v) => Object.assign(AV.verbs, v);
  AV.timelines = {};
  const P = () => AV.preset;

  // ---------------------------------------------------------------- helpers
  AV.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  AV.hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

  const SYMBOL = { GHS: 'GH¢ ', USD: '$', EUR: '€', GBP: '£' };
  AV.fmt = function (n, o = {}) {
    const dec = +o.dec || 0;
    const sym = SYMBOL[o.currency] || '';
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return `${n < 0 ? '−' : ''}${o.prefix || ''}${sym}${s}${o.suffix || ''}`;
  };

  AV.primitiveOf = function (el) {
    for (const c of el.classList) {
      const m = /^av-([a-z0-9-]+)$/.exec(c);
      if (m && table.PRIMITIVES.includes(m[1])) return m[1];
    }
    return null;
  };
  AV.defaultVerb = (el) => (el.hasAttribute('data-cap') ? 'captionIn' : table.defaultVerb(AV.primitiveOf(el)));

  // "#chip" inside scene "hook" is the element compiled as id="hook--chip".
  AV.scopeSelector = (sel, id) => String(sel).replace(/#([A-Za-z_][\w-]*)/g, (m, x) => (x === 'root' ? m : `#${id}--${x}`));

  AV.t = function (ref, sceneId) {
    const data = root.AV_DATA || {};
    const sc = (data.scenes || {})[sceneId];
    if (!sc) throw new Error(`AV.t: unknown scene ${sceneId}`);
    return refs.resolveRef(ref, { words: data.words, sceneStart: sc.start, sceneEnd: sc.end, wordRange: sc.wordRange, sceneId });
  };

  // Headline words, as .av-w spans (looks render them; plain elements get split here).
  AV.split = function (el) {
    const done = el.querySelectorAll('.av-w');
    if (done.length) return [...done];
    const out = [];
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = doc.createDocumentFragment();
          for (const part of parts) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); continue; }
            const span = doc.createElement('span');
            span.className = 'av-w';
            span.textContent = part;
            frag.appendChild(span);
            out.push(span);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      }
    };
    walk(el);
    return out;
  };

  // When each headline word appears: as it is spoken in this scene, else a steady stagger.
  AV.wordTimes = function (spans, sceneRoot, t0, stagger) {
    const data = root.AV_DATA || {};
    // The compiler's marker: HyperFrames strips data-composition-id from a mounted scene root.
    const id = sceneRoot.getAttribute('data-av-scene') || sceneRoot.getAttribute('data-composition-id');
    const sc = (data.scenes || {})[id];
    const start = +sceneRoot.getAttribute('data-av-start') || 0;
    let cursor = sc ? sc.wordRange[0] : 0;
    let last = t0;
    return spans.map((span, k) => {
      let t = null;
      if (sc && data.words) {
        const key = refs.norm(span.textContent);
        for (let i = cursor; i <= sc.wordRange[1]; i++) {
          if (data.words[i] && data.words[i].norm === key) { t = data.words[i].t0 - start; cursor = i + 1; break; }
        }
      }
      if (t === null || t < last) t = k === 0 ? t0 : last + stagger;
      last = Math.max(t, t0);
      return last;
    });
  };

  // How far an element's content reaches. Word spans are measured by their layout boxes, which
  // ignore transforms: scrollWidth would count a word mid-entrance at scale 1.6 as overflow.
  const reach = (el) => {
    const kids = el.children ? [...el.children] : [];
    return kids.length ? Math.max(...kids.map((k) => k.offsetLeft + k.offsetWidth)) : el.scrollWidth;
  };

  // Shrink an element's font until it fits its box (long words in big type).
  AV.fitText = function (el, o = {}) {
    const min = o.min || 40;
    let size = o.max || parseFloat(root.getComputedStyle(el).fontSize) || 100;
    el.style.fontSize = `${size}px`;
    for (let guard = 0; size > min && reach(el) > el.clientWidth + 1 && guard < 300; guard++) {
      size -= 2;
      el.style.fontSize = `${size}px`;
    }
    return size;
  };
  const fitAll = (scope) => scope.querySelectorAll('[data-fit]').forEach((el) => AV.fitText(el, { max: +el.getAttribute('data-fit') || undefined, min: +el.getAttribute('data-fit-min') || 40 }));

  // Hand-drawn wobble: a few seeded offsets per second, held (steps), between from and to.
  AV.boil = function (tl, el, from, to, o = {}) {
    const r = AV.rng(o.seed || 1);
    const amp = o.amp ?? 1.4;
    const rot = o.rot ?? 0.5;
    for (let t = from; t < to; t += 1 / (o.fps || 8)) tl.set(el, { x: (r() - 0.5) * 2 * amp, y: (r() - 0.5) * 2 * amp, rotation: (r() - 0.5) * 2 * rot }, t);
  };

  const strokeLength = (p) => (p.getTotalLength ? p.getTotalLength() : 1000);
  AV.drawStroke = function (tl, path, t, dur) {
    const L = strokeLength(path);
    tl.fromTo(path, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut' }, t);
  };

  // ---------------------------------------------------------------- primitive details
  // Small follow-up moves inside a primitive after it enters (a doc's lines fill, a playhead runs).
  // Every look's objectIn calls AV.detail; a look may replace any of these with defineDetails.
  AV.details = {};
  AV.defineDetails = (d) => Object.assign(AV.details, d);
  AV.detail = (tl, el, t, o) => { const d = AV.details[AV.primitiveOf(el)]; if (d) d(tl, el, t, o || {}); };
  AV.defineDetails({
    doc(tl, el, t) {
      const lines = el.querySelectorAll('.av-doc__bar, .av-doc__line');
      if (lines.length) tl.fromTo(lines, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.4, stagger: 0.07, ease: 'power2.out' }, t + 0.2);
    },
    video(tl, el, t) {
      const play = el.querySelector('.av-video__play');
      if (play) tl.fromTo(play, { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }, t + 0.35);
    },
    track(tl, el, t, o) {
      const clips = el.querySelectorAll('.av-track__clip');
      if (clips.length) tl.fromTo(clips, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.35, stagger: 0.1, ease: 'power3.out' }, t + 0.2);
      const head = el.querySelector('.av-track__head');
      const lane = el.querySelector('.av-track__clips');
      if (head && lane) tl.fromTo(head, { x: 0 }, { x: lane.offsetWidth || 800, duration: Math.max(0.8, (o.sceneDur || 4) - t - 0.6), ease: 'none' }, t + 0.5);
    },
    item(tl, el, t) {
      const ic = el.querySelector('.av-item__icon, .av-item__num');
      if (ic) tl.fromTo(ic, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(2.6)' }, t + 0.15);
    },
    split(tl, el, t) {
      const sides = el.querySelectorAll('.av-split__side');
      if (sides.length) tl.fromTo(sides, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.35, ease: P().pop }, t + 0.1);
      const vs = el.querySelector('.av-split__vs');
      if (vs) tl.fromTo(vs, { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, t + 0.35);
    },
    cta(tl, el, t) {
      const key = el.querySelector('.av-cta__key');
      if (key) {
        tl.fromTo(key, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.4)' }, t + 0.25);
        tl.to(key, { scale: 1.06, duration: 0.35, yoyo: true, repeat: 3, ease: 'sine.inOut' }, t + 0.9);
      }
      const rest = el.querySelectorAll('.av-cta__line, .av-cta__handle');
      if (rest.length) tl.fromTo(rest, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.15, ease: P().ease }, t + 0.6);
    },
  });

  // ---------------------------------------------------------------- default verbs
  const kids = (el) => [...el.children].filter((c) => !/^(AUDIO|SCRIPT|STYLE)$/.test(c.tagName));

  AV.defineVerbs({
    sceneIn(tl, el, t) { tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' }, t); },
    sceneOut(tl, el, t) { tl.to(el, { opacity: 0, filter: `blur(${P().blur}px)`, duration: P().outDur, ease: 'power2.in' }, t); },
    textIn(tl, el, t) {
      tl.fromTo(el, { opacity: 0, y: P().rise * 0.5, filter: `blur(${P().blur}px)` }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: P().dur, ease: P().ease }, t);
    },
    wordsIn(tl, el, t, o) {
      const ws = AV.split(el);
      const times = o.sync === 'off' ? ws.map((w, k) => t + k * P().stagger) : AV.wordTimes(ws, o.root, t, +o.stagger || P().stagger);
      tl.set(el, { opacity: 1 }, 0);
      ws.forEach((w, k) => tl.fromTo(w, { opacity: 0, y: P().rise, filter: `blur(${P().blur}px)` }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: P().dur, ease: P().ease }, times[k]));
    },
    objectIn(tl, el, t, o) {
      tl.fromTo(el, { opacity: 0, y: P().rise, scale: 0.94, filter: `blur(${P().blur}px)` }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: P().dur, ease: P().pop }, t);
      AV.detail(tl, el, t, o || {});
    },
    objectOut(tl, el, t) { tl.to(el, { opacity: 0, y: -P().rise * 0.5, filter: `blur(${P().blur}px)`, duration: P().outDur, ease: 'power2.in' }, t); },
    countUp(tl, el, t, o) {
      const num = el.querySelector('.av-counter__num') || el;
      const attr = (k) => num.getAttribute(`data-${k}`);
      const to = +(o.to ?? attr('to') ?? parseFloat(num.textContent.replace(/[^\d.-]/g, '')));
      const from = +(o.from ?? attr('from') ?? 0);
      const f = { dec: o.dec ?? attr('dec'), prefix: o.prefix ?? attr('prefix'), suffix: o.suffix ?? attr('suffix'), currency: o.currency ?? attr('currency') };
      AV.verbs.objectIn(tl, el, t, o);
      const st = { v: from };
      num.textContent = AV.fmt(from, f);
      tl.fromTo(st, { v: from }, { v: to, duration: +o.dur || 1.2, ease: 'power2.out', onUpdate: () => { num.textContent = AV.fmt(st.v, f); } }, t + 0.1);
    },
    typeText(tl, el, t, o) {
      AV.verbs.objectIn(tl, el, t, o);
      const nodes = el.querySelectorAll('[data-type]').length ? [...el.querySelectorAll('[data-type]')] : [el];
      const cps = +o.cps || 32;
      let at = t + 0.25;
      for (const node of nodes) {
        const full = node.getAttribute('data-full') ?? node.textContent;
        node.setAttribute('data-full', full);
        const dur = Math.max(0.2, full.length / cps);
        const st = { n: 0 };
        node.textContent = '';
        tl.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.05 }, at);
        tl.fromTo(st, { n: 0 }, { n: full.length, duration: dur, ease: 'none', onUpdate: () => { node.textContent = full.slice(0, Math.round(st.n)); } }, at);
        at += dur + (+o.gap || 0.3);
      }
    },
    drawPath(tl, el, t, o) {
      tl.set(el, { opacity: 1 }, t);
      const paths = el.matches && el.matches('path,line,polyline,circle,rect,ellipse') ? [el] : [...el.querySelectorAll('path,line,polyline')];
      paths.forEach((p, k) => AV.drawStroke(tl, p, t + k * 0.05, +o.dur || 0.6));
    },
    drawChart(tl, el, t, o) {
      const dur = +o.dur || 1.2;
      AV.verbs.objectIn(tl, el, t, o);
      el.querySelectorAll('.av-chart__line').forEach((p) => AV.drawStroke(tl, p, t + 0.2, dur));
      const bars = el.querySelectorAll('.av-chart__bar');
      if (bars.length) tl.fromTo(bars, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.5, stagger: dur / bars.length, ease: P().pop }, t + 0.2);
      const fade = el.querySelectorAll('.av-chart__area, .av-chart__label');
      if (fade.length) tl.fromTo(fade, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.05 }, t + 0.2 + dur * 0.6);
      const dots = el.querySelectorAll('.av-chart__dot');
      if (dots.length) tl.fromTo(dots, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.3, stagger: 0.06, ease: P().pop }, t + 0.2 + dur);
    },
    highlight(tl, el, t) {
      const bg = el.querySelector('.av-mark__bg') || el;
      tl.fromTo(bg, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.35, ease: 'power2.out' }, t);
    },
    stamp(tl, el, t, o) {
      const rot = +(o.rot ?? -8);
      tl.fromTo(el, { opacity: 0, scale: 2.4, rotation: rot - 20 }, { opacity: 1, scale: 1, rotation: rot, duration: 0.24, ease: 'power4.in' }, t);
    },
    focus(tl, el, t) {
      const others = [...el.parentElement.children].filter((c) => c !== el && c.classList.contains('av-p'));
      if (others.length) tl.to(others, { opacity: 0.28, scale: 0.96, filter: 'blur(3px)', duration: 0.4, ease: P().ease }, t);
      tl.to(el, { scale: 1.06, duration: 0.4, ease: P().pop }, t);
    },
    pulse(tl, el, t, o) { tl.to(el, { scale: 1.08, duration: 0.18, yoyo: true, repeat: (+o.times || 2) * 2 - 1, ease: 'sine.inOut' }, t); },
    kenBurns(tl, el, t, o) {
      AV.verbs.objectIn(tl, el, t, o);
      const img = el.querySelector('img, video, canvas') || el;
      tl.fromTo(img, { scale: 1.12 }, { scale: 1, duration: Math.max(0.5, (o.sceneDur || 4) - t), ease: 'none' }, t);
    },
    broll(tl, el, t, o) {
      AV.verbs.objectIn(tl, el, t, o);
      const canvas = el.querySelector('canvas');
      if (!canvas || !AV.broll) return;
      const name = el.getAttribute('data-broll') || 'network';
      const ctx = canvas.getContext('2d');
      const seed = +(el.getAttribute('data-seed') || AV.hash(el.id || name));
      const palette = AV.broll.palette(el);
      const state = AV.broll.render(name, ctx, 0, canvas.width, canvas.height, { seed, palette });
      const st = { p: 0 };
      const total = Math.max(0.5, o.sceneDur || 4);
      tl.fromTo(st, { p: 0 }, { p: total, duration: total, ease: 'none', onUpdate: () => AV.broll.render(name, ctx, st.p, canvas.width, canvas.height, { seed, palette, state }) }, 0);
    },
    progress(tl, el, t) {
      const step = +el.getAttribute('data-step') || 1;
      const total = +el.getAttribute('data-total') || step;
      AV.verbs.objectIn(tl, el, t, {});
      const dots = [...el.querySelectorAll('.av-progress__dot')].slice(0, step);
      if (dots.length) tl.fromTo(dots, { scale: 0.6, opacity: 0.3 }, { scale: 1, opacity: 1, duration: 0.3, stagger: 0.05, ease: P().pop }, t + 0.1);
      const ring = el.querySelector('.av-progress__ring');
      if (ring) { const L = strokeLength(ring); tl.fromTo(ring, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: L * (1 - step / total), duration: 0.8, ease: P().ease }, t + 0.1); }
      const fill = el.querySelector('.av-progress__fill');
      if (fill) tl.fromTo(fill, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: step / total, duration: 0.8, ease: P().ease }, t + 0.1);
    },
    captionIn(tl, el, t) {
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.06, ease: 'none' }, t);
      el.querySelectorAll('.av-cap__w').forEach((w) => {
        const wt = Math.max(t, +w.getAttribute('data-wt') || t);
        tl.fromTo(w, { opacity: 0, y: 14, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.18, ease: 'power2.out' }, wt);
      });
    },
    captionOut(tl, el, t) { tl.to(el, { opacity: 0, duration: 0.06, ease: 'none' }, Math.max(0, t - 0.06)); },
    decorTimeline() {},
  });


  const run = (name, ...args) => (AV.verbs[name] || AV.verbs.objectIn)(...args);

  // ---------------------------------------------------------------- the scene builder
  // The scene's own root. The compiler marks it data-av-scene="<id>". Without the marker: the
  // HyperFrames player moves the root into its host, strips id/data-composition-id and marks
  // data-hf-inner-root; the CLI inlines it and renames the host's data-composition-src.
  function findSceneRoot(id) {
    const marked = doc.querySelector(`[data-av-scene="${id}"]`);
    if (marked) return marked;
    const direct = doc.querySelector(`[data-composition-id="${id}"]:not([data-composition-src])`);
    if (direct) return direct;
    const host = doc.querySelector(`[data-composition-id="${id}"]`);
    if (!host) return null;
    return host.querySelector(':scope > [data-hf-inner-root]') || host.querySelector('[data-av-dur]') || host;
  }
  AV.findSceneRoot = findSceneRoot;

  AV.scene = function (id, extra) {
    const sceneRoot = findSceneRoot(id);
    if (!sceneRoot) throw new Error(`AV.scene: no scene root "${id}"`);
    const dur = +sceneRoot.getAttribute('data-av-dur') || 0;
    const start = +sceneRoot.getAttribute('data-av-start') || 0;
    const tl = root.gsap.timeline({ paused: true });
    const transitions = id !== 'captions' && id !== 'decor';
    const opts = (el) => Object.assign({ sceneDur: dur, sceneId: id, root: sceneRoot }, el.dataset);
    if (sceneRoot.querySelectorAll && doc.fonts) {
      fitAll(sceneRoot);
      doc.fonts.ready.then(() => fitAll(sceneRoot));
    }

    const stage = sceneRoot.querySelector('.av-scene') || sceneRoot;
    if (transitions) run('sceneIn', tl, stage, 0, opts(sceneRoot));
    for (const el of sceneRoot.querySelectorAll('[data-t]')) {
      const t = +el.getAttribute('data-t');
      run(el.getAttribute('data-verb') || AV.defaultVerb(el), tl, el, t, opts(el));
      if (el.hasAttribute('data-cap')) run('captionOut', tl, el, t + (+el.getAttribute('data-dur') || 1), opts(el));
    }
    for (const el of sceneRoot.querySelectorAll('[data-tout]')) run('objectOut', tl, el, +el.getAttribute('data-tout'), opts(el));
    // The last scene holds its final frame: the film ends on the CTA, not on a fade.
    if (transitions && dur && !sceneRoot.hasAttribute('data-av-last')) run('sceneOut', tl, stage, Math.max(0, dur - P().outDur), opts(sceneRoot));

    if (id === 'decor') AV.verbs.decorTimeline(tl, dur, sceneRoot);
    const q = (sel) => sceneRoot.querySelector(AV.scopeSelector(sel, id));
    const qa = (sel) => [...sceneRoot.querySelectorAll(AV.scopeSelector(sel, id))];
    if (typeof extra === 'function') extra(tl, q, { id, dur, start, root: sceneRoot, q, qa, rng: AV.rng(AV.hash(id)), t: (ref) => AV.t(ref, id) });
    AV.timelines[id] = tl;
    return tl;
  };
})(typeof window !== 'undefined' ? window : globalThis);
