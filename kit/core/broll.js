// Code-made b-roll: generative canvas scenes that fill a beat with motion, in the look's
// colours. Each draw(ctx, t, …) is a pure function of time (seeded randomness only), so any
// frame can be rendered on its own. Free and unlimited. Part of animation-video (by Web Asamoah).
//
//   AV.broll.render(name, ctx2d, t, w, h, { seed, palette, state }) → state
//   AV.broll.define(name, { setup(w, h, rng) → state, draw(ctx, t, w, h, { state, pal, rng }) })
(function (root) {
  'use strict';
  const AV = (root.AV = root.AV || {});
  const TAU = Math.PI * 2;
  const gens = {};
  const mulberry = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const rngOf = (seed) => (AV.rng || mulberry)(seed);

  function palette(el) {
    const cs = el && root.getComputedStyle ? root.getComputedStyle(el) : null;
    const v = (name, d) => (cs && cs.getPropertyValue(name).trim()) || d;
    return {
      bg: v('--av-bg', '#F3EDE4'), ink: v('--av-ink', '#1B1714'), paper: v('--av-paper', '#FFFFFF'),
      accent: v('--av-accent', '#D4613A'), accent2: v('--av-accent2', '#F2A57E'), glow: v('--av-glow', '#FFE3CF'),
      up: v('--av-up', '#22A06B'), down: v('--av-down', '#D9423B'),
    };
  }

  function render(name, ctx, t, w, h, opts = {}) {
    const g = gens[name];
    if (!g) throw new Error(`unknown b-roll "${name}" (have: ${Object.keys(gens).join(', ')})`);
    const seed = opts.seed ?? 7;
    const pal = opts.palette || palette(null);
    const state = opts.state || (g.setup ? g.setup(w, h, rngOf(seed)) : {});
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    g.draw(ctx, t, w, h, { state, pal, rng: rngOf(seed + 1) });
    ctx.globalAlpha = 1;
    return state;
  }

  const define = (name, g) => { gens[name] = g; };
  const dot = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fill(); };

  define('city', {
    setup(w, h, r) {
      const layers = [0.5, 0.75, 1].map((depth) => {
        const blocks = [];
        for (let x = -40; x < w * 2.2;) {
          const bw = 60 + r() * 110;
          blocks.push({ x, w: bw, h: h * (0.16 + r() * 0.42) * depth, lit: Array.from({ length: 64 }, () => r()) });
          x += bw + 4 + r() * 18;
        }
        return { depth, blocks };
      });
      return { layers, stars: Array.from({ length: 70 }, () => ({ x: r() * w, y: r() * h * 0.5, p: r() * TAU })) };
    },
    draw(ctx, t, w, h, { state, pal }) {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, pal.bg);
      sky.addColorStop(1, pal.glow);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = pal.accent2;
      ctx.globalAlpha = 0.9;
      dot(ctx, w * 0.78, h * 0.2, h * 0.07);
      ctx.fillStyle = pal.ink;
      for (const s of state.stars) { ctx.globalAlpha = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.2 + s.p)); ctx.fillRect(s.x, s.y, 3, 3); }
      state.layers.forEach((L, li) => {
        const span = w * 2.2;
        const off = (t * 22 * L.depth) % span;
        for (const b of L.blocks) {
          let x = b.x - off;
          if (x + b.w < -20) x += span;
          if (x > w) continue;
          ctx.globalAlpha = 0.28 + 0.32 * li;
          ctx.fillStyle = pal.ink;
          ctx.fillRect(x, h - b.h, b.w, b.h);
          if (li !== 2) continue;
          ctx.globalAlpha = 1;
          ctx.fillStyle = pal.accent;
          let k = 0;
          for (let y = h - b.h + 18; y < h - 24; y += 28) {
            for (let xx = x + 12; xx < x + b.w - 14; xx += 24) {
              if (b.lit[k++ % b.lit.length] > 0.5 + 0.2 * Math.sin(t * 0.8 + k * 1.7)) ctx.fillRect(xx, y, 10, 14);
            }
          }
        }
      });
    },
  });

  define('money', {
    setup(w, h, r) { return { coins: Array.from({ length: 26 }, () => ({ x: r() * w, sp: 0.5 + r(), ph: r(), sz: 18 + r() * 28, sw: r() * TAU })) }; },
    draw(ctx, t, w, h, { state, pal }) {
      for (const c of state.coins) {
        const y = ((c.ph + t * 0.16 * c.sp) % 1) * (h + 160) - 80;
        const x = c.x + Math.sin(t * 1.3 + c.sw) * 34;
        const turn = Math.max(0.16, Math.abs(Math.cos(t * 2.6 * c.sp + c.sw)));
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(turn, 1);
        ctx.fillStyle = pal.accent;
        dot(ctx, 0, 0, c.sz);
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.accent2;
        dot(ctx, 0, 0, c.sz * 0.62);
        ctx.restore();
      }
    },
  });

  define('network', {
    setup(w, h, r) {
      const nodes = Array.from({ length: 18 }, () => ({ x: 70 + r() * (w - 140), y: 70 + r() * (h - 140), p: r() * TAU, s: 7 + r() * 9 }));
      const links = [];
      nodes.forEach((a, i) => {
        nodes.map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 2)
          .forEach(([j]) => { if (!links.some(([p, q]) => (p === i && q === j) || (p === j && q === i))) links.push([i, j, r()]); });
      });
      return { nodes, links };
    },
    draw(ctx, t, w, h, { state, pal }) {
      const pos = state.nodes.map((n) => ({ x: n.x + Math.sin(t * 0.6 + n.p) * 12, y: n.y + Math.cos(t * 0.5 + n.p) * 12 }));
      ctx.lineWidth = 3;
      ctx.strokeStyle = pal.ink;
      ctx.globalAlpha = 0.22;
      for (const [i, j] of state.links) { ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[j].x, pos[j].y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.accent;
      for (const [i, j, ph] of state.links) {
        const f = (t * 0.45 + ph) % 1;
        dot(ctx, pos[i].x + (pos[j].x - pos[i].x) * f, pos[i].y + (pos[j].y - pos[i].y) * f, 5);
      }
      state.nodes.forEach((n, k) => {
        ctx.fillStyle = k % 3 ? pal.ink : pal.accent;
        dot(ctx, pos[k].x, pos[k].y, n.s * (1 + 0.15 * Math.sin(t * 2 + n.p)));
      });
    },
  });

  define('globe', {
    setup(w, h, r) {
      const pts = [];
      for (let lat = -80; lat <= 80; lat += 10) for (let lon = 0; lon < 360; lon += 9) pts.push([(lat * Math.PI) / 180, (lon * Math.PI) / 180]);
      const arcs = Array.from({ length: 6 }, () => [[(r() - 0.5) * 1.8, r() * TAU], [(r() - 0.5) * 1.8, r() * TAU], r()]);
      return { pts, arcs };
    },
    draw(ctx, t, w, h, { state, pal }) {
      const R = Math.min(w, h) * 0.38;
      const cx = w / 2;
      const cy = h / 2;
      const rot = t * 0.35;
      const proj = (lat, lon) => {
        const x = Math.cos(lat) * Math.sin(lon + rot);
        const z = Math.cos(lat) * Math.cos(lon + rot);
        return [cx + x * R, cy - Math.sin(lat) * R, z];
      };
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = pal.accent;
      dot(ctx, cx, cy, R * 1.04);
      ctx.fillStyle = pal.ink;
      for (const [lat, lon] of state.pts) {
        const [x, y, z] = proj(lat, lon);
        if (z < 0) continue;
        ctx.globalAlpha = 0.2 + 0.8 * z;
        dot(ctx, x, y, 2 + 1.8 * z);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 4;
      for (const [a, b, ph] of state.arcs) {
        const p = proj(a[0], a[1]);
        const q = proj(b[0], b[1]);
        if (p[2] < 0.1 || q[2] < 0.1) continue;
        const f = Math.min(1, ((t * 0.35 + ph) % 1.3) / 1);
        const mx = (p[0] + q[0]) / 2 + (cy - (p[1] + q[1]) / 2) * 0.1;
        const my = Math.min(p[1], q[1]) - R * 0.35;
        ctx.beginPath();
        for (let s = 0; s <= 24 * f; s++) {
          const u = s / 24;
          const x = (1 - u) * (1 - u) * p[0] + 2 * (1 - u) * u * mx + u * u * q[0];
          const y = (1 - u) * (1 - u) * p[1] + 2 * (1 - u) * u * my + u * u * q[1];
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
  });

  define('ticker', {
    setup(w, h, r) {
      const candles = [];
      let p = 100;
      for (let i = 0; i < 600; i++) {
        const o = p;
        p = Math.max(20, p + (r() - 0.47) * 6);
        candles.push({ o, c: p, hi: Math.max(o, p) + r() * 3, lo: Math.min(o, p) - r() * 3 });
      }
      return { candles };
    },
    draw(ctx, t, w, h, { state, pal }) {
      const cw = 28;
      const count = Math.ceil(w / cw) + 2;
      const shift = t * 3;
      const first = Math.floor(shift) % (state.candles.length - count - 1);
      const frac = shift - Math.floor(shift);
      const view = state.candles.slice(first, first + count);
      const lo = Math.min(...view.map((c) => c.lo));
      const hi = Math.max(...view.map((c) => c.hi));
      const y = (v) => h * 0.88 - ((v - lo) / Math.max(1, hi - lo)) * h * 0.76;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = pal.ink;
      for (let g = 1; g < 5; g++) ctx.fillRect(0, (h * g) / 5, w, 2);
      ctx.globalAlpha = 1;
      view.forEach((c, k) => {
        const x = (k - frac) * cw;
        ctx.fillStyle = c.c >= c.o ? pal.up : pal.down;
        ctx.fillRect(x + cw / 2 - 1.5, y(c.hi), 3, Math.max(2, y(c.lo) - y(c.hi)));
        ctx.fillRect(x + 4, Math.min(y(c.o), y(c.c)), cw - 8, Math.max(3, Math.abs(y(c.o) - y(c.c))));
      });
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      view.forEach((c, k) => { const x = (k - frac) * cw + cw / 2; if (k) ctx.lineTo(x, y(c.c)); else ctx.moveTo(x, y(c.c)); });
      ctx.stroke();
    },
  });

  define('burst', {
    setup(w, h, r) { return { ps: Array.from({ length: 80 }, () => ({ a: r() * TAU, v: 0.35 + r(), s: 3 + r() * 8, c: r() })) }; },
    draw(ctx, t, w, h, { state, pal }) {
      const k = (t % 3) / 3;
      const R = Math.max(w, h) * 0.6;
      const ease = 1 - (1 - k) ** 3;
      for (const p of state.ps) {
        const d = R * p.v * ease;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.c > 0.6 ? pal.accent : p.c > 0.3 ? pal.accent2 : pal.ink;
        dot(ctx, w / 2 + Math.cos(p.a) * d, h / 2 + Math.sin(p.a) * d, p.s * (1 - k * 0.5));
      }
    },
  });

  define('docs', {
    setup(w, h, r) { return { ds: Array.from({ length: 12 }, () => ({ y: 80 + r() * (h - 160), sp: 0.4 + r() * 0.8, ph: r(), rot: (r() - 0.5) * 0.8, s: 0.7 + r() * 0.6 })) }; },
    draw(ctx, t, w, h, { state, pal }) {
      for (const d of state.ds) {
        const x = ((d.ph + t * 0.11 * d.sp) % 1) * (w + 400) - 200;
        ctx.save();
        ctx.translate(x, d.y + Math.sin(t * 1.2 + d.ph * 6) * 40);
        ctx.rotate(d.rot + Math.sin(t + d.ph * 5) * 0.2);
        ctx.scale(d.s, d.s);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = pal.ink;
        ctx.fillRect(-56, -74, 120, 160);
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.paper;
        ctx.fillRect(-60, -80, 120, 160);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(-44, -58, 44, 9);
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = pal.ink;
        for (let l = 1; l < 6; l++) ctx.fillRect(-44, -58 + l * 20, l % 3 === 2 ? 52 : 88, 8);
        ctx.restore();
      }
    },
  });

  AV.broll = { define, render, palette, names: () => Object.keys(gens), get: (name) => gens[name] };
})(typeof window !== 'undefined' ? window : globalThis);
