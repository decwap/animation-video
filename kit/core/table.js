// The primitive names every look must render, and each one's default animation verb.
// Shared by the build (engine/table.mjs runs it in node:vm) and the browser kit (window.AVTable).
// Part of animation-video (by Web Asamoah).
(function (root) {
  'use strict';
  const PRIMITIVES = [
    'kicker', 'headline', 'mark', 'chip', 'note', 'stamp', 'counter',
    'doc', 'video', 'phone', 'window', 'chat', 'terminal', 'image',
    'chart', 'arrow', 'track', 'progress',
    'icon', 'item', 'split',
    'mascot', 'broll', 'cta',
  ];
  const VERB = {
    headline: 'wordsIn', kicker: 'textIn', counter: 'countUp', chart: 'drawChart', stamp: 'stamp',
    arrow: 'drawPath', chat: 'typeText', terminal: 'typeText', mark: 'highlight', broll: 'broll',
    image: 'kenBurns', progress: 'progress',
  };
  const defaultVerb = (name) => VERB[name] || 'objectIn';
  root.AVTable = { PRIMITIVES, defaultVerb };
})(typeof window !== 'undefined' ? window : globalThis);
