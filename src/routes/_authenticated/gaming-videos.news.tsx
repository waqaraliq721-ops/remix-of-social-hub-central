import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Newspaper, ArrowLeft, Play, Pause, Download, Loader2, Plus, Trash2, ImagePlus, Music, Upload, Wand2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FX_FONT, ease, hexA, roundRect, wrapText } from "@/lib/video-fx";
import { IntroOutroCard, defaultIntro, defaultOutro, paletteOf, type CardConfig } from "@/components/intro-outro-card";
import { ColorCustomiser, applyOverrides, type ColorOverrides, type PaletteLike } from "@/components/color-customiser";
import { INTRO_ANIMATIONS, OUTRO_ANIMATIONS } from "@/lib/video-fx";
import { TTS_PROVIDERS, TTS_VOICES, generateSpeech, blobDuration, type TtsProvider } from "@/lib/tts";

export const Route = createFileRoute("/_authenticated/gaming-videos/news")({
  head: () => ({
    meta: [
      { title: "News Recap Studio — Gaming Videos — Orbit" },
      {
        name: "description",
        content:
          "Turn gaming headlines into broadcast-style news recaps: 6 animated templates, scrolling ticker, AI voiceover and 1080p 60fps export.",
      },
      { property: "og:title", content: "News Recap Studio — Gaming Videos — Orbit" },
      {
        property: "og:description",
        content: "Breaking-news style gaming recaps with tickers, lower thirds and voiceover.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewsPage,
});

type AspectKey = "9:16" | "1:1" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · TikTok/Reels/Shorts" },
  "1:1": { w: 1080, h: 1080, label: "Square · Feed" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

type NewsItem = {
  id: string;
  headline: string;
  subtext: string;
  source: string;
  imgUrl: string | null;
  img: HTMLImageElement | null;
  voUrl: string | null;
  voBlob: Blob | null;
  voDur: number;
};

type TemplateId = "ticker" | "lowerthird" | "split" | "fullbleed" | "hud" | "magazine";
const TEMPLATES: { id: TemplateId; name: string; desc: string }[] = [
  { id: "ticker", name: "Breaking Ticker", desc: "Red breaking-news band with a scrolling ticker." },
  { id: "lowerthird", name: "Lower Third", desc: "Broadcast lower-third caption over full art." },
  { id: "split", name: "Split Card", desc: "Image left, headline and source right." },
  { id: "fullbleed", name: "Full Bleed Headline", desc: "Huge type over a dimmed full-bleed image." },
  { id: "hud", name: "Terminal / HUD", desc: "Monospace HUD readout with scanlines." },
  { id: "magazine", name: "Magazine", desc: "Editorial cover-style layout with kicker and rule lines." },
];

type Pal = PaletteLike & { id: string; name: string };
const PALETTES: Pal[] = [
  { id: "breaking", name: "Breaking Red", bg: ["#0a0505", "#2a0808"], primary: "#ef4444", accent: "#fbbf24", text: "#ffffff", muted: "#d6a3a3" },
  { id: "network", name: "Network Blue", bg: ["#02060d", "#0c1f3d"], primary: "#3b82f6", accent: "#f472b6", text: "#ffffff", muted: "#9db6d6" },
  { id: "hud", name: "HUD Green", bg: ["#010a05", "#04241a"], primary: "#22c55e", accent: "#a3e635", text: "#d8ffe8", muted: "#7fae91" },
  { id: "magazine", name: "Magazine Ink", bg: ["#0b0b0b", "#232323"], primary: "#f5f5f4", accent: "#f59e0b", text: "#ffffff", muted: "#a8a8a8" },
  { id: "violet", name: "Studio Violet", bg: ["#0a0618", "#2c0f52"], primary: "#a855f7", accent: "#22d3ee", text: "#ffffff", muted: "#c9b7e6" },
];

const uid = () => Math.random().toString(36).slice(2, 9);
function emptyItem(i: number): NewsItem {
  return {
    id: uid(),
    headline: `Big update rocks the meta #${i + 1}`,
    subtext: "Patch notes reveal major balance changes ahead of the next split.",
    source: "Orbit Gaming Wire",
    imgUrl: null,
    img: null,
    voUrl: null,
    voBlob: null,
    voDur: 0,
  };
}

function NewsPage() {
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [template, setTemplate] = useState<TemplateId>("ticker");
  const [paletteId, setPaletteId] = useState(PALETTES[0].id);
  const [colors, setColors] = useState<ColorOverrides>({});
  const [items, setItems] = useState<NewsItem[]>([emptyItem(0), emptyItem(1), emptyItem(2)]);
  const [showName, setShowName] = useState("Gaming Wire");
  const [perItem, setPerItem] = useState(5);
  const [tickerText, setTickerText] = useState("LATEST PATCH LIVE NOW · NEW SEASON DROPS FRIDAY · TOP ESPORTS RESULTS INSIDE");
  const [showTicker, setShowTicker] = useState(true);

  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const musicElRef = useRef<HTMLAudioElement | null>(null);

  const [provider, setProvider] = useState<TtsProvider>("elevenlabs");
  const [voice, setVoice] = useState(TTS_VOICES.elevenlabs[0].id);
  const [generating, setGenerating] = useState(false);

  const [gVoProvider, setGVoProvider] = useState<TtsProvider>("elevenlabs");
  const [gVoVoice, setGVoVoice] = useState(TTS_VOICES.elevenlabs[0].id);
  const [gVoScript, setGVoScript] = useState("");
  const [gVoUrl, setGVoUrl] = useState<string | null>(null);
  const [gVoBlob, setGVoBlob] = useState<Blob | null>(null);
  const [gVoDuration, setGVoDuration] = useState(0);
  const [gVoLoading, setGVoLoading] = useState(false);
  const [gVoError, setGVoError] = useState<string | null>(null);
  const [gVoVolume, setGVoVolume] = useState(0.9);
  const [matchVoDuration, setMatchVoDuration] = useState(false);
  const gVoAudioRef = useRef<HTMLAudioElement | null>(null);

  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, title: "Gaming News" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, title: "Follow for daily recaps" });

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const timeRef = useRef(0);
  const lastRef = useRef(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const playedRef = useRef<Set<string>>(new Set());

  const dims = ASPECTS[aspect];
  const basePalette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  const pal = useMemo(() => applyOverrides(basePalette, colors), [basePalette, colors]);

  const itemDur = useCallback((it: NewsItem) => Math.max(perItem, (it.voDur || 0) + 0.6), [perItem]);

  const timeline = useMemo(() => {
    const introEnd = intro.id !== "none" ? intro.seconds : 0;
    let t = introEnd;
    const segs = items.map((it, i) => {
      const start = t;
      const dur = itemDur(it);
      t += dur;
      return { item: it, index: i, start, dur };
    });
    let outroStart = t;
    if (matchVoDuration && gVoDuration > 0) {
      outroStart = Math.max(outroStart, introEnd + gVoDuration);
    }
    const total = outroStart + (outro.id !== "none" ? outro.seconds : 0);
    return { segs, outroStart, total, introEnd };
  }, [items, itemDur, intro, outro, matchVoDuration, gVoDuration]);

  const setItem = (id: string, patch: Partial<NewsItem>) =>
    setItems((its) => its.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addImage = (id: string, f: File) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setItem(id, { imgUrl: url, img });
    img.src = url;
  };

  const onMusic = (f: File) => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    const url = URL.createObjectURL(f);
    setMusicFile(f);
    setMusicUrl(url);
    const el = new Audio(url);
    el.loop = true;
    el.volume = musicVolume;
    musicElRef.current = el;
  };

  useEffect(() => {
    if (musicElRef.current) musicElRef.current.volume = musicVolume;
  }, [musicVolume]);

  const generateAll = async () => {
    setGenerating(true);
    try {
      for (const it of items) {
        const script = `${it.headline}. ${it.subtext}`;
        const { url, blob } = await generateSpeech(script, { provider, voice });
        const dur = await blobDuration(blob);
        setItem(it.id, { voUrl: url, voBlob: blob, voDur: dur });
      }
      toast.success("Voiceovers generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voiceover failed");
    } finally {
      setGenerating(false);
    }
  };

  const composeGVoScript = useCallback(() => {
    const lines = items
      .filter((it) => it.headline.trim())
      .map((it) => `${it.headline}. ${it.subtext} `.trim());
    return [showName ? `${showName}.` : "", ...lines].filter(Boolean).join(" ");
  }, [items, showName]);

  const useMyContent = () => setGVoScript(composeGVoScript());

  useEffect(() => {
    if (gVoAudioRef.current) gVoAudioRef.current.volume = gVoVolume;
  }, [gVoVolume]);

  const generateGlobalVoiceover = async () => {
    const script = gVoScript.trim() || composeGVoScript();
    if (!script) {
      setGVoError("Add some news items or a script first.");
      return;
    }
    setGVoScript(script);
    setGVoLoading(true);
    setGVoError(null);
    try {
      const { url, blob } = await generateSpeech(script, { provider: gVoProvider, voice: gVoVoice });
      const dur = await blobDuration(blob);
      if (gVoUrl) URL.revokeObjectURL(gVoUrl);
      gVoAudioRef.current?.pause();
      const el = new Audio(url);
      el.volume = gVoVolume;
      gVoAudioRef.current = el;
      setGVoUrl(url);
      setGVoBlob(blob);
      setGVoDuration(dur);
      toast.success("Voiceover generated");
    } catch (e) {
      setGVoError(e instanceof Error ? e.message : "Voiceover failed");
    } finally {
      setGVoLoading(false);
    }
  };

  const clearGlobalVoiceover = () => {
    if (gVoUrl) URL.revokeObjectURL(gVoUrl);
    gVoAudioRef.current?.pause();
    gVoAudioRef.current = null;
    setGVoUrl(null);
    setGVoBlob(null);
    setGVoDuration(0);
    setGVoError(null);
  };

  // ---------------- rendering ----------------

  const drawBackground = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
      g.addColorStop(0, pal.bg[0]);
      g.addColorStop(1, pal.bg[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const rg = ctx.createRadialGradient(w * 0.5, h * (0.3 + Math.sin(t * 0.2) * 0.03), 0, w * 0.5, h * 0.3, Math.max(w, h) * 0.7);
      rg.addColorStop(0, hexA(pal.primary, 0.14));
      rg.addColorStop(1, "transparent");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      if (template === "hud") {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.4);
      }
    },
    [pal, template],
  );

  const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, dim = 0) => {
    if (img && img.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * ratio;
      const dh = img.naturalHeight * ratio;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      if (dim > 0) {
        ctx.fillStyle = `rgba(0,0,0,${dim})`;
        ctx.fillRect(x, y, w, h);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = hexA(pal.primary, 0.15);
      ctx.fillRect(x, y, w, h);
    }
  };

  const drawTicker = (ctx: CanvasRenderingContext2D, w: number, h: number, y: number, height: number, absT: number) => {
    ctx.save();
    ctx.fillStyle = hexA("#000000", 0.7);
    ctx.fillRect(0, y, w, height);
    ctx.fillStyle = pal.primary;
    ctx.fillRect(0, y, w * 0.14, height);
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.round(height * 0.42)}px ${FX_FONT}`;
    ctx.fillText("LIVE", w * 0.07, y + height / 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w * 0.16, y, w * 0.84, height);
    ctx.clip();
    ctx.fillStyle = pal.text;
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(height * 0.4)}px ${FX_FONT}`;
    const full = `      ${tickerText}      ${tickerText}`;
    const tw = ctx.measureText(full).width;
    const speed = w * 0.12;
    const x0 = w * 0.16 - ((absT * speed) % tw);
    ctx.fillText(full, x0, y + height / 2);
    ctx.fillText(full, x0 + tw, y + height / 2);
    ctx.restore();
    ctx.restore();
  };

  const drawItem = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, seg: { item: NewsItem; index: number }, local: number, absT: number) => {
      drawBackground(ctx, w, h, absT);
      const { item: it } = seg;
      const inK = ease.out(Math.min(1, local / 0.45));
      const M = Math.min(w, h) * 0.06;
      const tickerH = showTicker ? Math.min(w, h) * 0.06 : 0;

      if (template === "ticker") {
        drawImageCover(ctx, it.img, 0, 0, w, h * 0.72, 0.25);
        ctx.save();
        ctx.globalAlpha = inK;
        ctx.fillStyle = pal.primary;
        const bw = Math.min(w * 0.5, Math.min(w,h)*0.45);
        roundRect(ctx, M, M, bw, Math.min(w, h) * 0.06, 6);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.round(Math.min(w, h) * 0.035)}px ${FX_FONT}`;
        ctx.fillText("BREAKING", M + 14, M + Math.min(w, h) * 0.03);
        ctx.restore();
        const boxY = h * 0.72;
        ctx.save();
        ctx.globalAlpha = inK;
        ctx.fillStyle = hexA("#000000", 0.75);
        ctx.fillRect(0, boxY, w, h - boxY - tickerH);
        ctx.fillStyle = pal.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const hs = Math.round(Math.min(w, h) * 0.045);
        ctx.font = `800 ${hs}px ${FX_FONT}`;
        const rows = wrapText(ctx, it.headline, w - M * 2);
        rows.slice(0, 3).forEach((row, ri) => ctx.fillText(row, M, boxY + M * 0.4 + ri * hs * 1.15));
        ctx.font = `500 ${Math.round(hs * 0.55)}px ${FX_FONT}`;
        ctx.fillStyle = pal.muted;
        ctx.fillText(it.source, M, boxY + M * 0.4 + rows.slice(0, 3).length * hs * 1.15 + 10);
        ctx.restore();
      } else if (template === "lowerthird") {
        drawImageCover(ctx, it.img, 0, 0, w, h, 0.35);
        const boxY = h * 0.68;
        ctx.save();
        ctx.globalAlpha = inK;
        ctx.translate(0, (1 - inK) * 40);
        ctx.fillStyle = hexA("#000000", 0.6);
        roundRect(ctx, M, boxY, w - M * 2, h - boxY - M - tickerH, 14);
        ctx.fill();
        ctx.fillStyle = pal.primary;
        ctx.fillRect(M, boxY, 8, h - boxY - M - tickerH);
        ctx.fillStyle = pal.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const hs = Math.round(Math.min(w, h) * 0.04);
        ctx.font = `800 ${hs}px ${FX_FONT}`;
        const rows = wrapText(ctx, it.headline, w - M * 2 - 40);
        rows.slice(0, 2).forEach((row, ri) => ctx.fillText(row, M + 24, boxY + 20 + ri * hs * 1.15));
        ctx.font = `500 ${Math.round(hs * 0.5)}px ${FX_FONT}`;
        ctx.fillStyle = pal.accent;
        ctx.fillText(it.source.toUpperCase(), M + 24, boxY + 20 + rows.slice(0, 2).length * hs * 1.15 + 10);
        ctx.restore();
      } else if (template === "split") {
        drawImageCover(ctx, it.img, 0, 0, w * 0.5, h - tickerH, 0);
        ctx.save();
        ctx.globalAlpha = inK;
        ctx.fillStyle = hexA("#000000", 0.4);
        ctx.fillRect(w * 0.5, 0, w * 0.5, h - tickerH);
        ctx.fillStyle = pal.accent;
        ctx.font = `700 ${Math.round(Math.min(w, h) * 0.03)}px ${FX_FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(it.source.toUpperCase(), w * 0.55, h * 0.3);
        ctx.fillStyle = pal.text;
        ctx.font = `800 ${Math.round(Math.min(w, h) * 0.05)}px ${FX_FONT}`;
        const rows = wrapText(ctx, it.headline, w * 0.4);
        rows.forEach((row, ri) => ctx.fillText(row, w * 0.55, h * 0.38 + ri * Math.min(w, h) * 0.06));
        ctx.font = `500 ${Math.round(Math.min(w, h) * 0.028)}px ${FX_FONT}`;
        ctx.fillStyle = pal.muted;
        const rows2 = wrapText(ctx, it.subtext, w * 0.4);
        rows2.slice(0, 3).forEach((row, ri) => ctx.fillText(row, w * 0.55, h * 0.38 + rows.length * Math.min(w, h) * 0.06 + 30 + ri * Math.min(w, h) * 0.036));
        ctx.restore();
      } else if (template === "fullbleed") {
        drawImageCover(ctx, it.img, 0, 0, w, h - tickerH, 0.5);
        ctx.save();
        ctx.globalAlpha = inK;
        ctx.translate(0, (1 - inK) * 30);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = pal.text;
        ctx.font = `900 ${Math.round(Math.min(w, h) * 0.075)}px ${FX_FONT}`;
        const rows = wrapText(ctx, it.headline.toUpperCase(), w * 0.85);
        const startY = (h - tickerH) / 2 - (rows.length - 1) * Math.min(w, h) * 0.04;
        rows.forEach((row, ri) => ctx.fillText(row, w / 2, startY + ri * Math.min(w, h) * 0.085));
        ctx.font = `700 ${Math.round(Math.min(w, h) * 0.03)}px ${FX_FONT}`;
        ctx.fillStyle = pal.primary;
        ctx.fillText(it.source.toUpperCase(), w / 2, startY + rows.length * Math.min(w, h) * 0.085 + 20);
        ctx.restore();
      } else if (template === "hud") {
        drawImageCover(ctx, it.img, w * 0.06, h * 0.08, w * 0.88, h * 0.42, 0.2);
        ctx.save();
        ctx.strokeStyle = hexA(pal.primary, 0.8);
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.06, h * 0.08, w * 0.88, h * 0.42);
        ctx.globalAlpha = inK;
        ctx.fillStyle = pal.primary;
        ctx.textAlign = "left";
        ctx.font = `700 ${Math.round(Math.min(w, h) * 0.026)}px "JetBrains Mono", monospace`;
        ctx.fillText(`> ${it.source.toUpperCase()}_FEED`, w * 0.06, h * 0.55);
        ctx.fillStyle = pal.text;
        ctx.font = `700 ${Math.round(Math.min(w, h) * 0.042)}px "JetBrains Mono", monospace`;
        const chars = Math.floor(it.headline.length * Math.min(1, local / 1.2));
        const rows = wrapText(ctx, it.headline.slice(0, chars), w * 0.88);
        rows.forEach((row, ri) => ctx.fillText(row, w * 0.06, h * 0.62 + ri * Math.min(w, h) * 0.05));
        ctx.fillStyle = pal.accent;
        ctx.font = `500 ${Math.round(Math.min(w, h) * 0.024)}px "JetBrains Mono", monospace`;
        const rows2 = wrapText(ctx, it.subtext, w * 0.88);
        rows2.slice(0, 3).forEach((row, ri) => ctx.fillText(row, w * 0.06, h * 0.78 + ri * Math.min(w, h) * 0.032));
        ctx.restore();
      } else {
        // magazine
        ctx.save();
        ctx.globalAlpha = inK;
        drawImageCover(ctx, it.img, w * 0.08, h * 0.1, w * 0.84, h * 0.4, 0);
        ctx.strokeStyle = pal.text;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.08, h * 0.54);
        ctx.lineTo(w * 0.92, h * 0.54);
        ctx.stroke();
        ctx.fillStyle = pal.accent;
        ctx.font = `700 ${Math.round(Math.min(w, h) * 0.026)}px ${FX_FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(it.source.toUpperCase(), w * 0.08, h * 0.6);
        ctx.fillStyle = pal.text;
        ctx.font = `italic 800 ${Math.round(Math.min(w, h) * 0.055)}px Georgia, serif`;
        const rows = wrapText(ctx, it.headline, w * 0.84);
        rows.forEach((row, ri) => ctx.fillText(row, w * 0.08, h * 0.68 + ri * Math.min(w, h) * 0.065));
        ctx.font = `400 ${Math.round(Math.min(w, h) * 0.028)}px Georgia, serif`;
        ctx.fillStyle = pal.muted;
        const rows2 = wrapText(ctx, it.subtext, w * 0.84);
        rows2.slice(0, 2).forEach((row, ri) => ctx.fillText(row, w * 0.08, h * 0.68 + rows.length * Math.min(w, h) * 0.065 + 20 + ri * Math.min(w, h) * 0.036));
        ctx.restore();
      }

      if (showTicker) drawTicker(ctx, w, h, h - tickerH, tickerH, absT);
    },
    [drawBackground, drawTicker, pal, showTicker, template],
  );

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const { w, h } = dims;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#07070a";
      ctx.fillRect(0, 0, w, h);
      if (intro.id !== "none" && t < timeline.introEnd) {
        INTRO_ANIMATIONS.find((a) => a.id === intro.id)?.draw({
          ctx, w, h, p: Math.min(1, t / Math.max(0.2, intro.seconds)),
          palette: paletteOf(intro.paletteId), title: intro.title, subtitle: intro.subtitle, logo: null,
        });
        return;
      }
      if (outro.id !== "none" && t >= timeline.outroStart) {
        OUTRO_ANIMATIONS.find((a) => a.id === outro.id)?.draw({
          ctx, w, h, p: Math.min(1, (t - timeline.outroStart) / Math.max(0.2, outro.seconds)),
          palette: paletteOf(outro.paletteId), title: outro.title, subtitle: outro.subtitle, logo: null,
        });
        return;
      }
      const seg = timeline.segs.find((s) => t >= s.start && t < s.start + s.dur) ?? timeline.segs[timeline.segs.length - 1];
      if (!seg) return;
      drawItem(ctx, w, h, seg, Math.max(0, t - seg.start), t);
    },
    [dims, drawItem, intro, outro, timeline],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const loop = (now: number) => {
      if (playing) {
        const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
        timeRef.current = Math.min(timeline.total, timeRef.current + dt);
        if (timeRef.current >= timeline.total) {
          setPlaying(false);
          timeRef.current = 0;
          playedRef.current.clear();
          musicElRef.current?.pause();
          gVoAudioRef.current?.pause();
        }
        for (const seg of timeline.segs) {
          if (seg.item.voUrl && !playedRef.current.has(seg.item.id) && timeRef.current >= seg.start && timeRef.current < seg.start + 0.35) {
            playedRef.current.add(seg.item.id);
            const el = new Audio(seg.item.voUrl);
            audioElRef.current = el;
            void el.play().catch(() => {});
          }
        }
        setTime(timeRef.current);
      }
      lastRef.current = now;
      if (gVoAudioRef.current) {
        const target = timeRef.current - timeline.introEnd;
        if (!playing || target < 0 || target > gVoDuration + 0.2) {
          if (!gVoAudioRef.current.paused) gVoAudioRef.current.pause();
        } else if (gVoAudioRef.current.paused || Math.abs(gVoAudioRef.current.currentTime - target) > 0.4) {
          gVoAudioRef.current.currentTime = target;
          void gVoAudioRef.current.play().catch(() => {});
        }
      }
      drawFrame(ctx, timeRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawFrame, playing, timeline]);

  const togglePlay = () => {
    if (playing) {
      audioElRef.current?.pause();
      musicElRef.current?.pause();
      gVoAudioRef.current?.pause();
      setPlaying(false);
    } else {
      if (timeRef.current >= timeline.total - 0.05) {
        timeRef.current = 0;
        playedRef.current.clear();
      }
      lastRef.current = 0;
      setPlaying(true);
      if (musicElRef.current) {
        musicElRef.current.currentTime = 0;
        void musicElRef.current.play().catch(() => {});
      }
    }
  };

  const exportVideo = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const fps = 60;
      const stream = canvas.captureStream(fps);
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      if (gVoBlob) {
        const buf = await audioCtx.decodeAudioData(await gVoBlob.arrayBuffer());
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const gain = audioCtx.createGain();
        gain.gain.value = gVoVolume;
        src.connect(gain).connect(dest);
        src.start(audioCtx.currentTime + timeline.introEnd);
      }
      for (const seg of timeline.segs) {
        if (!seg.item.voBlob) continue;
        const buf = await audioCtx.decodeAudioData(await seg.item.voBlob.arrayBuffer());
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start(audioCtx.currentTime + seg.start + 0.1);
      }
      if (musicFile) {
        const buf = await audioCtx.decodeAudioData(await musicFile.arrayBuffer());
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = audioCtx.createGain();
        gain.gain.value = musicVolume;
        src.connect(gain).connect(dest);
        src.start(audioCtx.currentTime);
        src.stop(audioCtx.currentTime + timeline.total);
      }
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

      const mime = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
        ? "video/mp4;codecs=avc1"
        : "video/webm;codecs=vp9";
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<void>((res) => (rec.onstop = () => res()));
      rec.start();

      const start = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          const t = (performance.now() - start) / 1000;
          if (t >= timeline.total) return resolve();
          drawFrame(ctx, t);
          setExportProgress(Math.min(99, (t / timeline.total) * 100));
          requestAnimationFrame(tick);
        };
        tick();
      });
      rec.stop();
      await done;
      await audioCtx.close();

      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `gaming-news-recap.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setExportProgress(100);
      toast.success("Export complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:flex lg:h-full lg:flex-col lg:space-y-0 lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/gaming-videos">
              <ArrowLeft className="mr-1 h-4 w-4" /> Gaming Videos
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Newspaper className="h-6 w-6" /> News recap studio
          </h1>
          <p className="text-sm text-muted-foreground">Broadcast-style gaming news recaps with tickers and voiceover.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={togglePlay}>
            {playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
            {playing ? "Pause" : "Preview"}
          </Button>
          <Button onClick={exportVideo} disabled={exporting}>
            {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Export 1080p
          </Button>
        </div>
      </div>

      {exporting && <Progress value={exportProgress} />}

      <div className="grid gap-6 lg:mt-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        <div className="min-w-0 space-y-4 lg:overflow-hidden">
          <Card>
            <CardContent className="flex justify-center p-4">
              <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                className="max-h-[58vh] w-auto rounded-xl border bg-black"
                style={{ aspectRatio: `${dims.w}/${dims.h}` }}
              />
            </CardContent>
          </Card>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{time.toFixed(1)}s / {timeline.total.toFixed(1)}s</span>
            <Slider
              className="flex-1"
              value={[time]}
              min={0}
              max={Math.max(1, timeline.total)}
              step={0.05}
              onValueChange={([v]) => {
                timeRef.current = v;
                setTime(v);
              }}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">News items</CardTitle>
                <CardDescription>Each item is one recap headline.</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setItems((its) => [...its, emptyItem(its.length)])}>
                <Plus className="mr-1 h-4 w-4" /> Add item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((it, i) => (
                <div key={it.id} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Item {i + 1}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setItems((its) => its.filter((x) => x.id !== it.id))}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Headline</Label>
                      <Input value={it.headline} onChange={(e) => setItem(it.id, { headline: e.target.value })} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Subtext</Label>
                      <Input value={it.subtext} onChange={(e) => setItem(it.id, { subtext: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Source</Label>
                      <Input value={it.source} onChange={(e) => setItem(it.id, { source: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Image</Label>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground hover:bg-muted/50">
                        <ImagePlus className="h-3.5 w-3.5" /> {it.imgUrl ? "Replace" : "Upload"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && addImage(it.id, e.target.files[0])} />
                      </label>
                    </div>
                  </div>
                  {it.imgUrl && <img src={it.imgUrl} alt={it.headline} className="mt-3 h-20 w-full rounded-md object-cover" />}
                  {it.voUrl && (
                    <audio controls src={it.voUrl} className="mt-3 w-full">
                      <track kind="captions" />
                    </audio>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Format & style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={aspect} onValueChange={(v) => setAspect(v as AspectKey)}>
                <TabsList className="w-full">
                  {(Object.keys(ASPECTS) as AspectKey[]).map((k) => (
                    <TabsTrigger key={k} value={k} className="flex-1">{k}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div>
                <Label className="text-xs text-muted-foreground">Template</Label>
                <Select value={template} onValueChange={(v) => setTemplate(v as TemplateId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{TEMPLATES.find((t) => t.id === template)?.desc}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Palette</Label>
                <Select value={paletteId} onValueChange={setPaletteId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PALETTES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Show name</Label>
                <Input value={showName} onChange={(e) => setShowName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Seconds per item · {perItem}s</Label>
                <Slider value={[perItem]} min={2} max={10} step={0.5} onValueChange={([v]) => setPerItem(v)} />
              </div>
              <label className="flex items-center justify-between gap-2 text-sm">
                Scrolling ticker <Switch checked={showTicker} onCheckedChange={setShowTicker} />
              </label>
              {showTicker && (
                <div>
                  <Label className="text-xs text-muted-foreground">Ticker text</Label>
                  <Input value={tickerText} onChange={(e) => setTickerText(e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>

          <ColorCustomiser base={basePalette} value={colors} onChange={setColors} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voiceover</CardTitle>
              <CardDescription>Generate an AI voiceover for every headline, or upload your own.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={provider} onValueChange={(v) => { const p = v as TtsProvider; setProvider(p); setVoice(TTS_VOICES[p][0].id); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TTS_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.note}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TTS_VOICES[provider].map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={generateAll} disabled={generating} className="w-full">
                {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
                Generate voiceover for all items
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Narrator voiceover</CardTitle>
              <CardDescription>A single narration track for the whole recap, mixed into the export.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={gVoProvider}
                  onValueChange={(v) => {
                    const p = v as TtsProvider;
                    setGVoProvider(p);
                    setGVoVoice(TTS_VOICES[p][0].id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={gVoVoice} onValueChange={setGVoVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_VOICES[gVoProvider].map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Script</Label>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={useMyContent}>
                    Use my content
                  </Button>
                </div>
                <Textarea
                  value={gVoScript}
                  onChange={(e) => setGVoScript(e.target.value)}
                  placeholder="Click “Use my content” to auto-write a script from your headlines, or write your own."
                  className="min-h-24 text-sm"
                />
              </div>
              <Button onClick={generateGlobalVoiceover} disabled={gVoLoading} className="w-full">
                {gVoLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
                {gVoUrl ? "Regenerate voiceover" : "Generate voiceover"}
              </Button>
              {gVoError && <p className="text-xs text-destructive">{gVoError}</p>}
              {gVoUrl && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <audio controls src={gVoUrl} className="h-9 flex-1">
                      <track kind="captions" />
                    </audio>
                    <Button size="icon" variant="ghost" onClick={clearGlobalVoiceover}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Voiceover volume · {Math.round(gVoVolume * 100)}%</Label>
                    <Slider value={[gVoVolume]} min={0} max={1} step={0.05} onValueChange={([v]) => setGVoVolume(v)} />
                  </div>
                  <label className="flex items-center justify-between gap-2 text-sm">
                    Match duration to voiceover
                    <Switch checked={matchVoDuration} onCheckedChange={setMatchVoDuration} />
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Music</CardTitle>
              <CardDescription>Optional background bed, mixed into the export.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {musicUrl ? (
                <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="flex items-center gap-1 truncate"><Music className="h-3.5 w-3.5" /> {musicFile?.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (musicUrl) URL.revokeObjectURL(musicUrl);
                      musicElRef.current?.pause();
                      musicElRef.current = null;
                      setMusicFile(null);
                      setMusicUrl(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="mr-2 h-4 w-4" /> Upload music
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && onMusic(e.target.files[0])} />
                </label>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Volume · {Math.round(musicVolume * 100)}%</Label>
                <Slider value={[musicVolume]} min={0} max={1} step={0.05} onValueChange={([v]) => setMusicVolume(v)} />
              </div>
            </CardContent>
          </Card>

          <IntroOutroCard intro={intro} outro={outro} onIntro={setIntro} onOutro={setOutro} ratio={dims.w / dims.h} />
        </div>
      </div>
    </div>
  );
}
