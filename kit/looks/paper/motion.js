// Warm Paper motion: soft blur-rises, springy cards that settle at a slight tilt, a mascot that
// hops in and blinks, peach glows drifting behind everything. Part of animation-video (by Web Asamoah).
(function () {
  'use strict';
  const BIG = ['doc', 'video', 'phone', 'window', 'image', 'chart', 'track', 'split', 'broll', 'cta', 'terminal'];
  AV.setPreset({ ease: 'power3.out', pop: 'back.out(1.6)', dur: 0.6, blur: 12, rise: 40, stagger: 0.08, outDur: 0.4 });

  AV.defineVerbs({
    sceneIn(tl, el, t) {
      tl.fromTo(el, { opacity: 0, filter: 'blur(14px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.45, ease: 'power2.out' }, t);
    },
    sceneOut(tl, el, t) {
      tl.to(el, { opacity: 0, filter: 'blur(16px)', y: -30, duration: 0.4, ease: 'power2.in' }, t);
    },
    objectIn(tl, el, t, o) {
      const name = AV.primitiveOf(el);
      const rot = +(o.rot || 0);
      if (name === 'mascot') {
        tl.fromTo(el, { opacity: 0, y: 160 }, { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(2.2)' }, t);
        tl.to(el, { y: -36, duration: 0.22, yoyo: true, repeat: 3, ease: 'power1.out' }, t + 0.65);
        const eyes = el.querySelectorAll('.av-mascot__eye');
        if (eyes.length) tl.to(eyes, { scaleY: 0.15, transformOrigin: '50% 60%', duration: 0.07, yoyo: true, repeat: 1 }, t + 1.8);
        return;
      }
      const big = BIG.includes(name);
      tl.fromTo(el, { opacity: 0, y: 54, scale: 0.94, rotation: big ? rot - 4 : rot, filter: 'blur(12px)' },
        { opacity: 1, y: 0, scale: 1, rotation: rot, filter: 'blur(0px)', duration: 0.7, ease: big ? 'back.out(1.4)' : 'back.out(2)' }, t);
      AV.detail(tl, el, t, o);
    },
    decorTimeline(tl, D, decor) {
      if (!decor) return;
      const drift = [[70, 40], [-80, -50], [60, -70]];
      decor.querySelectorAll('.pp-glow').forEach((g, k) => tl.fromTo(g, { x: 0, y: 0 }, { x: drift[k][0], y: drift[k][1], duration: Math.max(1, D), ease: 'sine.inOut' }, 0));
    },
  });
})();
