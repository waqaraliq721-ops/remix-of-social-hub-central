import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Music4,
  Upload,
  Play,
  Pause,
  Download,
  Loader2,
  ImagePlus,
  Disc3,
  Trash2,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  IntroOutroCard,
  defaultIntro,
  defaultOutro,
  paletteOf,
  type CardConfig,
} from "@/components/intro-outro-card";
import { INTRO_ANIMATIONS, OUTRO_ANIMATIONS } from "@/lib/video-fx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  transcribeFile,
  wordsToLines,
  linesToLrc,
  STT_PROVIDERS,
  type SttProvider,
} from "@/lib/transcribe";


export const Route = createFileRoute("/_authenticated/lyrical-videos")({
  head: () => ({
    meta: [
      { title: "Lyrical Videos — Orbit" },
      {
        name: "description",
        content:
          "Create Spotify-style lyric videos in 9:16 or 16:9 with 56 templates, a rotating gold vinyl, auto lyric detection and full-HD 60fps export.",
      },
      { property: "og:title", content: "Lyrical Videos — Orbit" },
      {
        property: "og:description",
        content:
          "Rotating vinyl lyric videos with auto-detected, word-accurate lyrics. Export 1080p at 60fps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LyricalVideosPage,
});

// -------------------- Types --------------------

type AspectKey = "9:16" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · Reels/TikTok/Shorts" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

type LyricLine = { time: number; text: string; end?: number };
type EngineId =
  | "vinyl"
  | "rolling"
  | "karaoke"
  | "spotify"
  | "neon"
  | "waveform"
  | "typewriter"
  | "cinebar"
  | "typo-serif"
  | "typo-stack"
  | "typo-marquee"
  | "typo-gradient"
  | "typo-outline"
  | "typo-justify"
  | "typo-mono"
  | "typo-vertical"
  | "typo-poster"
  | "typo-ticker";


type Palette = {
  id: string;
  name: string;
  bg: [string, string];
  primary: string;
  accent: string;
  text: string;
  muted: string;
};

const PALETTES: Palette[] = [
  { id: "gold", name: "Vinyl Gold", bg: ["#0b0906", "#241a0e"], primary: "#e8c07a", accent: "#f3d9a4", text: "#ffffff", muted: "#8b8377" },
  { id: "purple", name: "Neon Purple", bg: ["#120a20", "#3d1a5c"], primary: "#c084fc", accent: "#f0abfc", text: "#ffffff", muted: "#9c92b8" },
  { id: "sunset", name: "Sunset Orange", bg: ["#1c0908", "#5c2410"], primary: "#fb923c", accent: "#fde68a", text: "#fffbeb", muted: "#c39a80" },
  { id: "ocean", name: "Ocean Teal", bg: ["#04171a", "#0e4a5c"], primary: "#5eead4", accent: "#a5f3fc", text: "#f0fdfa", muted: "#79a8a2" },
  { id: "cherry", name: "Cherry Red", bg: ["#140407", "#5c0e1f"], primary: "#f43f5e", accent: "#fda4af", text: "#fff1f2", muted: "#c08590" },
  { id: "mono", name: "Mono White", bg: ["#070707", "#1f1f1f"], primary: "#ffffff", accent: "#d4d4d4", text: "#ffffff", muted: "#7a7a7a" },
  { id: "forest", name: "Forest Green", bg: ["#03150d", "#0b4f2e"], primary: "#34d399", accent: "#bbf7d0", text: "#f0fdf4", muted: "#7fa691" },
];

const ENGINES: { id: EngineId; name: string; desc: string }[] = [
  { id: "vinyl", name: "Vinyl Classic", desc: "Rotating vinyl with progress ring, lyrics rolling bottom → middle." },
  { id: "rolling", name: "Rolling Lyrics", desc: "Full-height lyric roll with soft top/bottom fades." },
  { id: "karaoke", name: "Karaoke", desc: "Word-by-word highlight on a huge centred line." },
  { id: "spotify", name: "Now Playing", desc: "Cover card, track meta and a scrubbing progress bar." },
  { id: "neon", name: "Neon Glow", desc: "Glowing uppercase lyric roll on a dark backdrop." },
  { id: "waveform", name: "Waveform Pulse", desc: "Reactive bars with a big centred lyric." },
  { id: "typewriter", name: "Typewriter", desc: "Lyrics typed out in sync with the vocal." },
  { id: "cinebar", name: "Cinematic Bars", desc: "Letterboxed film look with lower-third lyrics." },
  { id: "typo-serif", name: "Typo · Editorial Serif", desc: "Magazine serif lyric set with a hairline rule." },
  { id: "typo-stack", name: "Typo · Word Stack", desc: "Words stacked left, lighting up as they're sung." },
  { id: "typo-marquee", name: "Typo · Marquee", desc: "Condensed lyric scrolling between two rules." },
  { id: "typo-gradient", name: "Typo · Gradient Fill", desc: "Huge gradient-filled uppercase lyric." },
  { id: "typo-outline", name: "Typo · Outline Fill", desc: "Outlined letters filling with colour as sung." },
  { id: "typo-justify", name: "Typo · Justified Block", desc: "Words justified edge to edge, alternating colour." },
  { id: "typo-mono", name: "Typo · Mono Terminal", desc: "Monospace lyric typed with a blinking caret." },
  { id: "typo-vertical", name: "Typo · Vertical Column", desc: "Letters stacked vertically, shimmering." },
  { id: "typo-poster", name: "Typo · Poster Block", desc: "Condensed poster block, one phrase per line." },
  { id: "typo-ticker", name: "Typo · Kinetic Ticker", desc: "Alternating left/right lyric ticker." },
];


type Template = { id: string; name: string; engine: EngineId; palette: Palette };

const TEMPLATES: Template[] = ENGINES.flatMap((e) =>
  PALETTES.map((p) => ({
    id: `${e.id}-${p.id}`,
    name: `${e.name} · ${p.name}`,
    engine: e.id,
    palette: p,
  })),
);

// -------------------- LRC parsing --------------------

function parseLyrics(text: string, audioDuration: number): LyricLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lrcRe = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/;
  const timed: LyricLine[] = [];
  let anyTimed = false;
  const plain: string[] = [];
  for (const raw of lines) {
    const m = raw.match(lrcRe);
    if (m) {
      anyTimed = true;
      const mm = parseInt(m[1], 10);
      const ss = parseInt(m[2], 10);
      const ms = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
      const t = mm * 60 + ss + ms / 1000;
      const txt = m[4].trim();
      if (txt) timed.push({ time: t, text: txt });
    } else {
      plain.push(raw);
    }
  }
  if (anyTimed) return timed.sort((a, b) => a.time - b.time);
  const dur = audioDuration > 0 ? audioDuration : 30;
  const step = plain.length ? dur / plain.length : dur;
  return plain.map((text, i) => ({ time: i * step, text }));
}

function findLineIndex(lines: LyricLine[], t: number): number {
  if (!lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return idx;
}

// -------------------- Utility drawing --------------------

function hexA(hex: string, a: number) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}

/** Set by renderEngine so the background can vary per template. */
let BG_SEED = 0;

function hashSeed(s: string) {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

/**
 * Animated, palette-driven background. Six looks keyed off the template so no
 * two engines share a backdrop, and everything is painted edge to edge so the
 * frame reads as one continuous surface (no visible top/bottom banding).
 */
function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t: number) {
  const variant = BG_SEED % 6;
  const base = ctx.createLinearGradient(0, 0, w * 0.35, h);
  base.addColorStop(0, p.bg[0]);
  base.addColorStop(0.5, p.bg[1]);
  base.addColorStop(1, p.bg[0]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const blob = (cx: number, cy: number, rad: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, hexA(color, alpha));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  if (variant === 0) {
    // Aurora — three slow drifting colour clouds.
    blob(w * 0.3 + Math.sin(t * 0.21) * w * 0.18, h * 0.28 + Math.cos(t * 0.17) * h * 0.1, Math.max(w, h) * 0.55, p.primary, 0.22);
    blob(w * 0.75 + Math.cos(t * 0.15) * w * 0.14, h * 0.7 + Math.sin(t * 0.19) * h * 0.12, Math.max(w, h) * 0.5, p.accent, 0.16);
    blob(w * 0.5, h * 0.5 + Math.sin(t * 0.11) * h * 0.2, Math.max(w, h) * 0.45, p.bg[1], 0.3);
  } else if (variant === 1) {
    // Sweeping diagonal gradient band.
    const off = ((t * 0.06) % 1) * 2 - 0.5;
    const g = ctx.createLinearGradient(-w * off, 0, w * (1.4 - off), h);
    g.addColorStop(0, hexA(p.primary, 0));
    g.addColorStop(0.45, hexA(p.primary, 0.2));
    g.addColorStop(0.55, hexA(p.accent, 0.16));
    g.addColorStop(1, hexA(p.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    blob(w * 0.5, h * 0.45, Math.max(w, h) * 0.6, p.bg[1], 0.35);
  } else if (variant === 2) {
    // Slow rotating light rays.
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.rotate(t * 0.06);
    const rays = 12;
    for (let i = 0; i < rays; i++) {
      ctx.rotate((Math.PI * 2) / rays);
      const g = ctx.createLinearGradient(0, 0, 0, -Math.max(w, h));
      g.addColorStop(0, hexA(i % 2 ? p.primary : p.accent, 0.14));
      g.addColorStop(1, hexA(p.primary, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, Math.max(w, h), -Math.PI / 2 - 0.11, -Math.PI / 2 + 0.11);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    blob(w * 0.5, h * 0.5, Math.max(w, h) * 0.5, p.bg[1], 0.3);
  } else if (variant === 3) {
    // Floating bokeh.
    for (let i = 0; i < 16; i++) {
      const s = (i * 97) % 100 / 100;
      const cx = ((s * 1.7) % 1) * w + Math.sin(t * (0.12 + s * 0.2) + i) * w * 0.05;
      const cy = ((s * 2.3 + t * 0.02 * (0.5 + s)) % 1) * h;
      blob(cx, cy, Math.max(w, h) * (0.06 + s * 0.1), i % 3 ? p.primary : p.accent, 0.12);
    }
    blob(w * 0.5, h * 0.5, Math.max(w, h) * 0.55, p.bg[1], 0.25);
  } else if (variant === 4) {
    // Drifting soft stripes.
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.5);
    const band = Math.max(w, h) * 0.16;
    const shift = (t * band * 0.12) % (band * 2);
    for (let x = -Math.max(w, h) - shift; x < Math.max(w, h); x += band * 2) {
      const g = ctx.createLinearGradient(x, 0, x + band, 0);
      g.addColorStop(0, hexA(p.primary, 0));
      g.addColorStop(0.5, hexA(p.primary, 0.12));
      g.addColorStop(1, hexA(p.primary, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x, -Math.max(w, h), band, Math.max(w, h) * 2);
    }
    ctx.restore();
    blob(w * 0.5, h * 0.4, Math.max(w, h) * 0.55, p.accent, 0.12);
  } else {
    // Breathing concentric rings.
    for (let i = 0; i < 5; i++) {
      const phase = (t * 0.12 + i / 5) % 1;
      const rad = Math.max(w, h) * (0.15 + phase * 0.65);
      ctx.strokeStyle = hexA(i % 2 ? p.primary : p.accent, 0.16 * (1 - phase));
      ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.006);
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.45, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    blob(w / 2, h * 0.45, Math.max(w, h) * 0.5, p.primary, 0.16);
  }
  ctx.restore();

  // Even, full-frame vignette keeps the composition unified.
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Wrap + auto-shrink so a lyric always fits inside the safe area.
 * Returns the rows and the font size actually used.
 */
function layoutText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: {
    maxW: number;
    maxH: number;
    start: number;
    weight: number | string;
    family: string;
    lineH?: number;
    min?: number;
  },
): { rows: string[]; size: number } {
  const lineH = opts.lineH ?? 1.18;
  const min = opts.min ?? 12;
  let size = Math.max(min, Math.round(opts.start));
  for (;;) {
    ctx.font = `${opts.weight} ${size}px ${opts.family}`;
    const rows = wrapText(ctx, text, opts.maxW);
    const fits =
      rows.length * size * lineH <= opts.maxH &&
      rows.every((r) => ctx.measureText(r).width <= opts.maxW);
    if (fits || size <= min) return { rows, size };
    size = Math.max(min, Math.round(size * 0.92));
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const pushWord = (w: string) => {
    // Hard-break words that can never fit on their own.
    if (ctx.measureText(w).width <= maxWidth) return [w];
    const parts: string[] = [];
    let chunk = "";
    for (const ch of w) {
      if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
        parts.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    if (chunk) parts.push(chunk);
    return parts;
  };
  for (const raw of words) {
    for (const w of pushWord(raw)) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  // manual letter-spacing (canvas letterSpacing isn't universal)
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

function drawVinyl(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t: number,
  coverImg: HTMLImageElement | null,
  p: Palette,
) {
  ctx.save();
  ctx.translate(x, y);

  // soft glow behind disc
  const glow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.5);
  glow.addColorStop(0, hexA(p.primary, 0.18));
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate((t * Math.PI * 2) / 4.2); // ~14 rpm

  // disc body with sheen
  const body = ctx.createLinearGradient(-r, -r, r, r);
  body.addColorStop(0, "#191919");
  body.addColorStop(0.35, "#0a0a0a");
  body.addColorStop(0.55, "#242424");
  body.addColorStop(0.8, "#080808");
  body.addColorStop(1, "#1c1c1c");
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // grooves
  ctx.lineWidth = Math.max(1, r * 0.004);
  for (let i = r * 0.5; i < r * 0.985; i += r * 0.022) {
    ctx.beginPath();
    ctx.arc(0, 0, i, 0, Math.PI * 2);
    ctx.strokeStyle = i % (r * 0.11) < r * 0.03 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.035)";
    ctx.stroke();
  }

  // specular highlight sweep
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  const sheen = ctx.createLinearGradient(-r, -r, r, r);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0.07)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0.14)");
  sheen.addColorStop(0.55, "rgba(255,255,255,0.05)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  // label / cover
  const lr = r * 0.42;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, lr, 0, Math.PI * 2);
  ctx.clip();
  if (coverImg) {
    const iw = coverImg.naturalWidth;
    const ih = coverImg.naturalHeight;
    const ratio = Math.max((lr * 2) / iw, (lr * 2) / ih);
    ctx.drawImage(coverImg, (-iw * ratio) / 2, (-ih * ratio) / 2, iw * ratio, ih * ratio);
  } else {
    const lg = ctx.createLinearGradient(-lr, -lr, lr, lr);
    lg.addColorStop(0, p.primary);
    lg.addColorStop(1, p.bg[1]);
    ctx.fillStyle = lg;
    ctx.fillRect(-lr, -lr, lr * 2, lr * 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, lr, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = r * 0.012;
  ctx.stroke();

  // spindle hole
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.028, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore(); // end rotation

  // outer edge
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = Math.max(1, r * 0.008);
  ctx.stroke();

  ctx.restore();
}

function drawProgressRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  progress: number,
  p: Palette,
) {
  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * Math.max(0, Math.min(1, progress));
  ctx.save();
  ctx.lineCap = "round";
  // remaining (dashed)
  ctx.setLineDash([r * 0.02, r * 0.05]);
  ctx.strokeStyle = hexA(p.primary, 0.35);
  ctx.lineWidth = Math.max(1.5, r * 0.012);
  ctx.beginPath();
  ctx.arc(x, y, r, end, start + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // elapsed (solid, glowing)
  ctx.shadowColor = hexA(p.primary, 0.9);
  ctx.shadowBlur = r * 0.12;
  ctx.strokeStyle = p.primary;
  ctx.lineWidth = Math.max(2, r * 0.018);
  ctx.beginPath();
  ctx.arc(x, y, r, start, end);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // head dot
  ctx.beginPath();
  ctx.arc(x + Math.cos(end) * r, y + Math.sin(end) * r, r * 0.026, 0, Math.PI * 2);
  ctx.fillStyle = p.accent;
  ctx.fill();
  ctx.restore();
}

function drawWaveBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number,
  t: number,
  p: Palette,
  seed = 1,
) {
  const bars = Math.max(24, Math.round(w / 8));
  const bw = w / bars;
  for (let i = 0; i < bars; i++) {
    const n =
      Math.abs(Math.sin(i * 12.9898 * seed) * 43758.5453) % 1; // static shape
    const live = 0.55 + 0.45 * Math.abs(Math.sin(t * 5 + i * 0.5));
    const played = i / bars <= progress;
    const bh = h * (0.25 + n * 0.75) * (played ? live : 0.55);
    ctx.fillStyle = played ? p.primary : hexA(p.muted, 0.35);
    ctx.fillRect(x + i * bw, y - bh / 2, Math.max(1, bw * 0.55), bh);
  }
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

const FONT = `"Inter", "Helvetica Neue", Arial, sans-serif`;

// -------------------- Engines --------------------

type RenderCtx = {
  t: number;
  w: number;
  h: number;
  aspect: AspectKey;
  palette: Palette;
  title: string;
  artist: string;
  coverImg: HTMLImageElement | null;
  lyrics: LyricLine[];
  duration: number;
};

/** Rolling lyric column shared by several engines. */
function drawLyricRoll(
  ctx: CanvasRenderingContext2D,
  r: RenderCtx,
  opts: {
    top: number;
    bottom: number;
    focusY: number;
    size: number;
    uppercase?: boolean;
    glow?: boolean;
    showRule?: boolean;
  },
) {
  const { t, w, palette: p, lyrics } = r;
  const { top, bottom, focusY, size } = opts;
  const gap = size * 1.85;
  const idx = findLineIndex(lyrics, t);
  const next = lyrics[idx + 1];
  const cur = lyrics[idx];
  let progress = 0;
  if (cur && next) {
    const span = Math.max(0.2, next.time - cur.time);
    progress = Math.max(0, Math.min(1, (t - cur.time) / span));
  }
  // Continuous scroll: the column keeps drifting but slows to a hold while the
  // sung line sits on the focus point, then accelerates into the next line.
  const hold = 0.5;
  const ramp = Math.max(0, Math.min(1, (progress - hold) / (1 - hold)));
  const offset = ramp * ramp * (3 - 2 * ramp) * 0.9 + progress * 0.1;



  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, w, bottom - top);
  ctx.clip();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < lyrics.length; i++) {
    const y = focusY + (i - idx - offset) * gap;
    if (y < top - gap || y > bottom + gap) continue;
    const dist = Math.abs(y - focusY);
    const norm = Math.min(1, dist / ((bottom - top) * 0.55));
    const active = i === idx;
    // Alpha-based edge fade instead of painting opaque bars over the frame —
    // that used to make the lyric block read as a separate, darker panel.
    const edge =
      Math.max(0, Math.min(1, (y - top) / ((bottom - top) * 0.28))) *
      Math.max(0, Math.min(1, (bottom - y) / ((bottom - top) * 0.28)));
    const alpha = (active ? 1 : Math.max(0.05, Math.pow(1 - norm, 1.9) * 0.7)) * edge;
    const fs = active ? size * 1.18 : size * (1 - norm * 0.12);
    ctx.globalAlpha = alpha;

    ctx.font = `${active ? 700 : 500} ${Math.round(fs)}px ${FONT}`;
    ctx.fillStyle = active ? p.text : hexA(p.text, 0.85);
    if (opts.glow && active) {
      ctx.shadowColor = hexA(p.primary, 0.8);
      ctx.shadowBlur = size * 0.6;
    }
    const text = opts.uppercase ? lyrics[i].text.toUpperCase() : lyrics[i].text;
    const wrapped = wrapText(ctx, text, w * 0.86);
    let yy = y - ((wrapped.length - 1) * fs * 1.1) / 2;
    for (const line of wrapped) {
      ctx.fillText(line, w / 2, yy);
      yy += fs * 1.1;
    }
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // focus rule (thin gold lines either side, like the reference)
  if (opts.showRule && cur) {
    const y = focusY;
    const inner = w * 0.34;
    const outer = w * 0.47;
    for (const dir of [-1, 1]) {
      const g = ctx.createLinearGradient(w / 2 + dir * inner, 0, w / 2 + dir * outer, 0);
      g.addColorStop(0, hexA(p.primary, 0.75));
      g.addColorStop(1, "transparent");
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1, r.h * 0.0012);
      ctx.beginPath();
      ctx.moveTo(w / 2 + dir * inner, y);
      ctx.lineTo(w / 2 + dir * outer, y);
      ctx.stroke();
    }
  }

  // No opaque fade bars — the per-line alpha above handles the roll-off so the
  // frame stays one continuous, evenly lit surface.

}

/** Measure a tracked (letter-spaced) string at the current font. */
function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  const chars = [...text];
  return (
    chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1)
  );
}

/** Shrink until the tracked string fits maxW, then draw it centred. */
function trackedFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  weight: number,
  size: number,
  spacingRatio: number,
) {
  let s = size;
  for (let i = 0; i < 24; i++) {
    ctx.font = `${weight} ${Math.round(s)}px ${FONT}`;
    if (trackedWidth(ctx, text, s * spacingRatio) <= maxW || s <= 8) break;
    s *= 0.94;
  }
  tracked(ctx, text, x, y, s * spacingRatio);
  return s;
}

function drawHeader(ctx: CanvasRenderingContext2D, r: RenderCtx, y: number, big: number) {
  const { w, palette: p, title, artist } = r;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.primary;
  trackedFit(ctx, (title || "Untitled").toUpperCase(), w / 2, y, w * 0.84, 800, big, 0.06);
  ctx.fillStyle = hexA(p.text, 0.8);
  trackedFit(
    ctx,
    (artist || "Unknown artist").toUpperCase(),
    w / 2,
    y + big * 0.72,
    w * 0.7,
    500,
    big * 0.36,
    0.3,
  );

  // divider with dot
  const dy = y + big * 1.15;
  const half = w * 0.22;
  for (const dir of [-1, 1]) {
    const g = ctx.createLinearGradient(w / 2, 0, w / 2 + dir * half, 0);
    g.addColorStop(0, hexA(p.primary, 0.7));
    g.addColorStop(1, "transparent");
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1, r.h * 0.001);
    ctx.beginPath();
    ctx.moveTo(w / 2 + dir * w * 0.02, dy);
    ctx.lineTo(w / 2 + dir * half, dy);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(w / 2, dy, Math.max(2, r.h * 0.0022), 0, Math.PI * 2);
  ctx.fillStyle = p.primary;
  ctx.fill();
}

function drawFooterBar(ctx: CanvasRenderingContext2D, r: RenderCtx, y: number) {
  const { w, h, t, duration, palette: p } = r;
  const prog = duration > 0 ? Math.min(1, t / duration) : 0;
  const barW = w * 0.66;
  const x = (w - barW) / 2;
  drawWaveBar(ctx, x, y, barW, h * 0.022, prog, t, p);
  // playhead
  ctx.beginPath();
  ctx.arc(x + barW * prog, y, Math.max(3, h * 0.0045), 0, Math.PI * 2);
  ctx.fillStyle = p.accent;
  ctx.fill();
  ctx.font = `500 ${Math.round(h * 0.0135)}px ${FONT}`;
  ctx.fillStyle = hexA(p.muted, 0.95);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(fmtTime(t), x - w * 0.02, y);
  ctx.textAlign = "left";
  ctx.fillText(fmtTime(duration), x + barW + w * 0.02, y);
  ctx.textAlign = "center";
}

function renderVinyl(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, coverImg, duration, aspect } = r;
  drawBg(ctx, w, h, p, t);
  const vertical = aspect === "9:16";

  if (vertical) {
    drawHeader(ctx, r, h * 0.055, h * 0.038);
    // Disc sits fully between the header rule and the lyric column so nothing
    // overlaps: ring outer edge stays above the roll's top boundary.
    const vr = w * 0.25;
    const vy = h * 0.3;
    drawVinyl(ctx, w / 2, vy, vr, t, coverImg, p);
    drawProgressRing(ctx, w / 2, vy, vr * 1.16, duration > 0 ? t / duration : 0, p);
    drawLyricRoll(ctx, r, {
      top: h * 0.48,
      bottom: h * 0.93,
      focusY: h * 0.685,
      size: h * 0.028,
      showRule: true,
    });
    drawFooterBar(ctx, r, h * 0.955);
  } else {
    // side-by-side layout for 16:9
    const vr = h * 0.25;
    const vx = w * 0.19;
    const vy = h * 0.5;
    drawVinyl(ctx, vx, vy, vr, t, coverImg, p);
    drawProgressRing(ctx, vx, vy, vr * 1.16, duration > 0 ? t / duration : 0, p);

    ctx.save();
    ctx.translate(w * 0.36, 0);
    const sub: RenderCtx = { ...r, w: w * 0.62 };
    drawHeader(ctx, sub, h * 0.14, h * 0.06);
    drawLyricRoll(ctx, sub, {
      top: h * 0.28,
      bottom: h * 0.9,
      focusY: h * 0.6,
      size: h * 0.042,
      showRule: true,
    });
    ctx.restore();
    drawFooterBar(ctx, r, h * 0.94);
  }
}

function renderRolling(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p } = r;
  drawBg(ctx, w, h, p, t);
  drawHeader(ctx, r, h * 0.07, h * 0.032);
  drawLyricRoll(ctx, r, {
    top: h * 0.16,
    bottom: h * 0.93,
    focusY: h * 0.55,
    size: h * (r.aspect === "9:16" ? 0.034 : 0.05),
  });
  drawFooterBar(ctx, r, h * 0.96);
}

function renderKaraoke(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, lyrics, title, artist } = r;
  drawBg(ctx, w, h, p, t);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = hexA(p.muted, 0.9);
  ctx.font = `500 ${Math.round(h * 0.02)}px ${FONT}`;
  tracked(ctx, `${title || ""}${artist ? "  ·  " + artist : ""}`.toUpperCase(), w / 2, h * 0.09, h * 0.006);

  const idx = findLineIndex(lyrics, t);
  const cur = idx >= 0 ? lyrics[idx] : undefined;
  const nxt = lyrics[idx + 1];
  const size = Math.round(h * 0.072);
  ctx.font = `900 ${size}px ${FONT}`;
  const words = (cur?.text ?? "").split(" ").filter(Boolean);
  const lineEnd = cur?.end ?? nxt?.time ?? (cur ? cur.time + 3 : 0);
  const span = Math.max(0.3, lineEnd - (cur?.time ?? 0));
  const frac = cur ? Math.max(0, Math.min(1, (t - cur.time) / span)) : 0;
  const spoken = Math.floor(frac * words.length);

  // wrap while keeping word indices
  const rows: string[][] = [];
  let row: string[] = [];
  for (const word of words) {
    const test = [...row, word].join(" ");
    if (ctx.measureText(test).width > w * 0.86 && row.length) {
      rows.push(row);
      row = [word];
    } else row.push(word);
  }
  if (row.length) rows.push(row);

  let y = h / 2 - ((rows.length - 1) * size * 1.18) / 2;
  let wi = 0;
  for (const rowWords of rows) {
    const widths = rowWords.map((word) => ctx.measureText(word + " ").width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = w / 2 - total / 2;
    ctx.textAlign = "left";
    rowWords.forEach((word, i) => {
      const done = wi <= spoken;
      ctx.fillStyle = done ? p.accent : hexA(p.text, 0.35);
      if (done) {
        ctx.shadowColor = hexA(p.primary, 0.6);
        ctx.shadowBlur = size * 0.35;
      }
      ctx.fillText(word, x, y);
      ctx.shadowBlur = 0;
      x += widths[i];
      wi++;
    });
    ctx.textAlign = "center";
    y += size * 1.18;
  }

  if (nxt) {
    ctx.font = `600 ${Math.round(h * 0.03)}px ${FONT}`;
    ctx.fillStyle = hexA(p.text, 0.4);
    ctx.fillText(nxt.text, w / 2, y + h * 0.04);
  }
  drawFooterBar(ctx, r, h * 0.93);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rr: number) {
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function renderSpotify(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, coverImg, title, artist, lyrics, duration } = r;
  drawBg(ctx, w, h, p, t);
  const cardSize = Math.min(w, h) * (r.aspect === "16:9" ? 0.42 : 0.56);
  const cx = w / 2;
  const cy = h * (r.aspect === "16:9" ? 0.36 : 0.3);
  const x0 = cx - cardSize / 2;
  const y0 = cy - cardSize / 2;
  const bob = Math.sin(t * 1.2) * cardSize * 0.008;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = cardSize * 0.18;
  ctx.shadowOffsetY = cardSize * 0.05;
  ctx.fillStyle = "#111";
  roundRect(ctx, x0, y0 + bob, cardSize, cardSize, cardSize * 0.06);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x0, y0 + bob, cardSize, cardSize, cardSize * 0.06);
  ctx.clip();
  if (coverImg) {
    const iw = coverImg.naturalWidth;
    const ih = coverImg.naturalHeight;
    const ratio = Math.max(cardSize / iw, cardSize / ih);
    ctx.drawImage(coverImg, x0 + (cardSize - iw * ratio) / 2, y0 + bob + (cardSize - ih * ratio) / 2, iw * ratio, ih * ratio);
  } else {
    const g = ctx.createLinearGradient(x0, y0, x0 + cardSize, y0 + cardSize);
    g.addColorStop(0, p.primary);
    g.addColorStop(1, p.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0 + bob, cardSize, cardSize);
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.text;
  ctx.font = `800 ${Math.round(h * 0.034)}px ${FONT}`;
  ctx.fillText(title || "Untitled", cx, cy + cardSize / 2 + h * 0.055);
  ctx.fillStyle = hexA(p.muted, 1);
  ctx.font = `500 ${Math.round(h * 0.022)}px ${FONT}`;
  ctx.fillText(artist || "Unknown artist", cx, cy + cardSize / 2 + h * 0.095);

  const idx = findLineIndex(lyrics, t);
  const cur = idx >= 0 ? lyrics[idx].text : "";
  ctx.fillStyle = p.accent;
  ctx.font = `900 ${Math.round(h * 0.048)}px ${FONT}`;
  const lyr = wrapText(ctx, cur, w * 0.82);
  let ly = h * 0.78 - ((lyr.length - 1) * h * 0.058) / 2;
  for (const l of lyr) {
    ctx.fillText(l, w / 2, ly);
    ly += h * 0.058;
  }

  const barY = h * 0.9;
  const barW = w * 0.76;
  const barX = (w - barW) / 2;
  const prog = duration > 0 ? Math.min(1, t / duration) : 0;
  ctx.fillStyle = hexA(p.text, 0.18);
  roundRect(ctx, barX, barY, barW, h * 0.005, h * 0.003);
  ctx.fill();
  ctx.fillStyle = p.primary;
  roundRect(ctx, barX, barY, barW * prog, h * 0.005, h * 0.003);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(barX + barW * prog, barY + h * 0.0025, h * 0.006, 0, Math.PI * 2);
  ctx.fillStyle = p.text;
  ctx.fill();
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${Math.round(h * 0.014)}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(fmtTime(t), barX, barY + h * 0.028);
  ctx.textAlign = "right";
  ctx.fillText(fmtTime(duration), barX + barW, barY + h * 0.028);
}

function renderNeon(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p } = r;
  drawBg(ctx, w, h, p, t);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, w, h);
  drawHeader(ctx, r, h * 0.08, h * 0.03);
  drawLyricRoll(ctx, r, {
    top: h * 0.2,
    bottom: h * 0.92,
    focusY: h * 0.54,
    size: h * (r.aspect === "9:16" ? 0.038 : 0.055),
    uppercase: true,
    glow: true,
  });
  drawFooterBar(ctx, r, h * 0.955);
}

function renderWaveform(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, lyrics, title, artist, duration } = r;
  drawBg(ctx, w, h, p, t);
  const bars = 48;
  const barW = (w * 0.9) / bars;
  const baseY = h * 0.82;
  for (let i = 0; i < bars; i++) {
    const phase = i * 0.4 + t * 6;
    const hgt = (Math.abs(Math.sin(phase)) * 0.6 + Math.abs(Math.sin(phase * 1.7)) * 0.4) * h * 0.2;
    const x = w * 0.05 + i * barW;
    const g = ctx.createLinearGradient(0, baseY - hgt, 0, baseY);
    g.addColorStop(0, p.accent);
    g.addColorStop(1, hexA(p.primary, 0.25));
    ctx.fillStyle = g;
    roundRect(ctx, x + barW * 0.15, baseY - hgt, barW * 0.7, hgt, barW * 0.3);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    roundRect(ctx, x + barW * 0.15, baseY, barW * 0.7, hgt * 0.4, barW * 0.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = hexA(p.muted, 1);
  ctx.font = `500 ${Math.round(h * 0.022)}px ${FONT}`;
  tracked(ctx, `${title || ""}${artist ? "  ·  " + artist : ""}`.toUpperCase(), w / 2, h * 0.1, h * 0.006);

  const idx = findLineIndex(lyrics, t);
  const cur = idx >= 0 ? lyrics[idx] : undefined;
  const pop = cur ? easeOutCubic(Math.min(1, (t - cur.time) / 0.35)) : 1;
  ctx.save();
  ctx.translate(w / 2, h * 0.45);
  ctx.scale(0.94 + pop * 0.06, 0.94 + pop * 0.06);
  ctx.fillStyle = p.accent;
  ctx.font = `900 ${Math.round(h * 0.075)}px ${FONT}`;
  const lyr = wrapText(ctx, (cur?.text ?? "").toUpperCase(), w * 0.85);
  let y = -((lyr.length - 1) * h * 0.09) / 2;
  for (const l of lyr) {
    ctx.fillText(l, 0, y);
    y += h * 0.09;
  }
  ctx.restore();
  const prog = duration > 0 ? t / duration : 0;
  ctx.fillStyle = hexA(p.text, 0.15);
  ctx.fillRect(0, h - h * 0.006, w, h * 0.006);
  ctx.fillStyle = p.primary;
  ctx.fillRect(0, h - h * 0.006, w * prog, h * 0.006);
}

function renderTypewriter(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, lyrics } = r;
  drawBg(ctx, w, h, p, t);
  drawHeader(ctx, r, h * 0.09, h * 0.03);
  const idx = findLineIndex(lyrics, t);
  const cur = idx >= 0 ? lyrics[idx] : undefined;
  const nxt = lyrics[idx + 1];
  const size = Math.round(h * (r.aspect === "9:16" ? 0.045 : 0.06));
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const full = cur?.text ?? "";
  const lineEnd = cur?.end ?? nxt?.time ?? (cur ? cur.time + 2.5 : 0);
  const span = Math.max(0.4, (lineEnd - (cur?.time ?? 0)) * 0.65);
  const frac = cur ? Math.max(0, Math.min(1, (t - cur.time) / span)) : 0;
  const shown = full.slice(0, Math.round(full.length * frac));
  const rows = wrapText(ctx, shown, w * 0.78);
  let y = h * 0.5 - ((rows.length - 1) * size * 1.35) / 2;
  const x = w * 0.11;
  for (let i = 0; i < rows.length; i++) {
    ctx.fillStyle = p.text;
    ctx.fillText(rows[i], x, y);
    if (i === rows.length - 1 && Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = p.primary;
      ctx.fillRect(x + ctx.measureText(rows[i]).width + size * 0.12, y - size * 0.5, size * 0.08, size);
    }
    y += size * 1.35;
  }
  // previous line ghost
  if (idx > 0) {
    ctx.font = `500 ${Math.round(size * 0.5)}px ${FONT}`;
    ctx.fillStyle = hexA(p.muted, 0.6);
    ctx.fillText(lyrics[idx - 1].text, x, h * 0.28);
  }
  ctx.textAlign = "center";
  drawFooterBar(ctx, r, h * 0.94);
}

function renderCinebar(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, lyrics, title, artist, coverImg } = r;
  drawBg(ctx, w, h, p, t);
  // slow parallax cover as backdrop
  if (coverImg) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    const scale = 1.15 + Math.sin(t * 0.15) * 0.04;
    const iw = coverImg.naturalWidth;
    const ih = coverImg.naturalHeight;
    const ratio = Math.max(w / iw, h / ih) * scale;
    ctx.filter = "blur(14px)";
    ctx.drawImage(coverImg, (w - iw * ratio) / 2, (h - ih * ratio) / 2, iw * ratio, ih * ratio);
    ctx.filter = "none";
    ctx.restore();
  }
  const barH = h * 0.12;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, barH);
  ctx.fillRect(0, h - barH, w, barH);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = hexA(p.muted, 0.9);
  ctx.font = `500 ${Math.round(h * 0.018)}px ${FONT}`;
  tracked(ctx, `${title || ""}${artist ? "  ·  " + artist : ""}`.toUpperCase(), w / 2, barH * 0.5, h * 0.005);

  const idx = findLineIndex(lyrics, t);
  const cur = idx >= 0 ? lyrics[idx] : undefined;
  const appear = cur ? easeOutCubic(Math.min(1, (t - cur.time) / 0.4)) : 1;
  const size = Math.round(h * (r.aspect === "9:16" ? 0.04 : 0.052));
  ctx.font = `600 ${size}px ${FONT}`;
  const rows = wrapText(ctx, cur?.text ?? "", w * 0.8);
  let y = h * 0.78 - (rows.length - 1) * size * 1.25 + (1 - appear) * size * 0.5;
  ctx.globalAlpha = appear;
  for (const row of rows) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(row, w / 2 + 2, y + 2);
    ctx.fillStyle = p.text;
    ctx.fillText(row, w / 2, y);
    y += size * 1.25;
  }
  ctx.globalAlpha = 1;
}

// -------------------- Typography engines --------------------

const SERIF = `Georgia, "Times New Roman", serif`;
const MONO = `"JetBrains Mono", "SFMono-Regular", Menlo, monospace`;
const COND = `"Arial Narrow", "Helvetica Neue Condensed", Impact, sans-serif`;

function typoContext(r: RenderCtx) {
  const idx = findLineIndex(r.lyrics, r.t);
  const cur = idx >= 0 ? r.lyrics[idx] : undefined;
  const nxt = r.lyrics[idx + 1];
  const end = cur?.end ?? nxt?.time ?? (cur ? cur.time + 3 : 0);
  const span = Math.max(0.35, end - (cur?.time ?? 0));
  const frac = cur ? Math.max(0, Math.min(1, (r.t - cur.time) / span)) : 0;
  const appear = easeOutCubic(Math.min(1, (r.t - (cur?.time ?? 0)) / 0.32));
  return { idx, cur, nxt, frac, appear, text: cur?.text ?? "" };
}

function typoFooter(ctx: CanvasRenderingContext2D, r: RenderCtx, font: string) {
  const { w, h, palette: p, title, artist, duration, t } = r;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.round(h * 0.016)}px ${font}`;
  ctx.fillStyle = hexA(p.muted, 0.9);
  tracked(ctx, `${title || "Untitled"}${artist ? "  ·  " + artist : ""}`.toUpperCase(), w / 2, h * 0.955, h * 0.005);
  ctx.restore();
  const prog = duration > 0 ? Math.min(1, t / duration) : 0;
  ctx.fillStyle = hexA(p.text, 0.12);
  ctx.fillRect(w * 0.1, h * 0.98, w * 0.8, Math.max(2, h * 0.002));
  ctx.fillStyle = p.primary;
  ctx.fillRect(w * 0.1, h * 0.98, w * 0.8 * prog, Math.max(2, h * 0.002));
}

/** Safe area every typography engine draws inside. */
function safeBox(r: RenderCtx) {
  const { w, h } = r;
  return { x: w * 0.08, y: h * 0.2, w: w * 0.84, h: h * 0.55 };
}

function renderTypoSerif(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p } = r;
  drawBg(ctx, w, h, p, r.t);
  const { text, appear } = typoContext(r);
  const box = safeBox(r);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const { rows, size } = layoutText(ctx, text, {
    maxW: box.w,
    maxH: box.h,
    start: h * (r.aspect === "9:16" ? 0.056 : 0.075),
    weight: 400,
    family: SERIF,
    lineH: 1.3,
  });
  ctx.font = `400 ${size}px ${SERIF}`;
  let y = h * 0.48 - ((rows.length - 1) * size * 1.3) / 2;
  ctx.globalAlpha = appear;
  for (const row of rows) {
    ctx.fillStyle = p.text;
    ctx.fillText(row, w / 2, y + (1 - appear) * size * 0.25);
    y += size * 1.3;
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = hexA(p.primary, 0.7);
  ctx.lineWidth = Math.max(1, h * 0.0014);
  ctx.beginPath();
  ctx.moveTo(w / 2 - w * 0.08, y + size * 0.15);
  ctx.lineTo(w / 2 + w * 0.08, y + size * 0.15);
  ctx.stroke();
  ctx.restore();
  typoFooter(ctx, r, SERIF);
}

function renderTypoStack(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p } = r;
  drawBg(ctx, w, h, p, r.t);
  const { text, frac, appear } = typoContext(r);
  const words = text.split(" ").filter(Boolean).slice(0, 5);
  const box = safeBox(r);
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  // Fit both the widest word and the total stack height.
  let size = Math.round(h * (r.aspect === "9:16" ? 0.085 : 0.11));
  for (let i = 0; i < 40; i++) {
    ctx.font = `900 ${size}px ${FONT}`;
    const widest = Math.max(1, ...words.map((x) => ctx.measureText(x.toUpperCase()).width));
    if (widest <= box.w * 0.92 && words.length * size * 1.05 <= box.h * 1.25) break;
    size = Math.round(size * 0.93);
  }
  let y = h * 0.5 - (words.length * size * 1.05) / 2 + size * 0.5;
  words.forEach((word, i) => {
    const lit = frac >= i / Math.max(1, words.length);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.globalAlpha = appear;
    ctx.fillStyle = lit ? p.text : hexA(p.text, 0.22);
    ctx.fillText(word.toUpperCase(), box.x + w * 0.04, y);
    if (lit) {
      ctx.fillStyle = p.primary;
      ctx.fillRect(box.x, y - size * 0.32, Math.max(3, w * 0.006), size * 0.64);
    }
    y += size * 1.05;
  });
  ctx.restore();
  typoFooter(ctx, r, FONT);
}

function renderTypoMarquee(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p } = r;
  drawBg(ctx, w, h, p, r.t);
  const { text } = typoContext(r);
  let size = Math.round(h * (r.aspect === "9:16" ? 0.085 : 0.115));
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const label = `${text.toUpperCase()}   ✦   `;
  // Keep one repetition readable rather than letting glyphs run off-frame.
  for (let i = 0; i < 30; i++) {
    ctx.font = `900 ${size}px ${COND}`;
    if (ctx.measureText(label).width <= w * 1.6) break;
    size = Math.round(size * 0.93);
  }
  ctx.font = `900 ${size}px ${COND}`;
  const tw = Math.max(1, ctx.measureText(label).width);
  const shift = (r.t * w * 0.09) % tw;
  ctx.fillStyle = hexA(p.text, 0.95);
  for (let x = -shift; x < w; x += tw) ctx.fillText(label, x, h * 0.5);
  ctx.restore();
  ctx.fillStyle = hexA(p.primary, 0.55);
  ctx.fillRect(0, h * 0.5 - size * 0.78, w, Math.max(2, h * 0.002));
  ctx.fillRect(0, h * 0.5 + size * 0.78, w, Math.max(2, h * 0.002));
  typoFooter(ctx, r, COND);
}

function renderTypoGradient(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p } = r;
  drawBg(ctx, w, h, p, r.t);
  const { text, appear } = typoContext(r);
  const box = safeBox(r);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const { rows, size } = layoutText(ctx, text.toUpperCase(), {
    maxW: box.w,
    maxH: box.h,
    start: h * (r.aspect === "9:16" ? 0.08 : 0.105),
    weight: 900,
    family: FONT,
    lineH: 1.1,
  });
  ctx.font = `900 ${size}px ${FONT}`;
  let y = h * 0.5 - ((rows.length - 1) * size * 1.1) / 2;
  const g = ctx.createLinearGradient(0, y - size, 0, y + rows.length * size * 1.1);
  g.addColorStop(0, p.accent);
  g.addColorStop(1, p.primary);
  ctx.globalAlpha = appear;
  for (const row of rows) {
    ctx.fillStyle = g;
    ctx.fillText(row, w / 2, y);
    y += size * 1.1;
  }
  ctx.restore();
  typoFooter(ctx, r, FONT);
}

function renderTypoOutline(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p } = r;
  drawBg(ctx, w, h, p, r.t);
  const { text, frac } = typoContext(r);
  const box = safeBox(r);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const { rows, size } = layoutText(ctx, text.toUpperCase(), {
    maxW: box.w,
    maxH: box.h,
    start: h * (r.aspect === "9:16" ? 0.08 : 0.105),
    weight: 900,
    family: FONT,
    lineH: 1.12,
  });
  ctx.font = `900 ${size}px ${FONT}`;
  let y = h * 0.5 - ((rows.length - 1) * size * 1.12) / 2;
  for (const row of rows) {
    const rw = ctx.measureText(row).width;
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.strokeStyle = hexA(p.text, 0.85);
    ctx.strokeText(row, w / 2, y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - rw / 2, y - size * 0.7, rw * frac, size * 1.4);
    ctx.clip();
    ctx.fillStyle = p.primary;
    ctx.fillText(row, w / 2, y);
    ctx.restore();
    y += size * 1.12;
  }
  ctx.restore();
  typoFooter(ctx, r, FONT);
}

function renderTypoJustify(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p } = r;
  drawBg(ctx, w, h, p, r.t);
  const { text, appear } = typoContext(r);
  const words = text.split(" ").filter(Boolean);
  const box = safeBox(r);
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  let size = Math.round(h * (r.aspect === "9:16" ? 0.062 : 0.08));
  let rows: string[][] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    ctx.font = `800 ${size}px ${FONT}`;
    rows = [];
    let row: string[] = [];
    for (const word of words) {
      const test = [...row, word].join(" ").toUpperCase();
      if (ctx.measureText(test).width > box.w && row.length) {
        rows.push(row);
        row = [word];
      } else row.push(word);
    }
    if (row.length) rows.push(row);
    const widest = Math.max(0, ...rows.map((rw) => ctx.measureText(rw.join(" ").toUpperCase()).width));
    if (rows.length * size * 1.2 <= box.h && widest <= box.w) break;
    size = Math.round(size * 0.93);
  }
  let y = h * 0.5 - ((rows.length - 1) * size * 1.2) / 2;
  ctx.globalAlpha = appear;
  rows.forEach((rw, ri) => {
    const widths = rw.map((x) => ctx.measureText(x.toUpperCase()).width);
    const sum = widths.reduce((a, b) => a + b, 0);
    const gapW = rw.length > 1 && ri < rows.length - 1 ? (box.w - sum) / (rw.length - 1) : size * 0.3;
    let x = box.x;
    rw.forEach((word, i) => {
      ctx.fillStyle = ri % 2 ? p.primary : p.text;
      ctx.fillText(word.toUpperCase(), x, y);
      x += widths[i] + gapW;
    });
    y += size * 1.2;
  });
  ctx.restore();
  typoFooter(ctx, r, FONT);
}

function renderTypoMono(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p } = r;
  drawBg(ctx, w, h, p, r.t);
  const { idx, text, frac } = typoContext(r);
  const box = safeBox(r);
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const shown = text.slice(0, Math.ceil(text.length * Math.min(1, frac * 1.6)));
  const { rows, size } = layoutText(ctx, shown || " ", {
    maxW: box.w,
    maxH: box.h,
    start: h * (r.aspect === "9:16" ? 0.034 : 0.044),
    weight: 500,
    family: MONO,
    lineH: 1.5,
  });
  ctx.font = `500 ${size}px ${MONO}`;
  let y = h * 0.5 - ((rows.length - 1) * size * 1.5) / 2;
  ctx.fillStyle = hexA(p.primary, 0.75);
  ctx.fillText(`> line ${String(idx + 1).padStart(2, "0")}`, box.x, y - size * 2.1);
  let lastY = y;
  for (const row of rows) {
    ctx.fillStyle = p.text;
    ctx.fillText(row, box.x, y);
    lastY = y;
    y += size * 1.5;
  }
  if (Math.floor(r.t * 2) % 2 === 0) {
    const lastRow = rows[rows.length - 1] ?? "";
    ctx.fillStyle = p.primary;
    ctx.fillRect(box.x + ctx.measureText(lastRow).width + size * 0.2, lastY + size * 0.42, size * 0.5, size * 0.1);
  }
  ctx.restore();
  typoFooter(ctx, r, MONO);
}

function renderTypoVertical(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p } = r;
  drawBg(ctx, w, h, p, r.t);
  const { text, appear } = typoContext(r);
  const chars = [...text.toUpperCase()].slice(0, 14);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = Math.round(
    Math.min((h * 0.72) / Math.max(6, chars.length), h * 0.085, w * 0.2),
  );
  let y = h * 0.48 - (chars.length - 1) * size * 0.5;
  chars.forEach((c, i) => {
    ctx.globalAlpha = appear * (0.55 + 0.45 * Math.abs(Math.sin(r.t * 2 + i * 0.4)));
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.fillStyle = i % 2 ? p.primary : p.text;
    ctx.fillText(c === " " ? "·" : c, w / 2, y);
    y += size;
  });
  ctx.restore();
  typoFooter(ctx, r, FONT);
}

function fitTextLocal(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number) {
  let s = Math.round(start);
  ctx.font = `900 ${s}px ${COND}`;
  while (ctx.measureText(text).width > maxW && s > 14) {
    s -= 2;
    ctx.font = `900 ${s}px ${COND}`;
  }
  return s;
}

function renderTypoPoster(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p } = r;
  drawBg(ctx, w, h, p, r.t);
  const { text, appear } = typoContext(r);
  const box = safeBox(r);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const rows = text.toUpperCase().split(" ").reduce<string[]>((acc, word) => {
    if (!acc.length) return [word];
    const last = acc[acc.length - 1];
    if ((last + " " + word).length <= 12) acc[acc.length - 1] = last + " " + word;
    else acc.push(word);
    return acc;
  }, []);
  const start = Math.min(
    h * (r.aspect === "9:16" ? 0.12 : 0.15),
    (box.h * 1.3) / Math.max(1, rows.length),
  );
  // Every row gets its own fitted size, then rows share the smallest for rhythm.
  const sizes = rows.map((row) => fitTextLocal(ctx, row, box.w, start));
  const size = Math.min(...(sizes.length ? sizes : [start]));
  let y = h * 0.48 - ((rows.length - 1) * size * 0.98) / 2;
  ctx.globalAlpha = appear;
  rows.forEach((row, i) => {
    ctx.font = `900 ${size}px ${COND}`;
    ctx.fillStyle = i % 2 ? p.primary : p.text;
    ctx.fillText(row, w / 2, y);
    y += size * 0.98;
  });
  ctx.restore();
  typoFooter(ctx, r, COND);
}

function renderTypoTicker(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, palette: p, lyrics } = r;
  drawBg(ctx, w, h, p, r.t);
  const { idx, appear } = typoContext(r);
  ctx.save();
  ctx.textBaseline = "middle";
  const size = Math.round(h * (r.aspect === "9:16" ? 0.042 : 0.055));
  const maxW = w * 0.84;
  for (let i = Math.max(0, idx - 2); i <= Math.min(lyrics.length - 1, idx + 2); i++) {
    const off = i - idx;
    const y = h * 0.5 + off * size * 1.9;
    const active = off === 0;
    ctx.globalAlpha = active ? appear : 0.25;
    // Shrink any line that would otherwise run past the safe area.
    let s = Math.round(active ? size * 1.15 : size);
    const label = lyrics[i].text.toUpperCase();
    for (let k = 0; k < 30; k++) {
      ctx.font = `${active ? 900 : 500} ${s}px ${FONT}`;
      if (ctx.measureText(label).width <= maxW || s <= 12) break;
      s = Math.round(s * 0.93);
    }
    ctx.textAlign = i % 2 ? "right" : "left";
    ctx.fillStyle = active ? p.text : hexA(p.text, 0.8);
    ctx.fillText(label, i % 2 ? w * 0.92 : w * 0.08, y);
    if (active) {
      ctx.fillStyle = p.primary;
      ctx.fillRect(i % 2 ? w * 0.89 : w * 0.08, y + s * 0.8, w * 0.03, Math.max(2, h * 0.003));
    }
  }
  ctx.restore();
  typoFooter(ctx, r, FONT);
}

function renderEngine(ctx: CanvasRenderingContext2D, engine: EngineId, r: RenderCtx) {
  BG_SEED = hashSeed(engine);
  switch (engine) {
    case "vinyl":
      return renderVinyl(ctx, r);
    case "rolling":
      return renderRolling(ctx, r);
    case "karaoke":
      return renderKaraoke(ctx, r);
    case "spotify":
      return renderSpotify(ctx, r);
    case "neon":
      return renderNeon(ctx, r);
    case "waveform":
      return renderWaveform(ctx, r);
    case "typewriter":
      return renderTypewriter(ctx, r);
    case "cinebar":
      return renderCinebar(ctx, r);
    case "typo-serif":
      return renderTypoSerif(ctx, r);
    case "typo-stack":
      return renderTypoStack(ctx, r);
    case "typo-marquee":
      return renderTypoMarquee(ctx, r);
    case "typo-gradient":
      return renderTypoGradient(ctx, r);
    case "typo-outline":
      return renderTypoOutline(ctx, r);
    case "typo-justify":
      return renderTypoJustify(ctx, r);
    case "typo-mono":
      return renderTypoMono(ctx, r);
    case "typo-vertical":
      return renderTypoVertical(ctx, r);
    case "typo-poster":
      return renderTypoPoster(ctx, r);
    case "typo-ticker":
      return renderTypoTicker(ctx, r);
  }

}

// -------------------- Component --------------------

function LyricalVideosPage() {
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [engineFilter, setEngineFilter] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverImg, setCoverImg] = useState<HTMLImageElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [lyricsText, setLyricsText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [sttProvider, setSttProvider] = useState<SttProvider>("auto");

  const [lineLen, setLineLen] = useState(7);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);

  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, id: "none" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, id: "none" });


  const dims = ASPECTS[aspect];
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  const parsedLyrics = useMemo(
    () => parseLyrics(lyricsText, audioDuration),
    [lyricsText, audioDuration],
  );

  const onCover = (f: File) => {
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    const url = URL.createObjectURL(f);
    setCoverUrl(url);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setCoverImg(img);
    img.src = url;
  };
  const clearCover = () => {
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    setCoverUrl(null);
    setCoverImg(null);
  };

  const onAudio = (f: File) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(f);
    setAudioUrl(url);
    setAudioFile(f);
    setAudioName(f.name);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    const a = new Audio(url);
    a.addEventListener("loadedmetadata", () => {
      setAudioDuration(isFinite(a.duration) ? a.duration : 0);
    });
    a.addEventListener("ended", () => {
      setPlaying(false);
      pausedAtRef.current = 0;
      timeRef.current = 0;
      setCurrentTime(0);
    });
    audioRef.current = a;
  };
  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioFile(null);
    setAudioName(null);
    setAudioDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const detectLyrics = async () => {
    if (!audioFile) {
      toast("Upload the song first");
      return;
    }
    setDetecting(true);
    try {
      const { words, text, provider } = await transcribeFile(audioFile, {
        provider: sttProvider,
      });

      if (words.length) {
        const lines = wordsToLines(words, { maxWords: lineLen, maxChars: lineLen * 7 });
        setLyricsText(linesToLrc(lines));
        toast.success(`Detected ${lines.length} timed lyric lines`);
      } else if (text.trim()) {
        setLyricsText(text.replace(/([.!?])\s+/g, "$1\n"));
        toast(`Transcribed with ${provider} — no word timings, lines spread evenly`);
      } else {
        toast.error("No vocals detected in that track");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lyric detection failed");
    } finally {
      setDetecting(false);
    }
  };

  const introSec = intro.id !== "none" ? intro.seconds : 0;
  const outroSec = outro.id !== "none" ? outro.seconds : 0;
  /** Intro and outro cards extend the timeline instead of covering the song. */
  const totalDuration = introSec + audioDuration + outroSec;

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const songT = Math.max(0, Math.min(audioDuration || 0, t - introSec));
      renderEngine(ctx, template.engine, {
        t: songT,
        w,
        h,
        aspect,
        palette: template.palette,
        title,
        artist,
        coverImg,
        lyrics: parsedLyrics,
        duration: audioDuration,
      });
      if (introSec > 0 && t < introSec) {
        INTRO_ANIMATIONS.find((a) => a.id === intro.id)?.draw({
          ctx,
          w,
          h,
          p: Math.min(1, t / Math.max(0.2, introSec)),
          palette: paletteOf(intro.paletteId),
          title: intro.title || title,
          subtitle: intro.subtitle || artist,
          logo: null,
        });
      }
      if (outroSec > 0 && t >= introSec + audioDuration) {
        OUTRO_ANIMATIONS.find((a) => a.id === outro.id)?.draw({
          ctx,
          w,
          h,
          p: Math.min(1, (t - introSec - audioDuration) / Math.max(0.2, outroSec)),
          palette: paletteOf(outro.paletteId),
          title: outro.title,
          subtitle: outro.subtitle,
          logo: null,
        });
      }
    },
    [
      aspect,
      template,
      title,
      artist,
      coverImg,
      parsedLyrics,
      audioDuration,
      intro,
      outro,
      introSec,
      outroSec,
    ],
  );

  const drawAt = useCallback(
    (canvas: HTMLCanvasElement, t: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      paint(ctx, canvas.width, canvas.height, t);
    },
    [paint],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dims.w;
    canvas.height = dims.h;
    drawAt(canvas, timeRef.current);
  }, [dims.w, dims.h, drawAt]);

  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frames = 0;
    const tick = () => {
      const audio = audioRef.current;
      const t = performance.now() / 1000 - startedAtRef.current;
      timeRef.current = t;
      // Audio only starts once the intro card has played out.
      if (audio) {
        if (t >= introSec && t < introSec + audioDuration) {
          if (audio.paused) {
            audio.currentTime = Math.max(0, t - introSec);
            audio.play().catch(() => {});
          }
        } else if (!audio.paused) {
          audio.pause();
        }
      }
      if (frames++ % 6 === 0) setCurrentTime(t);
      drawAt(canvas, t);
      if (totalDuration > 0 && t >= totalDuration) {
        if (audio) audio.pause();
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, audioDuration, totalDuration, introSec, drawAt]);

  const togglePlay = async () => {
    if (!audioRef.current) {
      toast("Upload an audio file first");
      return;
    }
    if (playing) {
      setPlaying(false);
      audioRef.current.pause();
      pausedAtRef.current = timeRef.current;
    } else {
      const startFrom = pausedAtRef.current || 0;
      startedAtRef.current = performance.now() / 1000 - startFrom;
      audioRef.current.currentTime = Math.max(0, startFrom - introSec);
      if (startFrom >= introSec) {
        try {
          await audioRef.current.play();
        } catch {
          toast.error("Couldn't start audio playback");
          return;
        }
      }
      setPlaying(true);
    }
  };

  const seek = (v: number) => {
    timeRef.current = v;
    pausedAtRef.current = v;
    setCurrentTime(v);
    startedAtRef.current = performance.now() / 1000 - v;
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, v - introSec);
    const canvas = canvasRef.current;
    if (canvas) drawAt(canvas, v);
  };

  const exportVideo = async () => {
    if (!audioUrl || audioDuration <= 0) {
      toast("Upload audio first");
      return;
    }
    if (!parsedLyrics.length) {
      toast("Add or auto-detect lyrics first");
      return;
    }
    setExporting(true);
    setExportProgress(0);
    try {
      const off = document.createElement("canvas");
      off.width = dims.w;
      off.height = dims.h;
      const octx = off.getContext("2d")!;
      const stream = off.captureStream(60);

      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      const dest = ac.createMediaStreamDestination();
      const ab = await (await fetch(audioUrl)).arrayBuffer();
      const buf = await ac.decodeAudioData(ab);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));

      const mime =
        [
          "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ].find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const rec = new MediaRecorder(stream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: 12_000_000,
        audioBitsPerSecond: 192_000,
      });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const doneP = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] || "video/webm" }));
      });

      let running = true;
      const t0 = performance.now();
      // Delay the song so the intro card gets its own real time at the head.
      src.start(ac.currentTime + introSec);
      rec.start(100);
      const frameLoop = () => {
        if (!running) return;
        const t = (performance.now() - t0) / 1000;
        setExportProgress(Math.min(100, (t / totalDuration) * 100));
        paint(octx, off.width, off.height, t);
        if (t >= totalDuration) {
          running = false;
          try {
            src.stop();
          } catch {
            /* noop */
          }
          setTimeout(() => rec.stop(), 200);
          return;
        }
        requestAnimationFrame(frameLoop);
      };
      requestAnimationFrame(frameLoop);

      const blob = await doneP;
      ac.close().catch(() => {});
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "lyrical").replace(/\s+/g, "-")}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast.success(`Exported ${ext.toUpperCase()} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const shownTemplates =
    engineFilter === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.engine === engineFilter);

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg">
          <Music4 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Lyrical Videos</h1>
          <p className="mt-1 text-muted-foreground">
            Rotating-vinyl lyric videos with auto-detected, word-accurate lyrics. {TEMPLATES.length}{" "}
            templates · exports 1080p at 60fps.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr_360px]">
        {/* Left: track + lyrics */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Track</CardTitle>
              <CardDescription>Song info shown on the video.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" />
              </div>
              <div>
                <Label>Artist</Label>
                <Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" />
              </div>
              <div>
                <Label>Cover art</Label>
                {coverUrl ? (
                  <div className="mt-1 flex items-center gap-2">
                    <img src={coverUrl} alt="Album cover preview" className="h-14 w-14 rounded object-cover" />
                    <Button variant="ghost" size="sm" onClick={clearCover}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                ) : (
                  <label className="mt-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
                    <ImagePlus className="mr-2 h-4 w-4" /> Upload cover
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && onCover(e.target.files[0])}
                    />
                  </label>
                )}
              </div>
              <div>
                <Label>Audio</Label>
                {audioUrl ? (
                  <div className="mt-1 flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="truncate">{audioName}</span>
                    <Button variant="ghost" size="sm" onClick={clearAudio}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="mt-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
                    <Upload className="mr-2 h-4 w-4" /> Upload MP3 / WAV
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && onAudio(e.target.files[0])}
                    />
                  </label>
                )}
                {audioDuration > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">{fmtTime(audioDuration)} duration</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lyrics</CardTitle>
              <CardDescription>
                Type them manually, paste LRC (<code className="rounded bg-muted px-1">[00:12.50] Line</code>
                ), or auto-detect them from the uploaded song with word-level timing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Detection model</Label>
                <Select
                  value={sttProvider}
                  onValueChange={(v) => setSttProvider(v as SttProvider)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STT_PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {STT_PROVIDERS.find((p) => p.id === sttProvider)?.note}
                </p>
              </div>
              <div className="flex items-center gap-2">

                <Button onClick={detectLyrics} disabled={detecting || !audioFile} className="flex-1">
                  {detecting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Listening to the track…
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-1 h-4 w-4" /> Auto-detect lyrics
                    </>
                  )}
                </Button>
              </div>
              <div>
                <Label className="text-xs">Words per line · {lineLen}</Label>
                <Slider
                  min={3}
                  max={12}
                  step={1}
                  value={[lineLen]}
                  onValueChange={(v) => setLineLen(v[0])}
                />
              </div>
              <Textarea
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                rows={12}
                placeholder={`[00:00.00] Intro line\n[00:04.20] Second line\n...`}
                className="font-mono text-sm"
              />
              {parsedLyrics.length > 0 && (
                <p className="text-xs text-muted-foreground">{parsedLyrics.length} lines parsed</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center: preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Preview</CardTitle>
                <CardDescription>
                  {dims.label} · {dims.w}×{dims.h} · 60fps
                </CardDescription>
              </div>
              <Tabs value={aspect} onValueChange={(v) => setAspect(v as AspectKey)}>
                <TabsList>
                  <TabsTrigger value="9:16">9:16</TabsTrigger>
                  <TabsTrigger value="16:9">16:9</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <div className="mx-auto flex justify-center rounded-xl bg-black p-2">
                <canvas
                  ref={canvasRef}
                  className="max-h-[70vh] w-auto rounded-lg"
                  style={{ aspectRatio: `${dims.w} / ${dims.h}`, maxWidth: "100%", height: "auto" }}
                />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Button size="icon" onClick={togglePlay} disabled={!audioUrl}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="w-16 text-xs text-muted-foreground">{fmtTime(currentTime)}</span>
                <Slider
                  min={0}
                  max={Math.max(totalDuration, 0.01)}
                  step={0.05}
                  value={[currentTime]}
                  onValueChange={(v) => seek(v[0])}
                  className="flex-1"
                />
                <span className="w-16 text-right text-xs text-muted-foreground">
                  {fmtTime(audioDuration)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Template: <span className="font-medium text-foreground">{template.name}</span>
                </div>
                <Button onClick={exportVideo} disabled={exporting || !audioUrl || !parsedLyrics.length}>
                  {exporting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Rendering…{" "}
                      {Math.round(exportProgress)}%
                    </>
                  ) : (
                    <>
                      <Download className="mr-1 h-4 w-4" /> Export 1080p · 60fps
                    </>
                  )}
                </Button>
              </div>
              {exporting && <Progress value={exportProgress} className="mt-2" />}
            </CardContent>
          </Card>
        </div>

        {/* Right: templates */}
        <div className="space-y-4">
          <IntroOutroCard
            intro={intro}
            outro={outro}
            onIntro={setIntro}
            onOutro={setOutro}
            ratio={dims.w / dims.h}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Templates</CardTitle>
              <CardDescription>{shownTemplates.length} looks · both aspect ratios.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <Label>Style</Label>
                <Select value={engineFilter} onValueChange={setEngineFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All styles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All styles</SelectItem>
                    {ENGINES.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ENGINES.find((e) => e.id === engineFilter)?.desc ?? "Mix of every lyric style."}
                </p>
              </div>
              <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
                {shownTemplates.map((t) => {
                  const active = t.id === templateId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTemplateId(t.id)}
                      className={`group rounded-lg border p-2 text-left transition ${
                        active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"
                      }`}
                    >
                      <div
                        className="mb-2 flex h-20 items-center justify-center rounded-md"
                        style={{
                          background: `radial-gradient(circle at 50% 35%, ${t.palette.bg[1]}, ${t.palette.bg[0]})`,
                        }}
                      >
                        {t.engine === "vinyl" || t.engine === "rolling" ? (
                          <Disc3 className="h-8 w-8" style={{ color: t.palette.primary }} />
                        ) : (
                          <Sparkles className="h-7 w-7" style={{ color: t.palette.accent }} />
                        )}
                      </div>
                      <div className="text-[11px] font-medium leading-tight">{t.name}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
