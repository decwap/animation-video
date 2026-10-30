// Midnight Glow motion: words and objects sharpen out of a blur, glass cards rise in 3D, a light
// sweep crosses every card, documents get scanned, particles drift up through the aurora.
// Part of animation-video (by Web Asamoah).
(function () {
  'use strict';
  const BIG = ['doc', 'video', 'phone', 'window', 'image', 'chart', 'track', 'split', 'broll', 'cta', 'terminal'];
  AV.setPreset({ ease: 'expo.out', pop: 'expo.out', dur: 0.7, blur: 16, rise: 28, stagger: 0.07, outDur: 0.45 });

  const sweep = (tl, el, t) => {
    const s = el.querySelector(':scope > .gl-sweep');
    if (s) tl.fromTo(s, { xPercent: -140 }, { xPercent: 320, duration: 1.1, ease: 'power2.inOut' }, t + 0.55);
  };

  AV.defineVerbs({
    sceneIn(tl, el, t) {
      tl.fromTo(el, { opacity: 0, scale: 1.06, filter: 'blur(20px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out' }, t);
    },
    sceneOut(tl, el, t) {
      tl.to(el, { opacity: 0, scale: 0.95, filter: 'blur(18px)', duration: 0.45, ease: 'power2.in' }, t);
    },
    objectIn(tl, el, t, o) {
      const name = AV.primitiveOf(el);
      if (BIG.includes(name)) {
        tl.fromTo(el, { opacity: 0, y: 100, rotationX: 24, transformPerspective: 1600, transformOrigin: '50% 100%', filter: 'blur(14px)' },
          { opacity: 1, y: 0, rotationX: 0, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out' }, t);
      } else {
        tl.fromTo(el, { opacity: 0, scale: 1.16, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out' }, t);
      }
      AV.detail(tl, el, t, o);
      sweep(tl, el, t);
    },
    decorTimeline(tl, D, decor) {
      if (!decor) return;
      const drift = [[140, 90], [-120, -60], [90, -110]];
      decor.querySelectorAll('.gl-aur').forEach((a, k) => tl.fromTo(a, { x: 0, y: 0 }, { x: drift[k][0], y: drift[k][1], duration: Math.max(1, D), ease: 'sine.inOut' }, 0));
      decor.querySelectorAll('.gl-pt').forEach((p, k) => {
        const life = 4 + (k % 5);
        tl.fromTo(p, { y: 0, opacity: 0 }, { keyframes: { y: [0, -180, -360], opacity: [0, 0.9, 0] }, duration: life, ease: 'none', repeat: Math.ceil(D / life) }, (k * 0.37) % 3);
      });
    },
  });

  AV.defineDetails({
    doc(tl, el, t) {
      const lines = [...el.querySelectorAll('.av-doc__bar, .av-doc__line')];
      if (lines.length) tl.fromTo(lines, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, t + 0.3);
      const beam = el.querySelector('.gl-beam');
      if (beam) {
        tl.to(beam, { opacity: 1, duration: 0.2 }, t + 0.8);
        tl.fromTo(beam, { y: 0 }, { y: Math.max(120, el.offsetHeight - 120), duration: 0.9, ease: 'sine.inOut' }, t + 0.8);
        tl.to(beam, { opacity: 0, duration: 0.2 }, t + 1.6);
        lines.forEach((l, k) => tl.to(l, { backgroundColor: 'rgba(98, 243, 232, 0.55)', duration: 0.2 }, t + 0.85 + k * 0.13));
      }
    },
  });
})();
