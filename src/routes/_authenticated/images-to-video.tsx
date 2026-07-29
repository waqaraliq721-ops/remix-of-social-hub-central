import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Film,
  ImagePlus,
  Loader2,
  Music2,
  Pause,
  Play,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  MoveUp,
  MoveDown,
  Captions,
  Volume2,
  Wand,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/images-to-video")({
  head: () => ({
    meta: [
      { title: "Images to Video — Orbit" },
      {
        name: "description",
        content:
          "Turn a stack of images into a polished short video with AI voiceover, background music, animated captions, transitions and MP4 export — all in your browser.",
      },
    ],
  }),
  component: ImagesToVideoPage,
});

type TransitionKind = "none" | "fade" | "slide" | "slide-up" | "zoom-blur";
type MotionKind = "none" | "kenburns" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right";

type ImgItem = {
  id: string;
  src: string; // object URL
  bitmap: HTMLImageElement;
  name: string;
  motion: MotionKind;
  transition: TransitionKind; // transition OUT to next image
};

type AspectKey = "9:16" | "1:1" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · Reels/TikTok/Shorts" },
  "1:1": { w: 1080, h: 1080, label: "Square · Instagram feed" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

type CaptionPosition = "top" | "middle" | "bottom";
type CaptionStyle = "pop" | "clean" | "bold" | "underline" | "karaoke";

const MOTION_OPTIONS: { value: MotionKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "kenburns", label: "Ken Burns" },
  { value: "zoom-in", label: "Zoom in" },
  { value: "zoom-out", label: "Zoom out" },
  { value: "pan-left", label: "Pan left" },
  { value: "pan-right", label: "Pan right" },
];

const TRANSITION_OPTIONS: { value: TransitionKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "slide-up", label: "Slide up" },
  { value: "zoom-blur", label: "Zoom" },
];

type EasingKind = "linear" | "ease-in" | "ease-out" | "ease-in-out";

const EASING_OPTIONS: { value: EasingKind; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "ease-in", label: "Smooth in" },
  { value: "ease-out", label: "Smooth out" },
  { value: "ease-in-out", label: "Ease in-out (AE)" },
];

/** Cubic easing curves that feel like After Effects easy-ease. */
function applyEasing(t: number, kind: EasingKind) {
  const x = Math.max(0, Math.min(1, t));
  switch (kind) {
    case "ease-in":
      return x * x * x;
    case "ease-out":
      return 1 - Math.pow(1 - x, 3);
    case "ease-in-out":
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    default:
      return x;
  }
}

/** Rough English syllable count — much closer to spoken duration than char count. */
function estimateSyllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 1;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

type TtsProvider = "lovable" | "elevenlabs" | "google";

const PROVIDERS: { id: TtsProvider; label: string; hint: string }[] = [
  { id: "lovable", label: "Lovable AI", hint: "Uses your Lovable credits" },
  { id: "elevenlabs", label: "ElevenLabs", hint: "Studio-grade voices (free tier available)" },
  { id: "google", label: "Google AI Studio", hint: "Gemini TTS · free tier" },
];

const VOICES_BY_PROVIDER: Record<TtsProvider, { id: string; label: string }[]> = {
  lovable: [
    { id: "alloy", label: "Alloy — neutral" },
    { id: "verse", label: "Verse — warm" },
    { id: "sage", label: "Sage — calm" },
    { id: "coral", label: "Coral — bright" },
    { id: "ballad", label: "Ballad — cinematic" },
    { id: "ash", label: "Ash — deep" },
  ],
  elevenlabs: [
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — warm female" },
    { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura — friendly female" },
    { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica — expressive female" },
    { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda — narrator female" },
    { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice — british female" },
    { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — narrator male" },
    { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger — confident male" },
    { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie — natural male" },
    { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam — articulate male" },
    { id: "nPczCjzI2devNBz1zQrb", label: "Brian — deep male" },
  ],
  google: [
    { id: "Kore", label: "Kore — firm" },
    { id: "Puck", label: "Puck — upbeat" },
    { id: "Zephyr", label: "Zephyr — bright" },
    { id: "Charon", label: "Charon — informative" },
    { id: "Fenrir", label: "Fenrir — excitable" },
    { id: "Leda", label: "Leda — youthful" },
    { id: "Orus", label: "Orus — firm male" },
    { id: "Aoede", label: "Aoede — breezy" },
  ],
};

const MODELS_BY_PROVIDER: Record<TtsProvider, { id: string; label: string }[]> = {
  lovable: [
    { id: "openai/gpt-4o-mini-tts", label: "GPT-4o Mini TTS" },
    { id: "google/gemini-2.5-flash-tts", label: "Gemini 2.5 Flash TTS" },
    { id: "google/gemini-2.5-pro-tts", label: "Gemini 2.5 Pro TTS" },
  ],
  elevenlabs: [
    { id: "eleven_multilingual_v2", label: "Multilingual v2 (best)" },
    { id: "eleven_turbo_v2_5", label: "Turbo v2.5 (fast)" },
    { id: "eleven_turbo_v2", label: "Turbo v2 (fastest)" },
  ],
  google: [
    { id: "gemini-2.5-flash-preview-tts", label: "Gemini 2.5 Flash (free)" },
    { id: "gemini-2.5-pro-preview-tts", label: "Gemini 2.5 Pro" },
  ],
};

const CAPTION_FONTS = [
  { id: "Inter, system-ui, sans-serif", label: "Inter" },
  { id: "'Impact', 'Anton', system-ui, sans-serif", label: "Impact" },
  { id: "'Poppins', system-ui, sans-serif", label: "Poppins" },
  { id: "'Bebas Neue', Impact, sans-serif", label: "Bebas" },
  { id: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { id: "'Courier New', monospace", label: "Mono" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** Split script into caption chunks with weights based on syllable counts. */
function buildCaptionChunks(script: string, wordsPer: number) {
  const words = script.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const chunks: { text: string; weight: number }[] = [];
  for (let i = 0; i < words.length; i += wordsPer) {
    const slice = words.slice(i, i + wordsPer);
    const text = slice.join(" ");
    // syllables ~ spoken duration; add small trailing-punctuation pause
    const syll = slice.reduce((s, w) => s + estimateSyllables(w), 0);
    const pausePad = /[,.;:!?]$/.test(text) ? 0.6 : 0;
    chunks.push({ text, weight: Math.max(0.5, syll + pausePad) });
  }
  return chunks;
}

function ImagesToVideoPage() {
  const [images, setImages] = useState<ImgItem[]>([]);
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [perImageDuration, setPerImageDuration] = useState(3);
  const [defaultMotion, setDefaultMotion] = useState<MotionKind>("kenburns");
  const [defaultTransition, setDefaultTransition] = useState<TransitionKind>("fade");
  const [transitionMs, setTransitionMs] = useState(500);

  const [script, setScript] = useState("");
  const [provider, setProvider] = useState<TtsProvider>("lovable");
  const [voice, setVoice] = useState(VOICES_BY_PROVIDER.lovable[0].id);
  const [model, setModel] = useState(MODELS_BY_PROVIDER.lovable[0].id);
  const [voUrl, setVoUrl] = useState<string | null>(null);
  const [voLoading, setVoLoading] = useState(false);
  const [voDuration, setVoDuration] = useState(0);

  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicName, setMusicName] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(20);
  const [voVolume, setVoVolume] = useState(100);

  const [captionsOn, setCaptionsOn] = useState(true);
  const [captionsGenerated, setCaptionsGenerated] = useState(false);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("pop");
  const [captionPos, setCaptionPos] = useState<CaptionPosition>("bottom");
  const [captionWords, setCaptionWords] = useState(3);
  const [captionSize, setCaptionSize] = useState(72);
  const [captionColor, setCaptionColor] = useState("#ffffff");
  const [captionAccent, setCaptionAccent] = useState("#c084fc");
  const [captionFont, setCaptionFont] = useState(CAPTION_FONTS[0].id);
  const [captionUppercase, setCaptionUppercase] = useState(true);
  const [captionWeight, setCaptionWeight] = useState(800);
  const [captionMargin, setCaptionMargin] = useState(140);
  const [captionStrokeWidth, setCaptionStrokeWidth] = useState(12);
  const [captionBgOpacity, setCaptionBgOpacity] = useState(100);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const drawRef = useRef<(canvas: HTMLCanvasElement, t: number) => void>(() => {});

  const dims = ASPECTS[aspect];

  const totalDuration = useMemo(() => {
    if (images.length === 0) return 0;
    if (voDuration > 0) return Math.max(voDuration, images.length * 1.2);
    return images.length * perImageDuration;
  }, [images.length, perImageDuration, voDuration]);

  /** Captions scheduled by weight, aligned to voice-over span. Only active once the
   * user has generated captions from an existing voiceover. */
  const captionSchedule = useMemo(() => {
    if (!captionsGenerated || voDuration <= 0) return [] as { start: number; end: number; text: string }[];
    const chunks = buildCaptionChunks(script, captionWords);
    if (!chunks.length) return [];
    const totalWeight = chunks.reduce((s, c) => s + c.weight, 0);
    let cursor = 0;
    const out: { start: number; end: number; text: string }[] = [];
    for (const c of chunks) {
      const dur = (c.weight / totalWeight) * voDuration;
      out.push({ start: cursor, end: cursor + dur, text: c.text });
      cursor += dur;
    }
    return out;
  }, [script, captionWords, voDuration, captionsGenerated]);

  // -------- Image loading --------
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      const items: ImgItem[] = [];
      for (const f of arr) {
        const src = URL.createObjectURL(f);
        try {
          const bmp = await loadImageFromUrl(src);
          items.push({
            id: uid(),
            src,
            bitmap: bmp,
            name: f.name,
            motion: defaultMotion,
            transition: defaultTransition,
          });
        } catch {
          URL.revokeObjectURL(src);
        }
      }
      if (items.length) setImages((prev) => [...prev, ...items]);
    },
    [defaultMotion, defaultTransition],
  );

  const removeImage = (id: string) =>
    setImages((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.src);
      return prev.filter((p) => p.id !== id);
    });

  const move = (id: string, dir: -1 | 1) =>
    setImages((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const updateImage = (id: string, patch: Partial<ImgItem>) =>
    setImages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const applyMotionToAll = (m: MotionKind) =>
    setImages((prev) => prev.map((p) => ({ ...p, motion: m })));

  const applyTransitionToAll = (t: TransitionKind) =>
    setImages((prev) => prev.map((p) => ({ ...p, transition: t })));

  const randomizeAll = () => {
    // exclude "none" so randomization always produces visible motion/transitions
    const motions = MOTION_OPTIONS.filter((o) => o.value !== "none").map((o) => o.value);
    const transitions = TRANSITION_OPTIONS.filter((o) => o.value !== "none").map((o) => o.value);
    setImages((prev) =>
      prev.map((p) => ({
        ...p,
        motion: motions[Math.floor(Math.random() * motions.length)],
        transition: transitions[Math.floor(Math.random() * transitions.length)],
      })),
    );
    toast.success("Randomized motion & transitions");
  };

  // -------- Rendering (draws image with motion, handles transition to next) --------
  const drawImageWithMotion = (
    ctx: CanvasRenderingContext2D,
    img: ImgItem,
    local: number,
    cw: number,
    ch: number,
    extra: { ox?: number; oy?: number; scaleMul?: number; alpha?: number; blur?: number } = {},
  ) => {
    let scale = 1;
    let mx = 0;
    let my = 0;
    switch (img.motion) {
      case "kenburns":
        scale = 1.05 + 0.12 * local;
        mx = -40 * local;
        my = -30 * local;
        break;
      case "zoom-in":
        scale = 1 + 0.18 * local;
        break;
      case "zoom-out":
        scale = 1.18 - 0.18 * local;
        break;
      case "pan-left":
        scale = 1.1;
        mx = 60 * (0.5 - local);
        break;
      case "pan-right":
        scale = 1.1;
        mx = -60 * (0.5 - local);
        break;
    }
    scale *= extra.scaleMul ?? 1;

    const iw = img.bitmap.naturalWidth;
    const ih = img.bitmap.naturalHeight;
    const ratio = Math.max(cw / iw, ch / ih) * scale;
    const dw = iw * ratio;
    const dh = ih * ratio;
    const dx = (cw - dw) / 2 + mx + (extra.ox ?? 0);
    const dy = (ch - dh) / 2 + my + (extra.oy ?? 0);

    ctx.save();
    if (extra.alpha !== undefined) ctx.globalAlpha = extra.alpha;
    if (extra.blur) ctx.filter = `blur(${extra.blur}px)`;
    ctx.drawImage(img.bitmap, dx, dy, dw, dh);
    ctx.restore();
  };

  const drawFrame = useCallback(
    (canvas: HTMLCanvasElement, t: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!images.length || totalDuration <= 0) return;

      const per = totalDuration / images.length;
      const idx = Math.min(images.length - 1, Math.floor(t / per));
      const local = (t - idx * per) / per; // 0..1
      const img = images[idx];
      const transDur = transitionMs / 1000;
      const cw = canvas.width;
      const ch = canvas.height;

      const remaining = per - (t - idx * per);
      const inTransition =
        idx < images.length - 1 && remaining < transDur && img.transition !== "none";
      const p = inTransition ? 1 - remaining / transDur : 0; // 0..1 across transition

      if (!inTransition) {
        drawImageWithMotion(ctx, img, local, cw, ch);
      } else {
        const nextImg = images[idx + 1];
        switch (img.transition) {
          case "fade":
            drawImageWithMotion(ctx, img, local, cw, ch);
            drawImageWithMotion(ctx, nextImg, 0, cw, ch, { alpha: p });
            break;
          case "slide":
            drawImageWithMotion(ctx, img, local, cw, ch, { ox: -cw * p });
            drawImageWithMotion(ctx, nextImg, 0, cw, ch, { ox: cw * (1 - p) });
            break;
          case "slide-up":
            drawImageWithMotion(ctx, img, local, cw, ch, { oy: -ch * p });
            drawImageWithMotion(ctx, nextImg, 0, cw, ch, { oy: ch * (1 - p) });
            break;
          case "zoom-blur":
            drawImageWithMotion(ctx, img, local, cw, ch, {
              scaleMul: 1 + 0.3 * p,
              alpha: 1 - p,
              blur: 8 * p,
            });
            drawImageWithMotion(ctx, nextImg, 0, cw, ch, {
              scaleMul: 1.3 - 0.3 * p,
              alpha: p,
              blur: 8 * (1 - p),
            });
            break;
          default:
            drawImageWithMotion(ctx, img, local, cw, ch);
        }
      }

      // Captions
      if (captionsOn && captionSchedule.length) {
        const active = captionSchedule.find((c) => t >= c.start && t < c.end);
        if (active) {
          const progress = (t - active.start) / Math.max(0.001, active.end - active.start);
          drawCaption(ctx, active.text, cw, ch, progress);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images, totalDuration, transitionMs, captionsOn, captionSchedule, captionStyle, captionPos, captionSize, captionColor, captionAccent, captionFont, captionUppercase, captionWeight, captionMargin, captionStrokeWidth, captionBgOpacity],
  );

  // Keep latest drawFrame in a ref so the RAF loop is not recreated every state change.
  useEffect(() => {
    drawRef.current = drawFrame;
  }, [drawFrame]);

  const drawCaption = useCallback(
    (ctx: CanvasRenderingContext2D, rawText: string, w: number, h: number, progress: number) => {
      const text = captionUppercase ? rawText.toUpperCase() : rawText;
      const size = captionSize;
      const paddingX = size * 0.55;
      const paddingY = size * 0.32;
      ctx.font = `${captionWeight} ${size}px ${captionFont}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const metrics = ctx.measureText(text);
      const textW = metrics.width;
      const boxW = Math.min(w - 80, textW + paddingX * 2);
      const boxH = size + paddingY * 2;
      let y = h - boxH - captionMargin;
      if (captionPos === "top") y = captionMargin;
      if (captionPos === "middle") y = (h - boxH) / 2;
      const x = (w - boxW) / 2;
      const cx = w / 2;
      const cy = y + boxH / 2;

      // subtle pop-in scale for readability
      const pop = Math.min(1, progress * 6);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(0.92 + 0.08 * pop, 0.92 + 0.08 * pop);
      ctx.translate(-cx, -cy);

      if (captionStyle === "pop") {
        const bg = hexWithAlpha(captionAccent, captionBgOpacity / 100);
        ctx.fillStyle = bg;
        roundRect(ctx, x, y, boxW, boxH, size * 0.25);
        ctx.fill();
        ctx.fillStyle = captionColor;
        ctx.fillText(text, cx, cy);
      } else if (captionStyle === "bold") {
        ctx.lineWidth = captionStrokeWidth;
        ctx.strokeStyle = "#000";
        ctx.lineJoin = "round";
        ctx.strokeText(text, cx, cy);
        ctx.fillStyle = captionColor;
        ctx.fillText(text, cx, cy);
      } else if (captionStyle === "underline") {
        if (captionBgOpacity > 0) {
          ctx.fillStyle = hexWithAlpha("#000000", (captionBgOpacity / 100) * 0.4);
          roundRect(ctx, x, y, boxW, boxH, size * 0.2);
          ctx.fill();
        }
        ctx.fillStyle = captionColor;
        ctx.fillText(text, cx, cy);
        ctx.strokeStyle = captionAccent;
        ctx.lineWidth = size * 0.08;
        ctx.beginPath();
        ctx.moveTo(cx - textW / 2, cy + size * 0.55);
        ctx.lineTo(cx + textW / 2, cy + size * 0.55);
        ctx.stroke();
      } else if (captionStyle === "karaoke") {
        // Word-by-word highlight across the chunk
        const words = text.split(" ");
        const activeIdx = Math.min(words.length - 1, Math.floor(progress * words.length));
        const spaceW = ctx.measureText(" ").width;
        const widths = words.map((wd) => ctx.measureText(wd).width);
        const total = widths.reduce((s, wv) => s + wv, 0) + spaceW * (words.length - 1);
        let cursor = cx - total / 2;
        if (captionBgOpacity > 0) {
          ctx.fillStyle = hexWithAlpha("#000000", (captionBgOpacity / 100) * 0.5);
          roundRect(ctx, x, y, boxW, boxH, size * 0.2);
          ctx.fill();
        }
        ctx.textAlign = "left";
        for (let i = 0; i < words.length; i++) {
          ctx.fillStyle = i <= activeIdx ? captionAccent : captionColor;
          ctx.lineWidth = Math.max(4, captionStrokeWidth * 0.6);
          ctx.strokeStyle = "#000";
          ctx.lineJoin = "round";
          ctx.strokeText(words[i], cursor, cy);
          ctx.fillText(words[i], cursor, cy);
          cursor += widths[i] + spaceW;
        }
      } else {
        // clean
        if (captionBgOpacity > 0) {
          ctx.fillStyle = hexWithAlpha("#000000", (captionBgOpacity / 100) * 0.55);
          roundRect(ctx, x, y, boxW, boxH, size * 0.2);
          ctx.fill();
        }
        ctx.fillStyle = captionColor;
        ctx.fillText(text, cx, cy);
      }
      ctx.restore();
    },
    [captionAccent, captionBgOpacity, captionColor, captionFont, captionMargin, captionPos, captionSize, captionStrokeWidth, captionStyle, captionUppercase, captionWeight],
  );

  function hexWithAlpha(hex: string, alpha: number) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
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

  // Re-sync required if script or chunking changes
  useEffect(() => {
    setCaptionsGenerated(false);
  }, [script, captionWords]);

  // Redraw preview when paused-state deps change
  useEffect(() => {
    if (playing) return;
    const c = canvasRef.current;
    if (!c) return;
    drawFrame(c, Math.min(currentTime, totalDuration));
  }, [drawFrame, currentTime, playing, totalDuration]);

  // Playback loop — draws directly and throttles React state updates for smoothness
  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    startedAtRef.current = performance.now() - pausedAtRef.current * 1000;
    let lastUiUpdate = 0;
    const tick = () => {
      const t = (performance.now() - startedAtRef.current) / 1000;
      timeRef.current = t;
      if (t >= totalDuration) {
        const c = canvasRef.current;
        if (c) drawRef.current(c, totalDuration);
        setCurrentTime(totalDuration);
        setPlaying(false);
        pausedAtRef.current = 0;
        if (voAudioRef.current) voAudioRef.current.pause();
        if (musicAudioRef.current) musicAudioRef.current.pause();
        return;
      }
      const c = canvasRef.current;
      if (c) drawRef.current(c, t);
      // update slider ~10Hz to avoid re-render thrash
      if (t - lastUiUpdate > 0.1) {
        lastUiUpdate = t;
        setCurrentTime(t);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, totalDuration]);

  const togglePlay = () => {
    if (!images.length) {
      toast("Add at least one image first");
      return;
    }
    if (playing) {
      pausedAtRef.current = timeRef.current;
      setCurrentTime(timeRef.current);
      setPlaying(false);
      voAudioRef.current?.pause();
      musicAudioRef.current?.pause();
    } else {
      if (currentTime >= totalDuration) {
        pausedAtRef.current = 0;
        setCurrentTime(0);
      }
      setPlaying(true);
      if (voAudioRef.current) {
        voAudioRef.current.currentTime = pausedAtRef.current;
        voAudioRef.current.volume = voVolume / 100;
        voAudioRef.current.play().catch(() => {});
      }
      if (musicAudioRef.current) {
        musicAudioRef.current.currentTime = pausedAtRef.current % (musicAudioRef.current.duration || 1);
        musicAudioRef.current.volume = musicVolume / 100;
        musicAudioRef.current.loop = true;
        musicAudioRef.current.play().catch(() => {});
      }
    }
  };

  // -------- TTS --------
  const generateVoiceover = async () => {
    if (!script.trim()) {
      toast("Write a script first");
      return;
    }
    setVoLoading(true);
    try {
      const endpoint =
        provider === "elevenlabs"
          ? "/api/tts-elevenlabs"
          : provider === "google"
            ? "/api/tts-google"
            : "/api/tts";
      const body =
        provider === "elevenlabs"
          ? { text: script, voiceId: voice, modelId: model }
          : { text: script, voice, model };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `TTS failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (voUrl) URL.revokeObjectURL(voUrl);
      setVoUrl(url);
      setCaptionsGenerated(false); // require re-generate to match the new audio
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        setVoDuration(audio.duration);
      });
      voAudioRef.current = audio;
      toast.success("Voiceover ready — now generate captions to sync them");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "TTS failed");
    } finally {
      setVoLoading(false);
    }
  };

  const clearVoiceover = () => {
    if (voUrl) URL.revokeObjectURL(voUrl);
    setVoUrl(null);
    setVoDuration(0);
    setCaptionsGenerated(false);
    voAudioRef.current = null;
  };

  const generateCaptions = () => {
    if (!voUrl || voDuration <= 0) {
      toast("Generate a voiceover first — captions align to it");
      return;
    }
    if (!script.trim()) {
      toast("Write a script first");
      return;
    }
    setCaptionsGenerated(true);
    toast.success("Captions synced to voiceover");
  };

  // -------- Music --------
  const onMusicFile = (f: File) => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    const url = URL.createObjectURL(f);
    setMusicUrl(url);
    setMusicName(f.name);
    const audio = new Audio(url);
    audio.loop = true;
    musicAudioRef.current = audio;
  };

  const clearMusic = () => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    setMusicUrl(null);
    setMusicName(null);
    musicAudioRef.current = null;
  };

  // -------- Export --------
  const exportMp4 = async () => {
    if (!images.length) {
      toast("Add images before exporting");
      return;
    }
    setExporting(true);
    setExportProgress(0);
    try {
      const c = document.createElement("canvas");
      c.width = dims.w;
      c.height = dims.h;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");

      const fps = 30;
      const stream = c.captureStream(fps);

      const AC: typeof AudioContext =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
      const audioCtx = new AC();
      const dest = audioCtx.createMediaStreamDestination();

      const attach = async (url: string, volume: number, loop: boolean) => {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(buf.slice(0));
        const src = audioCtx.createBufferSource();
        src.buffer = audioBuf;
        src.loop = loop;
        const gain = audioCtx.createGain();
        gain.gain.value = volume;
        src.connect(gain).connect(dest);
        return src;
      };

      const sources: AudioBufferSourceNode[] = [];
      if (voUrl) sources.push(await attach(voUrl, voVolume / 100, false));
      if (musicUrl) sources.push(await attach(musicUrl, musicVolume / 100, true));

      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

      const mimeCandidates = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
      });

      recorder.start(200);
      sources.forEach((s) => s.start());

      const start = performance.now();
      const durMs = totalDuration * 1000;
      await new Promise<void>((resolve) => {
        const step = () => {
          const t = (performance.now() - start) / 1000;
          if (t >= totalDuration) {
            drawFrame(c, totalDuration - 0.001);
            resolve();
            return;
          }
          drawFrame(c, t);
          setExportProgress(Math.min(100, (t * 1000 * 100) / durMs));
          requestAnimationFrame(step);
        };
        step();
      });

      await new Promise((r) => setTimeout(r, 250));
      recorder.stop();
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* noop */
        }
      });
      const blob = await done;
      await audioCtx.close();

      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orbit-video-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success(`Exported ${ext.toUpperCase()}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  // -------- Drag & drop --------
  const [dragOver, setDragOver] = useState(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Studio
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Images to Video</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Drop images, tune motion &amp; transitions per clip, add an AI voiceover, layer music,
            style your captions and export a ready-to-post short — all in your browser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={aspect} onValueChange={(v) => setAspect(v as AspectKey)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ASPECTS) as AspectKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {k} · {ASPECTS[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,380px)_1fr_minmax(320px,400px)]">
        {/* LEFT — Images with per-clip motion/transition */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" /> Clips
              </span>
              <span className="text-xs normal-case text-muted-foreground">{images.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center text-sm transition ${
                dragOver
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-border hover:border-violet-500/50 hover:bg-muted/30"
              }`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              <ImagePlus className="mb-2 h-6 w-6 text-muted-foreground" />
              <div className="font-medium">Add images</div>
              <div className="text-xs text-muted-foreground">Drag &amp; drop or click to browse</div>
            </label>

            {/* Defaults + apply-to-all */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Defaults (applied to new clips)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-1 block text-[11px]">Motion</Label>
                  <Select value={defaultMotion} onValueChange={(v) => setDefaultMotion(v as MotionKind)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-[11px]">Transition</Label>
                  <Select value={defaultTransition} onValueChange={(v) => setDefaultTransition(v as TransitionKind)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSITION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px]" onClick={() => applyMotionToAll(defaultMotion)} disabled={!images.length}>
                  <Wand className="mr-1 h-3 w-3" /> Motion to all
                </Button>
                <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px]" onClick={() => applyTransitionToAll(defaultTransition)} disabled={!images.length}>
                  <Wand className="mr-1 h-3 w-3" /> Transition to all
                </Button>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 w-full text-[11px]"
                onClick={randomizeAll}
                disabled={!images.length}
              >
                <Shuffle className="mr-1 h-3 w-3" /> Randomize each clip
              </Button>
              <div>
                <div className="mb-1 flex justify-between text-[11px]">
                  <Label>Transition length</Label>
                  <span className="text-muted-foreground">{transitionMs}ms</span>
                </div>
                <Slider min={150} max={1500} step={50} value={[transitionMs]} onValueChange={(v) => setTransitionMs(v[0])} />
              </div>
            </div>

            <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className="group rounded-lg border bg-card p-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <img src={img.src} alt={img.name} className="h-12 w-12 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{img.name}</div>
                      <div className="text-[10px] text-muted-foreground">Clip #{i + 1}</div>
                    </div>
                    <div className="flex flex-col">
                      <button
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => move(img.id, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                      >
                        <MoveUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => move(img.id, 1)}
                        disabled={i === images.length - 1}
                        aria-label="Move down"
                      >
                        <MoveDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      className="p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => removeImage(img.id)}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Motion</Label>
                      <Select value={img.motion} onValueChange={(v) => updateImage(img.id, { motion: v as MotionKind })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOTION_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                        {i === images.length - 1 ? "Transition (last)" : "→ Next"}
                      </Label>
                      <Select
                        value={img.transition}
                        onValueChange={(v) => updateImage(img.id, { transition: v as TransitionKind })}
                        disabled={i === images.length - 1}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSITION_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t pt-3">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <Label>Per-image duration</Label>
                  <span className="text-muted-foreground">{perImageDuration.toFixed(1)}s</span>
                </div>
                <Slider
                  min={1}
                  max={8}
                  step={0.5}
                  value={[perImageDuration]}
                  onValueChange={(v) => setPerImageDuration(v[0])}
                  disabled={voDuration > 0}
                />
                {voDuration > 0 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Auto-fit to voiceover ({voDuration.toFixed(1)}s)
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CENTER — Preview */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-center">
                <div
                  className="relative overflow-hidden rounded-xl bg-black shadow-2xl"
                  style={{
                    aspectRatio: `${dims.w} / ${dims.h}`,
                    width: aspect === "16:9" ? "min(720px, 100%)" : aspect === "1:1" ? "min(520px, 100%)" : "min(360px, 100%)",
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    width={dims.w}
                    height={dims.h}
                    className="h-full w-full"
                  />
                  {!images.length && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                      <Film className="mb-2 h-8 w-8 opacity-60" />
                      Add images to start building your video.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Button onClick={togglePlay} size="sm" variant="secondary">
                  {playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                  {playing ? "Pause" : "Play"}
                </Button>
                <div className="flex-1">
                  <Slider
                    min={0}
                    max={Math.max(0.1, totalDuration)}
                    step={0.05}
                    value={[Math.min(currentTime, totalDuration)]}
                    onValueChange={(v) => {
                      setCurrentTime(v[0]);
                      pausedAtRef.current = v[0];
                      timeRef.current = v[0];
                      if (voAudioRef.current) voAudioRef.current.currentTime = Math.min(v[0], voAudioRef.current.duration || 0);
                    }}
                  />
                </div>
                <div className="w-24 text-right font-mono text-xs text-muted-foreground">
                  {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Export
              </CardTitle>
              <CardDescription className="text-xs">
                {dims.w} × {dims.h} · 30fps · {typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/mp4") ? "H.264 MP4" : "WebM (browser fallback)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={exportMp4}
                disabled={exporting || images.length === 0}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:opacity-90"
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting… {Math.round(exportProgress)}%
                  </>
                ) : (
                  <>
                    <Film className="mr-2 h-4 w-4" /> Export video
                  </>
                )}
              </Button>
              {exporting && <Progress value={exportProgress} />}
              <p className="text-[11px] text-muted-foreground">
                Runs fully in your browser. Longer videos and lots of images can take a couple of
                minutes — desktop recommended.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Audio + Captions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Wand2 className="h-4 w-4" /> Voiceover
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Type or paste your script here…"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={5}
              />
              <div>
                <Label className="mb-1 block text-xs">Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    const p = v as TtsProvider;
                    setProvider(p);
                    setVoice(VOICES_BY_PROVIDER[p][0].id);
                    setModel(MODELS_BY_PROVIDER[p][0].id);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label} — <span className="text-muted-foreground">{p.hint}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS_BY_PROVIDER[provider].map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICES_BY_PROVIDER[provider].map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={generateVoiceover}
                  disabled={voLoading}
                  className="flex-1"
                >
                  {voLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" /> Generate voiceover
                    </>
                  )}
                </Button>
                {voUrl && (
                  <Button variant="ghost" size="icon" onClick={clearVoiceover} aria-label="Clear voiceover">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {voUrl && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-2">
                  <audio src={voUrl} controls className="h-8 w-full" />
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <Label className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3" /> Voice volume
                      </Label>
                      <span className="text-muted-foreground">{voVolume}%</span>
                    </div>
                    <Slider min={0} max={100} step={1} value={[voVolume]} onValueChange={(v) => setVoVolume(v[0])} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Music2 className="h-4 w-4" /> Music
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm hover:bg-muted/40">
                <Upload className="h-4 w-4" />
                {musicName ? <span className="truncate">{musicName}</span> : "Upload background track"}
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onMusicFile(e.target.files[0])}
                />
              </label>
              {musicUrl && (
                <>
                  <audio src={musicUrl} controls className="h-8 w-full" />
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <Label>Volume</Label>
                      <span className="text-muted-foreground">{musicVolume}%</span>
                    </div>
                    <Slider min={0} max={100} step={1} value={[musicVolume]} onValueChange={(v) => setMusicVolume(v[0])} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearMusic}>
                    <X className="mr-1 h-3 w-3" /> Remove
                  </Button>
                </>
              )}
              <p className="text-[11px] text-muted-foreground">
                Use royalty-free music (Pixabay, YouTube Audio Library, etc.) to avoid copyright issues.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Captions className="h-4 w-4" /> Auto captions
                </span>
                <Switch checked={captionsOn} onCheckedChange={setCaptionsOn} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Captions are generated <strong>after</strong> your voiceover so they line up
                exactly with the spoken audio. Regenerate them any time the script or voiceover changes.
              </p>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
                <Button
                  size="sm"
                  onClick={generateCaptions}
                  disabled={!voUrl || voDuration <= 0 || !script.trim()}
                  className="flex-1"
                >
                  <Captions className="mr-1 h-3.5 w-3.5" />
                  {captionsGenerated ? "Re-sync captions" : "Generate captions"}
                </Button>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    captionsGenerated
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {captionsGenerated ? `Synced · ${voDuration.toFixed(1)}s` : "Not synced"}
                </span>
              </div>
              {!voUrl && (
                <p className="text-[10px] text-muted-foreground">
                  Generate a voiceover in the panel above to enable captions.
                </p>
              )}
              <Tabs value={captionStyle} onValueChange={(v) => setCaptionStyle(v as CaptionStyle)}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="pop" className="text-[11px]">Pop</TabsTrigger>
                  <TabsTrigger value="clean" className="text-[11px]">Clean</TabsTrigger>
                  <TabsTrigger value="bold" className="text-[11px]">Bold</TabsTrigger>
                  <TabsTrigger value="underline" className="text-[11px]">Under</TabsTrigger>
                  <TabsTrigger value="karaoke" className="text-[11px]">Karaoke</TabsTrigger>
                </TabsList>
                <TabsContent value={captionStyle} />
              </Tabs>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-1 block text-xs">Position</Label>
                  <Select value={captionPos} onValueChange={(v) => setCaptionPos(v as CaptionPosition)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="middle">Middle</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Font</Label>
                  <Select value={captionFont} onValueChange={setCaptionFont}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPTION_FONTS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-1 block text-xs">Words / caption</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={captionWords}
                    onChange={(e) => setCaptionWords(Math.max(1, Math.min(10, Number(e.target.value) || 3)))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Weight</Label>
                  <Select value={String(captionWeight)} onValueChange={(v) => setCaptionWeight(Number(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="500">Medium</SelectItem>
                      <SelectItem value="700">Bold</SelectItem>
                      <SelectItem value="800">Extrabold</SelectItem>
                      <SelectItem value="900">Black</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <Label>Font size</Label>
                  <span className="text-muted-foreground">{captionSize}px</span>
                </div>
                <Slider min={32} max={160} step={2} value={[captionSize]} onValueChange={(v) => setCaptionSize(v[0])} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <Label>Margin from edge</Label>
                  <span className="text-muted-foreground">{captionMargin}px</span>
                </div>
                <Slider min={20} max={400} step={10} value={[captionMargin]} onValueChange={(v) => setCaptionMargin(v[0])} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <Label>Outline width</Label>
                  <span className="text-muted-foreground">{captionStrokeWidth}px</span>
                </div>
                <Slider min={0} max={30} step={1} value={[captionStrokeWidth]} onValueChange={(v) => setCaptionStrokeWidth(v[0])} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <Label>Background opacity</Label>
                  <span className="text-muted-foreground">{captionBgOpacity}%</span>
                </div>
                <Slider min={0} max={100} step={5} value={[captionBgOpacity]} onValueChange={(v) => setCaptionBgOpacity(v[0])} />
              </div>
              <div className="flex items-center justify-between rounded-md border bg-muted/20 p-2">
                <Label className="text-xs">UPPERCASE</Label>
                <Switch checked={captionUppercase} onCheckedChange={setCaptionUppercase} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-1 block text-xs">Text color</Label>
                  <Input
                    type="color"
                    value={captionColor}
                    onChange={(e) => setCaptionColor(e.target.value)}
                    className="h-9 p-1"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Accent</Label>
                  <Input
                    type="color"
                    value={captionAccent}
                    onChange={(e) => setCaptionAccent(e.target.value)}
                    className="h-9 p-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
