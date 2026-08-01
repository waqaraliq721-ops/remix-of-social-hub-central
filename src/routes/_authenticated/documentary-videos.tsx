import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock3,
  Upload,
  Play,
  Pause,
  Download,
  Loader2,
  ImagePlus,
  Trash2,
  Wand2,
  Film,
  Plus,
  Mic,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  transcribeFile,
  wordsToLines,
  STT_PROVIDERS,
  type SttProvider,
  type TranscriptWord,
  type TimedLine,
} from "@/lib/transcribe";
import { generateSpeech, TTS_PROVIDERS, TTS_VOICES, type TtsProvider } from "@/lib/tts";
import { Switch } from "@/components/ui/switch";
import {
  IntroOutroCard,
  defaultIntro,
  defaultOutro,
  paletteOf,
  type CardConfig,
} from "@/components/intro-outro-card";
import { INTRO_ANIMATIONS, OUTRO_ANIMATIONS } from "@/lib/video-fx";
import { ColorCustomiser, applyOverrides, type ColorOverrides } from "@/components/color-customiser";
import { DocumentaryHQ } from "@/components/documentary-hq";

export const Route = createFileRoute("/_authenticated/documentary-videos")({
  head: () => ({
    meta: [
      { title: "Documentary Style Videos — Orbit" },
      {
        name: "description",
        content:
          "Turn footage, photos and narration into a cinematic documentary: Ken Burns pans, lower-thirds, chapter cards, timeline stamps, letterboxing and film grain. 1080p 60fps export.",
      },
      { property: "og:title", content: "Documentary Style Videos — Orbit" },
      {
        property: "og:description",
        content:
          "Upload narration or generate a voiceover, transcribe it into timed captions, and render with 8 documentary templates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocumentaryVideosPage,
});

type AspectKey = "9:16" | "16:9" | "1:1";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · Reels/TikTok/Shorts" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
  "1:1": { w: 1080, h: 1080, label: "Square · Feed" },
};

type Palette = {
  id: string;
  name: string;
  bg: [string, string];
  primary: string;
  accent: string;
  text: string;
  dim: string;
};

const PALETTES: Record<string, Palette> = {
  archive: {
    id: "archive",
    name: "Archive Sepia",
    bg: ["#0d0a06", "#241a0f"],
    primary: "#d8b06a",
    accent: "#f2dcae",
    text: "#f4ead9",
    dim: "#a99a80",
  },
  field: {
    id: "field",
    name: "Field Slate",
    bg: ["#08090b", "#151b22"],
    primary: "#6fb6d9",
    accent: "#d7ecf7",
    text: "#f2f7fa",
    dim: "#8fa2ad",
  },
  chapter: {
    id: "chapter",
    name: "Chapter Ink",
    bg: ["#050505", "#161616"],
    primary: "#e8e2d6",
    accent: "#c9a86a",
    text: "#ffffff",
    dim: "#9a958a",
  },
  interview: {
    id: "interview",
    name: "Interview Studio",
    bg: ["#07080a", "#131722"],
    primary: "#9bd0ff",
    accent: "#ffffff",
    text: "#f4f8ff",
    dim: "#8592a3",
  },
  timeline: {
    id: "timeline",
    name: "Timeline Amber",
    bg: ["#0a0705", "#241606"],
    primary: "#f0a445",
    accent: "#ffd9a0",
    text: "#fff3e2",
    dim: "#a68b70",
  },
  split: {
    id: "split",
    name: "Split Concrete",
    bg: ["#08090a", "#1a1c1e"],
    primary: "#e4e4e4",
    accent: "#8fd6c8",
    text: "#ffffff",
    dim: "#9a9a9a",
  },
  cinematic: {
    id: "cinematic",
    name: "Cinematic Noir",
    bg: ["#000000", "#101010"],
    primary: "#ffffff",
    accent: "#c9a86a",
    text: "#ffffff",
    dim: "#8a8a8a",
  },
  newsreel: {
    id: "newsreel",
    name: "Newsreel Mono",
    bg: ["#0a0a0a", "#1c1c1c"],
    primary: "#d9d9d9",
    accent: "#ffffff",
    text: "#f0f0f0",
    dim: "#8a8a8a",
  },
};

type EngineId =
  | "archive-kenburns"
  | "field-report"
  | "chapter-titles"
  | "interview-subtitle"
  | "timeline-stamp"
  | "split-frame"
  | "cinematic-letterbox"
  | "newsreel-grain";

type Template = { id: EngineId; name: string; desc: string; palette: Palette };
const TEMPLATES: Template[] = [
  {
    id: "archive-kenburns",
    name: "Archive Ken Burns",
    desc: "Slow pan/zoom over stills with a sepia archive grade and serif captions.",
    palette: PALETTES.archive,
  },
  {
    id: "field-report",
    name: "Field Report",
    desc: "Broadcast lower-third with location tag and live caption band.",
    palette: PALETTES.field,
  },
  {
    id: "chapter-titles",
    name: "Chapter Titles",
    desc: "Full-frame chapter cards between segments, minimal captions.",
    palette: PALETTES.chapter,
  },
  {
    id: "interview-subtitle",
    name: "Interview Subtitle",
    desc: "Clean centred subtitle band, like a talking-head interview.",
    palette: PALETTES.interview,
  },
  {
    id: "timeline-stamp",
    name: "Timeline Stamp",
    desc: "Running date/time stamp with a timeline progress rail.",
    palette: PALETTES.timeline,
  },
  {
    id: "split-frame",
    name: "Split Frame",
    desc: "Footage on one half, caption and chapter panel on the other.",
    palette: PALETTES.split,
  },
  {
    id: "cinematic-letterbox",
    name: "Cinematic Letterbox",
    desc: "Wide black bars, restrained centred captions, film-score pacing.",
    palette: PALETTES.cinematic,
  },
  {
    id: "newsreel-grain",
    name: "Newsreel Grain",
    desc: "Heavy grain, mono grade and flickering newsreel captions.",
    palette: PALETTES.newsreel,
  },
];

// -------------------- helpers --------------------

function hexA(hex: string, a: number) {
  const c = hex.replace("#", "");
  return `rgba(${parseInt(c.slice(0, 2), 16)}, ${parseInt(c.slice(2, 4), 16)}, ${parseInt(c.slice(4, 6), 16)}, ${a})`;
}
function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
function fmtStamp(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const FONT_SERIF = `Georgia, "Times New Roman", serif`;
const FONT_SANS = `"Inter", "Helvetica Neue", Arial, sans-serif`;
const FONT_MONO = `"JetBrains Mono", "SFMono-Regular", Menlo, monospace`;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ").filter(Boolean);
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
  return out.length ? out : [""];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  mw: number,
  mh: number,
  w: number,
  h: number,
  scale = 1,
  dx = 0,
  dy = 0,
) {
  if (!mw || !mh) return;
  const ratio = Math.max(w / mw, h / mh) * scale;
  const dw = mw * ratio;
  const dh = mh * ratio;
  ctx.drawImage(media, (w - dw) / 2 + dx, (h - dh) / 2 + dy, dw, dh);
}

// -------------------- domain types --------------------

type Backdrop =
  | { kind: "video"; el: HTMLVideoElement }
  | { kind: "images"; imgs: HTMLImageElement[]; per: number }
  | { kind: "none" };

export type ColorGrade = "none" | "warm" | "cool" | "mono";
export type Chapter = { id: string; time: number; title: string };

type RenderCtx = {
  t: number;
  w: number;
  h: number;
  aspect: AspectKey;
  palette: Palette;
  lines: TimedLine[];
  duration: number;
  dim: number;
  backdrop: Backdrop;
  chapters: Chapter[];
  dateStamp: boolean;
  dateStampText: string;
  letterbox: boolean;
  grain: boolean;
  colorGrade: ColorGrade;
};

let GRAIN_TILE: HTMLCanvasElement | null = null;
function grainTile() {
  if (GRAIN_TILE) return GRAIN_TILE;
  const c = document.createElement("canvas");
  c.width = 220;
  c.height = 220;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  GRAIN_TILE = c;
  return c;
}

function drawGrade(ctx: CanvasRenderingContext2D, w: number, h: number, grade: ColorGrade) {
  if (grade === "none") return;
  ctx.save();
  if (grade === "warm") {
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = "rgba(255,150,60,0.18)";
    ctx.fillRect(0, 0, w, h);
  } else if (grade === "cool") {
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = "rgba(60,140,255,0.18)";
    ctx.fillRect(0, 0, w, h);
  } else if (grade === "mono") {
    ctx.globalCompositeOperation = "saturation";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const tile = grainTile();
  ctx.save();
  ctx.globalAlpha = 0.09;
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

function drawLetterbox(ctx: CanvasRenderingContext2D, w: number, h: number, ratio = 0.11) {
  const bar = h * ratio;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, bar);
  ctx.fillRect(0, h - bar, w, bar);
}

function drawBackdrop(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h, t, palette: p, backdrop } = r;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p.bg[0]);
  g.addColorStop(1, p.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (backdrop.kind === "video") {
    const v = backdrop.el;
    if (v.videoWidth) drawCover(ctx, v, v.videoWidth, v.videoHeight, w, h, 1.02);
  } else if (backdrop.kind === "images" && backdrop.imgs.length) {
    const per = backdrop.per;
    const i = Math.floor(t / per) % backdrop.imgs.length;
    const nextI = (i + 1) % backdrop.imgs.length;
    const local = (t % per) / per;
    const fade = 0.12;
    const kb = (k: number) => 1.04 + k * 0.14;
    const cur = backdrop.imgs[i];
    ctx.globalAlpha = 1;
    drawCover(ctx, cur, cur.naturalWidth, cur.naturalHeight, w, h, kb(local), (local - 0.5) * w * 0.04, -local * h * 0.02);
    if (local > 1 - fade && backdrop.imgs.length > 1) {
      const a = (local - (1 - fade)) / fade;
      const nx = backdrop.imgs[nextI];
      ctx.globalAlpha = a;
      drawCover(ctx, nx, nx.naturalWidth, nx.naturalHeight, w, h, kb(0));
      ctx.globalAlpha = 1;
    }
  }

  drawGrade(ctx, w, h, r.colorGrade);

  ctx.fillStyle = `rgba(0,0,0,${r.dim})`;
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.75,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  const scrim = ctx.createLinearGradient(0, 0, 0, h);
  scrim.addColorStop(0, "rgba(0,0,0,0.3)");
  scrim.addColorStop(0.18, "rgba(0,0,0,0)");
  scrim.addColorStop(0.7, "rgba(0,0,0,0)");
  scrim.addColorStop(1, "rgba(0,0,0,0.46)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, h);

  if (r.grain) drawGrain(ctx, w, h, t);
}

function activeLine(lines: TimedLine[], t: number): TimedLine | undefined {
  let out: TimedLine | undefined;
  for (const l of lines) {
    if (l.time <= t) out = l;
    else break;
  }
  return out;
}

function activeChapter(chapters: Chapter[], t: number): Chapter | undefined {
  let out: Chapter | undefined;
  for (const c of chapters) {
    if (c.time <= t) out = c;
    else break;
  }
  return out;
}

function drawDateStamp(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  if (!r.dateStamp) return;
  const { w, h } = r;
  const size = Math.round(h * 0.024);
  ctx.font = `600 ${size}px ${FONT_MONO}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const text = `${r.dateStampText}  ${fmtStamp(r.t)}`;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  const pad = size * 0.5;
  const tw = ctx.measureText(text).width;
  roundRect(ctx, w - tw - pad * 2 - size, h - size * 2.6, tw + pad * 2, size * 1.7, 4);
  ctx.fill();
  ctx.fillStyle = r.palette.primary;
  ctx.fillText(text, w - size, h - size * 1.35);
}

function drawCaptionBand(
  ctx: CanvasRenderingContext2D,
  r: RenderCtx,
  opts: { y: number; font: string; size: number; align?: "center" | "left"; box?: boolean },
) {
  const { line } = { line: activeLine(r.lines, r.t) };
  if (!line) return;
  const appear = easeOutCubic(Math.min(1, (r.t - line.time) / 0.25));
  const size = opts.size;
  ctx.font = `600 ${size}px ${opts.font}`;
  const maxWidth = r.w * 0.82;
  const rows = wrapText(ctx, line.text, maxWidth);
  const lineH = size * 1.3;
  const boxH = rows.length * lineH + size * 0.8;
  const boxY = opts.y - boxH / 2;
  ctx.save();
  ctx.globalAlpha = appear;
  if (opts.box) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, r.w * 0.09, boxY, r.w * 0.82, boxH, size * 0.3);
    ctx.fill();
    ctx.fillStyle = r.palette.primary;
    ctx.fillRect(r.w * 0.09, boxY, Math.max(3, r.w * 0.005), boxH);
  }
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = r.palette.text;
  let y = boxY + size * 0.75;
  const x = opts.align === "left" ? r.w * 0.13 : r.w / 2;
  for (const row of rows) {
    ctx.fillText(row, x, y);
    y += lineH;
  }
  ctx.restore();
}

// -------------------- engines --------------------

function renderArchiveKenBurns(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  drawCaptionBand(ctx, r, { y: r.h * 0.86, font: FONT_SERIF, size: Math.round(r.h * 0.036) });
  const chap = activeChapter(r.chapters, r.t);
  if (chap) {
    ctx.font = `italic 600 ${Math.round(r.h * 0.022)}px ${FONT_SERIF}`;
    ctx.textAlign = "left";
    ctx.fillStyle = hexA(r.palette.accent, 0.9);
    ctx.fillText(chap.title.toUpperCase(), r.w * 0.08, r.h * 0.1);
  }
  drawDateStamp(ctx, r);
}

function renderFieldReport(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const chap = activeChapter(r.chapters, r.t);
  const tagY = r.h * 0.12;
  if (chap) {
    ctx.font = `800 ${Math.round(r.h * 0.024)}px ${FONT_SANS}`;
    const label = chap.title.toUpperCase();
    const pad = r.h * 0.012;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = r.palette.primary;
    roundRect(ctx, r.w * 0.06, tagY - r.h * 0.028, tw + pad * 4, r.h * 0.05, 4);
    ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.w * 0.06 + pad * 2, tagY - r.h * 0.003);
  }
  drawCaptionBand(ctx, r, {
    y: r.h * 0.86,
    font: FONT_SANS,
    size: Math.round(r.h * 0.032),
    align: "left",
    box: true,
  });
  drawDateStamp(ctx, r);
}

function renderChapterTitles(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const chap = activeChapter(r.chapters, r.t);
  if (chap) {
    const age = r.t - chap.time;
    if (age < 2.2) {
      const k = easeOutCubic(Math.min(1, age / 0.5));
      const fade = age > 1.7 ? 1 - (age - 1.7) / 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, k * fade));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(r.h * 0.055)}px ${FONT_SANS}`;
      ctx.fillStyle = r.palette.text;
      ctx.fillText(chap.title.toUpperCase(), r.w / 2, r.h / 2);
      ctx.fillStyle = r.palette.accent;
      ctx.fillRect(r.w / 2 - r.w * 0.06, r.h / 2 + r.h * 0.06, r.w * 0.12, Math.max(3, r.h * 0.005));
      ctx.restore();
    }
  }
  drawCaptionBand(ctx, r, { y: r.h * 0.88, font: FONT_SANS, size: Math.round(r.h * 0.028) });
  drawDateStamp(ctx, r);
}

function renderInterviewSubtitle(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  drawCaptionBand(ctx, r, {
    y: r.h * 0.84,
    font: FONT_SANS,
    size: Math.round(r.h * 0.034),
    box: true,
  });
  drawDateStamp(ctx, r);
}

function renderTimelineStamp(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h } = r;
  const railY = h * 0.94;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(w * 0.08, railY, w * 0.84, 3);
  const prog = r.duration > 0 ? Math.min(1, r.t / r.duration) : 0;
  ctx.fillStyle = r.palette.primary;
  ctx.fillRect(w * 0.08, railY, w * 0.84 * prog, 3);
  for (const c of r.chapters) {
    const cx = w * 0.08 + (w * 0.84) * Math.min(1, r.duration > 0 ? c.time / r.duration : 0);
    ctx.beginPath();
    ctx.arc(cx, railY + 1.5, 5, 0, Math.PI * 2);
    ctx.fillStyle = c.time <= r.t ? r.palette.accent : "rgba(255,255,255,0.4)";
    ctx.fill();
  }
  drawCaptionBand(ctx, r, { y: h * 0.85, font: FONT_MONO, size: Math.round(h * 0.03) });
  ctx.font = `700 ${Math.round(h * 0.026)}px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.fillStyle = r.palette.accent;
  ctx.fillText(fmtStamp(r.t), w * 0.08, h * 0.1);
  drawDateStamp(ctx, r);
}

function renderSplitFrame(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { w, h } = r;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w * 0.62, h);
  ctx.clip();
  drawBackdrop(ctx, r);
  ctx.restore();

  ctx.fillStyle = r.palette.bg[1];
  ctx.fillRect(w * 0.62, 0, w * 0.38, h);
  ctx.strokeStyle = hexA(r.palette.primary, 0.5);
  ctx.beginPath();
  ctx.moveTo(w * 0.62, 0);
  ctx.lineTo(w * 0.62, h);
  ctx.stroke();

  const chap = activeChapter(r.chapters, r.t);
  ctx.textAlign = "left";
  if (chap) {
    ctx.font = `800 ${Math.round(h * 0.03)}px ${FONT_SANS}`;
    ctx.fillStyle = r.palette.accent;
    wrapText(ctx, chap.title.toUpperCase(), w * 0.32).forEach((row, i) =>
      ctx.fillText(row, w * 0.67, h * 0.14 + i * h * 0.038),
    );
  }
  const line = activeLine(r.lines, r.t);
  if (line) {
    ctx.font = `500 ${Math.round(h * 0.024)}px ${FONT_SANS}`;
    ctx.fillStyle = r.palette.text;
    wrapText(ctx, line.text, w * 0.32).forEach((row, i) =>
      ctx.fillText(row, w * 0.67, h * 0.3 + i * h * 0.034),
    );
  }
  drawDateStamp(ctx, r);
}

function renderCinematicLetterbox(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  drawCaptionBand(ctx, r, { y: r.h * 0.82, font: FONT_SERIF, size: Math.round(r.h * 0.034) });
  drawLetterbox(ctx, r.w, r.h, 0.11);
  drawDateStamp(ctx, r);
}

function renderNewsreelGrain(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const flicker = 0.94 + Math.random() * 0.06;
  ctx.save();
  ctx.globalAlpha = flicker;
  drawCaptionBand(ctx, r, {
    y: r.h * 0.86,
    font: FONT_SERIF,
    size: Math.round(r.h * 0.032),
    box: true,
  });
  ctx.restore();
  drawGrain(ctx, r.w, r.h, r.t * 3);
  drawDateStamp(ctx, r);
}

function drawEngineBody(ctx: CanvasRenderingContext2D, engine: EngineId, r: RenderCtx) {
  switch (engine) {
    case "archive-kenburns":
      return renderArchiveKenBurns(ctx, r);
    case "field-report":
      return renderFieldReport(ctx, r);
    case "chapter-titles":
      return renderChapterTitles(ctx, r);
    case "interview-subtitle":
      return renderInterviewSubtitle(ctx, r);
    case "timeline-stamp":
      return renderTimelineStamp(ctx, r);
    case "split-frame":
      return renderSplitFrame(ctx, r);
    case "cinematic-letterbox":
      return renderCinematicLetterbox(ctx, r);
    case "newsreel-grain":
      return renderNewsreelGrain(ctx, r);
  }
}

function renderEngine(ctx: CanvasRenderingContext2D, engine: EngineId, r: RenderCtx) {
  drawEngineBody(ctx, engine, r);
  if (r.letterbox && engine !== "cinematic-letterbox") drawLetterbox(ctx, r.w, r.h, 0.08);
}

// -------------------- component --------------------

function DocumentaryVideosPage() {
  const [aspect, setAspect] = useState<AspectKey>("16:9");
  const [templateId, setTemplateId] = useState<EngineId>(TEMPLATES[0].id);
  const [dim, setDim] = useState(0.35);
  const [slidePer, setSlidePer] = useState(5);
  const [wordsPerLine, setWordsPerLine] = useState(8);

  const [colors, setColors] = useState<ColorOverrides>({});
  const [letterbox, setLetterbox] = useState(false);
  const [grain, setGrain] = useState(false);
  const [colorGrade, setColorGrade] = useState<ColorGrade>("none");
  const [dateStampOn, setDateStampOn] = useState(false);
  const [dateStampText, setDateStampText] = useState(() => new Date().toISOString().slice(0, 10));

  const [chapters, setChapters] = useState<Chapter[]>([
    { id: "c1", time: 0, title: "Opening" },
  ]);
  const addChapter = () =>
    setChapters((c) => [
      ...c,
      { id: `c${Date.now()}`, time: Math.round((timeRefInit.current || 0) + 1), title: "New chapter" },
    ]);
  const timeRefInit = useRef(0);

  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, id: "none" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, id: "none" });

  // background media: video OR image slideshow
  const [bgKind, setBgKind] = useState<"none" | "video" | "images">("none");
  const [bgVideoUrl, setBgVideoUrl] = useState<string | null>(null);
  const [bgVideoName, setBgVideoName] = useState<string | null>(null);
  const [images, setImages] = useState<{ id: string; url: string; img: HTMLImageElement }[]>([]);

  // narration audio: uploaded or generated
  const [narrationFile, setNarrationFile] = useState<File | null>(null);
  const [narrationUrl, setNarrationUrl] = useState<string | null>(null);
  const [narrationName, setNarrationName] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("elevenlabs");
  const [ttsVoice, setTtsVoice] = useState(TTS_VOICES.elevenlabs[0].id);
  const [script, setScript] = useState("");
  const [generatingVo, setGeneratingVo] = useState(false);

  const [lines, setLines] = useState<TimedLine[]>([]);
  const [transcript, setTranscript] = useState("");
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [sttProvider, setSttProvider] = useState<SttProvider>("auto");

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);
  const timeRef = useRef(0);
  timeRefInit.current = currentTime;

  const dims = ASPECTS[aspect];
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  const palette = useMemo(() => {
    const base = {
      bg: template.palette.bg,
      primary: template.palette.primary,
      accent: template.palette.accent,
      text: template.palette.text,
      muted: template.palette.dim,
    };
    const applied = applyOverrides(base, colors);
    return {
      ...template.palette,
      bg: applied.bg,
      primary: applied.primary,
      accent: applied.accent,
      text: applied.text,
      dim: applied.muted,
    };
  }, [template, colors]);

  const backdrop: Backdrop = useMemo(() => {
    if (bgKind === "video" && videoRef.current) return { kind: "video", el: videoRef.current };
    if (images.length) return { kind: "images", imgs: images.map((i) => i.img), per: slidePer };
    return { kind: "none" };
  }, [bgKind, images, slidePer, bgVideoUrl]);

  const onBgVideo = (f: File) => {
    if (bgVideoUrl) URL.revokeObjectURL(bgVideoUrl);
    const url = URL.createObjectURL(f);
    setBgVideoUrl(url);
    setBgVideoName(f.name);
    setBgKind("video");
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";
    videoRef.current = v;
  };

  const clearBgVideo = () => {
    if (bgVideoUrl) URL.revokeObjectURL(bgVideoUrl);
    videoRef.current?.pause();
    videoRef.current = null;
    setBgVideoUrl(null);
    setBgVideoName(null);
    setBgKind(images.length ? "images" : "none");
  };

  const addImages = (files: FileList) => {
    Array.from(files).forEach((f) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () =>
        setImages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, url, img }]);
      img.src = url;
    });
    if (bgKind === "none") setBgKind("images");
  };

  const removeImage = (id: string) =>
    setImages((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((i) => i.id !== id);
    });

  const onNarration = (f: File) => {
    if (narrationUrl) URL.revokeObjectURL(narrationUrl);
    const url = URL.createObjectURL(f);
    setNarrationUrl(url);
    setNarrationFile(f);
    setNarrationName(f.name);
    setLines([]);
    setWords([]);
    setTranscript("");
    const a = new Audio(url);
    a.addEventListener("loadedmetadata", () => setDuration(isFinite(a.duration) ? a.duration : 0));
    audioRef.current = a;
  };

  const clearNarration = () => {
    if (narrationUrl) URL.revokeObjectURL(narrationUrl);
    audioRef.current?.pause();
    audioRef.current = null;
    setNarrationUrl(null);
    setNarrationFile(null);
    setNarrationName(null);
    setDuration(0);
    setPlaying(false);
  };

  const runGenerateVoiceover = async () => {
    if (!script.trim()) {
      toast("Write the narration script first");
      return;
    }
    setGeneratingVo(true);
    try {
      const { url, blob } = await generateSpeech(script, { provider: ttsProvider, voice: ttsVoice });
      const file = new File([blob], `narration-${ttsProvider}.mp3`, { type: blob.type || "audio/mpeg" });
      if (narrationUrl) URL.revokeObjectURL(narrationUrl);
      setNarrationUrl(url);
      setNarrationFile(file);
      setNarrationName(file.name);
      setLines([]);
      setWords([]);
      setTranscript("");
      const a = new Audio(url);
      a.addEventListener("loadedmetadata", () => setDuration(isFinite(a.duration) ? a.duration : 0));
      audioRef.current = a;
      toast.success("Voiceover generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voiceover generation failed");
    } finally {
      setGeneratingVo(false);
    }
  };

  const runTranscribe = async () => {
    if (!narrationFile) {
      toast("Upload or generate narration audio first");
      return;
    }
    setTranscribing(true);
    try {
      const res = await transcribeFile(narrationFile, { provider: sttProvider });
      setTranscript(res.text);
      if (res.words.length) {
        setWords(res.words);
        setLines(wordsToLines(res.words, { maxWords: wordsPerLine, maxChars: wordsPerLine * 7 }));
        toast.success(`Transcribed ${res.words.length} words with exact timing`);
      } else if (res.text.trim()) {
        const chunks = res.text.split(/(?<=[.!?])\s+/).filter(Boolean);
        const per = (duration || chunks.length * 3) / Math.max(1, chunks.length);
        setWords([]);
        setLines(chunks.map((text, i) => ({ time: i * per, end: (i + 1) * per, text, words: [] })));
        toast("Transcribed, but this provider gave no word timings — lines spread evenly");
      } else {
        toast.error("No speech detected");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  useEffect(() => {
    if (words.length) {
      setLines(wordsToLines(words, { maxWords: wordsPerLine, maxChars: wordsPerLine * 7 }));
    }
  }, [wordsPerLine, words]);

  const applyManualText = (text: string) => {
    setTranscript(text);
    const chunks = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!chunks.length) {
      setLines([]);
      return;
    }
    setWords([]);
    const per = (duration || chunks.length * 3) / chunks.length;
    setLines(chunks.map((t, i) => ({ time: i * per, end: (i + 1) * per, text: t, words: [] })));
  };

  const introSec = intro.id !== "none" ? intro.seconds : 0;
  const outroSec = outro.id !== "none" ? outro.seconds : 0;
  const totalDuration = duration > 0 ? introSec + duration + outroSec : 0;

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, bd: Backdrop) => {
      const clipT = Math.max(0, Math.min(duration || 0, t - introSec));
      renderEngine(ctx, template.id, {
        t: clipT,
        w,
        h,
        aspect,
        palette,
        lines,
        duration,
        dim,
        backdrop: bd,
        chapters,
        dateStamp: dateStampOn,
        dateStampText,
        letterbox,
        grain,
        colorGrade,
      });

      if (introSec > 0 && t < introSec) {
        INTRO_ANIMATIONS.find((a) => a.id === intro.id)?.draw({
          ctx,
          w,
          h,
          p: Math.min(1, t / Math.max(0.2, introSec)),
          palette: paletteOf(intro.paletteId),
          title: intro.title,
          subtitle: intro.subtitle,
          logo: null,
        });
      }
      if (outroSec > 0 && duration > 0 && t >= introSec + duration) {
        OUTRO_ANIMATIONS.find((a) => a.id === outro.id)?.draw({
          ctx,
          w,
          h,
          p: Math.min(1, (t - introSec - duration) / Math.max(0.2, outroSec)),
          palette: paletteOf(outro.paletteId),
          title: outro.title,
          subtitle: outro.subtitle,
          logo: null,
        });
      }
    },
    [
      template,
      aspect,
      palette,
      lines,
      duration,
      dim,
      chapters,
      dateStampOn,
      dateStampText,
      letterbox,
      grain,
      colorGrade,
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
      try {
        paint(ctx, canvas.width, canvas.height, t, backdrop);
      } catch (err) {
        // A single bad asset (e.g. a video frame mid-decode, or a template
        // throwing on an edge-case time) must never kill the render loop —
        // fall back to a plain frame so the preview keeps playing.
        console.warn("Documentary preview draw failed", err);
        try {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } catch {
          /* noop */
        }
      }
    },
    [paint, backdrop],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dims.w;
    canvas.height = dims.h;
    try {
      drawAt(canvas, timeRef.current);
    } catch (err) {
      console.warn("Documentary preview initial draw failed", err);
    }
  }, [dims.w, dims.h, drawAt]);

  // Repaint whenever any preview-affecting input changes, even while
  // paused/no media — otherwise the canvas can be stuck showing a stale or
  // blank frame after toggling a template/control before playback starts.
  useEffect(() => {
    if (playing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      drawAt(canvas, timeRef.current);
    } catch (err) {
      console.warn("Documentary preview repaint failed", err);
    }
  }, [drawAt, playing]);

  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frames = 0;
    const started = performance.now() / 1000 - timeRef.current;
    const tick = () => {
      const el = audioRef.current;
      const vd = videoRef.current;
      const t = performance.now() / 1000 - started;
      timeRef.current = t;
      const inClip = t >= introSec && t < introSec + duration;
      if (el) {
        if (inClip) {
          if (el.paused) {
            el.currentTime = Math.max(0, t - introSec);
            el.play().catch(() => {});
          }
        } else if (!el.paused) el.pause();
      }
      if (vd) {
        if (inClip) {
          if (vd.paused) vd.play().catch(() => {});
        } else if (!vd.paused) vd.pause();
      }
      if (frames++ % 6 === 0) setCurrentTime(t);
      try {
        drawAt(canvas, t);
      } catch (err) {
        console.warn("Documentary preview frame failed", err);
      }
      if (totalDuration > 0 && t >= totalDuration - 0.02) {
        el?.pause();
        vd?.pause();
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, duration, totalDuration, introSec, drawAt]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el && !videoRef.current) {
      toast("Upload background media and narration first");
      return;
    }
    if (playing) {
      el?.pause();
      videoRef.current?.pause();
      setPlaying(false);
    } else {
      if (el) {
        el.currentTime = Math.max(0, timeRef.current - introSec);
        if (timeRef.current >= introSec) {
          try {
            await el.play();
          } catch {
            toast.error("Couldn't start playback");
            return;
          }
        }
      }
      setPlaying(true);
    }
  };

  const seek = (v: number) => {
    timeRef.current = v;
    setCurrentTime(v);
    const el = audioRef.current;
    if (el) el.currentTime = Math.max(0, v - introSec);
    const canvas = canvasRef.current;
    if (canvas) drawAt(canvas, v);
  };

  const exportVideo = async () => {
    if (duration <= 0 || !narrationUrl) {
      toast("Add narration audio (upload or generate) first");
      return;
    }
    setExporting(true);
    setExportProgress(0);
    let renderVideo: HTMLVideoElement | null = null;
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
      const ab = await (await fetch(narrationUrl)).arrayBuffer();
      let src: AudioBufferSourceNode | null = null;
      try {
        const buf = await ac.decodeAudioData(ab.slice(0));
        src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
      } catch {
        console.warn("Narration audio could not be decoded for export");
      }
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));

      let exportBackdrop: Backdrop = backdrop;
      if (bgKind === "video" && bgVideoUrl) {
        renderVideo = document.createElement("video");
        renderVideo.src = bgVideoUrl;
        renderVideo.muted = true;
        renderVideo.loop = true;
        renderVideo.playsInline = true;
        await new Promise<void>((res) => {
          renderVideo!.addEventListener("loadeddata", () => res(), { once: true });
        });
        if (introSec <= 0) await renderVideo.play().catch(() => {});
        exportBackdrop = { kind: "video", el: renderVideo };
      }

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
      src?.start(introSec > 0 ? ac.currentTime + introSec : 0);
      rec.start(100);
      const loop = () => {
        if (!running) return;
        const t = (performance.now() - t0) / 1000;
        if (renderVideo && renderVideo.paused && t >= introSec && t < introSec + duration) {
          renderVideo.play().catch(() => {});
        }
        setExportProgress(Math.min(100, (t / totalDuration) * 100));
        paint(octx, off.width, off.height, t, exportBackdrop);
        if (t >= totalDuration) {
          running = false;
          try {
            src?.stop();
          } catch {
            /* noop */
          }
          renderVideo?.pause();
          setTimeout(() => rec.stop(), 200);
          return;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      const blob = await doneP;
      ac.close().catch(() => {});
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documentary-${template.id}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast.success(`Exported ${ext.toUpperCase()} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      renderVideo?.pause();
      setExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-stone-700 text-white shadow-lg">
          <Clock3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Documentary Style Videos</h1>
          <p className="mt-1 text-muted-foreground">
            Upload footage or photos, add narration, and get word-accurate captions across{" "}
            {TEMPLATES.length} documentary templates. Exports 1080p at 60fps.
          </p>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="hq">HQ YT Vids</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr_360px]">
        {/* Left: media + narration + transcript */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Background footage</CardTitle>
              <CardDescription>Upload a video, or add photos for a Ken Burns slideshow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bgVideoUrl ? (
                <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="truncate">
                    <Film className="mr-1 inline h-3.5 w-3.5" />
                    {bgVideoName}
                  </span>
                  <Button variant="ghost" size="sm" onClick={clearBgVideo}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="mr-2 h-4 w-4" /> Upload background video
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onBgVideo(e.target.files[0])}
                  />
                </label>
              )}
              <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
                <ImagePlus className="mr-2 h-4 w-4" /> Add images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addImages(e.target.files)}
                />
              </label>
              {images.length > 0 && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((im) => (
                      <button
                        key={im.id}
                        onClick={() => removeImage(im.id)}
                        className="group relative overflow-hidden rounded-md border"
                        title="Remove"
                      >
                        <img src={im.url} alt="Background" className="h-16 w-full object-cover" />
                        <span className="absolute inset-0 hidden items-center justify-center bg-black/60 group-hover:flex">
                          <Trash2 className="h-4 w-4 text-white" />
                        </span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <Label className="text-xs">Seconds per image · {slidePer}</Label>
                    <Slider min={2} max={12} step={1} value={[slidePer]} onValueChange={(v) => setSlidePer(v[0])} />
                  </div>
                </>
              )}
              <div>
                <Label className="text-xs">Backdrop dim · {Math.round(dim * 100)}%</Label>
                <Slider min={0} max={0.8} step={0.05} value={[dim]} onValueChange={(v) => setDim(v[0])} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Narration</CardTitle>
              <CardDescription>Upload a voice recording, or generate one from a script.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {narrationUrl ? (
                <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="truncate">
                    <Mic className="mr-1 inline h-3.5 w-3.5" />
                    {narrationName}
                  </span>
                  <Button variant="ghost" size="sm" onClick={clearNarration}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="mr-2 h-4 w-4" /> Upload narration audio
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onNarration(e.target.files[0])}
                  />
                </label>
              )}
              {duration > 0 && <p className="text-xs text-muted-foreground">{fmtTime(duration)} duration</p>}

              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-xs">Or generate a voiceover</Label>
                <Textarea
                  rows={4}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Paste the narration script here…"
                  className="text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={ttsProvider}
                    onValueChange={(v) => {
                      const p = v as TtsProvider;
                      setTtsProvider(p);
                      setTtsVoice(TTS_VOICES[p][0].id);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TTS_PROVIDERS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={ttsVoice} onValueChange={setTtsVoice}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TTS_VOICES[ttsProvider].map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={runGenerateVoiceover} disabled={generatingVo} className="w-full" variant="secondary">
                  {generatingVo ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Generating…
                    </>
                  ) : (
                    <>
                      <Mic className="mr-1 h-4 w-4" /> Generate voiceover
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Captions</CardTitle>
              <CardDescription>Auto-transcribed with word-level timing from the narration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Transcription model</Label>
                <Select value={sttProvider} onValueChange={(v) => setSttProvider(v as SttProvider)}>
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
              <Button onClick={runTranscribe} disabled={transcribing || !narrationFile} className="w-full">
                {transcribing ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Transcribing…
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-1 h-4 w-4" /> Transcribe narration
                  </>
                )}
              </Button>
              <div>
                <Label className="text-xs">Words per caption · {wordsPerLine}</Label>
                <Slider min={3} max={14} step={1} value={[wordsPerLine]} onValueChange={(v) => setWordsPerLine(v[0])} />
              </div>
              <Textarea
                rows={7}
                value={transcript}
                onChange={(e) => applyManualText(e.target.value)}
                placeholder="Transcript appears here — or type captions, one line per caption."
                className="text-sm"
              />
              {lines.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {lines.length} captions{words.length ? " · word-timed" : " · evenly spread"}
                </p>
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
                  <TabsTrigger value="16:9">16:9</TabsTrigger>
                  <TabsTrigger value="9:16">9:16</TabsTrigger>
                  <TabsTrigger value="1:1">1:1</TabsTrigger>
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
                <Button size="icon" onClick={togglePlay} disabled={!narrationUrl}>
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
                <span className="w-16 text-right text-xs text-muted-foreground">{fmtTime(duration)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Template: <span className="font-medium text-foreground">{template.name}</span>
                </div>
                <Button onClick={exportVideo} disabled={exporting || !narrationUrl || !lines.length}>
                  {exporting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Rendering… {Math.round(exportProgress)}%
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chapters</CardTitle>
              <CardDescription>Titles that appear as the documentary progresses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {chapters.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={c.time}
                    onChange={(e) =>
                      setChapters((cs) =>
                        cs.map((x) => (x.id === c.id ? { ...x, time: Number(e.target.value) || 0 } : x)),
                      )
                    }
                  />
                  <Input
                    className="flex-1"
                    value={c.title}
                    onChange={(e) =>
                      setChapters((cs) => cs.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setChapters((cs) => cs.filter((x) => x.id !== c.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={addChapter}>
                <Plus className="mr-1 h-4 w-4" /> Add chapter
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: templates + controls */}
        <div className="space-y-4">
          <ColorCustomiser
            base={{
              bg: template.palette.bg,
              primary: template.palette.primary,
              accent: template.palette.accent,
              text: template.palette.text,
              muted: template.palette.dim,
            }}
            value={colors}
            onChange={setColors}
            title="Custom colours"
            description="Override this template's palette — background, accent, text and more."
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentary controls</CardTitle>
              <CardDescription>Date stamp, letterboxing, grain and colour grade.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Date / time stamp</Label>
                  <p className="text-xs text-muted-foreground">Broadcast-style timestamp overlay.</p>
                </div>
                <Switch checked={dateStampOn} onCheckedChange={setDateStampOn} />
              </div>
              {dateStampOn && (
                <Input
                  value={dateStampText}
                  onChange={(e) => setDateStampText(e.target.value)}
                  placeholder="Location or date label"
                />
              )}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Letterbox bars</Label>
                  <p className="text-xs text-muted-foreground">Cinematic black bars top and bottom.</p>
                </div>
                <Switch checked={letterbox} onCheckedChange={setLetterbox} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Film grain</Label>
                  <p className="text-xs text-muted-foreground">Subtle archival texture overlay.</p>
                </div>
                <Switch checked={grain} onCheckedChange={setGrain} />
              </div>
              <div>
                <Label className="text-xs">Colour grade</Label>
                <Select value={colorGrade} onValueChange={(v) => setColorGrade(v as ColorGrade)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cool">Cool</SelectItem>
                    <SelectItem value="mono">Mono</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <IntroOutroCard intro={intro} outro={outro} onIntro={setIntro} onOutro={setOutro} ratio={dims.w / dims.h} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Templates</CardTitle>
              <CardDescription>{TEMPLATES.length} documentary designs.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid max-h-[70vh] grid-cols-1 gap-2 overflow-y-auto pr-1">
                {TEMPLATES.map((t) => {
                  const active = t.id === templateId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTemplateId(t.id)}
                      className={`rounded-lg border p-2 text-left transition ${
                        active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"
                      }`}
                    >
                      <div
                        className="mb-2 flex h-14 items-center justify-center rounded-md text-xs font-medium"
                        style={{
                          background: `linear-gradient(140deg, ${t.palette.bg[0]}, ${t.palette.bg[1]})`,
                          color: t.palette.text,
                        }}
                      >
                        {t.name}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        </TabsContent>
        <TabsContent value="hq">
          <DocumentaryHQ />
        </TabsContent>
      </Tabs>
    </div>
  );
}
