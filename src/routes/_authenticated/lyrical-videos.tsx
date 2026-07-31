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
import { transcribeFile, wordsToLines, linesToLrc } from "@/lib/transcribe";

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
  | "cinebar";

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

function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t: number) {
  ctx.fillStyle = p.bg[0];
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2 + Math.sin(t * 0.25) * w * 0.04;
  const cy = h * 0.35 + Math.cos(t * 0.2) * h * 0.03;
  const rad = Math.max(w, h) * 0.75;
  const rg = ctx.createRadialGradient(cx, cy, rad * 0.05, cx, cy, rad);
  rg.addColorStop(0, p.bg[1]);
  rg.addColorStop(0.55, hexA(p.primary, 0.06));
  rg.addColorStop(1, p.bg[0]);
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  // film grain-ish vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
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
    const alpha = active ? 1 : Math.max(0.06, Math.pow(1 - norm, 1.9) * 0.75);
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

  // fades
  const fade = (bottom - top) * 0.32;
  const g1 = ctx.createLinearGradient(0, top, 0, top + fade);
  g1.addColorStop(0, p.bg[0]);
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1;
  ctx.fillRect(0, top, w, fade);
  const g2 = ctx.createLinearGradient(0, bottom - fade, 0, bottom);
  g2.addColorStop(0, "transparent");
  g2.addColorStop(1, p.bg[0]);
  ctx.fillStyle = g2;
  ctx.fillRect(0, bottom - fade, w, fade);
}

function drawHeader(ctx: CanvasRenderingContext2D, r: RenderCtx, y: number, big: number) {
  const { w, palette: p, title, artist } = r;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.primary;
  ctx.font = `800 ${Math.round(big)}px ${FONT}`;
  tracked(ctx, (title || "Untitled").toUpperCase(), w / 2, y, big * 0.06);
  ctx.fillStyle = hexA(p.text, 0.8);
  ctx.font = `500 ${Math.round(big * 0.36)}px ${FONT}`;
  tracked(ctx, (artist || "Unknown artist").toUpperCase(), w / 2, y + big * 0.72, big * 0.3);
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
    drawHeader(ctx, r, h * 0.055, h * 0.042);
    const vr = w * 0.29;
    const vy = h * 0.28;
    drawVinyl(ctx, w / 2, vy, vr, t, coverImg, p);
    drawProgressRing(ctx, w / 2, vy, vr * 1.22, duration > 0 ? t / duration : 0, p);
    drawLyricRoll(ctx, r, {
      top: h * 0.42,
      bottom: h * 0.94,
      focusY: h * 0.66,
      size: h * 0.028,
      showRule: true,
    });
    drawFooterBar(ctx, r, h * 0.955);
  } else {
    // side-by-side layout for 16:9
    const vr = h * 0.3;
    const vx = w * 0.26;
    const vy = h * 0.52;
    drawVinyl(ctx, vx, vy, vr, t, coverImg, p);
    drawProgressRing(ctx, vx, vy, vr * 1.22, duration > 0 ? t / duration : 0, p);
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

function renderEngine(ctx: CanvasRenderingContext2D, engine: EngineId, r: RenderCtx) {
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
  const [lineLen, setLineLen] = useState(7);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);

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
      const { words, text, provider } = await transcribeFile(audioFile);
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

  const drawAt = useCallback(
    (canvas: HTMLCanvasElement, t: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderEngine(ctx, template.engine, {
        t,
        w: canvas.width,
        h: canvas.height,
        aspect,
        palette: template.palette,
        title,
        artist,
        coverImg,
        lyrics: parsedLyrics,
        duration: audioDuration,
      });
    },
    [aspect, template, title, artist, coverImg, parsedLyrics, audioDuration],
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
      const t = audio ? audio.currentTime : performance.now() / 1000 - startedAtRef.current;
      timeRef.current = t;
      if (frames++ % 6 === 0) setCurrentTime(t);
      drawAt(canvas, t);
      if (audioDuration > 0 && t >= audioDuration) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, audioDuration, drawAt]);

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
      audioRef.current.currentTime = startFrom;
      try {
        await audioRef.current.play();
      } catch {
        toast.error("Couldn't start audio playback");
        return;
      }
      setPlaying(true);
    }
  };

  const seek = (v: number) => {
    timeRef.current = v;
    pausedAtRef.current = v;
    setCurrentTime(v);
    startedAtRef.current = performance.now() / 1000 - v;
    if (audioRef.current) audioRef.current.currentTime = v;
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
      src.start();
      rec.start(100);
      const frameLoop = () => {
        if (!running) return;
        const t = (performance.now() - t0) / 1000;
        setExportProgress(Math.min(100, (t / audioDuration) * 100));
        renderEngine(octx, template.engine, {
          t,
          w: off.width,
          h: off.height,
          aspect,
          palette: template.palette,
          title,
          artist,
          coverImg,
          lyrics: parsedLyrics,
          duration: audioDuration,
        });
        if (t >= audioDuration) {
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
                  max={Math.max(audioDuration, 0.01)}
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
