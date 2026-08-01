import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  ImagePlus,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  Download,
  Loader2,
  Mic,
  Music2,
  Type as TypeIcon,
  Film,
  Sparkles,
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { generateSpeech, TTS_PROVIDERS, TTS_VOICES, type TtsProvider } from "@/lib/tts";
import { hexA, roundRect, wrapText, ease } from "@/lib/video-fx";

// -------------------- constants --------------------

const W = 1920;
const H = 1080;

const FONT_SANS = `"Inter", "Helvetica Neue", Arial, sans-serif`;
const FONT_SERIF = `Georgia, "Times New Roman", serif`;

type MotionKind =
  | "static"
  | "kenburns-in"
  | "kenburns-out"
  | "pan-l"
  | "pan-r"
  | "pan-u"
  | "pan-d"
  | "drift"
  | "parallax";

const MOTIONS: { id: MotionKind; name: string }[] = [
  { id: "static", name: "Static" },
  { id: "kenburns-in", name: "Ken Burns · in" },
  { id: "kenburns-out", name: "Ken Burns · out" },
  { id: "pan-l", name: "Pan left" },
  { id: "pan-r", name: "Pan right" },
  { id: "pan-u", name: "Pan up" },
  { id: "pan-d", name: "Pan down" },
  { id: "drift", name: "Drift" },
  { id: "parallax", name: "Parallax" },
];

type TransitionKind = "cut" | "cross-fade" | "dip-black" | "slide" | "wipe" | "whip-pan" | "blur-dissolve";

const TRANSITIONS: { id: TransitionKind; name: string }[] = [
  { id: "cut", name: "Cut" },
  { id: "cross-fade", name: "Cross-fade" },
  { id: "dip-black", name: "Dip to black" },
  { id: "slide", name: "Slide" },
  { id: "wipe", name: "Wipe" },
  { id: "whip-pan", name: "Whip pan" },
  { id: "blur-dissolve", name: "Blur dissolve" },
];

type EasingKind = "linear" | "in" | "out" | "inOut";
const EASINGS: { id: EasingKind; name: string }[] = [
  { id: "linear", name: "Linear" },
  { id: "in", name: "Ease in" },
  { id: "out", name: "Ease out" },
  { id: "inOut", name: "Ease in-out" },
];

type GradePreset = "none" | "cinematic" | "warm" | "cold" | "noir" | "sepia";
const GRADES: { id: GradePreset; name: string }[] = [
  { id: "none", name: "None" },
  { id: "cinematic", name: "Cinematic" },
  { id: "warm", name: "Warm" },
  { id: "cold", name: "Cold" },
  { id: "noir", name: "Noir" },
  { id: "sepia", name: "Sepia" },
];

type TextKind = "title" | "subtitle" | "lower-third";
type Entrance = "none" | "fade" | "slide-up" | "slide-down" | "pop";

type TextLayer = {
  id: string;
  kind: TextKind;
  text: string;
  fontSize: number;
  x: number; // 0..100 percent
  y: number; // 0..100 percent
  color: string;
  entrance: Entrance;
};

type MediaKind = "image" | "video" | "graphic";

type MediaItem = {
  id: string;
  kind: MediaKind;
  url: string;
  name: string;
  el: HTMLImageElement | HTMLVideoElement;
  w: number;
  h: number;
};

type Clip = {
  id: string;
  mediaId: string | null;
  duration: number;
  motion: MotionKind;
  transitionIn: TransitionKind;
  transitionOut: TransitionKind;
  easing: EasingKind;
  texts: TextLayer[];
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function newClip(mediaId: string | null): Clip {
  return {
    id: uid(),
    mediaId,
    duration: 4,
    motion: "kenburns-in",
    transitionIn: "cross-fade",
    transitionOut: "cut",
    easing: "out",
    texts: [],
  };
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
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

function motionTransform(motion: MotionKind, p: number): { scale: number; dx: number; dy: number } {
  switch (motion) {
    case "kenburns-in":
      return { scale: 1 + p * 0.16, dx: 0, dy: 0 };
    case "kenburns-out":
      return { scale: 1.16 - p * 0.16, dx: 0, dy: 0 };
    case "pan-l":
      return { scale: 1.1, dx: (0.5 - p) * W * 0.14, dy: 0 };
    case "pan-r":
      return { scale: 1.1, dx: (p - 0.5) * W * 0.14, dy: 0 };
    case "pan-u":
      return { scale: 1.1, dx: 0, dy: (0.5 - p) * H * 0.14 };
    case "pan-d":
      return { scale: 1.1, dx: 0, dy: (p - 0.5) * H * 0.14 };
    case "drift":
      return {
        scale: 1.08 + Math.sin(p * Math.PI * 2) * 0.01,
        dx: Math.sin(p * Math.PI * 1.4) * W * 0.02,
        dy: Math.cos(p * Math.PI * 1.1) * H * 0.02,
      };
    case "parallax":
      return { scale: 1.14, dx: (p - 0.5) * W * 0.06, dy: (p - 0.5) * H * 0.03 };
    case "static":
    default:
      return { scale: 1, dx: 0, dy: 0 };
  }
}

function applyGrade(ctx: CanvasRenderingContext2D, grade: GradePreset, exposure: number, contrast: number, saturation: number) {
  const brightness = 1 + exposure / 100;
  const contrastF = 1 + contrast / 100;
  let sat = 1 + saturation / 100;
  let extraContrast = 1;
  let extraBrightness = 1;
  let hueRotate = 0;
  let sepia = 0;
  let grayscale = 0;
  if (grade === "cinematic") {
    extraContrast = 1.12;
    sat *= 0.92;
    hueRotate = -4;
  } else if (grade === "warm") {
    hueRotate = -8;
    sat *= 1.08;
    extraBrightness = 1.02;
  } else if (grade === "cold") {
    hueRotate = 10;
    sat *= 0.96;
  } else if (grade === "noir") {
    grayscale = 1;
    extraContrast = 1.2;
  } else if (grade === "sepia") {
    sepia = 0.75;
    sat *= 0.8;
  }
  ctx.filter = [
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

function drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, amount: number) {
  const tile = grainTile();
  ctx.save();
  ctx.globalAlpha = 0.08 * amount;
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

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${0.65 * amount})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawLetterbox(ctx: CanvasRenderingContext2D, w: number, h: number, ratio = 0.1) {
  const bar = h * ratio;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, bar);
  ctx.fillRect(0, h - bar, w, bar);
}

function drawTextLayer(ctx: CanvasRenderingContext2D, w: number, h: number, layer: TextLayer, localT: number, clipDur: number) {
  const appearDur = 0.5;
  const p = Math.min(1, localT / appearDur);
  const outAppear = Math.min(1, (clipDur - localT) / appearDur);
  const visible = Math.min(p, outAppear);
  if (visible <= 0) return;
  let alpha = 1;
  let offsetY = 0;
  let scale = 1;
  const k = ease.out(Math.min(1, p));
  switch (layer.entrance) {
    case "fade":
      alpha = k;
      break;
    case "slide-up":
      alpha = k;
      offsetY = (1 - k) * 40;
      break;
    case "slide-down":
      alpha = k;
      offsetY = -(1 - k) * 40;
      break;
    case "pop":
      alpha = k;
      scale = 0.85 + k * 0.15;
      break;
    case "none":
    default:
      alpha = 1;
  }
  alpha *= Math.min(1, outAppear * 4);

  const x = (layer.x / 100) * w;
  const y = (layer.y / 100) * h;
  const weight = layer.kind === "title" ? 800 : layer.kind === "subtitle" ? 600 : 700;
  const font = layer.kind === "title" ? FONT_SERIF : FONT_SANS;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(x, y + offsetY);
  ctx.scale(scale, scale);
  ctx.font = `${weight} ${layer.fontSize}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = w * 0.8;
  const rows = wrapText(ctx, layer.text || "", maxWidth);
  const lineH = layer.fontSize * 1.25;

  if (layer.kind === "lower-third") {
    const boxW = Math.max(...rows.map((r) => ctx.measureText(r).width)) + layer.fontSize * 1.4;
    const boxH = rows.length * lineH + layer.fontSize * 0.6;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 6);
    ctx.fill();
    ctx.fillStyle = layer.color;
    ctx.fillRect(-boxW / 2, -boxH / 2, 4, boxH);
  }

  ctx.fillStyle = layer.color;
  let ty = -(rows.length - 1) * lineH * 0.5;
  for (const row of rows) {
    ctx.fillText(row, 0, ty);
    ty += lineH;
  }
  ctx.restore();
}

function drawTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: TransitionKind,
  progress: number, // 0..1, 1 = fully settled
  direction: "in" | "out",
  easing: EasingKind,
) {
  const p = ease[easing](Math.max(0, Math.min(1, progress)));
  const amt = direction === "in" ? 1 - p : p; // amount of effect remaining
  if (amt <= 0.001 || kind === "cut") return;
  ctx.save();
  switch (kind) {
    case "cross-fade":
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${amt})`;
      ctx.fillRect(0, 0, w, h);
      break;
    case "dip-black":
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, amt * 1.3)})`;
      ctx.fillRect(0, 0, w, h);
      break;
    case "slide": {
      const dir = direction === "in" ? 1 : -1;
      ctx.fillStyle = "#000000";
      ctx.fillRect(dir > 0 ? w * (1 - amt) : -w * (1 - amt), 0, w, h);
      break;
    }
    case "wipe": {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w * amt, h);
      break;
    }
    case "whip-pan": {
      ctx.fillStyle = `rgba(255,255,255,${amt * 0.5})`;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "blur-dissolve": {
      ctx.fillStyle = `rgba(0,0,0,${amt * 0.7})`;
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
  ctx.restore();
}

// -------------------- component --------------------

export function DocumentaryHQ() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const [gradePreset, setGradePreset] = useState<GradePreset>("cinematic");
  const [exposure, setExposure] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [grain, setGrain] = useState(false);
  const [vignette, setVignette] = useState(0.3);
  const [letterbox, setLetterbox] = useState(false);

  // voiceover
  const [narrationUrl, setNarrationUrl] = useState<string | null>(null);
  const [narrationName, setNarrationName] = useState<string | null>(null);
  const [narrationDuration, setNarrationDuration] = useState(0);
  const [narrationVolume, setNarrationVolume] = useState(1);
  const [matchDuration, setMatchDuration] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("elevenlabs");
  const [ttsVoice, setTtsVoice] = useState(TTS_VOICES.elevenlabs[0].id);
  const [script, setScript] = useState("");
  const [generatingVo, setGeneratingVo] = useState(false);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);

  // music
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicName, setMusicName] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.25);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const timeRef = useRef(0);

  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null;

  const rawTotal = useMemo(() => clips.reduce((a, c) => a + c.duration, 0), [clips]);
  const scale = matchDuration && narrationDuration > 0 && rawTotal > 0 ? narrationDuration / rawTotal : 1;
  const totalDuration = matchDuration && narrationDuration > 0 ? narrationDuration : rawTotal;

  // -------------------- media library --------------------

  const addFiles = (files: FileList) => {
    Array.from(files).forEach((f) => {
      const url = URL.createObjectURL(f);
      const isVideo = f.type.startsWith("video/");
      const kind: MediaKind = isVideo ? "video" : "image";
      if (isVideo) {
        const v = document.createElement("video");
        v.src = url;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = "auto";
        v.addEventListener("loadedmetadata", () => {
          setMedia((prev) => [
            ...prev,
            { id: uid(), kind, url, name: f.name, el: v, w: v.videoWidth, h: v.videoHeight },
          ]);
        });
      } else {
        const img = new Image();
        img.onload = () => {
          setMedia((prev) => [
            ...prev,
            { id: uid(), kind, url, name: f.name, el: img, w: img.naturalWidth, h: img.naturalHeight },
          ]);
        };
        img.src = url;
      }
    });
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const found = prev.find((m) => m.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((m) => m.id !== id);
    });
    setClips((prev) => prev.map((c) => (c.mediaId === id ? { ...c, mediaId: null } : c)));
  };

  // -------------------- clips --------------------

  const addClip = (mediaId: string | null) => {
    const c = newClip(mediaId);
    setClips((prev) => [...prev, c]);
    setSelectedClipId(c.id);
  };

  const removeClip = (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (selectedClipId === id) setSelectedClipId(null);
  };

  const moveClip = (id: string, dir: -1 | 1) => {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const updateClip = (id: string, patch: Partial<Clip>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addTextLayer = (clipId: string, kind: TextKind) => {
    const layer: TextLayer = {
      id: uid(),
      kind,
      text: kind === "title" ? "Title" : kind === "subtitle" ? "Subtitle" : "Lower third",
      fontSize: kind === "title" ? 64 : kind === "subtitle" ? 40 : 34,
      x: 50,
      y: kind === "title" ? 45 : kind === "subtitle" ? 85 : 88,
      color: "#ffffff",
      entrance: "fade",
    };
    updateClip(clipId, { texts: [...(clips.find((c) => c.id === clipId)?.texts ?? []), layer] });
  };

  const updateTextLayer = (clipId: string, layerId: string, patch: Partial<TextLayer>) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId ? { ...c, texts: c.texts.map((t) => (t.id === layerId ? { ...t, ...patch } : t)) } : c,
      ),
    );
  };

  const removeTextLayer = (clipId: string, layerId: string) => {
    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, texts: c.texts.filter((t) => t.id !== layerId) } : c)),
    );
  };

  // -------------------- audio --------------------

  const onNarrationFile = (f: File) => {
    if (narrationUrl) URL.revokeObjectURL(narrationUrl);
    const url = URL.createObjectURL(f);
    setNarrationUrl(url);
    setNarrationName(f.name);
    const a = new Audio(url);
    a.addEventListener("loadedmetadata", () => setNarrationDuration(isFinite(a.duration) ? a.duration : 0));
    narrationAudioRef.current = a;
  };

  const clearNarration = () => {
    if (narrationUrl) URL.revokeObjectURL(narrationUrl);
    narrationAudioRef.current?.pause();
    narrationAudioRef.current = null;
    setNarrationUrl(null);
    setNarrationName(null);
    setNarrationDuration(0);
  };

  const runGenerateVoiceover = async () => {
    if (!script.trim()) {
      toast("Write the narration script first");
      return;
    }
    setGeneratingVo(true);
    try {
      const { url, blob } = await generateSpeech(script, { provider: ttsProvider, voice: ttsVoice });
      if (narrationUrl) URL.revokeObjectURL(narrationUrl);
      setNarrationUrl(url);
      setNarrationName(`narration-${ttsProvider}.mp3`);
      const a = new Audio(url);
      a.addEventListener("loadedmetadata", () => setNarrationDuration(isFinite(a.duration) ? a.duration : 0));
      narrationAudioRef.current = a;
      void blob;
      toast.success("Voiceover generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voiceover generation failed");
    } finally {
      setGeneratingVo(false);
    }
  };

  const onMusicFile = (f: File) => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    const url = URL.createObjectURL(f);
    setMusicUrl(url);
    setMusicName(f.name);
    const a = new Audio(url);
    a.loop = true;
    musicAudioRef.current = a;
  };

  const clearMusic = () => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    musicAudioRef.current?.pause();
    musicAudioRef.current = null;
    setMusicUrl(null);
    setMusicName(null);
  };

  useEffect(() => {
    if (narrationAudioRef.current) narrationAudioRef.current.volume = narrationVolume;
  }, [narrationVolume]);
  useEffect(() => {
    if (musicAudioRef.current) musicAudioRef.current.volume = musicVolume;
  }, [musicVolume]);

  // -------------------- render --------------------

  const findClipAt = useCallback(
    (t: number) => {
      let acc = 0;
      for (let i = 0; i < clips.length; i++) {
        const dur = clips[i].duration * scale;
        if (t < acc + dur || i === clips.length - 1) {
          return { clip: clips[i], index: i, localT: Math.max(0, Math.min(dur, t - acc)), dur };
        }
        acc += dur;
      }
      return null;
    },
    [clips, scale],
  );

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      ctx.save();
      ctx.filter = "none";
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);

      const found = findClipAt(t);
      if (found) {
        const { clip, localT, dur } = found;
        const m = clip.mediaId ? media.find((mm) => mm.id === clip.mediaId) : null;
        const p = dur > 0 ? localT / dur : 0;
        const { scale: sc, dx, dy } = motionTransform(clip.motion, p);
        ctx.save();
        applyGrade(ctx, gradePreset, exposure, contrast, saturation);
        if (m) {
          const mw = m.kind === "video" ? (m.el as HTMLVideoElement).videoWidth || m.w : m.w;
          const mh = m.kind === "video" ? (m.el as HTMLVideoElement).videoHeight || m.h : m.h;
          try {
            drawCover(ctx, m.el, mw, mh, W, H, sc, dx, dy);
          } catch {
            /* ignore mid-decode errors */
          }
        } else {
          const g = ctx.createLinearGradient(0, 0, W, H);
          g.addColorStop(0, "#111318");
          g.addColorStop(1, "#04050a");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
        ctx.filter = "none";

        if (grain) drawGrain(ctx, W, H, t, 1);
        drawVignette(ctx, W, H, vignette);
        if (letterbox) drawLetterbox(ctx, W, H, 0.1);

        for (const layer of clip.texts) drawTextLayer(ctx, W, H, layer, localT, dur);

        const transDur = Math.min(1, dur * 0.3);
        if (localT < transDur) {
          drawTransitionOverlay(ctx, W, H, clip.transitionIn, localT / transDur, "in", clip.easing);
        }
        if (localT > dur - transDur) {
          drawTransitionOverlay(ctx, W, H, clip.transitionOut, (dur - localT) / transDur, "out", clip.easing);
        }
      } else {
        ctx.fillStyle = "#9ca3af";
        ctx.font = `600 32px ${FONT_SANS}`;
        ctx.textAlign = "center";
        ctx.fillText("Add clips to the timeline to preview", W / 2, H / 2);
      }
      ctx.restore();
    },
    [findClipAt, media, gradePreset, exposure, contrast, saturation, grain, vignette, letterbox],
  );

  const drawAt = useCallback(
    (canvas: HTMLCanvasElement, t: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        paint(ctx, t);
      } catch (err) {
        console.warn("HQ preview draw failed", err);
      }
    },
    [paint],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    drawAt(canvas, timeRef.current);
  }, [drawAt]);

  useEffect(() => {
    if (playing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawAt(canvas, timeRef.current);
  }, [drawAt, playing]);

  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frames = 0;
    const started = performance.now() / 1000 - timeRef.current;
    const nar = narrationAudioRef.current;
    const mus = musicAudioRef.current;
    const videos = media.filter((m) => m.kind === "video").map((m) => m.el as HTMLVideoElement);
    if (nar) {
      nar.currentTime = timeRef.current;
      nar.play().catch(() => {});
    }
    if (mus) {
      mus.currentTime = 0;
      mus.play().catch(() => {});
    }
    videos.forEach((v) => v.play().catch(() => {}));
    const tick = () => {
      const t = performance.now() / 1000 - started;
      timeRef.current = t;
      if (frames++ % 4 === 0) setCurrentTime(t);
      drawAt(canvas, t);
      if (totalDuration > 0 && t >= totalDuration - 0.02) {
        nar?.pause();
        mus?.pause();
        videos.forEach((v) => v.pause());
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      nar?.pause();
      mus?.pause();
      videos.forEach((v) => v.pause());
    };
  }, [playing, drawAt, totalDuration, media]);

  const togglePlay = () => {
    if (!clips.length) {
      toast("Add at least one clip first");
      return;
    }
    if (playing) {
      setPlaying(false);
    } else {
      if (timeRef.current >= totalDuration - 0.05) timeRef.current = 0;
      setPlaying(true);
    }
  };

  const seek = (v: number) => {
    timeRef.current = v;
    setCurrentTime(v);
    const canvas = canvasRef.current;
    if (canvas) drawAt(canvas, v);
  };

  // -------------------- export --------------------

  const exportVideo = async () => {
    if (!clips.length) {
      toast("Add at least one clip first");
      return;
    }
    setExporting(true);
    setExportProgress(0);
    try {
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const octx = off.getContext("2d")!;
      const stream = off.captureStream(60);

      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      const dest = ac.createMediaStreamDestination();

      const sources: AudioBufferSourceNode[] = [];
      const loadTrack = async (url: string, volume: number, loop: boolean) => {
        try {
          const ab = await (await fetch(url)).arrayBuffer();
          const buf = await ac.decodeAudioData(ab.slice(0));
          const src = ac.createBufferSource();
          src.buffer = buf;
          src.loop = loop;
          const gain = ac.createGain();
          gain.gain.value = volume;
          src.connect(gain).connect(dest);
          sources.push(src);
        } catch (err) {
          console.warn("Could not decode audio track for export", err);
        }
      };
      if (narrationUrl) await loadTrack(narrationUrl, narrationVolume, false);
      if (musicUrl) await loadTrack(musicUrl, musicVolume, true);
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
        videoBitsPerSecond: 16_000_000,
        audioBitsPerSecond: 192_000,
      });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const doneP = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] || "video/webm" }));
      });

      const videos = media.filter((m) => m.kind === "video").map((m) => m.el as HTMLVideoElement);
      videos.forEach((v) => {
        v.currentTime = 0;
        v.play().catch(() => {});
      });

      let running = true;
      const t0 = performance.now();
      sources.forEach((s) => s.start());
      rec.start(100);
      const loop = () => {
        if (!running) return;
        const t = (performance.now() - t0) / 1000;
        setExportProgress(Math.min(100, (t / totalDuration) * 100));
        paint(octx, t);
        if (t >= totalDuration) {
          running = false;
          sources.forEach((s) => {
            try {
              s.stop();
            } catch {
              /* noop */
            }
          });
          videos.forEach((v) => v.pause());
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
      a.download = `hq-documentary.${ext}`;
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

  // -------------------- UI --------------------

  return (
    <div className="grid gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[380px_minmax(0,1fr)_360px] lg:overflow-hidden">
      {/* Left: media library + timeline */}
      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Media library</CardTitle>
            <CardDescription>Import images, video clips and graphics for the timeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50">
              <Upload className="mr-2 h-4 w-4" /> Import media
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </label>
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m) => (
                  <div key={m.id} className="group relative overflow-hidden rounded-md border">
                    {m.kind === "video" ? (
                      <div className="flex h-16 w-full items-center justify-center bg-muted text-muted-foreground">
                        <Film className="h-5 w-5" />
                      </div>
                    ) : (
                      <img src={m.url} alt={m.name} className="h-16 w-full object-cover" />
                    )}
                    <button
                      onClick={() => addClip(m.id)}
                      className="absolute inset-x-0 bottom-0 flex h-6 items-center justify-center bg-black/60 text-[10px] text-white opacity-0 group-hover:opacity-100"
                      title="Add as clip"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add clip
                    </button>
                    <button
                      onClick={() => removeMedia(m.id)}
                      className="absolute right-1 top-1 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clip timeline</CardTitle>
            <CardDescription>{clips.length} clip{clips.length === 1 ? "" : "s"} · {fmtTime(totalDuration)} total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {clips.length === 0 && (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Add media, then click "Add clip" on a thumbnail.
              </p>
            )}
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {clips.map((c, i) => {
                const m = media.find((mm) => mm.id === c.mediaId);
                const active = c.id === selectedClipId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClipId(c.id)}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
                      active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"
                    }`}
                  >
                    <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                      {m?.kind === "image" ? (
                        <img src={m.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Film className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m?.name ?? "Empty clip"}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.duration.toFixed(1)}s · {MOTIONS.find((mo) => mo.id === c.motion)?.name}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveClip(c.id, -1);
                        }}
                        disabled={i === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveClip(c.id, 1);
                        }}
                        disabled={i === clips.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeClip(c.id);
                      }}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" className="w-full" onClick={() => addClip(media[0]?.id ?? null)}>
              <Plus className="mr-1 h-4 w-4" /> Add clip
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Middle: preview */}
      <div className="min-w-0 space-y-4 lg:overflow-hidden">
        <Card>
          <CardContent className="p-4">
            <div className="mx-auto overflow-hidden rounded-lg bg-black" style={{ maxWidth: 900 }}>
              <canvas ref={canvasRef} className="mx-auto block max-h-[58vh] w-full object-contain" style={{ aspectRatio: `${W} / ${H}` }} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button size="icon" variant="secondary" onClick={togglePlay}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span className="w-24 text-xs text-muted-foreground">
                {fmtTime(currentTime)} / {fmtTime(totalDuration)}
              </span>
              <Slider
                className="flex-1"
                min={0}
                max={Math.max(0.1, totalDuration)}
                step={0.05}
                value={[Math.min(currentTime, totalDuration)]}
                onValueChange={(v) => seek(v[0])}
              />
            </div>
            <Button onClick={exportVideo} disabled={exporting || !clips.length} className="mt-3 w-full">
              {exporting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Exporting… {Math.round(exportProgress)}%
                </>
              ) : (
                <>
                  <Download className="mr-1 h-4 w-4" /> Export 1080p60
                </>
              )}
            </Button>
            {exporting && <Progress value={exportProgress} className="mt-2" />}
          </CardContent>
        </Card>

        {selectedClip && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clip settings</CardTitle>
              <CardDescription>Motion, transitions, media and duration for the selected clip.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Media</Label>
                <Select
                  value={selectedClip.mediaId ?? "__none"}
                  onValueChange={(v) => updateClip(selectedClip.id, { mediaId: v === "__none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {media.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Duration · {selectedClip.duration.toFixed(1)}s</Label>
                <Slider
                  min={1}
                  max={20}
                  step={0.5}
                  value={[selectedClip.duration]}
                  onValueChange={(v) => updateClip(selectedClip.id, { duration: v[0] })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Motion</Label>
                  <Select
                    value={selectedClip.motion}
                    onValueChange={(v) => updateClip(selectedClip.id, { motion: v as MotionKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIONS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Easing</Label>
                  <Select
                    value={selectedClip.easing}
                    onValueChange={(v) => updateClip(selectedClip.id, { easing: v as EasingKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EASINGS.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Transition in</Label>
                  <Select
                    value={selectedClip.transitionIn}
                    onValueChange={(v) => updateClip(selectedClip.id, { transitionIn: v as TransitionKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSITIONS.map((tr) => (
                        <SelectItem key={tr.id} value={tr.id}>
                          {tr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Transition out</Label>
                  <Select
                    value={selectedClip.transitionOut}
                    onValueChange={(v) => updateClip(selectedClip.id, { transitionOut: v as TransitionKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSITIONS.map((tr) => (
                        <SelectItem key={tr.id} value={tr.id}>
                          {tr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Text layers</Label>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => addTextLayer(selectedClip.id, "title")}>
                      <TypeIcon className="mr-1 h-3 w-3" /> Title
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addTextLayer(selectedClip.id, "subtitle")}>
                      Subtitle
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addTextLayer(selectedClip.id, "lower-third")}>
                      Lower 3rd
                    </Button>
                  </div>
                </div>
                {selectedClip.texts.map((t) => (
                  <div key={t.id} className="space-y-2 rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium capitalize text-muted-foreground">{t.kind}</span>
                      <button onClick={() => removeTextLayer(selectedClip.id, t.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      value={t.text}
                      onChange={(e) => updateTextLayer(selectedClip.id, t.id, { text: e.target.value })}
                      className="text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Size · {t.fontSize}px</Label>
                        <Slider
                          min={16}
                          max={120}
                          step={1}
                          value={[t.fontSize]}
                          onValueChange={(v) => updateTextLayer(selectedClip.id, t.id, { fontSize: v[0] })}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Colour</Label>
                        <input
                          type="color"
                          value={t.color}
                          onChange={(e) => updateTextLayer(selectedClip.id, t.id, { color: e.target.value })}
                          className="h-8 w-full rounded border"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">X · {t.x}%</Label>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={[t.x]}
                          onValueChange={(v) => updateTextLayer(selectedClip.id, t.id, { x: v[0] })}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Y · {t.y}%</Label>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={[t.y]}
                          onValueChange={(v) => updateTextLayer(selectedClip.id, t.id, { y: v[0] })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Entrance</Label>
                      <Select
                        value={t.entrance}
                        onValueChange={(v) => updateTextLayer(selectedClip.id, t.id, { entrance: v as Entrance })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="fade">Fade</SelectItem>
                          <SelectItem value="slide-up">Slide up</SelectItem>
                          <SelectItem value="slide-down">Slide down</SelectItem>
                          <SelectItem value="pop">Pop</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: global settings */}
      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade & effects</CardTitle>
            <CardDescription>Global colour grade applied across every clip.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Preset</Label>
              <Select value={gradePreset} onValueChange={(v) => setGradePreset(v as GradePreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Exposure · {exposure}</Label>
              <Slider min={-40} max={40} step={1} value={[exposure]} onValueChange={(v) => setExposure(v[0])} />
            </div>
            <div>
              <Label className="text-xs">Contrast · {contrast}</Label>
              <Slider min={-40} max={40} step={1} value={[contrast]} onValueChange={(v) => setContrast(v[0])} />
            </div>
            <div>
              <Label className="text-xs">Saturation · {saturation}</Label>
              <Slider min={-60} max={60} step={1} value={[saturation]} onValueChange={(v) => setSaturation(v[0])} />
            </div>
            <div>
              <Label className="text-xs">Vignette · {Math.round(vignette * 100)}%</Label>
              <Slider min={0} max={1} step={0.05} value={[vignette]} onValueChange={(v) => setVignette(v[0])} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Film grain</Label>
                <p className="text-xs text-muted-foreground">Subtle archival texture overlay.</p>
              </div>
              <Switch checked={grain} onCheckedChange={setGrain} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Letterbox</Label>
                <p className="text-xs text-muted-foreground">Cinematic black bars top/bottom.</p>
              </div>
              <Switch checked={letterbox} onCheckedChange={setLetterbox} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="h-4 w-4" /> Voiceover
            </CardTitle>
            <CardDescription>Upload narration, or generate one from a script.</CardDescription>
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
                  onChange={(e) => e.target.files?.[0] && onNarrationFile(e.target.files[0])}
                />
              </label>
            )}
            {narrationDuration > 0 && (
              <p className="text-xs text-muted-foreground">{fmtTime(narrationDuration)} duration</p>
            )}
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs">Or generate a voiceover</Label>
              <Textarea
                rows={3}
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
            <div>
              <Label className="text-xs">Voiceover volume · {Math.round(narrationVolume * 100)}%</Label>
              <Slider min={0} max={1} step={0.05} value={[narrationVolume]} onValueChange={(v) => setNarrationVolume(v[0])} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Match duration to voiceover</Label>
                <p className="text-xs text-muted-foreground">Stretches clip durations to fit the narration length.</p>
              </div>
              <Switch checked={matchDuration} onCheckedChange={setMatchDuration} disabled={!narrationDuration} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Music2 className="h-4 w-4" /> Background music
            </CardTitle>
            <CardDescription>Loops under the narration during preview and export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {musicUrl ? (
              <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="truncate">
                  <Music2 className="mr-1 inline h-3.5 w-3.5" />
                  {musicName}
                </span>
                <Button variant="ghost" size="sm" onClick={clearMusic}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50">
                <Upload className="mr-2 h-4 w-4" /> Upload background music
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onMusicFile(e.target.files[0])}
                />
              </label>
            )}
            <div>
              <Label className="text-xs">Music volume · {Math.round(musicVolume * 100)}%</Label>
              <Slider min={0} max={1} step={0.05} value={[musicVolume]} onValueChange={(v) => setMusicVolume(v[0])} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>Select a clip on the timeline to edit its motion, transitions and text layers.</p>
            <p>Export renders at 1920×1080, 60fps, mixing voiceover and music.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
