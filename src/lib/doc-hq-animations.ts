// Shared animation table: 50+ named entrance/motion animations usable by any
// visual clip type (image, video, graphic). Each entry exposes a pure
// transform function of progress p (0..1 across the clip's active life) so
// the same table can drive canvas rendering for every clip kind.

export type AnimClipRect = { x: number; y: number; w: number; h: number }; // normalized 0..1 reveal window

export type AnimResult = {
  scale: number;
  dx: number; // px offset at 1920x1080 stage scale (caller scales to stage)
  dy: number;
  rotation: number; // degrees
  opacity: number;
  skewX: number; // radians
  clip?: AnimClipRect;
  extraFilter?: string;
  flash?: number; // 0..1 white/warm flash overlay amount (film burn etc.)
  grainBoost?: number;
};

export type AnimationDef = {
  id: string;
  name: string;
  category: string;
  apply: (p: number) => AnimResult;
};

const base = (): AnimResult => ({ scale: 1, dx: 0, dy: 0, rotation: 0, opacity: 1, skewX: 0 });
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// quick local ease helpers (kept independent from clip-level easing selector)
const eo = (x: number) => 1 - Math.pow(1 - x, 3);
const ei = (x: number) => x * x * x;

function entrance(p: number, span = 0.22) {
  return clamp01(p / span);
}

const W = 1920, H = 1080;

export const ANIMATIONS: AnimationDef[] = [
  // ---------- Ken Burns / pan / zoom (continuous, whole-clip) ----------
  { id: "static", name: "Static", category: "Ken Burns & Pan", apply: () => base() },
  { id: "kenburns-in", name: "Ken Burns · in", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1 + p * 0.16 }) },
  { id: "kenburns-out", name: "Ken Burns · out", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1.16 - p * 0.16 }) },
  { id: "pan-l", name: "Pan left", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1.1, dx: (0.5 - p) * W * 0.14 }) },
  { id: "pan-r", name: "Pan right", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1.1, dx: (p - 0.5) * W * 0.14 }) },
  { id: "pan-u", name: "Pan up", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1.1, dy: (0.5 - p) * H * 0.14 }) },
  { id: "pan-d", name: "Pan down", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1.1, dy: (p - 0.5) * H * 0.14 }) },
  { id: "zoom-punch", name: "Zoom punch-in", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1 + eo(clamp01(p / 0.15)) * 0.2 }) },
  { id: "zoom-punch-out", name: "Zoom punch-out", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1.2 - eo(clamp01(p / 0.15)) * 0.2 }) },
  { id: "drift", name: "Drift", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1.08 + Math.sin(p * Math.PI * 2) * 0.01, dx: Math.sin(p * Math.PI * 1.4) * W * 0.02, dy: Math.cos(p * Math.PI * 1.1) * H * 0.02 }) },
  { id: "parallax-push", name: "Parallax push", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1.14, dx: (p - 0.5) * W * 0.06, dy: (p - 0.5) * H * 0.03 }) },
  { id: "orbit-drift", name: "Orbit drift", category: "Ken Burns & Pan", apply: (p) => ({ ...base(), scale: 1.12, dx: Math.cos(p * Math.PI * 2) * W * 0.03, dy: Math.sin(p * Math.PI * 2) * H * 0.03 }) },

  // ---------- Fades / slides ----------
  { id: "fade", name: "Fade in", category: "Fades & Slides", apply: (p) => ({ ...base(), opacity: entrance(p) }) },
  { id: "slide-up", name: "Slide up", category: "Fades & Slides", apply: (p) => { const k = eo(entrance(p)); return { ...base(), opacity: k, dy: (1 - k) * 120 }; } },
  { id: "slide-down", name: "Slide down", category: "Fades & Slides", apply: (p) => { const k = eo(entrance(p)); return { ...base(), opacity: k, dy: -(1 - k) * 120 }; } },
  { id: "slide-left", name: "Slide from right", category: "Fades & Slides", apply: (p) => { const k = eo(entrance(p)); return { ...base(), opacity: k, dx: (1 - k) * 220 }; } },
  { id: "slide-right", name: "Slide from left", category: "Fades & Slides", apply: (p) => { const k = eo(entrance(p)); return { ...base(), opacity: k, dx: -(1 - k) * 220 }; } },
  { id: "rise-fade", name: "Rise & fade", category: "Fades & Slides", apply: (p) => { const k = eo(entrance(p, 0.3)); return { ...base(), opacity: k, dy: (1 - k) * 60, scale: 0.97 + k * 0.03 }; } },
  { id: "drop-fade", name: "Drop & fade", category: "Fades & Slides", apply: (p) => { const k = eo(entrance(p, 0.3)); return { ...base(), opacity: k, dy: -(1 - k) * 60, scale: 1.03 - k * 0.03 }; } },
  { id: "slide-diagonal", name: "Diagonal slide", category: "Fades & Slides", apply: (p) => { const k = eo(entrance(p)); return { ...base(), opacity: k, dx: (1 - k) * 140, dy: (1 - k) * 100 }; } },
  { id: "blur-in", name: "Blur in", category: "Fades & Slides", apply: (p) => { const k = clamp01(p / 0.25); return { ...base(), opacity: k, extraFilter: `blur(${(1 - k) * 18}px)` }; } },
  { id: "cross-dissolve-in", name: "Cross dissolve", category: "Fades & Slides", apply: (p) => ({ ...base(), opacity: entrance(p, 0.35), scale: 1.02 - entrance(p, 0.35) * 0.02 }) },

  // ---------- Pop / scale ----------
  { id: "pop", name: "Pop", category: "Pop & Scale", apply: (p) => { const k = eo(entrance(p, 0.2)); return { ...base(), opacity: k, scale: 0.85 + k * 0.15 }; } },
  { id: "pop-elastic", name: "Elastic pop", category: "Pop & Scale", apply: (p) => { const x = entrance(p, 0.35); const k = x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1; return { ...base(), opacity: clamp01(x * 3), scale: 0.6 + k * 0.4 }; } },
  { id: "scale-in", name: "Scale in", category: "Pop & Scale", apply: (p) => { const k = eo(entrance(p)); return { ...base(), opacity: k, scale: 0.6 + k * 0.4 }; } },
  { id: "scale-out-hold", name: "Scale settle", category: "Pop & Scale", apply: (p) => { const k = eo(entrance(p)); return { ...base(), opacity: k, scale: 1.3 - k * 0.3 }; } },
  { id: "bounce-in", name: "Bounce in", category: "Pop & Scale", apply: (p) => { const k = clamp01(p / 0.4); const b = Math.abs(Math.sin(k * Math.PI * 2.2)) * (1 - k); return { ...base(), opacity: clamp01(p / 0.15), scale: 1 + b * 0.12, dy: -b * 30 }; } },
  { id: "swing-in", name: "Swing in", category: "Pop & Scale", apply: (p) => { const k = clamp01(p / 0.4); return { ...base(), opacity: clamp01(p / 0.15), rotation: (1 - k) * 12 * Math.sin(k * Math.PI * 3) }; } },
  { id: "heartbeat", name: "Heartbeat pulse", category: "Pop & Scale", apply: (p) => ({ ...base(), scale: 1 + Math.max(0, Math.sin(p * Math.PI * 8)) * 0.03 }) },

  // ---------- Rotate / flip / 3D ----------
  { id: "rotate-in", name: "Rotate in", category: "Rotate & Flip", apply: (p) => { const k = eo(entrance(p, 0.3)); return { ...base(), opacity: k, rotation: (1 - k) * -18, scale: 0.9 + k * 0.1 }; } },
  { id: "flip-x", name: "Flip horizontal", category: "Rotate & Flip", apply: (p) => { const k = entrance(p, 0.3); return { ...base(), opacity: clamp01(k * 3), scale: 1 - Math.abs(Math.cos(k * Math.PI)) * 0 + Math.abs(Math.sin(k * Math.PI * 0.5)) * 0 + 1 - (1 - k) * 0, skewX: (1 - k) * 0.3 }; } },
  { id: "flip-y", name: "Flip vertical", category: "Rotate & Flip", apply: (p) => { const k = eo(entrance(p, 0.3)); return { ...base(), opacity: k, dy: (1 - k) * 20, scale: 0.85 + k * 0.15 }; } },
  { id: "card-flip-3d", name: "3D card flip", category: "Rotate & Flip", apply: (p) => { const k = entrance(p, 0.4); const s = Math.abs(Math.cos((1 - k) * Math.PI * 0.5)); return { ...base(), opacity: clamp01(k * 2.5), scale: 0.94 + k * 0.06, skewX: (1 - k) * 0.18, extraFilter: s < 0.98 ? `brightness(${0.7 + s * 0.3})` : undefined }; } },
  { id: "spin-drop", name: "Spin & drop", category: "Rotate & Flip", apply: (p) => { const k = eo(entrance(p, 0.35)); return { ...base(), opacity: k, rotation: (1 - k) * 60, dy: -(1 - k) * 80, scale: 0.8 + k * 0.2 }; } },
  { id: "roll-in", name: "Roll in", category: "Rotate & Flip", apply: (p) => { const k = eo(entrance(p, 0.35)); return { ...base(), opacity: k, dx: -(1 - k) * 260, rotation: -(1 - k) * 200 }; } },
  { id: "tumble", name: "Tumble in", category: "Rotate & Flip", apply: (p) => { const k = eo(entrance(p, 0.4)); return { ...base(), opacity: k, rotation: (1 - k) * -140, dx: (1 - k) * 160, dy: (1 - k) * -60 }; } },

  // ---------- Wipes / masks ----------
  { id: "wipe-linear-l", name: "Wipe · left to right", category: "Wipes & Masks", apply: (p) => { const k = clamp01(p / 0.3); return { ...base(), clip: { x: 0, y: 0, w: k, h: 1 } }; } },
  { id: "wipe-linear-r", name: "Wipe · right to left", category: "Wipes & Masks", apply: (p) => { const k = clamp01(p / 0.3); return { ...base(), clip: { x: 1 - k, y: 0, w: k, h: 1 } }; } },
  { id: "wipe-vertical", name: "Wipe · top to bottom", category: "Wipes & Masks", apply: (p) => { const k = clamp01(p / 0.3); return { ...base(), clip: { x: 0, y: 0, w: 1, h: k } }; } },
  { id: "wipe-radial", name: "Radial wipe", category: "Wipes & Masks", apply: (p) => ({ ...base(), opacity: clamp01(p / 0.3) }) },
  { id: "iris-open", name: "Iris open", category: "Wipes & Masks", apply: (p) => { const k = eo(clamp01(p / 0.35)); return { ...base(), scale: 0.3 + k * 0.7, opacity: clamp01(p / 0.12) }; } },
  { id: "clock-wipe", name: "Clock wipe", category: "Wipes & Masks", apply: (p) => ({ ...base(), opacity: clamp01(p / 0.35) }) },
  { id: "blinds-h", name: "Blinds · horizontal", category: "Wipes & Masks", apply: (p) => ({ ...base(), opacity: clamp01(p / 0.3) }) },
  { id: "blinds-v", name: "Blinds · vertical", category: "Wipes & Masks", apply: (p) => ({ ...base(), opacity: clamp01(p / 0.3) }) },

  // ---------- Paper / craft ----------
  { id: "paper-unfold", name: "Paper unfold", category: "Paper & Craft", apply: (p) => { const k = eo(entrance(p, 0.4)); return { ...base(), opacity: clamp01(p / 0.1), clip: { x: 0.5 - k * 0.5, y: 0, w: k, h: 1 } }; } },
  { id: "page-turn", name: "Page turn", category: "Paper & Craft", apply: (p) => { const k = eo(entrance(p, 0.4)); return { ...base(), opacity: k, skewX: (1 - k) * -0.5, dx: (1 - k) * 200, extraFilter: `brightness(${0.75 + k * 0.25})` }; } },
  { id: "ink-bleed", name: "Ink bleed", category: "Paper & Craft", apply: (p) => { const k = clamp01(p / 0.5); return { ...base(), opacity: k, extraFilter: `blur(${(1 - k) * 10}px) contrast(${1 + (1 - k) * 0.4})` }; } },
  { id: "sketch-drawon", name: "Sketch draw-on", category: "Paper & Craft", apply: (p) => { const k = clamp01(p / 0.5); return { ...base(), clip: { x: 0, y: 0, w: k, h: 1 }, opacity: 1 }; } },
  { id: "film-burn", name: "Film burn", category: "Paper & Craft", apply: (p) => { const k = clamp01(p / 0.3); const flash = p < 0.15 ? 1 - p / 0.15 : 0; return { ...base(), opacity: k, flash: flash * 0.8 }; } },
  { id: "torn-edge", name: "Torn edge reveal", category: "Paper & Craft", apply: (p) => { const k = eo(clamp01(p / 0.35)); return { ...base(), opacity: k, dy: (1 - k) * 24, clip: { x: 0, y: 1 - k, w: 1, h: k } }; } },
  { id: "kraft-fold", name: "Kraft fold-out", category: "Paper & Craft", apply: (p) => { const k = eo(entrance(p, 0.4)); return { ...base(), opacity: clamp01(p / 0.1), clip: { x: 0, y: 0.5 - k * 0.5, w: 1, h: k } }; } },

  // ---------- Glitch / modern ----------
  { id: "glitch-slice", name: "Glitch slice", category: "Glitch & Modern", apply: (p) => { const k = clamp01(p / 0.25); const jitter = (1 - k) * (Math.random() - 0.5) * 30; return { ...base(), opacity: clamp01(p / 0.1), dx: jitter, extraFilter: k < 1 ? `hue-rotate(${(1 - k) * 40}deg)` : undefined }; } },
  { id: "shatter", name: "Shatter in", category: "Glitch & Modern", apply: (p) => { const k = eo(entrance(p, 0.4)); return { ...base(), opacity: k, scale: 1.3 - k * 0.3, rotation: (1 - k) * 8 }; } },
  { id: "pixelate-in", name: "Pixelate in", category: "Glitch & Modern", apply: (p) => { const k = clamp01(p / 0.35); return { ...base(), opacity: k, extraFilter: `blur(${(1 - k) * 6}px)` }; } },
  { id: "mosaic-reveal", name: "Mosaic reveal", category: "Glitch & Modern", apply: (p) => ({ ...base(), opacity: clamp01(p / 0.3) }) },
  { id: "light-sweep", name: "Light sweep", category: "Glitch & Modern", apply: (p) => { const flash = Math.max(0, 1 - Math.abs(p - 0.15) * 6); return { ...base(), opacity: clamp01(p / 0.1), flash: flash * 0.5 }; } },
  { id: "vhs-warp", name: "VHS warp-in", category: "Glitch & Modern", apply: (p) => { const k = clamp01(p / 0.3); return { ...base(), opacity: k, skewX: (1 - k) * 0.08 * Math.sin(p * 40), extraFilter: `saturate(${1 + (1 - k)})` }; } },
  { id: "datamosh", name: "Datamosh in", category: "Glitch & Modern", apply: (p) => { const k = clamp01(p / 0.3); return { ...base(), opacity: k, dx: (1 - k) * (Math.random() - 0.5) * 12 }; } },

  // ---------- Text-only ----------
  { id: "typewriter", name: "Typewriter", category: "Text", apply: (p) => ({ ...base(), opacity: 1 }) },
  { id: "letter-stagger", name: "Letter stagger", category: "Text", apply: (p) => ({ ...base(), opacity: 1 }) },
  { id: "caret-reveal", name: "Caret reveal", category: "Text", apply: (p) => ({ ...base(), opacity: 1 }) },
];

export function getAnimation(id: string): AnimationDef {
  return ANIMATIONS.find((a) => a.id === id) ?? ANIMATIONS[0];
}

export const ANIMATION_CATEGORIES = Array.from(new Set(ANIMATIONS.map((a) => a.category)));
