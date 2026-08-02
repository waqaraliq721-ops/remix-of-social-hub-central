// Backgrounds + per-clip effects render engine for the Documentary HQ editor.
// Pure canvas 2D helpers — no allocations inside the hot per-frame path
// beyond small gradient objects (cached where practical).

import type { ClipEffects, GradePreset } from "@/lib/doc-hq-types";

export type BackgroundKind =
  | "none"
  | "paper"
  | "kraft"
  | "linen"
  | "concrete"
  | "blueprint"
  | "marble"
  | "chalkboard"
  | "gradient-drift"
  | "gradient-aurora";

export const BACKGROUNDS: { id: BackgroundKind; name: string }[] = [
  { id: "none", name: "None (black)" },
  { id: "paper", name: "Paper texture" },
  { id: "kraft", name: "Kraft paper" },
  { id: "linen", name: "Linen fabric" },
  { id: "concrete", name: "Concrete" },
  { id: "blueprint", name: "Blueprint grid" },
  { id: "marble", name: "Marble" },
  { id: "chalkboard", name: "Chalkboard" },
  { id: "gradient-drift", name: "Animated gradient · drift" },
  { id: "gradient-aurora", name: "Animated gradient · aurora" },
];

// ---------------- procedural noise tile cache ----------------

const noiseTiles = new Map<string, HTMLCanvasElement>();

function noiseTile(key: string, size: number, gen: (i: number) => [number, number, number, number]) {
  const cached = noiseTiles.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const [r, g, b, a] = gen(i);
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  noiseTiles.set(key, c);
  return c;
}

function fillNoisePattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  key: string,
  size: number,
  gen: (i: number) => [number, number, number, number],
  alpha: number,
  compositeOp: GlobalCompositeOperation = "overlay",
) {
  const tile = noiseTile(key, size, gen);
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = compositeOp;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---------------- background painters ----------------

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, kind: BackgroundKind, t: number) {
  switch (kind) {
    case "paper": {
      ctx.fillStyle = "#f2ecdd";
      ctx.fillRect(0, 0, w, h);
      fillNoisePattern(ctx, w, h, "paper", 128, () => {
        const v = 200 + Math.random() * 55;
        return [v, v, v * 0.96, 255];
      }, 0.5, "multiply");
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(80,60,30,0.18)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "kraft": {
      ctx.fillStyle = "#b78a54";
      ctx.fillRect(0, 0, w, h);
      fillNoisePattern(ctx, w, h, "kraft", 128, () => {
        const v = 130 + Math.random() * 70;
        return [v, v * 0.78, v * 0.5, 255];
      }, 0.35, "overlay");
      break;
    }
    case "linen": {
      ctx.fillStyle = "#e7e1d3";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#8a8168";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "concrete": {
      ctx.fillStyle = "#9a9a94";
      ctx.fillRect(0, 0, w, h);
      fillNoisePattern(ctx, w, h, "concrete", 160, () => {
        const v = 110 + Math.random() * 90;
        return [v, v, v, 255];
      }, 0.4, "overlay");
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.8);
      vg.addColorStop(0, "rgba(255,255,255,0.05)");
      vg.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "blueprint": {
      ctx.fillStyle = "#0b3d66";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      const minor = 40;
      for (let x = 0; x < w; x += minor) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.globalAlpha = x % (minor * 5) === 0 ? 0.4 : 0.15;
        ctx.stroke();
      }
      for (let y = 0; y < h; y += minor) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.globalAlpha = y % (minor * 5) === 0 ? 0.4 : 0.15;
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "marble": {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#efefef");
      g.addColorStop(0.5, "#dcdcdc");
      g.addColorStop(1, "#f2f2f2");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.strokeStyle = "rgba(120,120,120,0.35)";
      for (let i = 0; i < 7; i++) {
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        const y0 = (i / 7) * h + Math.sin(t * 0.2 + i) * 10;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= w; x += w / 12) {
          ctx.lineTo(x, y0 + Math.sin(x * 0.01 + i * 2) * 40);
        }
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "chalkboard": {
      ctx.fillStyle = "#233b2e";
      ctx.fillRect(0, 0, w, h);
      fillNoisePattern(ctx, w, h, "chalk", 128, () => {
        const v = 40 + Math.random() * 40;
        return [v, v + 15, v, 255];
      }, 0.3, "overlay");
      break;
    }
    case "gradient-drift": {
      const ang = t * 0.15;
      const x1 = w / 2 + Math.cos(ang) * w * 0.6;
      const y1 = h / 2 + Math.sin(ang) * h * 0.6;
      const x2 = w / 2 - Math.cos(ang) * w * 0.6;
      const y2 = h / 2 - Math.sin(ang) * h * 0.6;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, "#1a1035");
      g.addColorStop(0.5, "#3a1650");
      g.addColorStop(1, "#0a0a18");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "gradient-aurora": {
      ctx.fillStyle = "#020610";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) {
        const cx = w * (0.2 + i * 0.3) + Math.sin(t * 0.3 + i) * w * 0.1;
        const cy = h * 0.5 + Math.cos(t * 0.25 + i * 2) * h * 0.2;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.6);
        const hue = (i * 100 + t * 20) % 360;
        g.addColorStop(0, `hsla(${hue},80%,55%,0.35)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "none":
    default:
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
  }
}

// ---------------- per-clip effects ----------------

export function gradeFilterString(grade: GradePreset, exposure: number, contrast: number, saturation: number) {
  const brightness = 1 + exposure / 100;
  const contrastF = 1 + contrast / 100;
  let sat = 1 + saturation / 100;
  let extraContrast = 1;
  let extraBrightness = 1;
  let hueRotate = 0;
  let sepia = 0;
  let grayscale = 0;
  switch (grade) {
    case "cinematic":
      extraContrast = 1.12;
      sat *= 0.92;
      hueRotate = -4;
      break;
    case "warm":
      hueRotate = -8;
      sat *= 1.08;
      extraBrightness = 1.02;
      break;
    case "cold":
      hueRotate = 10;
      sat *= 0.96;
      break;
    case "noir":
      grayscale = 1;
      extraContrast = 1.2;
      break;
    case "sepia":
      sepia = 0.75;
      sat *= 0.8;
      break;
    case "teal-orange":
      hueRotate = 6;
      extraContrast = 1.1;
      sat *= 1.15;
      break;
    case "bleach":
      extraContrast = 1.25;
      sat *= 0.55;
      extraBrightness = 1.08;
      break;
  }
  return [
    `brightness(${(brightness * extraBrightness).toFixed(3)})`,
    `contrast(${(contrastF * extraContrast).toFixed(3)})`,
    `saturate(${Math.max(0, sat).toFixed(3)})`,
    hueRotate ? `hue-rotate(${hueRotate}deg)` : "",
    sepia ? `sepia(${sepia})` : "",
    grayscale ? `grayscale(${grayscale})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function effectsFilterString(fx: ClipEffects) {
  const grade = gradeFilterString(fx.grade, fx.exposure, fx.contrast, fx.saturation);
  const parts = [grade];
  if (fx.blur > 0) parts.push(`blur(${fx.blur}px)`);
  if (fx.glow > 0) parts.push(`brightness(${1 + fx.glow * 0.15})`);
  return parts.filter(Boolean).join(" ");
}

let GRAIN_TILE: HTMLCanvasElement | null = null;
function grainTile() {
  if (GRAIN_TILE) return GRAIN_TILE;
  GRAIN_TILE = noiseTile("grain", 220, () => {
    const v = Math.random() * 255;
    return [v, v, v, 255];
  });
  return GRAIN_TILE;
}

export function drawFilmGrain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, amount: number) {
  if (amount <= 0) return;
  const tile = grainTile();
  ctx.save();
  ctx.globalAlpha = 0.09 * amount;
  ctx.globalCompositeOperation = "overlay";
  const ox = (Math.sin(t * 47.1) * 137) % tile.width;
  const oy = (Math.cos(t * 33.7) * 113) % tile.height;
  const pattern = ctx.createPattern(tile, "repeat");
  if (pattern) {
    ctx.translate(ox, oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(-ox, -oy, w, h);
  }
  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${0.7 * amount})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

export function drawLetterbox(ctx: CanvasRenderingContext2D, w: number, h: number, ratio = 0.1) {
  const bar = h * ratio;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, bar);
  ctx.fillRect(0, h - bar, w, bar);
}

export function drawGlow(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.6, amount * 0.5);
  ctx.globalCompositeOperation = "screen";
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
  g.addColorStop(0, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// Cheap chromatic-aberration approximation: redraw the already-composited
// frame region with tinted, offset copies blended with lighten/darken so we
// avoid re-sourcing the raw media (keeps this a pure post effect).
export function drawChromaticAberration(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  amount: number,
) {
  if (amount <= 0) return;
  const offset = amount * 10;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.5;
  ctx.drawImage(canvas, -offset, 0, w, h);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(canvas, offset, 0, w, h);
  ctx.restore();
}

export function applyClipEffects(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  t: number,
  fx: ClipEffects,
) {
  if (fx.grain > 0) drawFilmGrain(ctx, w, h, t, fx.grain);
  if (fx.vignette > 0) drawVignette(ctx, w, h, fx.vignette);
  if (fx.glow > 0) drawGlow(ctx, w, h, fx.glow);
  if (fx.chroma > 0) drawChromaticAberration(ctx, canvas, w, h, fx.chroma);
  if (fx.letterbox) drawLetterbox(ctx, w, h, 0.1);
}
