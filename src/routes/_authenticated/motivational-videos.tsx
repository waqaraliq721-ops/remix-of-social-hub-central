import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Quote,
  Upload,
  Play,
  Pause,
  Download,
  Loader2,
  ImagePlus,
  Trash2,
  Wand2,
  Film,
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
import {
  transcribeFile,
  wordsToLines,
  STT_PROVIDERS,
  type SttProvider,
  type TranscriptWord,
  type TimedLine,
} from "@/lib/transcribe";
import { Switch } from "@/components/ui/switch";
import {
  IntroOutroCard,
  defaultIntro,
  defaultOutro,
  paletteOf,
  type CardConfig,
} from "@/components/intro-outro-card";
import { INTRO_ANIMATIONS, OUTRO_ANIMATIONS } from "@/lib/video-fx";



export const Route = createFileRoute("/_authenticated/motivational-videos")({
  head: () => ({
    meta: [
      { title: "Motivational Quote Videos — Orbit" },
      {
        name: "description",
        content:
          "Turn a speech clip into a motivational quote video: word-accurate transcription, 20 cinematic templates, image or video backdrops, 1080p 60fps export.",
      },
      { property: "og:title", content: "Motivational Quote Videos — Orbit" },
      {
        property: "og:description",
        content:
          "Upload speech audio or video, get perfectly timed on-screen quotes with 20 professional templates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MotivationalVideosPage,
});

type AspectKey = "9:16" | "16:9" | "1:1";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · Reels/TikTok/Shorts" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
  "1:1": { w: 1080, h: 1080, label: "Square · Feed" },
};

type EngineId =
  | "wordpop"
  | "lowerthird"
  | "quoteframe"
  | "kinetic"
  | "spotlight"
  | "typo-serif"
  | "typo-stack"
  | "typo-outline"
  | "typo-gradient"
  | "typo-poster"
  | "typo-mono"
  | "typo-band"
  | "typo-ticker"
  | "typo-vertical"
  | "typo-split";


type Palette = {
  id: string;
  name: string;
  bg: [string, string];
  primary: string;
  accent: string;
  text: string;
  dim: string;
};

const PALETTES: Palette[] = [
  { id: "noir", name: "Noir Gold", bg: ["#08080a", "#1c1710"], primary: "#e6b566", accent: "#ffe6b0", text: "#ffffff", dim: "#9b9384" },
  { id: "steel", name: "Steel Blue", bg: ["#050a12", "#10243d"], primary: "#5aa9f0", accent: "#c7e4ff", text: "#f5faff", dim: "#8fa5bb" },
  { id: "ember", name: "Ember Red", bg: ["#100405", "#3b0c10"], primary: "#f2554a", accent: "#ffc9b0", text: "#fff6f4", dim: "#b8867f" },
  { id: "pure", name: "Pure Contrast", bg: ["#000000", "#141414"], primary: "#ffffff", accent: "#d9d9d9", text: "#ffffff", dim: "#8a8a8a" },
];

const ENGINES: { id: EngineId; name: string; desc: string }[] = [
  { id: "wordpop", name: "Word Pop", desc: "One power word at a time, punched in sync with the voice." },
  { id: "lowerthird", name: "Lower Third", desc: "Cinematic caption band across the lower third." },
  { id: "quoteframe", name: "Quote Frame", desc: "Framed centre quote with rule lines and attribution." },
  { id: "kinetic", name: "Kinetic Stack", desc: "Lines stack and slide with a progress rail." },
  { id: "spotlight", name: "Spotlight", desc: "Vignette spotlight with karaoke word highlight." },
  { id: "typo-serif", name: "Typo · Editorial Serif", desc: "Italic serif quote, magazine styling." },
  { id: "typo-stack", name: "Typo · Word Stack", desc: "Words stacked and lit word-by-word." },
  { id: "typo-outline", name: "Typo · Outline Fill", desc: "Outlined caps filling with colour as spoken." },
  { id: "typo-gradient", name: "Typo · Gradient Fill", desc: "Bold gradient-filled statement type." },
  { id: "typo-poster", name: "Typo · Poster Block", desc: "Condensed poster block, alternating colour." },
  { id: "typo-mono", name: "Typo · Mono Terminal", desc: "Monospace quote typed in sync." },
  { id: "typo-band", name: "Typo · Colour Bands", desc: "Each line set on a solid colour band." },
  { id: "typo-ticker", name: "Typo · Kinetic Ticker", desc: "Alternating left/right line ticker." },
  { id: "typo-vertical", name: "Typo · Vertical Column", desc: "Letters stacked vertically with shimmer." },
  { id: "typo-split", name: "Typo · Split Slide", desc: "Alternating lines sliding in with a rail." },
];


type Template = { id: string; name: string; engine: EngineId; palette: Palette };
const TEMPLATES: Template[] = ENGINES.flatMap((e) =>
  PALETTES.map((p) => ({ id: `${e.id}-${p.id}`, name: `${e.name} · ${p.name}`, engine: e.id, palette: p })),
);

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
const FONT = `"Inter", "Helvetica Neue", Arial, sans-serif`;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

// -------------------- render --------------------

type Backdrop =
  | { kind: "video"; el: HTMLVideoElement }
  | { kind: "images"; imgs: HTMLImageElement[]; per: number }
  | { kind: "none" };

type RenderCtx = {
  t: number;
  w: number;
  h: number;
  aspect: AspectKey;
  palette: Palette;
  lines: TimedLine[];
  duration: number;
  author: string;
  dim: number;
  backdrop: Backdrop;
};

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
    const kb = (k: number) => 1.06 + k * 0.1;
    const cur = backdrop.imgs[i];
    ctx.globalAlpha = 1;
    drawCover(ctx, cur, cur.naturalWidth, cur.naturalHeight, w, h, kb(local), 0, -local * h * 0.02);
    if (local > 1 - fade && backdrop.imgs.length > 1) {
      const a = (local - (1 - fade)) / fade;
      const nx = backdrop.imgs[nextI];
      ctx.globalAlpha = a;
      drawCover(ctx, nx, nx.naturalWidth, nx.naturalHeight, w, h, kb(0));
      ctx.globalAlpha = 1;
    }
  }

  // dim + vignette so the text always reads
  ctx.fillStyle = `rgba(0,0,0,${r.dim})`;
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function activeLine(lines: TimedLine[], t: number): { line?: TimedLine; index: number } {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) index = i;
    else break;
  }
  return { line: index >= 0 ? lines[index] : undefined, index };
}

function activeWord(line: TimedLine | undefined, t: number): TranscriptWord | undefined {
  if (!line?.words.length) return undefined;
  let w = line.words[0];
  for (const cand of line.words) {
    if (cand.start <= t) w = cand;
    else break;
  }
  return w;
}

function drawAuthor(ctx: CanvasRenderingContext2D, r: RenderCtx, y: number) {
  if (!r.author) return;
  ctx.font = `600 ${Math.round(r.h * 0.018)}px ${FONT}`;
  ctx.fillStyle = hexA(r.palette.primary, 0.9);
  ctx.textAlign = "center";
  ctx.fillText(`— ${r.author.toUpperCase()}`, r.w / 2, y);
}

function renderWordPop(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, t, palette: p } = r;
  const { line } = activeLine(r.lines, t);
  const word = activeWord(line, t);
  if (!word) return;
  const life = Math.max(0.12, word.end - word.start);
  const k = Math.max(0, Math.min(1, (t - word.start) / Math.min(0.22, life)));
  const pop = 0.86 + easeOutCubic(k) * 0.14;
  ctx.save();
  ctx.translate(w / 2, h * 0.5);
  ctx.scale(pop, pop);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = Math.round(h * 0.11);
  ctx.font = `900 ${size}px ${FONT}`;
  while (ctx.measureText(word.text.toUpperCase()).width > w * 0.86 && size > 20) {
    size -= 4;
    ctx.font = `900 ${size}px ${FONT}`;
  }
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = size * 0.3;
  ctx.fillStyle = p.text;
  ctx.fillText(word.text.toUpperCase(), 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
  // underline accent
  ctx.fillStyle = p.primary;
  ctx.fillRect(w / 2 - w * 0.06, h * 0.5 + h * 0.075, w * 0.12, Math.max(3, h * 0.004));
  drawAuthor(ctx, r, h * 0.9);
}

function renderLowerThird(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, t, palette: p } = r;
  const { line } = activeLine(r.lines, t);
  if (!line) return;
  const appear = easeOutCubic(Math.min(1, (t - line.time) / 0.28));
  const size = Math.round(h * (r.aspect === "16:9" ? 0.05 : 0.04));
  ctx.font = `700 ${size}px ${FONT}`;
  const rows = wrapText(ctx, line.text, w * 0.78);
  const padY = size * 0.7;
  const boxH = rows.length * size * 1.24 + padY * 2;
  const boxY = h * 0.74 - boxH / 2;
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, w * 0.08, boxY, w * 0.84, boxH, size * 0.25);
  ctx.fill();
  ctx.fillStyle = p.primary;
  ctx.fillRect(w * 0.08, boxY, Math.max(4, w * 0.006), boxH);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let y = boxY + padY + size * 0.62;
  const words = line.words;
  for (const row of rows) {
    ctx.fillStyle = p.text;
    ctx.fillText(row, w * 0.12, y);
    y += size * 1.24;
  }
  if (words.length) {
    const cur = activeWord(line, t);
    if (cur) {
      ctx.fillStyle = hexA(p.primary, 0.9);
      ctx.font = `600 ${Math.round(size * 0.42)}px ${FONT}`;
      ctx.fillText(cur.text.toUpperCase(), w * 0.12, boxY + boxH + size * 0.5);
    }
  }
  ctx.restore();
  drawAuthor(ctx, r, h * 0.94);
}

function renderQuoteFrame(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, t, palette: p } = r;
  const { line } = activeLine(r.lines, t);
  const inset = w * 0.08;
  ctx.strokeStyle = hexA(p.primary, 0.6);
  ctx.lineWidth = Math.max(1.5, h * 0.0018);
  ctx.strokeRect(inset, inset * (r.aspect === "9:16" ? 0.6 : 1), w - inset * 2, h - inset * (r.aspect === "9:16" ? 1.2 : 2));
  if (!line) return;
  const appear = easeOutCubic(Math.min(1, (t - line.time) / 0.35));
  const size = Math.round(h * (r.aspect === "16:9" ? 0.055 : 0.046));
  ctx.font = `300 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const rows = wrapText(ctx, `“${line.text}”`, w * 0.72);
  let y = h * 0.5 - ((rows.length - 1) * size * 1.35) / 2;
  ctx.globalAlpha = appear;
  for (const row of rows) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(row, w / 2 + 2, y + 3);
    ctx.fillStyle = p.text;
    ctx.fillText(row, w / 2, y);
    y += size * 1.35;
  }
  ctx.globalAlpha = 1;
  const ruleY = y + size * 0.4;
  ctx.strokeStyle = hexA(p.primary, 0.8);
  ctx.beginPath();
  ctx.moveTo(w / 2 - w * 0.08, ruleY);
  ctx.lineTo(w / 2 + w * 0.08, ruleY);
  ctx.stroke();
  drawAuthor(ctx, r, ruleY + size * 0.7);
}

function renderKinetic(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, t, palette: p, lines, duration } = r;
  const { index } = activeLine(lines, t);
  const size = Math.round(h * (r.aspect === "16:9" ? 0.048 : 0.038));
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const focus = h * 0.55;
  const gap = size * 1.9;
  const cur = lines[index];
  let slide = 0;
  if (cur) slide = easeOutCubic(Math.min(1, (t - cur.time) / 0.4));
  for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 3); i++) {
    const y = focus + (i - index - (1 - slide)) * gap;
    const active = i === index;
    ctx.globalAlpha = active ? 1 : 0.3;
    ctx.font = `${active ? 800 : 500} ${Math.round(active ? size * 1.15 : size)}px ${FONT}`;
    ctx.fillStyle = active ? p.text : hexA(p.text, 0.85);
    const rows = wrapText(ctx, lines[i].text, w * 0.74);
    let yy = y;
    for (const row of rows) {
      ctx.fillText(row, w * 0.12, yy);
      yy += size * 1.2;
    }
    if (active) {
      ctx.fillStyle = p.primary;
      ctx.fillRect(w * 0.08, y - size * 0.6, Math.max(3, w * 0.005), size * 1.2);
    }
  }
  ctx.globalAlpha = 1;
  const prog = duration > 0 ? Math.min(1, t / duration) : 0;
  ctx.fillStyle = hexA(p.text, 0.15);
  ctx.fillRect(w * 0.08, h * 0.92, w * 0.84, Math.max(2, h * 0.003));
  ctx.fillStyle = p.primary;
  ctx.fillRect(w * 0.08, h * 0.92, w * 0.84 * prog, Math.max(2, h * 0.003));
  drawAuthor(ctx, r, h * 0.96);
}

function renderSpotlight(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, t, palette: p } = r;
  const spot = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, Math.max(w, h) * 0.5);
  spot.addColorStop(0, hexA(p.primary, 0.16));
  spot.addColorStop(0.6, "rgba(0,0,0,0.35)");
  spot.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);

  const { line } = activeLine(r.lines, t);
  if (!line) return;
  const size = Math.round(h * (r.aspect === "16:9" ? 0.058 : 0.048));
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textBaseline = "middle";
  const words = line.words.length ? line.words : line.text.split(" ").map((tx) => ({ text: tx, start: line.time, end: line.end }));
  const rows: TranscriptWord[][] = [];
  let row: TranscriptWord[] = [];
  for (const word of words) {
    const test = [...row, word].map((x) => x.text).join(" ");
    if (ctx.measureText(test).width > w * 0.8 && row.length) {
      rows.push(row);
      row = [word];
    } else row.push(word);
  }
  if (row.length) rows.push(row);
  let y = h * 0.5 - ((rows.length - 1) * size * 1.25) / 2;
  for (const rw of rows) {
    const widths = rw.map((x) => ctx.measureText(x.text + " ").width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = w / 2 - total / 2;
    ctx.textAlign = "left";
    rw.forEach((word, i) => {
      const spoken = t >= word.start;
      ctx.fillStyle = spoken ? p.accent : hexA(p.text, 0.35);
      if (spoken && t <= word.end) {
        ctx.shadowColor = hexA(p.primary, 0.85);
        ctx.shadowBlur = size * 0.5;
      }
      ctx.fillText(word.text.toUpperCase(), x, y);
      ctx.shadowBlur = 0;
      x += widths[i];
    });
    y += size * 1.25;
  }
  ctx.textAlign = "center";
  drawAuthor(ctx, r, h * 0.9);
}

// -------------------- typography engines --------------------

const SERIF = `Georgia, "Times New Roman", serif`;
const MONO = `"JetBrains Mono", "SFMono-Regular", Menlo, monospace`;
const COND = `"Arial Narrow", "Helvetica Neue Condensed", Impact, sans-serif`;

function typoState(r: RenderCtx) {
  const { line } = activeLine(r.lines, r.t);
  const text = line?.text ?? "";
  const span = line ? Math.max(0.4, line.end - line.time) : 1;
  const frac = line ? Math.max(0, Math.min(1, (r.t - line.time) / span)) : 0;
  const appear = line ? easeOutCubic(Math.min(1, (r.t - line.time) / 0.3)) : 0;
  return { line, text, frac, appear };
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, spec: string) {
  let s = start;
  ctx.font = spec.replace("{s}", String(s));
  while (ctx.measureText(text).width > maxW && s > 16) {
    s -= 2;
    ctx.font = spec.replace("{s}", String(s));
  }
  return s;
}

function renderTypoSerif(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p } = r;
  const { text, appear } = typoState(r);
  if (!text) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = Math.round(h * (r.aspect === "9:16" ? 0.05 : 0.066));
  ctx.font = `400 italic ${size}px ${SERIF}`;
  const rows = wrapText(ctx, text, w * 0.78);
  let y = h * 0.5 - ((rows.length - 1) * size * 1.32) / 2;
  ctx.globalAlpha = appear;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = size * 0.35;
  for (const row of rows) {
    ctx.fillStyle = p.text;
    ctx.fillText(row, w / 2, y + (1 - appear) * size * 0.2);
    y += size * 1.32;
  }
  ctx.restore();
  drawAuthor(ctx, r, y + size * 0.6);
}

function renderTypoStack(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p } = r;
  const { line, text, appear } = typoState(r);
  if (!text) return;
  const words = (line?.words.length ? line.words.map((x) => x.text) : text.split(" ")).slice(0, 5);
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const size = Math.round(h * (r.aspect === "9:16" ? 0.075 : 0.095));
  let y = h * 0.5 - (words.length * size * 1.02) / 2 + size * 0.5;
  words.forEach((word, i) => {
    const wd = line?.words[i];
    const lit = !wd || r.t >= wd.start;
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.globalAlpha = appear;
    ctx.fillStyle = lit ? p.text : hexA(p.text, 0.25);
    ctx.fillText(word.toUpperCase(), w * 0.11, y);
    if (lit) {
      ctx.fillStyle = p.primary;
      ctx.fillRect(w * 0.07, y - size * 0.3, Math.max(3, w * 0.006), size * 0.6);
    }
    y += size * 1.02;
  });
  ctx.restore();
}

function renderTypoOutline(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p } = r;
  const { text, frac } = typoState(r);
  if (!text) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = Math.round(h * (r.aspect === "9:16" ? 0.07 : 0.092));
  ctx.font = `900 ${size}px ${FONT}`;
  const rows = wrapText(ctx, text.toUpperCase(), w * 0.86);
  let y = h * 0.5 - ((rows.length - 1) * size * 1.12) / 2;
  for (const row of rows) {
    const tw = ctx.measureText(row).width;
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.strokeStyle = hexA(p.text, 0.9);
    ctx.strokeText(row, w / 2, y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - tw / 2, y - size * 0.6, tw * frac, size * 1.2);
    ctx.clip();
    ctx.fillStyle = p.primary;
    ctx.fillText(row, w / 2, y);
    ctx.restore();
    y += size * 1.12;
  }
  ctx.restore();
  drawAuthor(ctx, r, y + size * 0.3);
}

function renderTypoGradient(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p } = r;
  const { text, appear } = typoState(r);
  if (!text) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = Math.round(h * (r.aspect === "9:16" ? 0.072 : 0.095));
  ctx.font = `900 ${size}px ${FONT}`;
  const rows = wrapText(ctx, text.toUpperCase(), w * 0.86);
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
  drawAuthor(ctx, r, y + size * 0.3);
}

function renderTypoPoster(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p } = r;
  const { text, appear } = typoState(r);
  if (!text) return;
  const rows = text.toUpperCase().split(" ").reduce<string[]>((acc, word) => {
    if (!acc.length) return [word];
    const last = acc[acc.length - 1];
    if ((last + " " + word).length <= 12) acc[acc.length - 1] = last + " " + word;
    else acc.push(word);
    return acc;
  }, []);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const base = Math.round((h * (r.aspect === "9:16" ? 0.15 : 0.18)) / Math.max(1, rows.length * 0.55));
  let y = h * 0.5 - ((rows.length - 1) * base * 0.95) / 2;
  ctx.globalAlpha = appear;
  rows.forEach((row, i) => {
    const s = fitFont(ctx, row, w * 0.9, base, `900 {s}px ${COND}`);
    ctx.fillStyle = i % 2 ? p.primary : p.text;
    ctx.fillText(row, w / 2, y);
    y += s * 0.98;
  });
  ctx.restore();
  drawAuthor(ctx, r, y + base * 0.3);
}

function renderTypoMono(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p } = r;
  const { text, frac } = typoState(r);
  if (!text) return;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const size = Math.round(h * (r.aspect === "9:16" ? 0.03 : 0.04));
  ctx.font = `500 ${size}px ${MONO}`;
  const shown = text.slice(0, Math.ceil(text.length * Math.min(1, frac * 1.5)));
  const rows = wrapText(ctx, shown, w * 0.74);
  let y = h * 0.5 - ((rows.length - 1) * size * 1.6) / 2;
  for (const row of rows) {
    ctx.fillStyle = p.text;
    ctx.fillText(row, w * 0.13, y);
    y += size * 1.6;
  }
  ctx.fillStyle = p.primary;
  ctx.fillRect(w * 0.13, h * 0.5 - ((rows.length + 1) * size * 1.6) / 2, w * 0.06, Math.max(2, h * 0.003));
  ctx.restore();
  drawAuthor(ctx, r, y + size);
}

function renderTypoBand(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p } = r;
  const { text, appear } = typoState(r);
  if (!text) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = Math.round(h * (r.aspect === "9:16" ? 0.055 : 0.07));
  ctx.font = `800 ${size}px ${FONT}`;
  const rows = wrapText(ctx, text.toUpperCase(), w * 0.72);
  let y = h * 0.5 - ((rows.length - 1) * size * 1.35) / 2;
  for (const row of rows) {
    const tw = ctx.measureText(row).width;
    ctx.globalAlpha = appear;
    ctx.fillStyle = p.primary;
    roundRect(ctx, w / 2 - tw / 2 - size * 0.35, y - size * 0.62, tw + size * 0.7, size * 1.24, size * 0.14);
    ctx.fill();
    ctx.fillStyle = "#0b0b0c";
    ctx.fillText(row, w / 2, y);
    y += size * 1.35;
  }
  ctx.restore();
  drawAuthor(ctx, r, y + size * 0.2);
}

function renderTypoTicker(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p, lines } = r;
  const { index } = activeLine(lines, r.t);
  if (index < 0) return;
  ctx.save();
  ctx.textBaseline = "middle";
  const size = Math.round(h * (r.aspect === "9:16" ? 0.042 : 0.055));
  for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 2); i++) {
    const off = i - index;
    const y = h * 0.5 + off * size * 1.9;
    const active = off === 0;
    ctx.globalAlpha = active ? 1 : 0.22;
    ctx.font = `${active ? 900 : 500} ${Math.round(active ? size * 1.15 : size)}px ${FONT}`;
    ctx.textAlign = i % 2 ? "right" : "left";
    ctx.fillStyle = active ? p.text : hexA(p.text, 0.85);
    ctx.fillText(lines[i].text.toUpperCase(), i % 2 ? w * 0.92 : w * 0.08, y);
  }
  ctx.restore();
}

function renderTypoVertical(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p } = r;
  const { text, appear } = typoState(r);
  if (!text) return;
  const chars = [...text.toUpperCase()].slice(0, 14);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = Math.round(Math.min(h / Math.max(6, chars.length + 2), h * 0.085));
  let y = h * 0.5 - (chars.length - 1) * size * 0.5;
  chars.forEach((c, i) => {
    ctx.globalAlpha = appear * (0.55 + 0.45 * Math.abs(Math.sin(r.t * 2 + i * 0.4)));
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.fillStyle = i % 2 ? p.primary : p.text;
    ctx.fillText(c === " " ? "·" : c, w / 2, y);
    y += size;
  });
  ctx.restore();
}

function renderTypoSplit(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  drawBackdrop(ctx, r);
  const { w, h, palette: p } = r;
  const { text, appear, frac } = typoState(r);
  if (!text) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = Math.round(h * (r.aspect === "9:16" ? 0.062 : 0.08));
  ctx.font = `900 ${size}px ${FONT}`;
  const rows = wrapText(ctx, text.toUpperCase(), w * 0.8);
  const slide = (1 - appear) * w * 0.06;
  let y = h * 0.5 - ((rows.length - 1) * size * 1.2) / 2;
  rows.forEach((row, i) => {
    ctx.globalAlpha = appear;
    ctx.fillStyle = i % 2 ? p.accent : p.text;
    ctx.fillText(row, w / 2 + (i % 2 ? slide : -slide), y);
    y += size * 1.2;
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = hexA(p.primary, 0.85);
  ctx.fillRect(w * 0.5 - w * 0.12, y + size * 0.15, w * 0.24 * frac, Math.max(2, h * 0.003));
  ctx.restore();
  drawAuthor(ctx, r, y + size * 0.7);
}

function renderEngine(ctx: CanvasRenderingContext2D, engine: EngineId, r: RenderCtx) {
  switch (engine) {
    case "wordpop":
      return renderWordPop(ctx, r);
    case "lowerthird":
      return renderLowerThird(ctx, r);
    case "quoteframe":
      return renderQuoteFrame(ctx, r);
    case "kinetic":
      return renderKinetic(ctx, r);
    case "spotlight":
      return renderSpotlight(ctx, r);
    case "typo-serif":
      return renderTypoSerif(ctx, r);
    case "typo-stack":
      return renderTypoStack(ctx, r);
    case "typo-outline":
      return renderTypoOutline(ctx, r);
    case "typo-gradient":
      return renderTypoGradient(ctx, r);
    case "typo-poster":
      return renderTypoPoster(ctx, r);
    case "typo-mono":
      return renderTypoMono(ctx, r);
    case "typo-band":
      return renderTypoBand(ctx, r);
    case "typo-ticker":
      return renderTypoTicker(ctx, r);
    case "typo-vertical":
      return renderTypoVertical(ctx, r);
    case "typo-split":
      return renderTypoSplit(ctx, r);
  }
}


// -------------------- component --------------------

function MotivationalVideosPage() {
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [engineFilter, setEngineFilter] = useState("all");
  const [author, setAuthor] = useState("");
  const [dim, setDim] = useState(0.35);
  const [wordsPerLine, setWordsPerLine] = useState(6);
  const [slidePer, setSlidePer] = useState(4);
  // template customisation
  const [accentColor, setAccentColor] = useState("");
  const [textColor, setTextColor] = useState("");
  const [uppercase, setUppercase] = useState(false);
  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, id: "none" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, id: "none" });

  const [mediaKind, setMediaKind] = useState<"none" | "video" | "audio">("none");
  const [mediaName, setMediaName] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const [images, setImages] = useState<{ id: string; url: string; img: HTMLImageElement }[]>([]);
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

  const dims = ASPECTS[aspect];
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  // Template colours can be overridden per project.
  const palette = useMemo(
    () => ({
      ...template.palette,
      primary: accentColor || template.palette.primary,
      accent: accentColor || template.palette.accent,
      text: textColor || template.palette.text,
    }),
    [template, accentColor, textColor],
  );


  const backdrop: Backdrop = useMemo(() => {
    if (mediaKind === "video" && videoRef.current) return { kind: "video", el: videoRef.current };
    if (images.length) return { kind: "images", imgs: images.map((i) => i.img), per: slidePer };
    return { kind: "none" };
  }, [mediaKind, images, slidePer, mediaUrl]);

  const mediaEl = () => (mediaKind === "video" ? videoRef.current : audioRef.current);

  const onMedia = (f: File) => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const url = URL.createObjectURL(f);
    const isVideo = f.type.startsWith("video");
    setMediaUrl(url);
    setMediaFile(f);
    setMediaName(f.name);
    setMediaKind(isVideo ? "video" : "audio");
    setLines([]);
    setWords([]);
    setTranscript("");
    if (isVideo) {
      const v = document.createElement("video");
      v.src = url;
      v.muted = false;
      v.playsInline = true;
      v.preload = "auto";
      v.addEventListener("loadedmetadata", () => setDuration(isFinite(v.duration) ? v.duration : 0));
      videoRef.current = v;
      audioRef.current = null;
    } else {
      const a = new Audio(url);
      a.addEventListener("loadedmetadata", () => setDuration(isFinite(a.duration) ? a.duration : 0));
      audioRef.current = a;
      videoRef.current = null;
    }
  };

  const clearMedia = () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    videoRef.current?.pause();
    audioRef.current?.pause();
    videoRef.current = null;
    audioRef.current = null;
    setMediaUrl(null);
    setMediaFile(null);
    setMediaName(null);
    setMediaKind("none");
    setDuration(0);
    setPlaying(false);
  };

  const addImages = (files: FileList) => {
    Array.from(files).forEach((f) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () =>
        setImages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, url, img }]);
      img.src = url;
    });
  };

  const removeImage = (id: string) =>
    setImages((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((i) => i.id !== id);
    });

  const runTranscribe = async () => {
    if (!mediaFile) {
      toast("Upload the speech video or audio first");
      return;
    }
    setTranscribing(true);
    try {
      const res = await transcribeFile(mediaFile, { provider: sttProvider });
      setTranscript(res.text);
      if (res.words.length) {
        setWords(res.words);
        setLines(wordsToLines(res.words, { maxWords: wordsPerLine, maxChars: wordsPerLine * 7 }));
        toast.success(`Transcribed ${res.words.length} words with exact timing`);
      } else if (res.text.trim()) {
        const chunks = res.text.split(/(?<=[.!?])\s+/).filter(Boolean);
        const per = (duration || chunks.length * 3) / Math.max(1, chunks.length);
        setWords([]);
        setLines(
          chunks.map((text, i) => ({
            time: i * per,
            end: (i + 1) * per,
            text,
            words: [],
          })),
        );
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

  // regroup when words-per-line changes
  useEffect(() => {
    if (words.length) {
      setLines(wordsToLines(words, { maxWords: wordsPerLine, maxChars: wordsPerLine * 7 }));
    }
  }, [wordsPerLine, words]);

  const applyManualText = (text: string) => {
    setTranscript(text);
    const chunks = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!chunks.length) {
      setLines([]);
      return;
    }
    setWords([]);
    const per = (duration || chunks.length * 3) / chunks.length;
    setLines(chunks.map((t, i) => ({ time: i * per, end: (i + 1) * per, text: t, words: [] })));
  };

  const shownLines = useMemo(
    () => (uppercase ? lines.map((l) => ({ ...l, text: l.text.toUpperCase() })) : lines),
    [lines, uppercase],
  );

  /** Draws one frame: engine + optional intro / outro cards over the top. */
  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, bd: Backdrop) => {
      renderEngine(ctx, template.engine, {
        t,
        w,
        h,
        aspect,
        palette,
        lines: shownLines,
        duration,
        author,
        dim,
        backdrop: bd,
      });
      if (intro.id !== "none" && t < intro.seconds) {
        INTRO_ANIMATIONS.find((a) => a.id === intro.id)?.draw({
          ctx,
          w,
          h,
          p: Math.min(1, t / Math.max(0.2, intro.seconds)),
          palette: paletteOf(intro.paletteId),
          title: intro.title,
          subtitle: intro.subtitle,
          logo: null,
        });
      }
      if (outro.id !== "none" && duration > 0 && t > duration - outro.seconds) {
        OUTRO_ANIMATIONS.find((a) => a.id === outro.id)?.draw({
          ctx,
          w,
          h,
          p: Math.min(1, (t - (duration - outro.seconds)) / Math.max(0.2, outro.seconds)),
          palette: paletteOf(outro.paletteId),
          title: outro.title,
          subtitle: outro.subtitle,
          logo: null,
        });
      }
    },
    [template, aspect, palette, shownLines, duration, author, dim, intro, outro],
  );

  const drawAt = useCallback(
    (canvas: HTMLCanvasElement, t: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      paint(ctx, canvas.width, canvas.height, t, backdrop);
    },
    [paint, backdrop],
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
      const el = mediaEl();
      const t = el ? el.currentTime : timeRef.current;
      timeRef.current = t;
      if (frames++ % 6 === 0) setCurrentTime(t);
      drawAt(canvas, t);
      if (duration > 0 && t >= duration - 0.05) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, duration, drawAt]);

  const togglePlay = async () => {
    const el = mediaEl();
    if (!el) {
      toast("Upload a video or audio clip first");
      return;
    }
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        await el.play();
      } catch {
        toast.error("Couldn't start playback");
        return;
      }
      setPlaying(true);
    }
  };

  const seek = (v: number) => {
    timeRef.current = v;
    setCurrentTime(v);
    const el = mediaEl();
    if (el) el.currentTime = v;
    const canvas = canvasRef.current;
    if (canvas) drawAt(canvas, v);
  };

  const exportVideo = async () => {
    if (!mediaUrl || duration <= 0) {
      toast("Upload a video or audio clip first");
      return;
    }
    if (!lines.length) {
      toast("Transcribe or type the quote first");
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
      const ab = await (await fetch(mediaUrl)).arrayBuffer();
      let src: AudioBufferSourceNode | null = null;
      try {
        const buf = await ac.decodeAudioData(ab.slice(0));
        src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
      } catch {
        // Some video containers can't be decoded directly; fall back to silent track.
        console.warn("Audio track could not be decoded for export");
      }
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));

      let exportBackdrop: Backdrop = backdrop;
      if (mediaKind === "video") {
        renderVideo = document.createElement("video");
        renderVideo.src = mediaUrl;
        renderVideo.muted = true;
        renderVideo.playsInline = true;
        await new Promise<void>((res) => {
          renderVideo!.addEventListener("loadeddata", () => res(), { once: true });
        });
        await renderVideo.play().catch(() => {});
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
      src?.start();
      rec.start(100);
      const loop = () => {
        if (!running) return;
        const t = (performance.now() - t0) / 1000;
        setExportProgress(Math.min(100, (t / duration) * 100));
        paint(octx, off.width, off.height, t, exportBackdrop);
        if (t >= duration) {
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
      a.download = `motivational-${template.engine}.${ext}`;
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

  const shownTemplates =
    engineFilter === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.engine === engineFilter);

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg">
          <Quote className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Motivational Quote Videos</h1>
          <p className="mt-1 text-muted-foreground">
            Upload a speech clip, get word-accurate on-screen captions and pick from {TEMPLATES.length}{" "}
            professional templates. Exports 1080p at 60fps.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr_360px]">
        {/* Left: media + transcript */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Speech clip</CardTitle>
              <CardDescription>Video or audio — the voice drives the caption timing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mediaUrl ? (
                <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="truncate">
                    {mediaKind === "video" ? <Film className="mr-1 inline h-3.5 w-3.5" /> : null}
                    {mediaName}
                  </span>
                  <Button variant="ghost" size="sm" onClick={clearMedia}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="mr-2 h-4 w-4" /> Upload video or audio
                  <input
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onMedia(e.target.files[0])}
                  />
                </label>
              )}
              {duration > 0 && (
                <p className="text-xs text-muted-foreground">{fmtTime(duration)} duration</p>
              )}
              <div>
                <Label>Attribution</Label>
                <Input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Speaker name (optional)"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Background images</CardTitle>
              <CardDescription>
                Used when there's no video, or as a slideshow backdrop for audio clips.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
                    <Slider min={2} max={10} step={1} value={[slidePer]} onValueChange={(v) => setSlidePer(v[0])} />
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
              <CardTitle className="text-base">Transcript</CardTitle>
              <CardDescription>
                Auto-transcribed with word-level timing so on-screen text matches the voice exactly.
              </CardDescription>
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

              <Button onClick={runTranscribe} disabled={transcribing || !mediaFile} className="w-full">
                {transcribing ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Transcribing…
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-1 h-4 w-4" /> Transcribe speech
                  </>
                )}
              </Button>
              <div>
                <Label className="text-xs">Words per caption · {wordsPerLine}</Label>
                <Slider
                  min={2}
                  max={12}
                  step={1}
                  value={[wordsPerLine]}
                  onValueChange={(v) => setWordsPerLine(v[0])}
                />
              </div>
              <Textarea
                rows={8}
                value={transcript}
                onChange={(e) => applyManualText(e.target.value)}
                placeholder="Transcript appears here — or type your quote, one line per caption."
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
                  <TabsTrigger value="9:16">9:16</TabsTrigger>
                  <TabsTrigger value="1:1">1:1</TabsTrigger>
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
                <Button size="icon" onClick={togglePlay} disabled={!mediaUrl}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="w-16 text-xs text-muted-foreground">{fmtTime(currentTime)}</span>
                <Slider
                  min={0}
                  max={Math.max(duration, 0.01)}
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
                <Button onClick={exportVideo} disabled={exporting || !mediaUrl || !lines.length}>
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
              <CardTitle className="text-base">Customise</CardTitle>
              <CardDescription>Recolour any template and set the caption case.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Accent</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="color"
                      className="h-9 w-12 p-1"
                      value={accentColor || template.palette.primary}
                      onChange={(e) => setAccentColor(e.target.value)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setAccentColor("")}>
                      Reset
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Text</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="color"
                      className="h-9 w-12 p-1"
                      value={textColor || template.palette.text}
                      onChange={(e) => setTextColor(e.target.value)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setTextColor("")}>
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Uppercase captions</Label>
                  <p className="text-xs text-muted-foreground">Punchier, poster-style delivery.</p>
                </div>
                <Switch checked={uppercase} onCheckedChange={setUppercase} />
              </div>
            </CardContent>
          </Card>

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
              <CardDescription>{shownTemplates.length} designs · every aspect ratio.</CardDescription>
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
                  {ENGINES.find((e) => e.id === engineFilter)?.desc ?? "Mix of every quote style."}
                </p>
              </div>
              <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
                {shownTemplates.map((t) => {
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
                        className="mb-2 flex h-20 items-center justify-center rounded-md"
                        style={{
                          background: `linear-gradient(140deg, ${t.palette.bg[0]}, ${t.palette.bg[1]})`,
                        }}
                      >
                        <Quote className="h-7 w-7" style={{ color: t.palette.primary }} />
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
