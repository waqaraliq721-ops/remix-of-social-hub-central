// HQ motivational video engine — cut-out subjects, textured backdrops and
// transcript-driven kinetic captions. Everything here is pure canvas drawing so
// the same code powers both the live preview and the exported frames.

import type { TranscriptWord } from "@/lib/transcribe";

export type HqAspect = "9:16" | "1:1" | "16:9";

export const HQ_ASPECTS: Record<HqAspect, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · Reels/Shorts" },
  "1:1": { w: 1080, h: 1080, label: "Square · Feed" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

/* ------------------------------------------------------------------ words */

export type HqWord = TranscriptWord & { important: boolean };
export type HqLine = { start: number; end: number; words: HqWord[] };

const STOP = new Set(
  ("a an the and or but if of to in on at for with from by is are was were be been being am " +
    "it its this that these those i you he she we they me him her them my your his our their as " +
    "so than then just about into over under up down out not no do does did done have has had " +
    "will would can could should may might must because while when where which who whom what how")
    .split(" "),
);

/** Marks the words that carry the punch so they can be styled bigger/brighter. */
export function markImportant(
  words: TranscriptWord[],
  opts: { minLength: number; keywords: string; auto: boolean },
): HqWord[] {
  const keys = new Set(
    opts.keywords
      .split(/[,\n]/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean),
  );
  return words.map((w) => {
    const clean = w.text.toLowerCase().replace(/[^a-z0-9'-]/g, "");
    let important = keys.has(clean);
    if (!important && opts.auto) {
      important = clean.length >= opts.minLength && !STOP.has(clean);
    }
    return { ...w, important };
  });
}

export function groupHqLines(words: HqWord[], perLine: number, gap = 0.7): HqLine[] {
  const out: HqLine[] = [];
  let cur: HqWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    cur.push(words[i]);
    const next = words[i + 1];
    const pause = next ? next.start - words[i].end : Infinity;
    if (cur.length >= perLine || pause >= gap || /[.!?]$/.test(words[i].text) || !next) flush();
  }
  flush();
  return out;
}

/** Fallback for typed text without timings. */
export function textToHqLines(text: string, duration: number, perLine: number): HqLine[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const total = duration > 0 ? duration : tokens.length * 0.42;
  const per = total / tokens.length;
  const words: HqWord[] = tokens.map((t, i) => ({
    text: t,
    start: i * per,
    end: (i + 1) * per,
    important: /[A-Z]{2,}|[!?]$/.test(t),
  }));
  return groupHqLines(words, perLine, Infinity);
}

/** Stable identity for a transcript word, used to key per-word style overrides. */
export function hqWordKey(lineIndex: number, wordIndex: number): string {
  return `${lineIndex}:${wordIndex}`;
}

/* --------------------------------------------------------- per-word styles */

export type HqWordStyle = {
  color?: string;
  scale?: number;
  weight?: string;
  italic?: boolean;
  dx?: number;
  dy?: number;
  anim?: HqAnimId;
  delay?: number;
  emphasis?: boolean;
};

/* ------------------------------------------------------------- backgrounds */

export type HqBackdrop = {
  id: string;
  name: string;
  base: string;
  /** Paints a full-frame textured, gently animated backdrop. */
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, color: string) => void;
};

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, amount: number) {
  const step = 4;
  ctx.save();
  ctx.globalAlpha = amount;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const n = Math.sin((x * 12.9898 + y * 78.233 + Math.floor(t * 12) * 3.17) * 0.5) * 43758.5453;
      const v = n - Math.floor(n);
      if (v > 0.86) {
        ctx.fillStyle = v > 0.95 ? "#ffffff" : "#000000";
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  ctx.restore();
}

function shade(hex: string, amt: number) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export const HQ_BACKDROPS: HqBackdrop[] = [
  {
    id: "studio",
    name: "Studio Sweep",
    base: "#123a8a",
    paint: (ctx, w, h, t, c) => {
      const g = ctx.createRadialGradient(
        w * 0.5,
        h * (0.36 + Math.sin(t * 0.3) * 0.02),
        0,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.85,
      );
      g.addColorStop(0, shade(c, 0.16));
      g.addColorStop(1, shade(c, -0.24));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, t, 0.05);
    },
  },
  {
    id: "paper",
    name: "Pressed Paper",
    base: "#efece4",
    paint: (ctx, w, h, t, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 90; i++) {
        const y = ((i * 97) % h) + Math.sin(t * 0.4 + i) * 3;
        ctx.strokeStyle = i % 2 ? "#000" : "#fff";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + ((i % 5) - 2) * 4);
        ctx.stroke();
      }
      ctx.restore();
      grain(ctx, w, h, t, 0.12);
    },
  },
  {
    id: "concrete",
    name: "Concrete",
    base: "#2b2b2e",
    paint: (ctx, w, h, t, c) => {
      ctx.fillStyle = shade(c, -0.05);
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      for (let i = 0; i < 26; i++) {
        const r = (Math.sin(i * 3.1) * 0.5 + 0.5) * Math.max(w, h) * 0.45;
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = i % 2 ? "#fff" : "#000";
        ctx.beginPath();
        ctx.arc(
          ((i * 137) % w) + Math.sin(t * 0.2 + i) * 20,
          ((i * 311) % h) + Math.cos(t * 0.18 + i) * 20,
          r,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();
      grain(ctx, w, h, t, 0.1);
    },
  },
  {
    id: "canvasoil",
    name: "Oil Canvas",
    base: "#1a1408",
    paint: (ctx, w, h, t, c) => {
      ctx.fillStyle = shade(c, -0.08);
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < 260; i++) {
        const x = (i * 613) % w;
        const y = (i * 379) % h;
        const a = Math.sin(i + t * 0.25) * 0.8;
        ctx.strokeStyle = i % 3 === 0 ? shade(c, 0.3) : shade(c, -0.2);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 42, y + Math.sin(a) * 42);
        ctx.stroke();
      }
      ctx.restore();
      grain(ctx, w, h, t, 0.08);
    },
  },
  {
    id: "newsprint",
    name: "Newsprint",
    base: "#c9c6bd",
    paint: (ctx, w, h, t, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#000";
      for (let y = 0; y < h; y += 26) {
        for (let x = 0; x < w; x += 26) {
          const r = 4 + Math.sin((x + y) * 0.02 + t * 0.6) * 1.6;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      grain(ctx, w, h, t, 0.1);
    },
  },
  {
    id: "voidsolid",
    name: "Deep Void",
    base: "#050505",
    paint: (ctx, w, h, t, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, w * 0.8);
      g.addColorStop(0, "rgba(255,255,255,0.06)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, t, 0.05);
    },
  },
  {
    id: "duotone",
    name: "Duotone Wash",
    base: "#0d5c63",
    paint: (ctx, w, h, t, c) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, shade(c, 0.18));
      g.addColorStop(0.5 + Math.sin(t * 0.25) * 0.1, shade(c, -0.05));
      g.addColorStop(1, shade(c, -0.3));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, t, 0.07);
    },
  },
  {
    id: "grunge",
    name: "Grunge Split",
    base: "#101010",
    paint: (ctx, w, h, t, c) => {
      ctx.fillStyle = "#e8e5df";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = shade(c, -0.02);
      ctx.beginPath();
      const edge = w * 0.42;
      ctx.moveTo(edge, 0);
      for (let y = 0; y <= h; y += 20) {
        ctx.lineTo(edge + Math.sin(y * 0.05 + t * 0.5) * 14, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(w, 0);
      ctx.closePath();
      ctx.fill();
      grain(ctx, w, h, t, 0.13);
    },
  },
  {
    id: "spotlight",
    name: "Stage Light",
    base: "#080808",
    paint: (ctx, w, h, t, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      const g = ctx.createRadialGradient(w * 0.5, h * 0.28, 0, w * 0.5, h * 0.32, h * 0.55);
      g.addColorStop(0, `rgba(255,240,210,${0.22 + Math.sin(t * 0.8) * 0.03})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      grain(ctx, w, h, t, 0.06);
    },
  },
  {
    id: "aurora",
    name: "Aurora Drift",
    base: "#101b3a",
    paint: (ctx, w, h, t, c) => {
      ctx.fillStyle = shade(c, -0.18);
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 3; i++) {
        const g = ctx.createRadialGradient(
          w * (0.3 + 0.2 * i) + Math.sin(t * 0.25 + i) * w * 0.12,
          h * (0.3 + 0.18 * i) + Math.cos(t * 0.2 + i) * h * 0.08,
          0,
          w * 0.5,
          h * 0.5,
          w * 0.7,
        );
        g.addColorStop(0, shade(c, 0.25 - i * 0.06));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
      grain(ctx, w, h, t, 0.05);
    },
  },
  {
    id: "gradientsun",
    name: "Warm Gradient",
    base: "#e0703a",
    paint: (ctx, w, h, t, c) => {
      const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
      g.addColorStop(0, shade(c, 0.28));
      g.addColorStop(0.55 + Math.sin(t * 0.2) * 0.04, shade(c, 0.02));
      g.addColorStop(1, shade(c, -0.22));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, t, 0.04);
    },
  },
  {
    id: "cream",
    name: "Cream Sky",
    base: "#efe6d3",
    paint: (ctx, w, h, t, c) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, shade(c, 0.12));
      g.addColorStop(0.55, c);
      g.addColorStop(1, shade(c, -0.14));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, t, 0.03);
    },
  },
  {
    id: "graytex",
    name: "Slate Texture",
    base: "#26282b",
    paint: (ctx, w, h, t, c) => {
      ctx.fillStyle = shade(c, -0.04);
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = i % 2 ? "#fff" : "#000";
        const x = (i * 173 + t * 6) % (w + 80) - 40;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 120, h);
        ctx.stroke();
      }
      ctx.restore();
      grain(ctx, w, h, t, 0.09);
    },
  },
];

/* ------------------------------------------------------------- easing */

export const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeOutQuint = (p: number) => 1 - Math.pow(1 - p, 5);
export const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
/** Critically-damped spring-ish settle, good for punchy but smooth pops. */
export const springOut = (p: number, damping = 0.62) => {
  if (p >= 1) return 1;
  if (p <= 0) return 0;
  const decay = Math.exp(-p * 6 * damping);
  return 1 - decay * Math.cos(p * 9 * (1 - damping * 0.5));
};

const ease = easeInOutCubic;

/* ------------------------------------------------------------- animations */

export type HqAnimId =
  | "pop"
  | "rise"
  | "drop"
  | "slide"
  | "typewriter"
  | "blur"
  | "flip"
  | "wipe"
  | "spring"
  | "shake"
  | "glitch"
  | "none";

export const HQ_CAPTION_ANIMS: { id: HqAnimId; name: string }[] = [
  { id: "pop", name: "Pop scale" },
  { id: "rise", name: "Rise up" },
  { id: "drop", name: "Drop in" },
  { id: "slide", name: "Slide across" },
  { id: "typewriter", name: "Typewriter" },
  { id: "blur", name: "Blur focus" },
  { id: "flip", name: "Flip in" },
  { id: "wipe", name: "Wipe reveal" },
  { id: "spring", name: "Spring bounce" },
  { id: "shake", name: "Impact shake" },
  { id: "glitch", name: "Glitch" },
  { id: "none", name: "No animation" },
];

export type WordMotion = {
  alpha: number;
  dx: number;
  dy: number;
  scale: number;
  rot: number;
  clip: number; // 0..1 horizontal reveal
};

export function wordMotion(anim: HqAnimId, p: number, intensity: number): WordMotion {
  const k = Math.max(0, Math.min(1, p));
  const e = ease(k);
  const s = intensity;
  const base: WordMotion = { alpha: 1, dx: 0, dy: 0, scale: 1, rot: 0, clip: 1 };
  switch (anim) {
    case "pop": {
      const o = easeOutBack(k);
      return { ...base, alpha: Math.min(1, k * 2.4), scale: 0.55 + 0.45 * o };
    }
    case "rise":
      return { ...base, alpha: easeOutQuint(k), dy: (1 - easeOutQuint(k)) * 70 * s };
    case "drop":
      return { ...base, alpha: easeOutQuint(k), dy: -(1 - easeOutQuint(k)) * 70 * s };
    case "slide":
      return { ...base, alpha: easeOutQuint(k), dx: (1 - easeOutQuint(k)) * 120 * s };
    case "typewriter":
      return { ...base, alpha: k > 0 ? 1 : 0, clip: Math.min(1, k * 1.8) };
    case "blur":
      return { ...base, alpha: e, scale: 1 + (1 - e) * 0.14 * s };
    case "flip":
      return { ...base, alpha: e, scale: 0.3 + 0.7 * easeOutBack(k), rot: (1 - e) * 0.5 * s };
    case "wipe":
      return { ...base, clip: easeInOutCubic(k) };
    case "spring": {
      const o = springOut(k);
      return { ...base, alpha: Math.min(1, k * 3), scale: 0.7 + 0.3 * o + Math.sin(k * Math.PI * 2) * (1 - k) * 0.06 * s };
    }
    case "shake": {
      const a = (1 - e) * 18 * s;
      return { ...base, alpha: Math.min(1, k * 4), dx: Math.sin(k * 40) * a, dy: Math.cos(k * 33) * a };
    }
    case "glitch": {
      const j = (1 - e) * 26 * s;
      return {
        ...base,
        alpha: k > 0.08 ? 1 : 0,
        dx: (Math.random() - 0.5) * j,
        dy: (Math.random() - 0.5) * j * 0.4,
      };
    }
    default:
      return base;
  }
}

export const SUBJECT_ANIMS = [
  { id: "riseIn", name: "Rise in" },
  { id: "zoomIn", name: "Zoom in" },
  { id: "zoomOut", name: "Zoom out" },
  { id: "fadeIn", name: "Fade in" },
  { id: "slideLeft", name: "Slide from left" },
  { id: "slideRight", name: "Slide from right" },
  { id: "breathe", name: "Breathe (loop)" },
  { id: "sway", name: "Sway (loop)" },
  { id: "none", name: "Static" },
] as const;
export type SubjectAnimId = (typeof SUBJECT_ANIMS)[number]["id"];

export function subjectMotion(anim: SubjectAnimId, t: number, dur: number, amount: number) {
  const p = Math.max(0, Math.min(1, t / Math.max(0.2, dur)));
  const e = easeOutQuint(p);
  switch (anim) {
    case "riseIn":
      return { dx: 0, dy: (1 - e) * 220 * amount, scale: 0.97 + 0.03 * easeOutBack(p), alpha: e };
    case "zoomIn":
      return { dx: 0, dy: 0, scale: 0.82 + 0.18 * e, alpha: e };
    case "zoomOut":
      return { dx: 0, dy: 0, scale: 1.2 - 0.2 * e, alpha: e };
    case "fadeIn":
      return { dx: 0, dy: 0, scale: 1, alpha: e };
    case "slideLeft":
      return { dx: -(1 - e) * 320 * amount, dy: 0, scale: 1, alpha: e };
    case "slideRight":
      return { dx: (1 - e) * 320 * amount, dy: 0, scale: 1, alpha: e };
    case "breathe":
      return { dx: 0, dy: 0, scale: 1 + Math.sin(t * 0.9) * 0.02 * amount, alpha: 1 };
    case "sway":
      return { dx: Math.sin(t * 0.6) * 18 * amount, dy: Math.cos(t * 0.5) * 10 * amount, scale: 1, alpha: 1 };
    default:
      return { dx: 0, dy: 0, scale: 1, alpha: 1 };
  }
}

/* ---------------------------------------------------------- camera motion */

export const HQ_CAMERA_MOTIONS = [
  { id: "none", name: "Locked off" },
  { id: "zoomIn", name: "Slow zoom in" },
  { id: "zoomOut", name: "Slow zoom out" },
  { id: "drift", name: "Float / drift" },
  { id: "parallax", name: "Parallax sway" },
  { id: "handheld", name: "Handheld micro-shake" },
  { id: "panL", name: "Pan left" },
  { id: "panR", name: "Pan right" },
  { id: "breathe", name: "Breathe" },
] as const;
export type HqCameraMotionId = (typeof HQ_CAMERA_MOTIONS)[number]["id"];

/** A continuous transform applied to the whole composed frame so no export is ever static. */
export function cameraTransform(
  id: HqCameraMotionId,
  t: number,
  speed: number,
  intensity: number,
  w: number,
  h: number,
): { dx: number; dy: number; scale: number; rot: number } {
  const s = speed;
  const k = intensity;
  switch (id) {
    case "zoomIn":
      return { dx: 0, dy: 0, scale: 1 + Math.min(0.4, t * 0.012 * s) * k, rot: 0 };
    case "zoomOut":
      return { dx: 0, dy: 0, scale: 1.22 - Math.min(0.2, t * 0.01 * s) * k, rot: 0 };
    case "drift":
      return {
        dx: Math.sin(t * 0.22 * s) * w * 0.012 * k,
        dy: Math.cos(t * 0.17 * s) * h * 0.01 * k,
        scale: 1.05,
        rot: 0,
      };
    case "parallax":
      return {
        dx: Math.sin(t * 0.35 * s) * w * 0.018 * k,
        dy: Math.sin(t * 0.2 * s) * h * 0.006 * k,
        scale: 1.06,
        rot: Math.sin(t * 0.2 * s) * 0.006 * k,
      };
    case "handheld":
      return {
        dx: (Math.sin(t * 7.1 * s) + Math.sin(t * 3.3 * s)) * 1.4 * k,
        dy: (Math.cos(t * 6.3 * s) + Math.sin(t * 2.6 * s)) * 1.2 * k,
        scale: 1.03,
        rot: Math.sin(t * 5 * s) * 0.0016 * k,
      };
    case "panL":
      return { dx: -Math.min(w * 0.08, t * 4 * s) * k, dy: 0, scale: 1.12, rot: 0 };
    case "panR":
      return { dx: Math.min(w * 0.08, t * 4 * s) * k, dy: 0, scale: 1.12, rot: 0 };
    case "breathe":
      return { dx: 0, dy: 0, scale: 1 + Math.sin(t * 0.8 * s) * 0.015 * k, rot: 0 };
    default:
      return { dx: 0, dy: 0, scale: 1, rot: 0 };
  }
}

/* --------------------------------------------------------------- particles */

export const HQ_PARTICLES = [
  { id: "none", name: "None" },
  { id: "money", name: "Falling money" },
  { id: "sparks", name: "Embers" },
  { id: "dust", name: "Dust motes" },
  { id: "leaves", name: "Leaves" },
  { id: "confetti", name: "Confetti" },
] as const;
export type ParticleId = (typeof HQ_PARTICLES)[number]["id"];

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  kind: ParticleId,
  count: number,
  speed: number,
  region: { x: number; y: number; w: number; h: number },
  color: string,
) {
  if (kind === "none" || count <= 0) return;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 9301;
    const rx = ((seed % 1000) / 1000) * region.w + region.x;
    const fall = ((t * speed * 90 + (seed % 700)) % (region.h + 260)) - 130;
    const y = region.y + fall;
    const rot = Math.sin(t * speed + i) * 1.6;
    ctx.save();
    ctx.translate(rx, y);
    ctx.rotate(rot);
    if (kind === "money") {
      ctx.fillStyle = "#cfe3c4";
      ctx.strokeStyle = "#2f5136";
      ctx.lineWidth = 2;
      ctx.fillRect(-34, -17, 68, 34);
      ctx.strokeRect(-34, -17, 68, 34);
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === "sparks") {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 3 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "dust") {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "leaves") {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 8, 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = i % 3 === 0 ? color : i % 3 === 1 ? "#ffffff" : shade(color, 0.2);
      ctx.fillRect(-7, -14, 14, 28);
    }
    ctx.restore();
  }
  ctx.restore();
}

/* --------------------------------------------------------------- templates */

export type HqLayout =
  | "layered"
  | "leadEmphasis"
  | "serifCentered"
  | "grungeRight"
  | "skySplit"
  | "tallStack"
  | "splitKinetic"
  | "duotoneHalftone"
  | "verticalMarquee"
  | "filmStrip"
  | "glitchTerminal"
  | "liquidReveal";

export type HqControlKey =
  | "headline"
  | "typography"
  | "wordAnimation"
  | "wordEditor"
  | "subject"
  | "backdrop"
  | "particles"
  | "camera"
  | "signature"
  | "layoutOptions";

export type HqTemplate = {
  id: string;
  name: string;
  desc: string;
  layout: HqLayout;
  backdrop: string;
  backdropColor: string;
  textColor: string;
  highlightColor: string;
  font: string;
  weight: string;
  italic: boolean;
  uppercase: boolean;
  size: number; // relative to frame height
  align: "left" | "center" | "right";
  textY: number; // 0..1
  cutout: boolean;
  keepOriginalBg: boolean;
  particles: ParticleId;
  controls: HqControlKey[];
  cameraMotion: HqCameraMotionId;
  duotone: boolean;
};

export const HQ_TEMPLATES: HqTemplate[] = [
  {
    id: "hq-headline-sandwich",
    name: "Headline Sandwich",
    desc: "Giant staggered condensed caps with the desaturated subject layered between the lines.",
    layout: "layered",
    backdrop: "concrete",
    backdropColor: "#232323",
    textColor: "#f2f2f2",
    highlightColor: "#e5352b",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: true,
    size: 0.1,
    align: "center",
    textY: 0.82,
    cutout: true,
    keepOriginalBg: true,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "camera"],
    cameraMotion: "handheld",
    duotone: true,
  },
  {
    id: "hq-lead-emphasis",
    name: "Watch Me",
    desc: "Warm gradient, small lead-in line above a huge emphasis line, script signature watermarks.",
    layout: "leadEmphasis",
    backdrop: "gradientsun",
    backdropColor: "#e0703a",
    textColor: "#fff6ea",
    highlightColor: "#ffd166",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: false,
    size: 0.09,
    align: "left",
    textY: 0.86,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "signature", "camera"],
    cameraMotion: "drift",
    duotone: false,
  },
  {
    id: "hq-serif-cinema",
    name: "Cinema Serif",
    desc: "Centered elegant serif caps over a dark cinematic still with heavy vignette.",
    layout: "serifCentered",
    backdrop: "voidsolid",
    backdropColor: "#060606",
    textColor: "#f6f3ec",
    highlightColor: "#f6f3ec",
    font: "Georgia, 'Times New Roman', serif",
    weight: "700",
    italic: false,
    uppercase: true,
    size: 0.062,
    align: "center",
    textY: 0.46,
    cutout: false,
    keepOriginalBg: true,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "backdrop", "camera"],
    cameraMotion: "zoomIn",
    duotone: false,
  },
  {
    id: "hq-grunge-right",
    name: "Grunge Right",
    desc: "Right-aligned distressed stacked caps, one gold accent word, subject filling the left half.",
    layout: "grungeRight",
    backdrop: "graytex",
    backdropColor: "#151515",
    textColor: "#eceae4",
    highlightColor: "#c9a24b",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: true,
    size: 0.086,
    align: "right",
    textY: 0.32,
    cutout: true,
    keepOriginalBg: false,
    particles: "sparks",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "particles", "signature", "camera"],
    cameraMotion: "parallax",
    duotone: true,
  },
  {
    id: "hq-sky-split",
    name: "Sky Split",
    desc: "Cream sky upper field, navy heavy sans in two weights, subject bottom-centered.",
    layout: "skySplit",
    backdrop: "cream",
    backdropColor: "#efe6d3",
    textColor: "#132043",
    highlightColor: "#c0392b",
    font: "'Helvetica Neue', Arial, sans-serif",
    weight: "800",
    italic: false,
    uppercase: false,
    size: 0.048,
    align: "center",
    textY: 0.14,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "camera"],
    cameraMotion: "breathe",
    duotone: false,
  },
  {
    id: "hq-tall-stack",
    name: "Tall Stack",
    desc: "Full-bleed dark grey texture, tall thin condensed caps stacked vertically, subject small at the base.",
    layout: "tallStack",
    backdrop: "graytex",
    backdropColor: "#26282b",
    textColor: "#e7e5df",
    highlightColor: "#ffffff",
    font: "'Helvetica Neue', Arial, sans-serif",
    weight: "300",
    italic: false,
    uppercase: true,
    size: 0.05,
    align: "center",
    textY: 0.08,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "signature", "camera"],
    cameraMotion: "zoomOut",
    duotone: true,
  },
  {
    id: "hq-split-kinetic",
    name: "Split Kinetic",
    desc: "The frame cracks into two hard-edged panels that slide apart on every line, subject sandwiched between them.",
    layout: "splitKinetic",
    backdrop: "voidsolid",
    backdropColor: "#0a0a0c",
    textColor: "#f5f5f2",
    highlightColor: "#ff3d3d",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: true,
    size: 0.072,
    align: "center",
    textY: 0.88,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "camera", "layoutOptions"],
    cameraMotion: "handheld",
    duotone: false,
  },
  {
    id: "hq-duotone-halftone",
    name: "Duotone Halftone",
    desc: "Comic-press duotone subject under an animated halftone dot field, oversized outline type wrapping around it.",
    layout: "duotoneHalftone",
    backdrop: "duotone",
    backdropColor: "#0d5c63",
    textColor: "#f3ede0",
    highlightColor: "#ffce45",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: true,
    size: 0.06,
    align: "center",
    textY: 0.86,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "camera", "layoutOptions"],
    cameraMotion: "breathe",
    duotone: true,
  },
  {
    id: "hq-vertical-marquee",
    name: "Vertical Marquee",
    desc: "An endless scrolling column of repeated key words behind the subject, with the focus line pinned and lit up.",
    layout: "verticalMarquee",
    backdrop: "graytex",
    backdropColor: "#161616",
    textColor: "#3d3d3d",
    highlightColor: "#f2c744",
    font: "'Helvetica Neue', Arial, sans-serif",
    weight: "800",
    italic: false,
    uppercase: true,
    size: 0.05,
    align: "center",
    textY: 0.9,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "camera", "layoutOptions", "signature"],
    cameraMotion: "drift",
    duotone: false,
  },
  {
    id: "hq-film-strip",
    name: "Film Strip",
    desc: "Subject boxed in an animated contact-sheet frame with drifting sprockets, a running timecode and chapter slate.",
    layout: "filmStrip",
    backdrop: "concrete",
    backdropColor: "#111113",
    textColor: "#eae7df",
    highlightColor: "#d94f3d",
    font: "'Courier New', monospace",
    weight: "700",
    italic: false,
    uppercase: true,
    size: 0.046,
    align: "center",
    textY: 0.9,
    cutout: false,
    keepOriginalBg: true,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "backdrop", "camera", "layoutOptions", "signature"],
    cameraMotion: "parallax",
    duotone: false,
  },
  {
    id: "hq-glitch-terminal",
    name: "Glitch Terminal",
    desc: "RGB-split glitch bursts on every line change, CRT scanlines and a mono decrypt-style type reveal.",
    layout: "glitchTerminal",
    backdrop: "voidsolid",
    backdropColor: "#04070a",
    textColor: "#7dffb0",
    highlightColor: "#ff3ec8",
    font: "'Courier New', monospace",
    weight: "700",
    italic: false,
    uppercase: true,
    size: 0.055,
    align: "center",
    textY: 0.86,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "camera", "layoutOptions"],
    cameraMotion: "handheld",
    duotone: false,
  },
  {
    id: "hq-liquid-reveal",
    name: "Liquid Mask Reveal",
    desc: "Text bleeds into view through an organic ink-blot mask while the subject feathers softly into a textured backdrop.",
    layout: "liquidReveal",
    backdrop: "aurora",
    backdropColor: "#101b3a",
    textColor: "#f4f1ea",
    highlightColor: "#57c2ff",
    font: "Georgia, 'Times New Roman', serif",
    weight: "700",
    italic: false,
    uppercase: false,
    size: 0.058,
    align: "center",
    textY: 0.84,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
    controls: ["headline", "typography", "wordAnimation", "wordEditor", "subject", "backdrop", "camera", "layoutOptions"],
    cameraMotion: "drift",
    duotone: false,
  },
];

/* ------------------------------------------------------------------ config */

export type HqConfig = {
  templateId: string;
  backdropId: string;
  backdropColor: string;
  // text
  font: string;
  fontWeight: string;
  italic: boolean;
  uppercase: boolean;
  textColor: string;
  highlightColor: string;
  highlightBold: boolean;
  highlightItalic: boolean;
  highlightScale: number;
  textSize: number;
  lineGap: number;
  textX: number;
  textY: number;
  textWidth: number;
  align: "left" | "center" | "right";
  stroke: number;
  strokeColor: string;
  shadow: number;
  anim: HqAnimId;
  animIntensity: number;
  animStagger: number;
  wordsPerLine: number;
  autoImportant: boolean;
  importantMinLength: number;
  keywords: string;
  // per-word overrides, keyed by hqWordKey(lineIndex, wordIndex)
  wordStyles: Record<string, HqWordStyle>;
  // subject
  subjectScale: number;
  subjectX: number;
  subjectY: number;
  subjectAnim: SubjectAnimId;
  subjectAnimDur: number;
  subjectAnimAmount: number;
  subjectShadow: number;
  // background handling
  removeBg: boolean;
  bgDim: number;
  bgBlur: number;
  bgZoom: number;
  lightIntensity: number;
  lightColor: string;
  // camera (applies to the whole composed frame)
  cameraMotion: HqCameraMotionId;
  cameraSpeed: number;
  cameraIntensity: number;
  // extras
  particles: ParticleId;
  particleCount: number;
  particleSpeed: number;
  particleColor: string;
  heading: string;
  subheading: string;
  author: string;
  // template-specific layout options (harmless no-ops for templates that don't use them)
  splitGap: number;
  halftoneDot: number;
  marqueeSpeed: number;
  glitchAmount: number;
};

export function configForTemplate(tpl: HqTemplate, prev?: Partial<HqConfig>): HqConfig {
  const headingDefaults: Record<string, { heading: string; subheading: string; author: string }> = {
    "hq-headline-sandwich": { heading: "NO RISK\nNO STORY", subheading: "", author: "" },
    "hq-lead-emphasis": { heading: "I can and I will,\nwatch me.", subheading: "@yourname", author: "stay hard" },
    "hq-serif-cinema": { heading: "DISCIPLINE\nIS DESTINY", subheading: "the quiet work before the loud result", author: "" },
    "hq-grunge-right": { heading: "EARN\nIT", subheading: "no shortcuts, no excuses", author: "" },
    "hq-sky-split": { heading: "keep going\nEVEN WHEN IT'S HARD", subheading: "", author: "" },
    "hq-tall-stack": { heading: "P\nA\nT\nI\nE\nN\nC\nE", subheading: "trust the process", author: "" },
    "hq-split-kinetic": { heading: "BREAK\nTHE MOLD", subheading: "", author: "" },
    "hq-duotone-halftone": { heading: "PRESS\nON", subheading: "", author: "" },
    "hq-vertical-marquee": { heading: "focus wins\nEVERY TIME", subheading: "focus, grind, rise, repeat, discipline, hustle", author: "" },
    "hq-film-strip": { heading: "TAKE\nONE", subheading: "chapter i · the grind", author: "00:00:12:04" },
    "hq-glitch-terminal": { heading: "REBOOT\nYOUR MIND", subheading: "", author: "" },
    "hq-liquid-reveal": { heading: "flow with\nthe chaos", subheading: "", author: "" },
  };
  const d = headingDefaults[tpl.id] ?? { heading: "Winner.", subheading: "", author: "" };
  return {
    templateId: tpl.id,
    backdropId: tpl.backdrop,
    backdropColor: tpl.backdropColor,
    font: tpl.font,
    fontWeight: tpl.weight,
    italic: tpl.italic,
    uppercase: tpl.uppercase,
    textColor: tpl.textColor,
    highlightColor: tpl.highlightColor,
    highlightBold: true,
    highlightItalic: false,
    highlightScale: 1.45,
    textSize: tpl.size,
    lineGap: 1.05,
    textX: 0.5,
    textY: tpl.textY,
    textWidth: 0.86,
    align: tpl.align,
    stroke: 0,
    strokeColor: "#000000",
    shadow: 0.35,
    anim: "pop",
    animIntensity: 1,
    animStagger: 0.06,
    wordsPerLine: 5,
    autoImportant: true,
    importantMinLength: 6,
    keywords: "",
    wordStyles: {},
    subjectScale: 1,
    subjectX: 0.5,
    subjectY: 0.62,
    subjectAnim: "riseIn",
    subjectAnimDur: 1.1,
    subjectAnimAmount: 1,
    subjectShadow: 0.4,
    removeBg: tpl.cutout,
    bgDim: 0.3,
    bgBlur: 0,
    bgZoom: 1.04,
    lightIntensity: 0.25,
    lightColor: "#ffe6b0",
    cameraMotion: tpl.cameraMotion,
    cameraSpeed: 1,
    cameraIntensity: 1,
    particles: tpl.particles,
    particleCount: 18,
    particleSpeed: 1,
    particleColor: "#e8a63a",
    heading: d.heading,
    subheading: d.subheading,
    author: d.author,
    splitGap: 0.05,
    halftoneDot: 10,
    marqueeSpeed: 1,
    glitchAmount: 1,
    ...prev,
  };
}

/* ------------------------------------------------------------------ render */

type Drawable = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export type HqFrameInput = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  t: number;
  cfg: HqConfig;
  template: HqTemplate;
  /** Cut-out (transparent) subject when available. */
  subject: Drawable | null;
  /** Original untouched photo, used for depth/poster layouts. */
  original: Drawable | null;
  /** Optional looping background video. */
  bgVideo: HTMLVideoElement | null;
  line: HqLine | null;
  /** Index of `line` inside the full lines array, used for word-style keys. */
  lineIndex?: number;
};

function drawCover(
  ctx: CanvasRenderingContext2D,
  src: Drawable,
  w: number,
  h: number,
  zoom: number,
) {
  const sw = "videoWidth" in src ? src.videoWidth : (src as HTMLImageElement).naturalWidth || src.width;
  const sh =
    "videoHeight" in src ? src.videoHeight : (src as HTMLImageElement).naturalHeight || src.height;
  if (!sw || !sh) return;
  const r = Math.max(w / sw, h / sh) * zoom;
  const dw = sw * r;
  const dh = sh * r;
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function subjectRect(i: HqFrameInput, src: Drawable) {
  const { w, h, cfg, t } = i;
  const sw = "videoWidth" in src ? src.videoWidth : (src as HTMLImageElement).naturalWidth || src.width;
  const sh =
    "videoHeight" in src ? src.videoHeight : (src as HTMLImageElement).naturalHeight || src.height;
  const m = subjectMotion(cfg.subjectAnim, t, cfg.subjectAnimDur, cfg.subjectAnimAmount);
  const targetH = h * 0.82 * cfg.subjectScale * m.scale;
  const scale = sh ? targetH / sh : 0;
  const dw = sw * scale;
  const dh = sh * scale;
  const cx = w * cfg.subjectX + m.dx;
  const cy = h * cfg.subjectY + m.dy;
  return { sw, sh, dw, dh, cx, cy, alpha: m.alpha };
}

function drawSubject(ctx: CanvasRenderingContext2D, i: HqFrameInput, src: Drawable, opts?: { desaturate?: boolean }) {
  const { cfg } = i;
  const r = subjectRect(i, src);
  if (!r.sw || !r.sh) return;
  ctx.save();
  ctx.globalAlpha = r.alpha;
  if (opts?.desaturate) ctx.filter = "grayscale(0.75) contrast(1.08)";
  if (cfg.subjectShadow > 0) {
    ctx.shadowColor = `rgba(0,0,0,${cfg.subjectShadow})`;
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
  }
  ctx.drawImage(src, r.cx - r.dw / 2, r.cy - r.dh / 2, r.dw, r.dh);
  ctx.restore();
}

/** Draws the subject with a soft alpha-feathered edge so it blends into a textured backdrop. */
function drawSubjectFeathered(ctx: CanvasRenderingContext2D, i: HqFrameInput, src: Drawable, featherAmount = 0.34) {
  const { w, h } = i;
  const r = subjectRect(i, src);
  if (!r.sw || !r.sh) return;
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.globalAlpha = r.alpha;
  tctx.drawImage(src, r.cx - r.dw / 2, r.cy - r.dh / 2, r.dw, r.dh);
  const outerR = Math.max(r.dw, r.dh) * 0.62;
  const innerR = outerR * (1 - featherAmount);
  tctx.globalCompositeOperation = "destination-in";
  const grad = tctx.createRadialGradient(r.cx, r.cy, innerR, r.cx, r.cy, outerR);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  tctx.fillStyle = grad;
  tctx.fillRect(0, 0, w, h);
  ctx.save();
  if (i.cfg.subjectShadow > 0) {
    ctx.shadowColor = `rgba(0,0,0,${i.cfg.subjectShadow})`;
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 18;
  }
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

/** Animated halftone dot field, brightness-modulated by an underlying sine field. */
function drawHalftoneOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  color: string,
  dotSize: number,
) {
  ctx.save();
  ctx.fillStyle = color;
  const step = Math.max(4, dotSize);
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const wave = Math.sin(x * 0.02 + t * 0.6) * Math.cos(y * 0.018 - t * 0.4);
      const r = (0.32 + 0.5 * ((wave + 1) / 2)) * (step * 0.42);
      ctx.globalAlpha = 0.16 + 0.1 * ((wave + 1) / 2);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** CRT-style scanlines with a slow vertical drift. */
function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#000000";
  const step = 4;
  const offset = (t * 40) % step;
  for (let y = -step + offset; y < h; y += step) {
    ctx.fillRect(0, y, w, 1.6);
  }
  ctx.restore();
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0.05)");
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Vertical strip of drifting sprocket holes for the film-strip layout. */
function drawSprockets(ctx: CanvasRenderingContext2D, x: number, colW: number, h: number, t: number) {
  ctx.save();
  ctx.fillStyle = "#050505";
  ctx.fillRect(x, 0, colW, h);
  const holeH = colW * 0.68;
  const gap = holeH * 1.55;
  const offset = (t * 26) % gap;
  ctx.fillStyle = "#dcd6c8";
  for (let y = -gap + offset; y < h + gap; y += gap) {
    const rx = x + colW * 0.5;
    ctx.beginPath();
    ctx.roundRect(rx - colW * 0.28, y, colW * 0.56, holeH, colW * 0.14);
    ctx.fill();
  }
  ctx.restore();
}

/** Decrypt-style reveal: characters cycle through random glyphs before locking to the real text. */
const GLITCH_GLYPHS = "!<>-_\\/[]{}—=+*^?#@$%01ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function decryptText(text: string, progress: number, seed: number): string {
  const p = Math.max(0, Math.min(1, progress));
  const lockCount = Math.floor(text.length * p);
  let out = "";
  for (let idx = 0; idx < text.length; idx++) {
    const ch = text[idx];
    if (ch === " " || idx < lockCount) {
      out += ch;
    } else {
      const n = Math.floor(Math.abs(Math.sin(idx * 12.9898 + seed * 78.233)) * GLITCH_GLYPHS.length);
      out += GLITCH_GLYPHS[n % GLITCH_GLYPHS.length];
    }
  }
  return out;
}

function fontString(cfg: HqConfig, size: number, weight: string, italic: boolean, font?: string) {
  return `${italic ? "italic " : ""}${weight} ${size}px ${font ?? cfg.font}`;
}

type LaidWord = {
  w: HqWord;
  key: string;
  x: number;
  y: number;
  size: number;
  weight: string;
  italic: boolean;
  color: string;
  width: number;
  anim: HqAnimId;
  delay: number;
  dx: number;
  dy: number;
};

function layoutCaption(
  ctx: CanvasRenderingContext2D,
  i: HqFrameInput,
  boxW: number,
): { rows: LaidWord[][]; lineH: number; base: number } {
  const { cfg, h, line } = i;
  const base = h * cfg.textSize;
  const rows: LaidWord[][] = [];
  if (!line) return { rows, lineH: base * cfg.lineGap, base };
  let row: LaidWord[] = [];
  let x = 0;
  const space = base * 0.28;
  const li = i.lineIndex ?? 0;
  line.words.forEach((word, wi) => {
    const key = hqWordKey(li, wi);
    const ov = cfg.wordStyles[key];
    const big = ov?.emphasis ?? word.important;
    const scaleMul = ov?.scale ?? (big ? cfg.highlightScale : 1);
    const size = base * scaleMul;
    const weight = ov?.weight ?? (big ? "900" : cfg.fontWeight);
    const italic = ov?.italic ?? (cfg.italic || (big && cfg.highlightItalic));
    ctx.font = fontString(cfg, size, weight, italic);
    const text = cfg.uppercase ? word.text.toUpperCase() : word.text;
    const width = ctx.measureText(text).width;
    if (row.length && x + width > boxW) {
      rows.push(row);
      row = [];
      x = 0;
    }
    row.push({
      w: word,
      key,
      x,
      y: 0,
      size,
      weight,
      italic,
      color: ov?.color ?? (big ? cfg.highlightColor : cfg.textColor),
      width,
      anim: ov?.anim ?? cfg.anim,
      delay: ov?.delay ?? 0,
      dx: ov?.dx ?? 0,
      dy: ov?.dy ?? 0,
    });
    x += width + space;
  });
  if (row.length) rows.push(row);
  return { rows, lineH: base * 1.15 * cfg.lineGap, base };
}

function paintCaption(ctx: CanvasRenderingContext2D, i: HqFrameInput, boxW: number, topY: number) {
  const { cfg, w, t, line } = i;
  if (!line || !line.words.length) return;
  const { rows, lineH } = layoutCaption(ctx, i, boxW);
  const originX = w * cfg.textX;
  let idx = 0;
  rows.forEach((row, r) => {
    const rowW = row.reduce((n, x) => n + x.width, 0) + (row.length - 1) * (i.h * cfg.textSize * 0.28);
    let startX =
      cfg.align === "left" ? originX - boxW / 2 : cfg.align === "right" ? originX + boxW / 2 - rowW : originX - rowW / 2;
    const y = topY + r * lineH;
    for (const lw of row) {
      const stag = idx * cfg.animStagger + lw.delay;
      const p = (t - lw.w.start - stag) / 0.34;
      const m = wordMotion(lw.anim, p, cfg.animIntensity);
      const visible = t >= lw.w.start + stag - 0.001;
      idx++;
      if (!visible) {
        startX += lw.width + i.h * cfg.textSize * 0.28;
        continue;
      }
      const text = cfg.uppercase ? lw.w.text.toUpperCase() : lw.w.text;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, m.alpha));
      ctx.font = fontString(cfg, lw.size, lw.weight, lw.italic);
      ctx.textBaseline = "alphabetic";
      ctx.translate(startX + lw.width / 2 + m.dx + lw.dx, y + m.dy + lw.dy);
      ctx.rotate(m.rot);
      ctx.scale(m.scale, m.scale);
      if (m.clip < 1) {
        ctx.beginPath();
        ctx.rect(-lw.width / 2, -lw.size, lw.width * m.clip, lw.size * 2);
        ctx.clip();
      }
      if (cfg.shadow > 0) {
        ctx.shadowColor = `rgba(0,0,0,${cfg.shadow})`;
        ctx.shadowBlur = lw.size * 0.35;
        ctx.shadowOffsetY = lw.size * 0.06;
      }
      ctx.fillStyle = lw.color;
      if (cfg.stroke > 0) {
        ctx.lineWidth = cfg.stroke;
        ctx.strokeStyle = cfg.strokeColor;
        ctx.strokeText(text, -lw.width / 2, 0);
      }
      ctx.fillText(text, -lw.width / 2, 0);
      ctx.restore();
      startX += lw.width + i.h * cfg.textSize * 0.28;
    }
  });
}

function paintBackdrop(i: HqFrameInput) {
  const { ctx, w, h, cfg, t } = i;
  const bd = HQ_BACKDROPS.find((b) => b.id === cfg.backdropId) ?? HQ_BACKDROPS[0];
  bd.paint(ctx, w, h, t, cfg.backdropColor);
}

function paintMediaBackground(i: HqFrameInput, opts?: { vignette?: number; grayscale?: boolean }) {
  const { ctx, w, h, cfg } = i;
  const src = i.bgVideo ?? i.original;
  if (!src) {
    paintBackdrop(i);
  } else {
    ctx.save();
    let filter = "";
    if (cfg.bgBlur > 0) filter += `blur(${cfg.bgBlur}px) `;
    if (opts?.grayscale) filter += "grayscale(0.6) contrast(1.1) ";
    if (filter) ctx.filter = filter.trim();
    drawCover(ctx, src, w, h, cfg.bgZoom);
    ctx.restore();
    if (cfg.bgDim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${cfg.bgDim})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
  if (opts?.vignette) {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.2, w * 0.5, h * 0.5, h * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${opts.vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function paintLight(i: HqFrameInput) {
  const { ctx, w, h, cfg, t } = i;
  if (cfg.lightIntensity <= 0) return;
  const g = ctx.createRadialGradient(
    w * cfg.subjectX,
    h * (cfg.subjectY - 0.28),
    0,
    w * cfg.subjectX,
    h * cfg.subjectY,
    h * 0.62,
  );
  const a = cfg.lightIntensity * (0.85 + Math.sin(t * 0.9) * 0.06);
  g.addColorStop(0, hexA(cfg.lightColor, a * 0.55));
  g.addColorStop(0.5, hexA(cfg.lightColor, a * 0.16));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function hexA(hex: string, a: number) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

/** Draws multi-line static headline text (cfg.heading, split on \n) with a soft rise-in per line. */
function drawHeadingLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  size: number,
  weight: string,
  font: string,
  color: string,
  align: CanvasTextAlign,
  t: number,
  uppercase: boolean,
  italic: boolean,
) {
  const lines = text.split("\n");
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  lines.forEach((ln, idx) => {
    const p = Math.max(0, Math.min(1, (t - idx * 0.12) / 0.6));
    const e = easeOutQuint(p);
    ctx.save();
    ctx.globalAlpha = e;
    ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    const dy = (1 - e) * 26;
    ctx.fillText(uppercase ? ln.toUpperCase() : ln, x, y + idx * lineHeight + dy);
    ctx.restore();
  });
  ctx.restore();
}

/** Draws one full HQ frame. */
export function renderHqFrame(i: HqFrameInput) {
  const { ctx, w, h, cfg, template, t } = i;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  const cam = cameraTransform(cfg.cameraMotion, t, cfg.cameraSpeed, cfg.cameraIntensity, w, h);
  ctx.translate(w / 2 + cam.dx, h / 2 + cam.dy);
  ctx.rotate(cam.rot);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-w / 2, -h / 2);

  const boxW = w * cfg.textWidth;
  const topY = h * cfg.textY;
  const subject = i.subject ?? i.original;

  switch (template.layout) {
    case "layered": {
      paintMediaBackground(i, { grayscale: true, vignette: 0.35 });
      const lines = cfg.heading.split("\n");
      const size = h * 0.13;
      const lh = size * 1.02;
      const midY = h * 0.5;
      const startY = midY - ((lines.length - 1) / 2) * lh;
      // lines before the last: drawn behind the subject
      lines.slice(0, -1).forEach((ln, idx) => {
        drawHeadingLines(ctx, ln, w / 2, startY + idx * lh, lh, size, "900", cfg.font, cfg.textColor, "center", t, cfg.uppercase, cfg.italic);
      });
      if (subject) drawSubject(ctx, i, subject, { desaturate: true });
      // accent bar
      ctx.save();
      ctx.fillStyle = cfg.highlightColor;
      ctx.fillRect(w * 0.5 - w * 0.09, h * 0.5 - h * 0.006, w * 0.18, h * 0.012);
      ctx.restore();
      const lastLn = lines[lines.length - 1];
      if (lastLn) {
        drawHeadingLines(ctx, lastLn, w / 2, startY + (lines.length - 1) * lh, lh, size, "900", cfg.font, cfg.textColor, "center", t, cfg.uppercase, cfg.italic);
      }
      paintCaption(ctx, i, boxW, topY);
      break;
    }
    case "leadEmphasis": {
      paintBackdrop(i);
      if (subject) drawSubject(ctx, i, subject);
      const lines = cfg.heading.split("\n");
      const leadSize = h * 0.032;
      const bigSize = h * 0.082;
      const x = w * 0.08;
      let y = h * 0.12;
      if (lines[0]) {
        drawHeadingLines(ctx, lines[0], x, y, leadSize * 1.3, leadSize, "600", cfg.font, cfg.textColor, "left", t, false, false);
        y += leadSize * 1.6;
      }
      drawHeadingLines(ctx, lines.slice(1).join("\n") || "", x, y, bigSize * 1.06, bigSize, "900", cfg.font, cfg.highlightColor, "left", t - 0.15, cfg.uppercase, cfg.italic);
      // script signature watermarks
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.font = `italic 400 ${h * 0.028}px Georgia, serif`;
      ctx.fillStyle = cfg.textColor;
      ctx.textAlign = "left";
      if (cfg.subheading) ctx.fillText(cfg.subheading, w * 0.06, h * 0.96);
      ctx.textAlign = "right";
      if (cfg.author) ctx.fillText(cfg.author, w * 0.94, h * 0.96);
      ctx.restore();
      paintCaption(ctx, i, boxW, topY);
      break;
    }
    case "serifCentered": {
      paintMediaBackground(i, { vignette: 0.55 });
      const lines = cfg.heading.split("\n");
      const size = h * 0.058;
      const lh = size * 1.35;
      const midY = h * 0.42;
      const startY = midY - ((lines.length - 1) / 2) * lh;
      lines.forEach((ln, idx) => {
        drawHeadingLines(ctx, ln, w / 2, startY + idx * lh, lh, size, "700", cfg.font, cfg.textColor, "center", t, cfg.uppercase, cfg.italic);
      });
      if (cfg.subheading) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.textAlign = "center";
        ctx.font = `300 ${h * 0.026}px 'Helvetica Neue', Arial, sans-serif`;
        ctx.fillStyle = cfg.textColor;
        ctx.fillText(cfg.subheading, w / 2, startY + lines.length * lh + h * 0.01);
        ctx.restore();
      }
      paintCaption(ctx, i, boxW, topY);
      break;
    }
    case "grungeRight": {
      paintBackdrop(i);
      if (subject) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w * 0.58, h);
        ctx.clip();
        drawSubject(ctx, i, subject, { desaturate: true });
        ctx.restore();
      }
      drawParticles(ctx, w, h, t, cfg.particles, cfg.particleCount, cfg.particleSpeed, { x: w * 0.55, y: 0, w: w * 0.45, h }, cfg.particleColor);
      const lines = cfg.heading.split("\n");
      const size = h * 0.09;
      const lh = size * 0.98;
      const x = w * 0.94;
      let y = h * 0.32;
      lines.forEach((ln, idx) => {
        const isAccent = idx === lines.length - 1 && lines.length > 1;
        drawHeadingLines(ctx, ln, x, y, lh, size, "900", cfg.font, isAccent ? cfg.highlightColor : cfg.textColor, "right", t + idx * 0.05, cfg.uppercase, cfg.italic);
        y += lh;
      });
      if (cfg.subheading) {
        ctx.save();
        ctx.textAlign = "right";
        ctx.globalAlpha = 0.75;
        ctx.font = `500 ${h * 0.02}px ${cfg.font}`;
        ctx.fillStyle = cfg.textColor;
        ctx.fillText(cfg.subheading.toUpperCase(), x, y + h * 0.02);
        ctx.restore();
      }
      paintCaption(ctx, i, boxW, topY);
      break;
    }
    case "skySplit": {
      paintBackdrop(i);
      const lines = cfg.heading.split("\n");
      const smallSize = h * 0.036;
      const bigSize = h * 0.072;
      let y = h * 0.16;
      if (lines[0]) {
        drawHeadingLines(ctx, lines[0], w / 2, y, smallSize * 1.2, smallSize, "500", cfg.font, cfg.textColor, "center", t, false, true);
        y += smallSize * 1.5;
      }
      drawHeadingLines(ctx, lines.slice(1).join("\n") || "", w / 2, y, bigSize * 1.05, bigSize, "800", cfg.font, cfg.textColor, "center", t - 0.12, cfg.uppercase, false);
      if (subject) drawSubject(ctx, i, subject);
      paintCaption(ctx, i, boxW, topY);
      break;
    }
    case "tallStack": {
      paintBackdrop(i);
      const glyphs = cfg.heading.replace(/\n/g, "").split("");
      const size = h * 0.052;
      const lh = size * 0.92;
      let y = h * 0.1;
      glyphs.forEach((g, idx) => {
        drawHeadingLines(ctx, g, w / 2, y, lh, size, "300", cfg.font, cfg.textColor, "center", t + idx * 0.02, true, false);
        y += lh;
      });
      if (cfg.subheading) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.font = `700 ${h * 0.022}px ${cfg.font}`;
        ctx.fillStyle = cfg.highlightColor;
        ctx.globalAlpha = 0.9;
        ctx.fillText(cfg.subheading.toUpperCase(), w / 2, h * 0.94);
        ctx.restore();
      }
      if (subject) drawSubject(ctx, i, subject, { desaturate: true });
      paintCaption(ctx, i, boxW, topY);
      break;
    }
  }

  ctx.restore();
}
