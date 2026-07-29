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

export const Route = createFileRoute("/_authenticated/lyrical-videos")({
  head: () => ({
    meta: [
      { title: "Lyrical Videos — Orbit" },
      {
        name: "description",
        content:
          "Create Spotify-style lyrical videos in 9:16 or 16:9 with 30+ templates, rotating vinyls, karaoke highlights and full-HD 60fps export.",
      },
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

type LyricLine = { time: number; text: string };
type EngineId = "rolling" | "karaoke" | "spotify" | "neon" | "waveform";

type Palette = {
  id: string;
  name: string;
  bg: [string, string]; // gradient stops
  primary: string;
  accent: string;
  text: string;
  muted: string;
};

const PALETTES: Palette[] = [
  { id: "purple", name: "Neon Purple", bg: ["#1a0b2e", "#3d1a5c"], primary: "#c084fc", accent: "#f0abfc", text: "#ffffff", muted: "#b3a7d1" },
  { id: "sunset", name: "Sunset Orange", bg: ["#2a0e0e", "#5c2410"], primary: "#fb923c", accent: "#fde68a", text: "#fffbeb", muted: "#f8c9a6" },
  { id: "ocean", name: "Ocean Teal", bg: ["#062226", "#0e4a5c"], primary: "#5eead4", accent: "#a5f3fc", text: "#f0fdfa", muted: "#94e0d5" },
  { id: "cherry", name: "Cherry Red", bg: ["#1c0509", "#5c0e1f"], primary: "#f43f5e", accent: "#fda4af", text: "#fff1f2", muted: "#f9a8b4" },
  { id: "mono", name: "Mono White", bg: ["#0a0a0a", "#1f1f1f"], primary: "#ffffff", accent: "#a3a3a3", text: "#ffffff", muted: "#8b8b8b" },
  { id: "forest", name: "Forest Green", bg: ["#052014", "#0b4f2e"], primary: "#34d399", accent: "#bbf7d0", text: "#f0fdf4", muted: "#a7d9be" },
];

const ENGINES: { id: EngineId; name: string; desc: string }[] = [
  { id: "rolling", name: "Rolling Vinyl", desc: "Lyrics scroll bottom-to-middle, spinning vinyl on top." },
  { id: "karaoke", name: "Karaoke", desc: "Huge centered current lyric with next line preview." },
  { id: "spotify", name: "Spotify Card", desc: "Cover + track meta + progress bar with centered lyric." },
  { id: "neon", name: "Neon Glow", desc: "Neon-glow lyrics on dark backdrop." },
  { id: "waveform", name: "Waveform Pulse", desc: "Dancing waveform bars with a big centered word." },
];

type Template = {
  id: string;
  name: string;
  engine: EngineId;
  palette: Palette;
};

// 30 templates: 5 engines × 6 palettes — all support both aspect ratios.
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
  // Distribute plain lines evenly across audio (or a 30s fallback).
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

function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p.bg[0]);
  g.addColorStop(1, p.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // subtle animated radial glow
  const cx = w / 2 + Math.sin(t * 0.4) * w * 0.05;
  const cy = h / 2 + Math.cos(t * 0.3) * h * 0.05;
  const rad = Math.max(w, h) * 0.6;
  const rg = ctx.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad);
  rg.addColorStop(0, hexA(p.primary, 0.18));
  rg.addColorStop(1, "transparent");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
}

function hexA(hex: string, a: number) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
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
  ctx.rotate((t * Math.PI * 2) / 6); // one rotation every 6s
  // record
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0b0f";
  ctx.fill();
  // grooves
  ctx.strokeStyle = hexA(p.muted, 0.25);
  ctx.lineWidth = 1;
  for (let i = 4; i < r - 6; i += 6) {
    ctx.beginPath();
    ctx.arc(0, 0, i, 0, Math.PI * 2);
    ctx.stroke();
  }
  // label / cover in center
  const lr = r * 0.45;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, lr, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (coverImg) {
    const iw = coverImg.naturalWidth;
    const ih = coverImg.naturalHeight;
    const ratio = Math.max((lr * 2) / iw, (lr * 2) / ih);
    const dw = iw * ratio;
    const dh = ih * ratio;
    ctx.drawImage(coverImg, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.fillStyle = p.primary;
    ctx.fillRect(-lr, -lr, lr * 2, lr * 2);
  }
  ctx.restore();
  // spindle
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
}

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

function fontFace(w: number) {
  return `"Inter", "Helvetica Neue", Arial, sans-serif`;
}

function renderRolling(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, coverImg, title, artist, lyrics } = r;
  drawBg(ctx, w, h, p, t);

  // Vinyl area — top area of frame
  const vinylR = Math.min(w, h) * 0.18;
  const vinylY = h * 0.22;
  drawVinyl(ctx, w / 2, vinylY, vinylR, t, coverImg, p);

  // Song title & artist above vinyl (spotify-ish)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.text;
  ctx.font = `800 ${Math.round(h * 0.03)}px ${fontFace(w)}`;
  ctx.fillText(title || "Untitled", w / 2, h * 0.06);
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${Math.round(h * 0.022)}px ${fontFace(w)}`;
  ctx.fillText(artist || "Unknown artist", w / 2, h * 0.1);

  // Rolling lyrics: window under vinyl, scroll upward
  const lineSize = Math.round(h * 0.038);
  const gap = lineSize * 1.5;
  ctx.font = `700 ${lineSize}px ${fontFace(w)}`;
  const startY = h * 0.55; // "current" line target position
  const idx = findLineIndex(lyrics, t);
  const next = lyrics[idx + 1];
  const progress =
    idx >= 0 && next ? (t - lyrics[idx].time) / (next.time - lyrics[idx].time) : 0;

  const windowTop = vinylY + vinylR + h * 0.04;
  const windowBottom = h * 0.94;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, windowTop, w, windowBottom - windowTop);
  ctx.clip();

  for (let i = 0; i < lyrics.length; i++) {
    const lineY = startY + (i - idx - progress) * gap;
    if (lineY < windowTop - gap || lineY > windowBottom + gap) continue;
    const dist = Math.abs(lineY - startY) / (h * 0.35);
    const alpha = Math.max(0, 1 - dist);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i === idx ? p.accent : p.text;
    ctx.font = `${i === idx ? 800 : 600} ${
      i === idx ? Math.round(lineSize * 1.15) : lineSize
    }px ${fontFace(w)}`;
    ctx.fillText(lyrics[i].text, w / 2, lineY);
  }
  ctx.restore();

  // fade masks
  const fadeH = h * 0.12;
  const g1 = ctx.createLinearGradient(0, windowTop, 0, windowTop + fadeH);
  g1.addColorStop(0, p.bg[1]);
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1;
  ctx.fillRect(0, windowTop, w, fadeH);
  const g2 = ctx.createLinearGradient(0, windowBottom - fadeH, 0, windowBottom);
  g2.addColorStop(0, "transparent");
  g2.addColorStop(1, p.bg[1]);
  ctx.fillStyle = g2;
  ctx.fillRect(0, windowBottom - fadeH, w, fadeH);
}

function renderKaraoke(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, lyrics, title, artist } = r;
  drawBg(ctx, w, h, p, t);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${Math.round(h * 0.025)}px ${fontFace(w)}`;
  ctx.fillText(`${title || ""}${artist ? " · " + artist : ""}`, w / 2, h * 0.08);

  const idx = findLineIndex(lyrics, t);
  const cur = idx >= 0 ? lyrics[idx].text : "";
  const nxt = idx + 1 < lyrics.length ? lyrics[idx + 1].text : "";

  const maxWidth = w * 0.85;
  const curSize = Math.round(h * 0.075);
  ctx.font = `900 ${curSize}px ${fontFace(w)}`;
  const curLines = wrapText(ctx, cur.toUpperCase(), maxWidth);
  let y = h / 2 - (curLines.length - 1) * (curSize * 0.6);
  ctx.fillStyle = p.accent;
  for (const line of curLines) {
    ctx.fillText(line, w / 2, y);
    y += curSize * 1.2;
  }
  const nxtSize = Math.round(h * 0.035);
  ctx.font = `600 ${nxtSize}px ${fontFace(w)}`;
  ctx.fillStyle = hexA(p.text, 0.55);
  const nxtLines = wrapText(ctx, nxt, maxWidth);
  let ny = y + h * 0.03;
  for (const line of nxtLines) {
    ctx.fillText(line, w / 2, ny);
    ny += nxtSize * 1.3;
  }
}

function renderSpotify(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, coverImg, title, artist, lyrics, duration } = r;
  drawBg(ctx, w, h, p, t);

  // Cover card
  const cardSize = Math.min(w, h) * (r.aspect === "16:9" ? 0.35 : 0.5);
  const cx = w / 2;
  const cy = h * 0.28;
  const x0 = cx - cardSize / 2;
  const y0 = cy - cardSize / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#111";
  const rad = 24;
  roundRect(ctx, x0, y0, cardSize, cardSize, rad);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x0, y0, cardSize, cardSize, rad);
  ctx.clip();
  if (coverImg) {
    const iw = coverImg.naturalWidth;
    const ih = coverImg.naturalHeight;
    const ratio = Math.max(cardSize / iw, cardSize / ih);
    const dw = iw * ratio;
    const dh = ih * ratio;
    ctx.drawImage(coverImg, x0 + (cardSize - dw) / 2, y0 + (cardSize - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = p.primary;
    ctx.fillRect(x0, y0, cardSize, cardSize);
  }
  ctx.restore();

  // Song name / artist
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.text;
  ctx.font = `800 ${Math.round(h * 0.035)}px ${fontFace(w)}`;
  ctx.fillText(title || "Untitled", cx, cy + cardSize / 2 + h * 0.05);
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${Math.round(h * 0.025)}px ${fontFace(w)}`;
  ctx.fillText(artist || "Unknown artist", cx, cy + cardSize / 2 + h * 0.09);

  // Current lyric big center-lower
  const idx = findLineIndex(lyrics, t);
  const cur = idx >= 0 ? lyrics[idx].text : "";
  ctx.fillStyle = p.accent;
  ctx.font = `900 ${Math.round(h * 0.055)}px ${fontFace(w)}`;
  const lyr = wrapText(ctx, cur, w * 0.85);
  let ly = h * 0.7 - (lyr.length - 1) * h * 0.035;
  for (const l of lyr) {
    ctx.fillText(l, w / 2, ly);
    ly += h * 0.07;
  }

  // Progress bar
  const barY = h * 0.9;
  const barW = w * 0.8;
  const barX = (w - barW) / 2;
  const prog = duration > 0 ? Math.min(1, t / duration) : 0;
  ctx.fillStyle = hexA(p.text, 0.2);
  roundRect(ctx, barX, barY, barW, 6, 3);
  ctx.fill();
  ctx.fillStyle = p.primary;
  roundRect(ctx, barX, barY, barW * prog, 6, 3);
  ctx.fill();
  // dot
  ctx.beginPath();
  ctx.arc(barX + barW * prog, barY + 3, 10, 0, Math.PI * 2);
  ctx.fillStyle = p.text;
  ctx.fill();
  // time
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${Math.round(h * 0.016)}px ${fontFace(w)}`;
  ctx.textAlign = "left";
  ctx.fillText(fmtTime(t), barX, barY + 24);
  ctx.textAlign = "right";
  ctx.fillText(fmtTime(duration), barX + barW, barY + 24);
}

function renderNeon(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, lyrics, title, artist } = r;
  drawBg(ctx, w, h, p, t);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${Math.round(h * 0.022)}px ${fontFace(w)}`;
  ctx.fillText(`${title || ""}${artist ? " · " + artist : ""}`, w / 2, h * 0.08);

  const idx = findLineIndex(lyrics, t);
  const winSize = Math.round(h * 0.05);
  ctx.font = `900 ${winSize * 1.4}px ${fontFace(w)}`;
  const startY = h * 0.5;
  const gap = winSize * 1.9;
  const next = lyrics[idx + 1];
  const progress =
    idx >= 0 && next ? (t - lyrics[idx].time) / (next.time - lyrics[idx].time) : 0;

  ctx.save();
  ctx.shadowColor = p.primary;
  ctx.shadowBlur = 40;
  for (let i = 0; i < lyrics.length; i++) {
    const y = startY + (i - idx - progress) * gap;
    const dist = Math.abs(y - startY);
    if (dist > h * 0.5) continue;
    const alpha = Math.max(0, 1 - dist / (h * 0.45));
    ctx.globalAlpha = alpha;
    const active = i === idx;
    ctx.fillStyle = active ? p.accent : p.text;
    ctx.font = `${active ? 900 : 700} ${
      active ? Math.round(winSize * 1.6) : Math.round(winSize * 1.2)
    }px ${fontFace(w)}`;
    ctx.fillText(lyrics[i].text.toUpperCase(), w / 2, y);
  }
  ctx.restore();
}

function renderWaveform(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const { t, w, h, palette: p, lyrics, title, artist } = r;
  drawBg(ctx, w, h, p, t);

  // Waveform bars
  const bars = 40;
  const barW = (w * 0.9) / bars;
  const baseY = h * 0.85;
  for (let i = 0; i < bars; i++) {
    const phase = i * 0.4 + t * 6;
    const hgt =
      (Math.abs(Math.sin(phase)) * 0.6 + Math.abs(Math.sin(phase * 1.7)) * 0.4) *
      h *
      0.22;
    const x = w * 0.05 + i * barW;
    ctx.fillStyle = hexA(p.primary, 0.9);
    roundRect(ctx, x + barW * 0.15, baseY - hgt, barW * 0.7, hgt, barW * 0.2);
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${Math.round(h * 0.025)}px ${fontFace(w)}`;
  ctx.fillText(`${title || ""}${artist ? " · " + artist : ""}`, w / 2, h * 0.1);

  const idx = findLineIndex(lyrics, t);
  const cur = idx >= 0 ? lyrics[idx].text : "";
  ctx.fillStyle = p.accent;
  ctx.font = `900 ${Math.round(h * 0.08)}px ${fontFace(w)}`;
  const lyr = wrapText(ctx, cur.toUpperCase(), w * 0.85);
  let y = h * 0.45 - (lyr.length - 1) * h * 0.05;
  for (const l of lyr) {
    ctx.fillText(l, w / 2, y);
    y += h * 0.1;
  }
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
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function renderEngine(ctx: CanvasRenderingContext2D, engine: EngineId, r: RenderCtx) {
  switch (engine) {
    case "rolling":
      renderRolling(ctx, r);
      break;
    case "karaoke":
      renderKaraoke(ctx, r);
      break;
    case "spotify":
      renderSpotify(ctx, r);
      break;
    case "neon":
      renderNeon(ctx, r);
      break;
    case "waveform":
      renderWaveform(ctx, r);
      break;
  }
}

// -------------------- Component --------------------

function LyricalVideosPage() {
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverImg, setCoverImg] = useState<HTMLImageElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [lyricsText, setLyricsText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

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
    setAudioName(f.name);
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
    setAudioName(null);
    setAudioDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
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

  // Preview loop
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
    const tick = () => {
      const now = performance.now() / 1000;
      const t = now - startedAtRef.current;
      timeRef.current = t;
      setCurrentTime(t);
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
    if (!audioRef.current || audioDuration <= 0) {
      toast("Upload audio first");
      return;
    }
    if (!parsedLyrics.length) {
      toast("Add lyrics first");
      return;
    }
    setExporting(true);
    setExportProgress(0);
    try {
      // Render offscreen canvas at 1080p, 60fps
      const off = document.createElement("canvas");
      off.width = dims.w;
      off.height = dims.h;
      const stream = off.captureStream(60);

      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      const dest = ac.createMediaStreamDestination();
      const resp = await fetch(audioUrl!);
      const ab = await resp.arrayBuffer();
      const buf = await ac.decodeAudioData(ab);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(dest);

      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

      const mimeCandidates = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const rec = new MediaRecorder(stream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: 10_000_000,
        audioBitsPerSecond: 192_000,
      });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

      let running = true;
      const doneP = new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: mime.split(";")[0] || "video/webm" });
          resolve(blob);
        };
      });

      // Render loop synced to audio start
      const t0 = performance.now();
      src.start();
      rec.start(100);
      const frameLoop = () => {
        if (!running) return;
        const t = (performance.now() - t0) / 1000;
        setExportProgress(Math.min(100, (t / audioDuration) * 100));
        renderEngine(off.getContext("2d")!, template.engine, {
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
            /* */
          }
          setTimeout(() => rec.stop(), 200);
          return;
        }
        requestAnimationFrame(frameLoop);
      };
      requestAnimationFrame(frameLoop);

      const blob = await doneP;
      ac.close().catch(() => {});
      const ext = (blob.type.includes("mp4") ? "mp4" : "webm");
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

  const shownTemplates = TEMPLATES; // all 30 available for both aspects

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg">
          <Music4 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Lyrical Videos</h1>
          <p className="mt-1 text-muted-foreground">
            Spotify-style lyric videos with rotating vinyls, karaoke highlights and neon rolls. Exports at
            1080p · 60fps.
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
                    <img src={coverUrl} alt="cover" className="h-14 w-14 rounded object-cover" />
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
                Paste plain lyrics (auto-distributed across the song) or LRC format for accurate sync:{" "}
                <code className="rounded bg-muted px-1">[00:12.50] Line text</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                rows={12}
                placeholder={`[00:00.00] Intro line\n[00:04.20] Second line\n...`}
                className="font-mono text-sm"
              />
              {parsedLyrics.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {parsedLyrics.length} lines parsed
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
                <CardDescription>{dims.label} · {dims.w}×{dims.h} · 60fps</CardDescription>
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
                  style={{
                    aspectRatio: `${dims.w} / ${dims.h}`,
                    maxWidth: "100%",
                    height: "auto",
                  }}
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
        </div>

        {/* Right: templates */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Templates</CardTitle>
              <CardDescription>
                {shownTemplates.length} templates — filtered by engine.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <Label>Engine filter</Label>
                <Select
                  value={
                    (["all", ...ENGINES.map((e) => e.id)] as string[]).includes("all")
                      ? "all"
                      : "all"
                  }
                  onValueChange={() => {}}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All engines" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All engines</SelectItem>
                    {ENGINES.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                          background: `linear-gradient(135deg, ${t.palette.bg[0]}, ${t.palette.bg[1]})`,
                        }}
                      >
                        <Disc3
                          className="h-8 w-8"
                          style={{ color: t.palette.accent }}
                        />
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
