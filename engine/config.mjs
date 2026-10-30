// Shared constants for the animation-video engine. Part of animation-video (by Web Asamoah).
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HF_PIN = '0.8.216';
export const HF = ['--yes', `hyperframes@${HF_PIN}`];
export const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js';
export const PLAYER_URL = `https://cdn.jsdelivr.net/npm/hyperframes@${HF_PIN}/dist/hyperframes-player.global.js`;

export const W = 1080;
export const H = 1920;
export const FPS = 30;
// Key content stays inside SAFE; captions own CAPTION_BAND; the platform UI owns the rest.
export const SAFE = { x0: 60, x1: 960, y0: 220, y1: 1520 };
export const CAPTION_BAND = { y0: 1400, y1: 1540 };

export const LOOKS = ['paper', 'glow', 'doodle', 'editorial'];
// Seconds each sound-bank file lasts at most (the bank trims to these); sound clips carry them.
export const SFX_LENGTH = { pop: 0.4, whoosh: 0.8, swish: 0.5, tick: 1.3, type: 1.0, ding: 1.2, stamp: 1.0, draw: 0.6, riser: 1.4, impact: 1.4, click: 0.3, sparkle: 0.6 };
// The voice is levelled to this (engine/voice.mjs); the music bed sits MUSIC_UNDER_VOICE LU under it.
export const VOICE_LUFS = -16;
export const MUSIC_UNDER_VOICE = 8.5;
export const WHISPER_MODEL = process.env.AV_WHISPER_MODEL
  || path.join(os.homedir(), '.cache', 'whisper-cpp', 'ggml-large-v3-turbo-q5_0.bin');

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KIT_DIR = path.join(SKILL_ROOT, 'kit');

// Where everything lives inside one video folder.
export function paths(videoDir) {
  const j = (...p) => path.join(videoDir, ...p);
  return {
    brief: j('brief.md'),
    script: j('script.md'),
    research: j('research.md'),
    storyboard: j('storyboard.json'),
    brand: j('brand.json'),
    voiceDir: j('voice'),
    words: j('voice', 'words.json'),
    scenesDir: j('scenes'),
    assetsDir: j('assets'),
    looksDir: j('looks'),
    picker: j('picker.html'),
    renders: j('renders'),
  };
}
