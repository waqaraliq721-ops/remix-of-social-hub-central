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
];

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

const ease = (p: number) => 1 - Math.pow(1 - p, 3);

export function wordMotion(anim: HqAnimId, p: number, intensity: number): WordMotion {
  const k = Math.max(0, Math.min(1, p));
  const e = ease(k);
  const s = intensity;
  const base: WordMotion = { alpha: 1, dx: 0, dy: 0, scale: 1, rot: 0, clip: 1 };
  switch (anim) {
    case "pop":
      return { ...base, alpha: e, scale: 0.6 + 0.4 * e + (1 - e) * 0 * s };
    case "rise":
      return { ...base, alpha: e, dy: (1 - e) * 70 * s };
    case "drop":
      return { ...base, alpha: e, dy: -(1 - e) * 70 * s };
    case "slide":
      return { ...base, alpha: e, dx: (1 - e) * 120 * s };
    case "typewriter":
      return { ...base, alpha: k > 0 ? 1 : 0, clip: Math.min(1, k * 1.6) };
    case "blur":
      return { ...base, alpha: e, scale: 1 + (1 - e) * 0.14 * s };
    case "flip":
      return { ...base, alpha: e, scale: 0.3 + 0.7 * e, rot: (1 - e) * 0.5 * s };
    case "wipe":
      return { ...base, clip: e };
    case "spring": {
      const o = 1 + Math.sin(k * Math.PI * 2.2) * (1 - k) * 0.28 * s;
      return { ...base, alpha: Math.min(1, k * 3), scale: o };
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
  const e = ease(p);
  switch (anim) {
    case "riseIn":
      return { dx: 0, dy: (1 - e) * 220 * amount, scale: 1, alpha: e };
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

export type HqLayout = "behind" | "over" | "column" | "depth" | "spot" | "wiki" | "poster" | "news";

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
};

export const HQ_TEMPLATES: HqTemplate[] = [
  {
    id: "hq-cutout-bold",
    name: "Bold Cutout",
    desc: "Subject cut out over a textured sweep with heavy sans text tucked behind them.",
    layout: "behind",
    backdrop: "studio",
    backdropColor: "#123a8a",
    textColor: "#ffffff",
    highlightColor: "#ffffff",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: false,
    size: 0.075,
    align: "center",
    textY: 0.22,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
  },
  {
    id: "hq-poster-overlay",
    name: "Poster Overlay",
    desc: "Full-bleed photo or video with condensed captions locked to the upper third.",
    layout: "poster",
    backdrop: "voidsolid",
    backdropColor: "#050505",
    textColor: "#f2f2f2",
    highlightColor: "#ffd166",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: true,
    size: 0.078,
    align: "center",
    textY: 0.26,
    cutout: false,
    keepOriginalBg: true,
    particles: "none",
  },
  {
    id: "hq-mono-cutout",
    name: "Mono Cutout",
    desc: "Grayscale subject on pressed paper with oversized black lowercase type.",
    layout: "behind",
    backdrop: "paper",
    backdropColor: "#efece4",
    textColor: "#0b0b0b",
    highlightColor: "#0b0b0b",
    font: "'Helvetica Neue', Arial, sans-serif",
    weight: "800",
    italic: false,
    uppercase: false,
    size: 0.09,
    align: "center",
    textY: 0.3,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
  },
  {
    id: "hq-depth-split",
    name: "Depth Split",
    desc: "Keeps the original photo background and floats the caption between it and the subject.",
    layout: "depth",
    backdrop: "duotone",
    backdropColor: "#0d5c63",
    textColor: "#101418",
    highlightColor: "#ffffff",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: false,
    size: 0.08,
    align: "center",
    textY: 0.18,
    cutout: true,
    keepOriginalBg: true,
    particles: "none",
  },
  {
    id: "hq-oil-paint",
    name: "Oil Paint",
    desc: "Painterly canvas texture with a stacked left column of gold and bone type.",
    layout: "column",
    backdrop: "canvasoil",
    backdropColor: "#1a1408",
    textColor: "#efe6d4",
    highlightColor: "#e8a63a",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: true,
    size: 0.072,
    align: "left",
    textY: 0.3,
    cutout: true,
    keepOriginalBg: true,
    particles: "dust",
  },
  {
    id: "hq-spotlight",
    name: "Spotlight",
    desc: "Cut-out subject on a solid void with a soft rim light and glowing stacked type.",
    layout: "spot",
    backdrop: "voidsolid",
    backdropColor: "#050505",
    textColor: "#ffffff",
    highlightColor: "#ffffff",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: true,
    size: 0.1,
    align: "center",
    textY: 0.16,
    cutout: true,
    keepOriginalBg: false,
    particles: "none",
  },
  {
    id: "hq-editorial-serif",
    name: "Editorial Serif",
    desc: "Cinematic still with a mixed roman/italic serif quote block and attribution.",
    layout: "over",
    backdrop: "duotone",
    backdropColor: "#12403c",
    textColor: "#f6f3ec",
    highlightColor: "#f6f3ec",
    font: "Georgia, 'Times New Roman', serif",
    weight: "700",
    italic: false,
    uppercase: true,
    size: 0.052,
    align: "left",
    textY: 0.16,
    cutout: false,
    keepOriginalBg: true,
    particles: "none",
  },
  {
    id: "hq-wiki-card",
    name: "Definition Card",
    desc: "Dictionary-style heading with a typing definition, subject bottom-left, props falling right.",
    layout: "wiki",
    backdrop: "voidsolid",
    backdropColor: "#050505",
    textColor: "#f4f2ec",
    highlightColor: "#cfe3c4",
    font: "Georgia, 'Times New Roman', serif",
    weight: "500",
    italic: false,
    uppercase: false,
    size: 0.03,
    align: "left",
    textY: 0.48,
    cutout: true,
    keepOriginalBg: false,
    particles: "money",
  },
  {
    id: "hq-depth-glow",
    name: "Depth Glow",
    desc: "Original backdrop dimmed and lit, with glowing type sandwiched behind the subject.",
    layout: "depth",
    backdrop: "spotlight",
    backdropColor: "#080808",
    textColor: "#ffffff",
    highlightColor: "#ffd166",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: true,
    size: 0.086,
    align: "center",
    textY: 0.14,
    cutout: true,
    keepOriginalBg: true,
    particles: "dust",
  },
  {
    id: "hq-newsprint",
    name: "Newsprint Impact",
    desc: "Halftone press texture with alternating red/grey words down the right rail.",
    layout: "news",
    backdrop: "newsprint",
    backdropColor: "#c9c6bd",
    textColor: "#d7d7d7",
    highlightColor: "#e01f26",
    font: "'Archivo Black', Impact, sans-serif",
    weight: "900",
    italic: false,
    uppercase: true,
    size: 0.075,
    align: "right",
    textY: 0.1,
    cutout: false,
    keepOriginalBg: true,
    particles: "none",
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
  // extras
  particles: ParticleId;
  particleCount: number;
  particleSpeed: number;
  particleColor: string;
  heading: string;
  subheading: string;
  author: string;
};

export function configForTemplate(tpl: HqTemplate, prev?: Partial<HqConfig>): HqConfig {
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
    lightIntensity: tpl.layout === "spot" ? 0.7 : 0.25,
    lightColor: "#ffe6b0",
    particles: tpl.particles,
    particleCount: 18,
    particleSpeed: 1,
    particleColor: "#e8a63a",
    heading: "Winner.",
    subheading: "/'wɪnər/ noun",
    author: "",
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

function drawSubject(ctx: CanvasRenderingContext2D, i: HqFrameInput, src: Drawable) {
  const { w, h, cfg, t } = i;
  const sw = "videoWidth" in src ? src.videoWidth : (src as HTMLImageElement).naturalWidth || src.width;
  const sh =
    "videoHeight" in src ? src.videoHeight : (src as HTMLImageElement).naturalHeight || src.height;
  if (!sw || !sh) return;
  const m = subjectMotion(cfg.subjectAnim, t, cfg.subjectAnimDur, cfg.subjectAnimAmount);
  const targetH = h * 0.82 * cfg.subjectScale * m.scale;
  const scale = targetH / sh;
  const dw = sw * scale;
  const dh = sh * scale;
  const cx = w * cfg.subjectX + m.dx;
  const cy = h * cfg.subjectY + m.dy;
  ctx.save();
  ctx.globalAlpha = m.alpha;
  if (cfg.subjectShadow > 0) {
    ctx.shadowColor = `rgba(0,0,0,${cfg.subjectShadow})`;
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
  }
  ctx.drawImage(src, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function fontString(cfg: HqConfig, size: number, bold: boolean, italic: boolean) {
  return `${italic ? "italic " : ""}${bold ? "900" : cfg.fontWeight} ${size}px ${cfg.font}`;
}

type LaidWord = { w: HqWord; x: number; y: number; size: number; bold: boolean; italic: boolean; width: number };

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
  for (const word of line.words) {
    const big = word.important;
    const size = big ? base * cfg.highlightScale : base;
    const bold = big ? cfg.highlightBold : false;
    const italic = cfg.italic || (big && cfg.highlightItalic);
    ctx.font = fontString(cfg, size, bold, italic);
    const text = cfg.uppercase ? word.text.toUpperCase() : word.text;
    const width = ctx.measureText(text).width;
    if (row.length && x + width > boxW) {
      rows.push(row);
      row = [];
      x = 0;
    }
    row.push({ w: word, x, y: 0, size, bold, italic, width });
    x += width + space;
  }
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
      const appear = lw.w.start + idx * 0 + 0;
      const p = (t - appear) / 0.34 + idx * 0;
      const stag = idx * cfg.animStagger;
      const m = wordMotion(cfg.anim, (t - lw.w.start - stag * 0) / 0.34, cfg.animIntensity);
      const visible = t >= lw.w.start - 0.001;
      idx++;
      if (!visible) {
        startX += lw.width + i.h * cfg.textSize * 0.28;
        continue;
      }
      const text = cfg.uppercase ? lw.w.text.toUpperCase() : lw.w.text;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, m.alpha));
      ctx.font = fontString(cfg, lw.size, lw.bold, lw.italic);
      ctx.textBaseline = "alphabetic";
      ctx.translate(startX + lw.width / 2 + m.dx, y + m.dy);
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
      ctx.fillStyle = lw.w.important ? cfg.highlightColor : cfg.textColor;
      if (cfg.stroke > 0) {
        ctx.lineWidth = cfg.stroke;
        ctx.strokeStyle = cfg.strokeColor;
        ctx.strokeText(text, -lw.width / 2, 0);
      }
      ctx.fillText(text, -lw.width / 2, 0);
      ctx.restore();
      startX += lw.width + i.h * cfg.textSize * 0.28;
      void p;
    }
  });
}

function paintBackdrop(i: HqFrameInput) {
  const { ctx, w, h, cfg, t } = i;
  const bd = HQ_BACKDROPS.find((b) => b.id === cfg.backdropId) ?? HQ_BACKDROPS[0];
  bd.paint(ctx, w, h, t, cfg.backdropColor);
}

function paintMediaBackground(i: HqFrameInput) {
  const { ctx, w, h, cfg } = i;
  const src = i.bgVideo ?? i.original;
  if (!src) {
    paintBackdrop(i);
    return;
  }
  ctx.save();
  if (cfg.bgBlur > 0) ctx.filter = `blur(${cfg.bgBlur}px)`;
  drawCover(ctx, src, w, h, cfg.bgZoom);
  ctx.restore();
  if (cfg.bgDim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${cfg.bgDim})`;
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

/** Draws one full HQ frame. */
export function renderHqFrame(i: HqFrameInput) {
  const { ctx, w, h, cfg, template } = i;
  ctx.clearRect(0, 0, w, h);
  const boxW = w * cfg.textWidth;
  const topY = h * cfg.textY;
  const subject = i.subject ?? i.original;

  switch (template.layout) {
    case "behind": {
      paintBackdrop(i);
      paintLight(i);
      paintCaption(ctx, i, boxW, topY);
      if (subject) drawSubject(ctx, i, subject);
      drawParticles(
        ctx, w, h, i.t, cfg.particles, cfg.particleCount, cfg.particleSpeed,
        { x: 0, y: 0, w, h }, cfg.particleColor,
      );
      break;
    }
    case "poster": {
      paintMediaBackground(i);
      paintCaption(ctx, i, boxW, topY);
      drawParticles(ctx, w, h, i.t, cfg.particles, cfg.particleCount, cfg.particleSpeed, { x: 0, y: 0, w, h }, cfg.particleColor);
      break;
    }
    case "depth": {
      // original photo stays as the plate, caption sits between it and the cut-out.
      paintMediaBackground(i);
      paintLight(i);
      paintCaption(ctx, i, boxW, topY);
      if (i.subject) drawSubject(ctx, i, i.subject);
      drawParticles(ctx, w, h, i.t, cfg.particles, cfg.particleCount, cfg.particleSpeed, { x: 0, y: 0, w, h }, cfg.particleColor);
      break;
    }
    case "column": {
      paintBackdrop(i);
      if (i.original && !i.subject) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        drawCover(ctx, i.original, w, h, cfg.bgZoom);
        ctx.restore();
        ctx.fillStyle = `rgba(0,0,0,${cfg.bgDim})`;
        ctx.fillRect(0, 0, w, h);
      } else if (i.subject) {
        drawSubject(ctx, i, i.subject);
      }
      paintCaption(ctx, i, boxW, topY);
      drawParticles(ctx, w, h, i.t, cfg.particles, cfg.particleCount, cfg.particleSpeed, { x: 0, y: 0, w, h }, cfg.particleColor);
      break;
    }
    case "spot": {
      paintBackdrop(i);
      if (subject) drawSubject(ctx, i, subject);
      paintLight(i);
      paintCaption(ctx, i, boxW, topY);
      break;
    }
    case "over": {
      paintMediaBackground(i);
      paintCaption(ctx, i, boxW, topY);
      if (cfg.author) {
        ctx.save();
        ctx.font = `italic 600 ${h * cfg.textSize * 0.5}px ${cfg.font}`;
        ctx.fillStyle = cfg.textColor;
        ctx.globalAlpha = 0.85;
        const ax = cfg.align === "left" ? w * cfg.textX - boxW / 2 : w * cfg.textX;
        ctx.textAlign = cfg.align === "left" ? "left" : "center";
        ctx.fillText(`— ${cfg.author}`, ax, topY + h * cfg.textSize * 3.4);
        ctx.restore();
      }
      break;
    }
    case "wiki": {
      paintBackdrop(i);
      drawParticles(
        ctx, w, h, i.t, cfg.particles, cfg.particleCount, cfg.particleSpeed,
        { x: w * 0.5, y: 0, w: w * 0.5, h }, cfg.particleColor,
      );
      if (subject) {
        ctx.save();
        ctx.globalAlpha = 0.95;
        drawSubject(ctx, i, subject);
        ctx.restore();
      }
      const hx = w * cfg.textX - boxW / 2;
      const hy = h * cfg.textY;
      ctx.save();
      ctx.textAlign = "left";
      ctx.fillStyle = cfg.textColor;
      ctx.font = `${cfg.italic ? "italic " : ""}${cfg.fontWeight} ${h * cfg.textSize * 2.2}px ${cfg.font}`;
      ctx.fillText(cfg.heading, hx, hy);
      ctx.globalAlpha = 0.75;
      ctx.font = `${h * cfg.textSize * 0.95}px ${cfg.font}`;
      ctx.fillText(cfg.subheading, hx, hy + h * cfg.textSize * 1.25);
      ctx.restore();
      paintCaption(ctx, i, boxW, hy + h * cfg.textSize * 3.1);
      break;
    }
    case "news": {
      paintBackdrop(i);
      if (i.original) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.filter = "grayscale(1) contrast(1.2)";
        drawCover(ctx, i.subject ?? i.original, w, h, cfg.bgZoom);
        ctx.restore();
      }
      ctx.fillStyle = `rgba(20,20,20,${cfg.bgDim * 0.6})`;
      ctx.fillRect(0, 0, w, h);
      paintCaption(ctx, i, boxW, topY);
      break;
    }
  }
}
