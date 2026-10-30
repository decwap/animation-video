// Storybook Doodle motion: everything pops in with a bounce, outlines draw themselves, the play
// button plops onto the TV, and objects keep a gentle hand-drawn wobble while they are on screen.
// Part of animation-video (by Web Asamoah).
(function () {
  'use strict';
  AV.setPreset({ ease: 'back.out(2.2)', pop: 'back.out(2.6)', dur: 0.55, blur: 0, rise: 34, stagger: 0.09, outDur: 0.4 });

  // Seeded jitter, held between steps (8 a second), around the object's own tilt.
  function boil(tl, el, from, to, baseRot, seed) {
    const r = AV.rng(seed);
    for (let t = from; t < to - 0.05; t += 0.125) tl.set(el, { x: (r() - 0.5) * 2.4, y: (r() - 0.5) * 2.4, rotation: baseRot + (r() - 0.5) * 0.9 }, t);
  }

  AV.defineVerbs({
    sceneIn(tl, el, t) {
      tl.fromTo(el, { opacity: 0, x: 90, rotation: 2 }, { opacity: 1, x: 0, rotation: 0, duration: 0.55, ease: 'power3.out' }, t);
    },
    sceneOut(tl, el, t) {
      tl.to(el, { opacity: 0, x: -100, rotation: -2, duration: 0.4, ease: 'power2.in' }, t);
    },
    objectIn(tl, el, t, o) {
      const rot = +(o.rot || 0);
      tl.fromTo(el, { opacity: 0, scale: 0.5, rotation: rot - 8 }, { opacity: 1, scale: 1, rotation: rot, duration: 0.55, ease: 'back.out(2.6)' }, t);
      el.querySelectorAll('.dd-stroke').forEach((p, k) => AV.drawStroke(tl, p, t + 0.05 + k * 0.05, 0.45));
      const tri = el.querySelector('.dd-tri');
      if (tri) tl.fromTo(tri, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }, t + 0.6);
      AV.detail(tl, el, t, o);
      const end = el.hasAttribute('data-tout') ? +el.getAttribute('data-tout') : (o.sceneDur || 4);
      boil(tl, el, t + 0.7, end, rot, AV.hash(el.id || 'doodle'));
    },
  });
})();
