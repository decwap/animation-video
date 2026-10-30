// Bold Editorial motion: words slam in one by one, clippings drop onto the desk, stamps hit with a
// camera shake, scenes change with a hard wipe.
// Part of animation-video (by Web Asamoah).
(function () {
  'use strict';
  const BIG = ['doc', 'video', 'phone', 'window', 'image', 'chart', 'track', 'split', 'broll', 'cta', 'terminal'];
  AV.setPreset({ ease: 'expo.out', pop: 'expo.out', dur: 0.32, blur: 0, rise: 0, stagger: 0.06, outDur: 0.3 });

  const shake = (tl, el, t, k = 1) => {
    const stage = el.closest ? el.closest('.av-scene') : null;
    if (stage) tl.to(stage, { keyframes: { x: [0, 18 * k, -16 * k, 10 * k, -6 * k, 0], y: [0, -10 * k, 8 * k, -5 * k, 3 * k, 0] }, duration: 0.35, ease: 'none' }, t);
  };

  AV.defineVerbs({
    sceneIn(tl, el, t) {
      tl.fromTo(el, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.35, ease: 'expo.inOut' }, t);
    },
    sceneOut(tl, el, t) {
      tl.to(el, { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.3, ease: 'expo.in' }, t);
    },
    wordsIn(tl, el, t, o) {
      const ws = AV.split(el);
      const times = o.sync === 'off' ? ws.map((w, k) => t + k * 0.06) : AV.wordTimes(ws, o.root, t, 0.06);
      tl.set(el, { opacity: 1 }, 0);
      ws.forEach((w, k) => tl.fromTo(w, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.28, ease: 'expo.out' }, times[k]));
    },
    objectIn(tl, el, t, o) {
      const rot = +(o.rot || 0);
      if (BIG.includes(AV.primitiveOf(el))) {
        tl.fromTo(el, { opacity: 0, y: 240, rotation: rot + 7 }, { opacity: 1, y: 0, rotation: rot, duration: 0.6, ease: 'expo.out' }, t);
      } else {
        tl.fromTo(el, { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'expo.out' }, t);
      }
      AV.detail(tl, el, t, o);
    },
    stamp(tl, el, t, o) {
      const rot = +(o.rot ?? -12);
      tl.fromTo(el, { opacity: 0, scale: 2.6, rotation: rot - 22 }, { opacity: 1, scale: 1, rotation: rot, duration: 0.22, ease: 'power4.in' }, t);
      shake(tl, el, t + 0.22);
    },
  });
})();
