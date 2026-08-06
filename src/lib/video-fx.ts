// Shared canvas helpers + a library of 20 intro and 20 outro animations
// used by every video studio (images-to-video, lyrical, motivational, WYR,
// repurpose). Each animation draws a full-frame card given a 0..1 progress.

export const FX_FONT = `"Inter", "Helvetica Neue", Arial, sans-serif`;

export type FxPalette = {
  bg: [string, string];
  primary: string;
  accent: string;
  text: string;
};

export const FX_PALETTES: (FxPalette & { id: string; name: string })[] = [
  { id: "gold", name: "Noir Gold", bg: ["#08070a", "#1d1710"], primary: "#e6b566", accent: "#ffe6b0", text: "#ffffff" },
  { id: "violet", name: "Violet Pulse", bg: ["#0d0718", "#33125c"], primary: "#c084fc", accent: "#f0abfc", text: "#ffffff" },
  { id: "cyan", name: "Cyber Cyan", bg: ["#03121a", "#0b4356"], primary: "#22d3ee", accent: "#a5f3fc", text: "#f0fdff" },
  { id: "ember", name: "Ember", bg: ["#120405", "#450d12"], primary: "#f2554a", accent: "#ffc9b0", text: "#fff6f4" },
  { id: "mono", name: "Mono", bg: ["#000000", "#161616"], primary: "#ffffff", accent: "#d4d4d4", text: "#ffffff" },
  { id: "mint", name: "Mint", bg: ["#03150e", "#0b4f33"], primary: "#34d399", accent: "#bbf7d0", text: "#f0fdf4" },
];

export function hexA(hex: string, a: number) {
  const c = hex.replace("#", "");
  return `rgba(${parseInt(c.slice(0, 2), 16)}, ${parseInt(c.slice(2, 4), 16)}, ${parseInt(c.slice(4, 6), 16)}, ${a})`;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      out.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}

export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  weight = 900,
  min = 14,
) {
  let size = start;
  ctx.font = `${weight} ${size}px ${FX_FONT}`;
  while (ctx.measureText(text).width > maxWidth && size > min) {
    size -= Math.max(1, Math.round(size * 0.05));
    ctx.font = `${weight} ${size}px ${FX_FONT}`;
  }
  return size;
}

export function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prev;
}

export const ease = {
  linear: (x: number) => x,
  out: (x: number) => 1 - Math.pow(1 - x, 3),
  in: (x: number) => x * x * x,
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2),
  elastic: (x: number) =>
    x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

export type FxFrame = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** 0 → 1 across the card duration */
  p: number;
  palette: FxPalette;
  title: string;
  subtitle: string;
  logo?: HTMLImageElement | null;
};

type FxDef = { id: string; name: string; draw: (f: FxFrame) => void };

function bg(f: FxFrame, shift = 0) {
  const { ctx, w, h, palette } = f;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, palette.bg[0]);
  g.addColorStop(1, palette.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rg = ctx.createRadialGradient(w / 2, h * (0.45 + shift), 0, w / 2, h * 0.45, Math.max(w, h) * 0.7);
  rg.addColorStop(0, hexA(palette.primary, 0.18));
  rg.addColorStop(1, "transparent");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
}

function centerTitle(f: FxFrame, y: number, scale = 1, alpha = 1, weight = 900) {
  const { ctx, w, h, palette, title } = f;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = fitText(ctx, title.toUpperCase(), w * 0.84, h * 0.1 * scale, weight);
  ctx.fillStyle = palette.text;
  ctx.font = `${weight} ${size}px ${FX_FONT}`;
  ctx.fillText(title.toUpperCase(), w / 2, y);
  ctx.restore();
  return size;
}

function subtitle(f: FxFrame, y: number, alpha = 1) {
  const { ctx, w, h, palette } = f;
  if (!f.subtitle) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = hexA(palette.primary, 0.95);
  ctx.font = `600 ${Math.round(h * 0.024)}px ${FX_FONT}`;
  tracked(ctx, f.subtitle.toUpperCase(), w / 2, y, h * 0.008);
  ctx.restore();
}

function logoOrBadge(f: FxFrame, cx: number, cy: number, r: number, alpha = 1) {
  const { ctx, palette } = f;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  if (f.logo) {
    ctx.save();
    ctx.clip();
    const iw = f.logo.naturalWidth;
    const ih = f.logo.naturalHeight;
    const ratio = Math.max((r * 2) / iw, (r * 2) / ih);
    ctx.drawImage(f.logo, cx - (iw * ratio) / 2, cy - (ih * ratio) / 2, iw * ratio, ih * ratio);
    ctx.restore();
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.accent);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.round(r * 0.9)}px ${FX_FONT}`;
    ctx.fillText((f.title || "O").trim().charAt(0).toUpperCase(), cx, cy + r * 0.03);
  }
  ctx.strokeStyle = hexA(palette.primary, 0.7);
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- INTROS

export const INTRO_ANIMATIONS: FxDef[] = [
  {
    id: "none",
    name: "None",
    draw: () => {},
  },
  {
    id: "fade-rise",
    name: "Fade Rise",
    draw: (f) => {
      bg(f);
      const a = ease.out(Math.min(1, f.p * 2));
      centerTitle(f, f.h * 0.48 + (1 - a) * f.h * 0.05, 1, a);
      subtitle(f, f.h * 0.57, ease.out(Math.max(0, f.p * 2 - 0.6)));
    },
  },
  {
    id: "logo-pop",
    name: "Logo Pop",
    draw: (f) => {
      bg(f);
      const a = ease.back(Math.min(1, f.p * 2.2));
      logoOrBadge(f, f.w / 2, f.h * 0.42, f.h * 0.1 * a, Math.min(1, f.p * 3));
      centerTitle(f, f.h * 0.6, 0.8, ease.out(Math.max(0, f.p * 1.6 - 0.5)));
      subtitle(f, f.h * 0.68, ease.out(Math.max(0, f.p * 1.6 - 0.8)));
    },
  },
  {
    id: "wipe-bars",
    name: "Wipe Bars",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const rows = 6;
      for (let i = 0; i < rows; i++) {
        const local = Math.max(0, Math.min(1, f.p * 1.6 - i * 0.06));
        const wpx = ease.out(local) * w;
        ctx.fillStyle = hexA(i % 2 ? palette.primary : palette.accent, 0.14);
        ctx.fillRect(i % 2 ? w - wpx : 0, (h / rows) * i, wpx, h / rows);
      }
      centerTitle(f, h * 0.5, 1, ease.out(Math.max(0, f.p * 2 - 0.7)));
    },
  },
  {
    id: "glitch",
    name: "Glitch In",
    draw: (f) => {
      const { ctx, w, h } = f;
      bg(f);
      const a = Math.min(1, f.p * 2);
      const jitter = (1 - a) * w * 0.02;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "#ff004c";
      ctx.globalAlpha = 0.5 * (1 - a);
      ctx.translate(-jitter, 0);
      centerTitle(f, h * 0.5, 1, 1);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.5 * (1 - a);
      ctx.translate(jitter, 0);
      centerTitle(f, h * 0.5, 1, 1);
      ctx.restore();
      centerTitle(f, h * 0.5, 1, a);
      subtitle(f, h * 0.59, a);
    },
  },
  {
    id: "line-reveal",
    name: "Line Reveal",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const lw = ease.inOut(Math.min(1, f.p * 1.5)) * w * 0.7;
      ctx.fillStyle = palette.primary;
      ctx.fillRect(w / 2 - lw / 2, h * 0.5, lw, Math.max(2, h * 0.003));
      const a = ease.out(Math.max(0, f.p * 2 - 0.8));
      centerTitle(f, h * 0.44, 0.95, a);
      subtitle(f, h * 0.57, a);
    },
  },
  {
    id: "zoom-blur",
    name: "Zoom Punch",
    draw: (f) => {
      const { ctx, w, h } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 1.8));
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1.6 - 0.6 * k, 1.6 - 0.6 * k);
      ctx.translate(-w / 2, -h / 2);
      centerTitle(f, h * 0.5, 1, k);
      ctx.restore();
      subtitle(f, h * 0.6, ease.out(Math.max(0, f.p * 2 - 0.9)));
    },
  },
  {
    id: "slide-split",
    name: "Split Slide",
    draw: (f) => {
      const { ctx, w, h } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 1.7));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h * 0.5);
      ctx.clip();
      ctx.translate(-(1 - k) * w, 0);
      centerTitle(f, h * 0.5, 1, 1);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, h * 0.5, w, h * 0.5);
      ctx.clip();
      ctx.translate((1 - k) * w, 0);
      centerTitle(f, h * 0.5, 1, 1);
      ctx.restore();
      subtitle(f, h * 0.6, ease.out(Math.max(0, f.p * 2 - 0.9)));
    },
  },
  {
    id: "ring-draw",
    name: "Ring Draw",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const r = Math.min(w, h) * 0.22;
      const end = -Math.PI / 2 + Math.PI * 2 * ease.inOut(Math.min(1, f.p * 1.4));
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = Math.max(3, r * 0.05);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.42, r, -Math.PI / 2, end);
      ctx.stroke();
      logoOrBadge(f, w / 2, h * 0.42, r * 0.62, ease.out(Math.max(0, f.p * 2 - 0.5)));
      centerTitle(f, h * 0.72, 0.75, ease.out(Math.max(0, f.p * 2 - 0.8)));
    },
  },
  {
    id: "type-in",
    name: "Typewriter",
    draw: (f) => {
      const { ctx, w, h, palette, title } = f;
      bg(f);
      const shown = title.slice(0, Math.round(title.length * Math.min(1, f.p * 1.5)));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const size = fitText(ctx, title.toUpperCase(), w * 0.82, h * 0.075, 800);
      ctx.font = `800 ${size}px ${FX_FONT}`;
      ctx.fillStyle = palette.text;
      ctx.fillText(shown.toUpperCase(), w / 2, h * 0.5);
      if (Math.floor(f.p * 12) % 2 === 0) {
        const tw = ctx.measureText(shown.toUpperCase()).width;
        ctx.fillStyle = palette.primary;
        ctx.fillRect(w / 2 + tw / 2 + size * 0.1, h * 0.5 - size * 0.45, size * 0.08, size * 0.9);
      }
      subtitle(f, h * 0.6, ease.out(Math.max(0, f.p * 2 - 1)));
    },
  },
  {
    id: "shutter",
    name: "Shutter",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      centerTitle(f, h * 0.5, 1, 1);
      const k = ease.inOut(Math.min(1, f.p * 1.3));
      const cols = 8;
      ctx.fillStyle = palette.bg[0];
      for (let i = 0; i < cols; i++) {
        const cw = w / cols;
        const hh = (1 - k) * h;
        ctx.fillRect(i * cw, i % 2 ? h - hh : 0, cw + 1, hh);
      }
      subtitle(f, h * 0.6, ease.out(Math.max(0, f.p * 2 - 1)));
    },
  },
  {
    id: "neon-flicker",
    name: "Neon Flicker",
    draw: (f) => {
      const { ctx, h, palette } = f;
      bg(f);
      const flick = f.p < 0.5 ? (Math.sin(f.p * 60) > 0 ? 1 : 0.25) : 1;
      ctx.save();
      ctx.shadowColor = hexA(palette.primary, 0.95);
      ctx.shadowBlur = h * 0.05;
      centerTitle(f, h * 0.5, 1, flick);
      ctx.restore();
      subtitle(f, h * 0.6, Math.max(0, f.p * 2 - 1));
    },
  },
  {
    id: "count-in",
    name: "Count In",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const n = 3 - Math.floor(Math.min(2.99, f.p * 3));
      const local = (f.p * 3) % 1;
      ctx.save();
      ctx.globalAlpha = 1 - local * 0.6;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${Math.round(h * 0.24 * (1.2 - local * 0.2))}px ${FX_FONT}`;
      ctx.fillStyle = palette.primary;
      ctx.fillText(String(n), w / 2, h * 0.45);
      ctx.restore();
      centerTitle(f, h * 0.72, 0.6, Math.max(0, f.p * 1.4 - 0.4));
    },
  },
  {
    id: "particles",
    name: "Particle Burst",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 1.6));
      for (let i = 0; i < 60; i++) {
        const ang = (i / 60) * Math.PI * 2;
        const dist = k * Math.min(w, h) * (0.15 + ((i * 37) % 100) / 240);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = i % 3 ? palette.primary : palette.accent;
        ctx.beginPath();
        ctx.arc(w / 2 + Math.cos(ang) * dist, h * 0.5 + Math.sin(ang) * dist, Math.max(1.5, h * 0.004), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      centerTitle(f, h * 0.5, 1, k);
      subtitle(f, h * 0.6, Math.max(0, f.p * 2 - 1));
    },
  },
  {
    id: "stamp",
    name: "Stamp",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const k = Math.min(1, f.p * 2.5);
      const s = 2.2 - 1.2 * ease.out(k);
      ctx.save();
      ctx.translate(w / 2, h * 0.5);
      ctx.rotate((1 - ease.out(k)) * -0.25);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h * 0.5);
      centerTitle(f, h * 0.5, 1, k);
      ctx.restore();
      if (k >= 1) {
        ctx.strokeStyle = hexA(palette.primary, 0.8);
        ctx.lineWidth = Math.max(2, h * 0.004);
        ctx.strokeRect(w * 0.14, h * 0.42, w * 0.72, h * 0.16);
      }
    },
  },
  {
    id: "curtain",
    name: "Curtain",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      centerTitle(f, h * 0.5, 1, 1);
      subtitle(f, h * 0.6, 1);
      const k = ease.inOut(Math.min(1, f.p * 1.4));
      ctx.fillStyle = palette.bg[0];
      ctx.fillRect(0, 0, w * 0.5 * (1 - k), h);
      ctx.fillRect(w - w * 0.5 * (1 - k), 0, w * 0.5 * (1 - k), h);
    },
  },
  {
    id: "swipe-card",
    name: "Swipe Card",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 1.6));
      const cw = w * 0.78;
      const chh = h * 0.24;
      const x = w / 2 - cw / 2;
      const y = h * 0.5 - chh / 2 + (1 - k) * h * 0.12;
      ctx.globalAlpha = k;
      ctx.fillStyle = hexA(palette.primary, 0.16);
      roundRect(ctx, x, y, cw, chh, chh * 0.16);
      ctx.fill();
      ctx.strokeStyle = hexA(palette.primary, 0.7);
      ctx.lineWidth = Math.max(1.5, h * 0.002);
      ctx.stroke();
      ctx.globalAlpha = 1;
      centerTitle(f, y + chh * 0.42, 0.72, k);
      subtitle(f, y + chh * 0.75, k);
    },
  },
  {
    id: "scanline",
    name: "Scanline",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      centerTitle(f, h * 0.5, 1, Math.min(1, f.p * 2));
      const y = f.p * h;
      const g = ctx.createLinearGradient(0, y - h * 0.06, 0, y + h * 0.06);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, hexA(palette.accent, 0.35));
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, y - h * 0.06, w, h * 0.12);
      for (let i = 0; i < h; i += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(0, i, w, 1);
      }
    },
  },
  {
    id: "flip",
    name: "3D Flip",
    draw: (f) => {
      const { ctx, w, h } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 1.6));
      const sx = Math.abs(Math.cos((1 - k) * Math.PI * 0.5));
      ctx.save();
      ctx.translate(w / 2, h * 0.5);
      ctx.scale(Math.max(0.02, sx), 1);
      ctx.translate(-w / 2, -h * 0.5);
      centerTitle(f, h * 0.5, 1, 1);
      ctx.restore();
      subtitle(f, h * 0.6, Math.max(0, f.p * 2 - 1));
    },
  },
  {
    id: "streak",
    name: "Light Streak",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      centerTitle(f, h * 0.5, 1, Math.min(1, f.p * 2.2));
      const x = -w * 0.3 + f.p * w * 1.6;
      const g = ctx.createLinearGradient(x - w * 0.2, 0, x + w * 0.2, 0);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, hexA(palette.accent, 0.4));
      g.addColorStop(1, "transparent");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.fillRect(x - w * 0.2, 0, w * 0.4, h);
      ctx.restore();
    },
  },
  {
    id: "grid-build",
    name: "Grid Build",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const cols = 10;
      const rows = 16;
      for (let i = 0; i < cols * rows; i++) {
        const local = Math.max(0, Math.min(1, f.p * 2 - ((i * 13) % (cols * rows)) / (cols * rows)));
        if (local <= 0) continue;
        const cx = (i % cols) * (w / cols);
        const cy = Math.floor(i / cols) * (h / rows);
        ctx.globalAlpha = (1 - local) * 0.5;
        ctx.fillStyle = palette.primary;
        ctx.fillRect(cx, cy, w / cols, h / rows);
      }
      ctx.globalAlpha = 1;
      centerTitle(f, h * 0.5, 1, ease.out(Math.min(1, f.p * 1.6)));
    },
  },
];

// ---------------------------------------------------------------- OUTROS

export const OUTRO_ANIMATIONS: FxDef[] = [
  { id: "none", name: "None", draw: () => {} },
  {
    id: "subscribe",
    name: "Subscribe Card",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 2.5));
      logoOrBadge(f, w / 2, h * 0.36, h * 0.085 * k, k);
      centerTitle(f, h * 0.53, 0.85, k);
      const bw = w * 0.5;
      const bh = h * 0.06;
      ctx.globalAlpha = k;
      ctx.fillStyle = palette.primary;
      roundRect(ctx, w / 2 - bw / 2, h * 0.63, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(bh * 0.42)}px ${FX_FONT}`;
      ctx.fillText((f.subtitle || "SUBSCRIBE").toUpperCase(), w / 2, h * 0.63 + bh / 2);
      ctx.globalAlpha = 1;
    },
  },
  {
    id: "fade-out",
    name: "Fade Out",
    draw: (f) => {
      bg(f);
      centerTitle(f, f.h * 0.48, 1, 1 - ease.in(f.p));
      subtitle(f, f.h * 0.58, 1 - ease.in(f.p));
    },
  },
  {
    id: "shrink",
    name: "Shrink Away",
    draw: (f) => {
      const { ctx, w, h } = f;
      bg(f);
      const s = 1 - ease.in(f.p) * 0.85;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
      centerTitle(f, h * 0.5, 1, 1 - f.p * 0.6);
      ctx.restore();
    },
  },
  {
    id: "swipe-off",
    name: "Swipe Off",
    draw: (f) => {
      const { ctx, w, h } = f;
      bg(f);
      ctx.save();
      ctx.translate(-ease.in(f.p) * w, 0);
      centerTitle(f, h * 0.48, 1, 1);
      subtitle(f, h * 0.58, 1);
      ctx.restore();
    },
  },
  {
    id: "cta-split",
    name: "CTA Split",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 2));
      ctx.fillStyle = hexA(palette.primary, 0.14);
      ctx.fillRect(0, h * 0.42, w * k, h * 0.16);
      centerTitle(f, h * 0.5, 0.9, k);
      subtitle(f, h * 0.62, k);
    },
  },
  {
    id: "ring-close",
    name: "Ring Close",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const r = Math.min(w, h) * 0.24 * (1 - f.p * 0.2);
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = Math.max(3, r * 0.06);
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.44, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ease.inOut(f.p)));
      ctx.stroke();
      logoOrBadge(f, w / 2, h * 0.44, r * 0.6, 1);
      centerTitle(f, h * 0.74, 0.7, 1 - f.p * 0.3);
    },
  },
  {
    id: "end-slate",
    name: "End Slate",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 2));
      ctx.globalAlpha = k;
      ctx.strokeStyle = hexA(palette.primary, 0.7);
      ctx.lineWidth = Math.max(2, h * 0.0025);
      ctx.strokeRect(w * 0.1, h * 0.3, w * 0.8, h * 0.4);
      ctx.globalAlpha = 1;
      centerTitle(f, h * 0.46, 0.85, k);
      subtitle(f, h * 0.58, k);
    },
  },
  {
    id: "next-video",
    name: "Next Video",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 2));
      const bw = w * 0.7;
      const bh = h * 0.2;
      ctx.globalAlpha = k;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, w / 2 - bw / 2, h * 0.4, bw, bh, bh * 0.12);
      ctx.fill();
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = Math.max(2, h * 0.002);
      ctx.stroke();
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.moveTo(w / 2 - bw * 0.36, h * 0.5 - bh * 0.12);
      ctx.lineTo(w / 2 - bw * 0.36, h * 0.5 + bh * 0.12);
      ctx.lineTo(w / 2 - bw * 0.22, h * 0.5);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = palette.text;
      const s = fitText(ctx, f.title.toUpperCase(), bw * 0.5, h * 0.04, 800);
      ctx.font = `800 ${s}px ${FX_FONT}`;
      ctx.fillText(f.title.toUpperCase(), w / 2 - bw * 0.14, h * 0.48);
      ctx.fillStyle = hexA(palette.primary, 0.9);
      ctx.font = `600 ${Math.round(h * 0.02)}px ${FX_FONT}`;
      ctx.fillText((f.subtitle || "UP NEXT").toUpperCase(), w / 2 - bw * 0.14, h * 0.55);
      ctx.textAlign = "center";
    },
  },
  {
    id: "socials",
    name: "Social Bar",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 2));
      centerTitle(f, h * 0.44, 0.9, k);
      const handles = (f.subtitle || "@yourhandle").split(/[,|]/).map((s) => s.trim()).filter(Boolean);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      handles.slice(0, 3).forEach((hd, i) => {
        const y = h * 0.58 + i * h * 0.06;
        const a = ease.out(Math.max(0, f.p * 2.5 - 0.4 - i * 0.25));
        ctx.globalAlpha = a;
        ctx.fillStyle = hexA(palette.primary, 0.18);
        roundRect(ctx, w * 0.25, y - h * 0.024, w * 0.5, h * 0.048, h * 0.024);
        ctx.fill();
        ctx.fillStyle = palette.text;
        ctx.font = `700 ${Math.round(h * 0.022)}px ${FX_FONT}`;
        ctx.fillText(hd, w / 2, y);
      });
      ctx.globalAlpha = 1;
    },
  },
  {
    id: "iris-out",
    name: "Iris Out",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      centerTitle(f, h * 0.5, 1, 1);
      ctx.save();
      ctx.fillStyle = palette.bg[0];
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(w / 2, h / 2, Math.max(0.01, (1 - ease.inOut(f.p)) * Math.hypot(w, h) * 0.6), 0, Math.PI * 2, true);
      ctx.fill("evenodd");
      ctx.restore();
    },
  },
  {
    id: "bars-close",
    name: "Bars Close",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      centerTitle(f, h * 0.5, 1, 1 - f.p * 0.4);
      const k = ease.inOut(f.p);
      ctx.fillStyle = palette.bg[0];
      ctx.fillRect(0, 0, w, (h / 2) * k);
      ctx.fillRect(0, h - (h / 2) * k, w, (h / 2) * k);
    },
  },
  {
    id: "thanks",
    name: "Thank You",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const k = ease.out(Math.min(1, f.p * 2));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = k;
      const s = fitText(ctx, "THANKS FOR WATCHING", w * 0.8, h * 0.06, 300);
      ctx.font = `300 ${s}px ${FX_FONT}`;
      ctx.fillStyle = hexA(palette.text, 0.9);
      tracked(ctx, "THANKS FOR WATCHING", w / 2, h * 0.44, s * 0.16);
      ctx.globalAlpha = 1;
      centerTitle(f, h * 0.58, 0.7, k);
    },
  },
  {
    id: "loop",
    name: "Loop Hint",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const r = Math.min(w, h) * 0.1;
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.42, r, f.p * 6, f.p * 6 + Math.PI * 1.5);
      ctx.stroke();
      centerTitle(f, h * 0.62, 0.7, 1);
      subtitle(f, h * 0.7, 1);
    },
  },
  {
    id: "push-up",
    name: "Push Up",
    draw: (f) => {
      const { ctx, h } = f;
      bg(f);
      ctx.save();
      ctx.translate(0, -ease.in(f.p) * h);
      centerTitle(f, h * 0.5, 1, 1);
      ctx.restore();
      subtitle(f, h * (0.9 - ease.out(f.p) * 0.28), ease.out(f.p));
    },
  },
  {
    id: "flash-cut",
    name: "Flash Cut",
    draw: (f) => {
      const { ctx, w, h } = f;
      bg(f);
      centerTitle(f, h * 0.5, 1, 1);
      const flash = Math.max(0, 1 - Math.abs(f.p - 0.5) * 6);
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.85})`;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: "credits",
    name: "Credits Roll",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      const rows = [f.title, ...(f.subtitle || "").split(/[,|]/)].filter(Boolean);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      rows.forEach((row, i) => {
        const y = h * (1.05 + i * 0.07) - f.p * h * 0.75;
        ctx.fillStyle = i === 0 ? palette.text : hexA(palette.primary, 0.9);
        ctx.font = `${i === 0 ? 900 : 500} ${Math.round(h * (i === 0 ? 0.045 : 0.024))}px ${FX_FONT}`;
        ctx.fillText(row.trim().toUpperCase(), w / 2, y);
      });
    },
  },
  {
    id: "pulse-logo",
    name: "Pulse Logo",
    draw: (f) => {
      const { w, h } = f;
      bg(f);
      const pulse = 1 + Math.sin(f.p * Math.PI * 4) * 0.05;
      logoOrBadge(f, w / 2, h * 0.45, h * 0.1 * pulse, 1);
      centerTitle(f, h * 0.66, 0.72, 1);
    },
  },
  {
    id: "wipe-down",
    name: "Wipe Down",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      centerTitle(f, h * 0.5, 1, 1);
      ctx.fillStyle = hexA(palette.primary, 0.9);
      ctx.fillRect(0, 0, w, ease.inOut(f.p) * h);
    },
  },
  {
    id: "corner-tag",
    name: "Corner Tag",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      centerTitle(f, h * 0.46, 0.9, 1);
      const k = ease.out(Math.min(1, f.p * 2));
      const bw = w * 0.42;
      const bh = h * 0.07;
      const x = w - bw * k - w * 0.06;
      ctx.fillStyle = hexA(palette.primary, 0.9);
      roundRect(ctx, x, h * 0.78, bw, bh, bh * 0.2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(bh * 0.36)}px ${FX_FONT}`;
      ctx.fillText((f.subtitle || "FOLLOW FOR MORE").toUpperCase(), x + bw / 2, h * 0.78 + bh / 2);
    },
  },
  {
    id: "dissolve-grid",
    name: "Dissolve Grid",
    draw: (f) => {
      const { ctx, w, h, palette } = f;
      bg(f);
      centerTitle(f, h * 0.5, 1, 1);
      const cols = 12;
      const rows = 20;
      ctx.fillStyle = palette.bg[0];
      for (let i = 0; i < cols * rows; i++) {
        const thresh = ((i * 71) % (cols * rows)) / (cols * rows);
        if (f.p > thresh) {
          ctx.fillRect((i % cols) * (w / cols), Math.floor(i / cols) * (h / rows), w / cols + 1, h / rows + 1);
        }
      }
    },
  },
];

export function drawFx(list: FxDef[], id: string, frame: FxFrame) {
  const def = list.find((d) => d.id === id);
  if (!def || def.id === "none") return false;
  def.draw(frame);
  return true;
}
