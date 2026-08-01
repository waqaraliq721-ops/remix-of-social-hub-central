// HQ YouTube-style documentary editor — a from-scratch clip editor with media
// library, per-clip motion/transitions/filters, text layers, voiceover, music,
// live canvas preview and 1080p60 export.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Pause,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Music,
  Mic,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { generateSpeech, TTS_PROVIDERS, TTS_VOICES, type TtsProvider } from "@/lib/tts";

// ---------------------------------------------------------------------------
// Types & presets
// ---------------------------------------------------------------------------

type Ratio = "16:9" | "9:16" | "1:1";

type MotionId =
  | "static"
  | "kenburns-in"
  | "kenburns-out"
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down"
  | "drift"
  | "parallax";

const MOTIONS: { id: MotionId; name: string }[] = [
  { id: "kenburns-in", name: "Ken Burns in" },
  { id: "kenburns-out", name: "Ken Burns out" },
  { id: "pan-left", name: "Pan left" },
  { id: "pan-right", name: "Pan right" },
  { id: "pan-up", name: "Pan up" },
  { id: "pan-down", name: "Pan down" },
  { id: "drift", name: "Drift" },
  { id: "parallax", name: "Parallax tilt" },
  { id: "static", name: "Static" },
];

type TransitionId =
  | "cut"
  | "cross-fade"
  | "dip-black"
  | "slide"
  | "wipe"
  | "whip-pan"
  | "blur-dissolve";

const TRANSITIONS: { id: TransitionId; name: string }[] = [
  { id: "cut", name: "Cut" },
  { id: "cross-fade", name: "Cross fade" },
  { id: "dip-black", name: "Dip to black" },
  { id: "slide", name: "Slide" },
  { id: "wipe", name: "Wipe" },
  { id: "whip-pan", name: "Whip pan" },
  { id: "blur-dissolve", name: "Blur dissolve" },
];

type EasingId = "linear" | "ease-in" | "ease-out" | "ease-in-out";
const EASINGS: { id: EasingId; name: string }[] = [
  { id: "ease-in-out", name: "Easy ease" },
  { id: "ease-out", name: "Smooth out" },
  { id: "ease-in", name: "Smooth in" },
  { id: "linear", name: "Linear" },
];

const ease = (id: EasingId, t: number) => {
  const x = Math.max(0, Math.min(1, t));
  switch (id) {
    case "ease-in":
      return x * x;
    case "ease-out":
      return 1 - (1 - x) * (1 - x);
    case "ease-in-out":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    default:
      return x;
  }
};

type GradeId = "none" | "cinematic" | "warm" | "cold" | "noir" | "sepia";
const GRADES: { id: GradeId; name: string; filter: string }[] = [
  { id: "none", name: "None", filter: "" },
  { id: "cinematic", name: "Cinematic", filter: "contrast(1.12) saturate(1.05) brightness(0.97)" },
  { id: "warm", name: "Warm", filter: "sepia(0.2) saturate(1.2) brightness(1.03)" },
  { id: "cold", name: "Cold", filter: "hue-rotate(-12deg) saturate(0.95) brightness(1.02)" },
  { id: "noir", name: "Noir", filter: "grayscale(1) contrast(1.25)" },
  { id: "sepia", name: "Sepia", filter: "sepia(0.75) contrast(1.05)" },
];

type TextAnimId = "fade" | "slide-up" | "wipe" | "scale" | "none";
const TEXT_ANIMS: { id: TextAnimId; name: string }[] = [
  { id: "fade", name: "Fade" },
  { id: "slide-up", name: "Slide up" },
  { id: "wipe", name: "Wipe" },
  { id: "scale", name: "Scale" },
  { id: "none", name: "None" },
];

type TextLayer = {
  id: string;
  text: string;
  kind: "title" | "subtitle" | "lower-third";
  size: number;
  x: number; // 0..100 %
  y: number; // 0..100 %
  color: string;
  anim: TextAnimId;
};

type Clip = {
  id: string;
  mediaId: string | null;
  duration: number;
  motion: MotionId;
  transition: TransitionId;
  easing: EasingId;
  transitionLen: number;
  grade: GradeId;
  exposure: number;
  contrast: number;
  saturation: number;
  grain: number;
  vignette: number;
  letterbox: boolean;
  texts: TextLayer[];
};

type MediaItem = {
  id: string;
  name: string;
  kind: "image" | "video";
  url: string;
  el: HTMLImageElement | HTMLVideoElement;
};

const uid = () => Math.random().toString(36).slice(2, 10);

function newClip(mediaId: string | null): Clip {
  return {
    id: uid(),
    mediaId,
    duration: 4,
    motion: "kenburns-in",
    transition: "cross-fade",
    easing: "ease-in-out",
    transitionLen: 0.6,
    grade: "cinematic",
    exposure: 1,
    contrast: 1,
    saturation: 1,
    grain: 0.08,
    vignette: 0.35,
    letterbox: false,
    texts: [],
  };
}

const DIMS: Record<Ratio, [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

// ---------------------------------------------------------------------------

export function DocumentaryHQ() {
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState(false);

  // audio
  const [voProvider, setVoProvider] = useState<TtsProvider>("elevenlabs");
  const [voVoice, setVoVoice] = useState(TTS_VOICES.elevenlabs[0].id);
  const [script, setScript] = useState("");
  const [voUrl, setVoUrl] = useState<string | null>(null);
  const [voBusy, setVoBusy] = useState(false);
  const [voVolume, setVoVolume] = useState(1);
  const [matchVo, setMatchVo] = useState(true);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.25);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const voRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const [W, H] = DIMS[ratio];
  const total = useMemo(
    () => clips.reduce((s, c) => s + Math.max(0.2, c.duration), 0) || 0.001,
    [clips],
  );
  const sel = clips.find((c) => c.id === selected) ?? null;
  const mediaById = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);

  const patch = (id: string, p: Partial<Clip>) =>
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));

  // -------------------------------------------------------------- media load
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: MediaItem[] = [];
    for (const f of Array.from(files)) {
      const url = URL.createObjectURL(f);
      const isVideo = f.type.startsWith("video");
      try {
        const el = await new Promise<HTMLImageElement | HTMLVideoElement>((res, rej) => {
          if (isVideo) {
            const v = document.createElement("video");
            v.muted = true;
            v.playsInline = true;
            v.loop = true;
            v.onloadeddata = () => res(v);
            v.onerror = () => rej(new Error("video decode failed"));
            v.src = url;
          } else {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = () => rej(new Error("image decode failed"));
            i.src = url;
          }
        });
        added.push({ id: uid(), name: f.name, kind: isVideo ? "video" : "image", url, el });
      } catch {
        toast.error(`Could not load ${f.name}`);
      }
    }
    if (!added.length) return;
    setMedia((m) => [...m, ...added]);
    setClips((cs) => {
      const next = [...cs, ...added.map((a) => newClip(a.id))];
      if (!selected && next.length) setSelected(next[0].id);
      return next;
    });
  };

  // ------------------------------------------------------------------ render
  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // locate clip
      let acc = 0;
      let idx = 0;
      for (let i = 0; i < clips.length; i++) {
        const d = Math.max(0.2, clips[i].duration);
        if (t < acc + d || i === clips.length - 1) {
          idx = i;
          break;
        }
        acc += d;
      }
      const clip = clips[idx];
      if (!clip) {
        ctx.restore();
        return;
      }
      const local = Math.max(0, t - acc);
      const dur = Math.max(0.2, clip.duration);

      const paintClip = (c: Clip, p: number, alpha: number, shift = 0, blur = 0) => {
        const m = c.mediaId ? mediaById.get(c.mediaId) : null;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        const grade = GRADES.find((g) => g.id === c.grade)?.filter ?? "";
        const custom = `brightness(${c.exposure}) contrast(${c.contrast}) saturate(${c.saturation})`;
        ctx.filter = `${grade} ${custom}${blur > 0 ? ` blur(${blur}px)` : ""}`.trim();

        if (m) {
          const src = m.el;
          const sw = m.kind === "video" ? (src as HTMLVideoElement).videoWidth : (src as HTMLImageElement).naturalWidth;
          const sh = m.kind === "video" ? (src as HTMLVideoElement).videoHeight : (src as HTMLImageElement).naturalHeight;
          if (sw && sh) {
            let zoom = 1.06;
            let ox = 0;
            let oy = 0;
            let rot = 0;
            const e = ease(c.easing, p);
            switch (c.motion) {
              case "kenburns-in":
                zoom = 1 + 0.16 * e;
                break;
              case "kenburns-out":
                zoom = 1.16 - 0.16 * e;
                break;
              case "pan-left":
                zoom = 1.14;
                ox = (0.5 - e) * 0.12 * W;
                break;
              case "pan-right":
                zoom = 1.14;
                ox = (e - 0.5) * 0.12 * W;
                break;
              case "pan-up":
                zoom = 1.14;
                oy = (0.5 - e) * 0.12 * H;
                break;
              case "pan-down":
                zoom = 1.14;
                oy = (e - 0.5) * 0.12 * H;
                break;
              case "drift":
                zoom = 1.1;
                ox = Math.sin(p * Math.PI * 2) * 0.02 * W;
                oy = Math.cos(p * Math.PI * 2) * 0.015 * H;
                break;
              case "parallax":
                zoom = 1.12;
                rot = Math.sin(p * Math.PI) * 0.012;
                oy = (e - 0.5) * 0.05 * H;
                break;
              default:
                zoom = 1.02;
            }
            const scale = Math.max(W / sw, H / sh) * zoom;
            const dw = sw * scale;
            const dh = sh * scale;
            ctx.translate(W / 2 + ox + shift, H / 2 + oy);
            ctx.rotate(rot);
            ctx.drawImage(src as CanvasImageSource, -dw / 2, -dh / 2, dw, dh);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
          }
        } else {
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, W, H);
        }
        ctx.filter = "none";

        // vignette
        if (c.vignette > 0) {
          const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(1, `rgba(0,0,0,${c.vignette})`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        // grain
        if (c.grain > 0) {
          ctx.globalAlpha = c.grain * 0.6 * (alpha || 1);
          for (let i = 0; i < 900; i++) {
            const gx = (Math.sin(i * 12.9898 + Math.floor(p * 60)) * 43758.5453) % 1;
            const gy = (Math.sin(i * 78.233 + Math.floor(p * 60)) * 43758.5453) % 1;
            ctx.fillStyle = i % 2 ? "#fff" : "#000";
            ctx.fillRect(Math.abs(gx) * W, Math.abs(gy) * H, 2, 2);
          }
          ctx.globalAlpha = alpha;
        }
        // letterbox
        if (c.letterbox) {
          const bar = H * 0.11;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, bar);
          ctx.fillRect(0, H - bar, W, bar);
        }

        // text layers
        c.texts.forEach((tl, i) => {
          const inAt = 0.15 + i * 0.12;
          const k = Math.max(0, Math.min(1, (p - inAt) / 0.25));
          if (k <= 0) return;
          ctx.save();
          ctx.globalAlpha = alpha * (tl.anim === "none" ? 1 : k);
          const fs = (tl.size / 100) * H * 0.12;
          ctx.font = `${tl.kind === "title" ? 800 : 600} ${fs}px system-ui, sans-serif`;
          ctx.fillStyle = tl.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const px = (tl.x / 100) * W;
          const py = (tl.y / 100) * H + (tl.anim === "slide-up" ? (1 - k) * fs * 0.8 : 0);
          if (tl.anim === "scale") {
            ctx.translate(px, py);
            ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
            ctx.translate(-px, -py);
          }
          if (tl.anim === "wipe") {
            const tw = ctx.measureText(tl.text).width;
            ctx.beginPath();
            ctx.rect(px - tw / 2, py - fs, tw * k, fs * 2);
            ctx.clip();
          }
          if (tl.kind === "lower-third") {
            const tw = ctx.measureText(tl.text).width;
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillRect(px - tw / 2 - fs * 0.4, py - fs * 0.72, tw + fs * 0.8, fs * 1.44);
            ctx.fillStyle = tl.color;
          }
          ctx.shadowColor = "rgba(0,0,0,0.6)";
          ctx.shadowBlur = fs * 0.25;
          ctx.fillText(tl.text, px, py);
          ctx.restore();
        });

        ctx.restore();
      };

      // transition with previous clip
      const tl = Math.max(0, Math.min(1.5, clip.transitionLen));
      const prev = clips[idx - 1];
      const inTrans = prev && local < tl && clip.transition !== "cut";
      const k = inTrans ? ease(clip.easing, local / tl) : 1;

      if (inTrans && prev) {
        const pd = Math.max(0.2, prev.duration);
        switch (clip.transition) {
          case "dip-black":
            if (k < 0.5) paintClip(prev, 1, 1 - k * 2);
            else paintClip(clip, local / dur, (k - 0.5) * 2);
            break;
          case "slide":
            paintClip(prev, 1, 1, -k * W);
            paintClip(clip, local / dur, 1, (1 - k) * W);
            break;
          case "whip-pan":
            paintClip(prev, 1, 1 - k, -k * W * 0.6, k * 18);
            paintClip(clip, local / dur, k, (1 - k) * W * 0.6, (1 - k) * 18);
            break;
          case "blur-dissolve":
            paintClip(prev, 1, 1 - k, 0, k * 14);
            paintClip(clip, local / dur, k, 0, (1 - k) * 14);
            break;
          case "wipe": {
            paintClip(prev, 1, 1);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, W * k, H);
            ctx.clip();
            paintClip(clip, local / dur, 1);
            ctx.restore();
            break;
          }
          default:
            paintClip(prev, 1, 1 - k);
            paintClip(clip, local / dur, k);
        }
        void pd;
      } else {
        paintClip(clip, local / dur, 1);
      }

      ctx.restore();
    },
    [clips, mediaById, W, H],
  );

  // repaint on any change while paused
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || playing) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    try {
      drawFrame(ctx, time);
    } catch {
      /* keep the editor alive on a bad asset */
    }
  }, [drawFrame, time, playing, W, H]);

  // playback loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      voRef.current?.pause();
      musicRef.current?.pause();
      return;
    }
    startedAtRef.current = performance.now() - time * 1000;
    media.forEach((m) => {
      if (m.kind === "video") (m.el as HTMLVideoElement).play().catch(() => {});
    });
    if (voRef.current) {
      voRef.current.currentTime = Math.min(time, voRef.current.duration || time);
      voRef.current.volume = voVolume;
      voRef.current.play().catch(() => {});
    }
    if (musicRef.current) {
      musicRef.current.volume = musicVolume;
      musicRef.current.play().catch(() => {});
    }
    const loop = () => {
      const t = (performance.now() - startedAtRef.current) / 1000;
      if (t >= total) {
        setPlaying(false);
        setTime(0);
        return;
      }
      setTime(t);
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (ctx) {
        try {
          drawFrame(ctx, t);
        } catch {
          /* skip a bad frame instead of killing the loop */
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      media.forEach((m) => {
        if (m.kind === "video") (m.el as HTMLVideoElement).pause();
      });
    };
  }, [playing, drawFrame, total, media, voVolume, musicVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------- voiceover
  const makeVoiceover = async () => {
    if (!script.trim()) {
      toast.error("Add a narration script first.");
      return;
    }
    setVoBusy(true);
    try {
      const { url, blob } = await generateSpeech(script.trim(), {
        provider: voProvider,
        voice: voVoice,
      });
      setVoUrl(url);
      if (matchVo) {
        const a = new Audio();
        a.src = URL.createObjectURL(blob);
        await new Promise<void>((res) => {
          a.onloadedmetadata = () => res();
          a.onerror = () => res();
        });
        const d = isFinite(a.duration) ? a.duration : 0;
        if (d > 0 && clips.length) {
          const per = d / clips.length;
          setClips((cs) => cs.map((c) => ({ ...c, duration: Math.max(0.5, per) })));
        }
      }
      toast.success("Voiceover ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voiceover failed");
    } finally {
      setVoBusy(false);
    }
  };

  // ---------------------------------------------------------------- export
  const exportVideo = async () => {
    if (!clips.length) {
      toast.error("Add at least one clip.");
      return;
    }
    setExporting(true);
    setPlaying(false);
    try {
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const ctx = off.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      const stream = off.captureStream(60);
      const ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      const attach = async (url: string | null, vol: number, loop: boolean) => {
        if (!url) return null;
        const el = new Audio(url);
        el.crossOrigin = "anonymous";
        el.loop = loop;
        const src = ac.createMediaElementSource(el);
        const g = ac.createGain();
        g.gain.value = vol;
        src.connect(g).connect(dest);
        return el;
      };
      const voEl = await attach(voUrl, voVolume, false);
      const musicEl = await attach(musicUrl, musicVolume, true);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));

      const rec = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
        videoBitsPerSecond: 12_000_000,
      });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<Blob>((res) => {
        rec.onstop = () => res(new Blob(chunks, { type: "video/webm" }));
      });

      rec.start();
      await ac.resume();
      voEl?.play().catch(() => {});
      musicEl?.play().catch(() => {});
      media.forEach((m) => {
        if (m.kind === "video") (m.el as HTMLVideoElement).play().catch(() => {});
      });

      const fps = 60;
      const frames = Math.ceil(total * fps);
      for (let f = 0; f < frames; f++) {
        try {
          drawFrame(ctx, f / fps);
        } catch {
          /* keep encoding */
        }
        await new Promise((r) => setTimeout(r, 1000 / fps));
      }
      rec.stop();
      voEl?.pause();
      musicEl?.pause();
      media.forEach((m) => {
        if (m.kind === "video") (m.el as HTMLVideoElement).pause();
      });
      const blob = await done;
      await ac.close();

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `documentary-hq-${Date.now()}.webm`;
      a.click();
      toast.success("Export complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // ------------------------------------------------------------------- UI
  const move = (id: string, dir: -1 | 1) =>
    setClips((cs) => {
      const i = cs.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const addText = (clipId: string) =>
    patch(clipId, {
      texts: [
        ...(clips.find((c) => c.id === clipId)?.texts ?? []),
        {
          id: uid(),
          text: "Your headline",
          kind: "title",
          size: 60,
          x: 50,
          y: 78,
          color: "#ffffff",
          anim: "slide-up",
        },
      ],
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* preview */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-center rounded-xl bg-black p-3">
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="max-h-[62vh] w-auto max-w-full rounded-lg"
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={() => setPlaying((p) => !p)} disabled={!clips.length}>
                {playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                {playing ? "Pause" : "Play"}
              </Button>
              <Slider
                className="flex-1"
                value={[time]}
                min={0}
                max={total}
                step={0.05}
                onValueChange={([v]) => {
                  setPlaying(false);
                  setTime(v);
                }}
              />
              <span className="w-20 text-right font-mono text-xs text-muted-foreground">
                {time.toFixed(1)}s / {total.toFixed(1)}s
              </span>
              <Button size="sm" variant="secondary" onClick={exportVideo} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                Export 1080p60
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
            <CardDescription>Order clips, set durations, pick the one to edit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {clips.length === 0 && (
              <p className="text-sm text-muted-foreground">Import media to create clips.</p>
            )}
            {clips.map((c, i) => {
              const m = c.mediaId ? mediaById.get(c.mediaId) : null;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 ${
                    selected === c.id ? "border-primary bg-muted/40" : ""
                  }`}
                >
                  <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                  {m?.kind === "image" ? (
                    <img src={m.url} alt="" className="h-10 w-16 rounded object-cover" />
                  ) : (
                    <div className="flex h-10 w-16 items-center justify-center rounded bg-muted text-[10px]">
                      {m ? "video" : "empty"}
                    </div>
                  )}
                  <span className="flex-1 truncate text-xs">{m?.name ?? "Blank clip"}</span>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={c.duration}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => patch(c.id, { duration: Number(e.target.value) || 1 })}
                    className="h-8 w-20"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); move(c.id, -1); }}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); move(c.id, 1); }}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClips((cs) => cs.filter((x) => x.id !== c.id));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            <Button size="sm" variant="outline" onClick={() => setClips((cs) => [...cs, newClip(null)])}>
              Add blank clip
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* settings */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Media library</CardTitle>
            <CardDescription>Images, video, graphics and icons.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Aspect ratio</Label>
              <Select value={ratio} onValueChange={(v) => setRatio(v as Ratio)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["16:9", "9:16", "1:1"] as Ratio[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              <Upload className="h-4 w-4" /> Import media
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {media.map((m) => (
                <div key={m.id} className="overflow-hidden rounded border">
                  {m.kind === "image" ? (
                    <img src={m.url} alt={m.name} className="h-14 w-full object-cover" />
                  ) : (
                    <div className="flex h-14 items-center justify-center bg-muted text-[10px]">video</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {sel && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Motion & transition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Motion</Label>
                  <Select value={sel.motion} onValueChange={(v) => patch(sel.id, { motion: v as MotionId })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MOTIONS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Transition in</Label>
                  <Select value={sel.transition} onValueChange={(v) => patch(sel.id, { transition: v as TransitionId })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRANSITIONS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Easing</Label>
                  <Select value={sel.easing} onValueChange={(v) => patch(sel.id, { easing: v as EasingId })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EASINGS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    Transition length · {sel.transitionLen.toFixed(2)}s
                  </Label>
                  <Slider value={[sel.transitionLen]} min={0} max={1.5} step={0.05}
                    onValueChange={([v]) => patch(sel.id, { transitionLen: v })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Filters & effects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Grade</Label>
                  <Select value={sel.grade} onValueChange={(v) => patch(sel.id, { grade: v as GradeId })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {([
                  ["Exposure", "exposure", 0.5, 1.6],
                  ["Contrast", "contrast", 0.5, 1.8],
                  ["Saturation", "saturation", 0, 2],
                  ["Film grain", "grain", 0, 0.4],
                  ["Vignette", "vignette", 0, 0.9],
                ] as const).map(([label, key, min, max]) => (
                  <div key={key}>
                    <Label className="text-[11px] text-muted-foreground">
                      {label} · {(sel[key] as number).toFixed(2)}
                    </Label>
                    <Slider value={[sel[key] as number]} min={min} max={max} step={0.02}
                      onValueChange={([v]) => patch(sel.id, { [key]: v } as Partial<Clip>)} />
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Letterbox</Label>
                  <Switch checked={sel.letterbox} onCheckedChange={(v) => patch(sel.id, { letterbox: v })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Text layers</CardTitle>
                <Button size="sm" variant="outline" onClick={() => addText(sel.id)}>Add</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {sel.texts.length === 0 && (
                  <p className="text-xs text-muted-foreground">No text on this clip.</p>
                )}
                {sel.texts.map((tl) => {
                  const upd = (p: Partial<TextLayer>) =>
                    patch(sel.id, { texts: sel.texts.map((x) => (x.id === tl.id ? { ...x, ...p } : x)) });
                  return (
                    <div key={tl.id} className="space-y-2 rounded-lg border p-3">
                      <Input value={tl.text} onChange={(e) => upd({ text: e.target.value })} className="h-8 text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={tl.kind} onValueChange={(v) => upd({ kind: v as TextLayer["kind"] })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="title">Title</SelectItem>
                            <SelectItem value="subtitle">Subtitle</SelectItem>
                            <SelectItem value="lower-third">Lower third</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={tl.anim} onValueChange={(v) => upd({ anim: v as TextAnimId })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TEXT_ANIMS.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Size · {tl.size}</Label>
                        <Slider value={[tl.size]} min={20} max={140} step={1} onValueChange={([v]) => upd({ size: v })} />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">X · {tl.x}%</Label>
                        <Slider value={[tl.x]} min={0} max={100} step={1} onValueChange={([v]) => upd({ x: v })} />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Y · {tl.y}%</Label>
                        <Slider value={[tl.y]} min={0} max={100} step={1} onValueChange={([v]) => upd({ y: v })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={tl.color}
                          onChange={(e) => upd({ color: e.target.value })}
                          className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => patch(sel.id, { texts: sel.texts.filter((x) => x.id !== tl.id) })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4" /> Voiceover
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Narration script…"
              className="min-h-24 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={voProvider}
                onValueChange={(v) => {
                  const p = v as TtsProvider;
                  setVoProvider(p);
                  setVoVoice(TTS_VOICES[p][0].id);
                }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TTS_PROVIDERS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={voVoice} onValueChange={setVoVoice}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TTS_VOICES[voProvider].map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Match duration to voiceover</Label>
              <Switch checked={matchVo} onCheckedChange={setMatchVo} />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Volume · {Math.round(voVolume * 100)}%</Label>
              <Slider value={[voVolume]} min={0} max={1} step={0.05} onValueChange={([v]) => setVoVolume(v)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={makeVoiceover} disabled={voBusy}>
                {voBusy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Generate
              </Button>
              <label className="inline-flex cursor-pointer items-center rounded-md border px-3 text-xs">
                Upload audio
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setVoUrl(URL.createObjectURL(f));
                  }}
                />
              </label>
            </div>
            {voUrl && <audio ref={voRef} src={voUrl} controls className="w-full" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="h-4 w-4" /> Background music
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept="audio/*"
              className="h-8 text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setMusicUrl(URL.createObjectURL(f));
              }}
            />
            <div>
              <Label className="text-[11px] text-muted-foreground">Volume · {Math.round(musicVolume * 100)}%</Label>
              <Slider value={[musicVolume]} min={0} max={1} step={0.05} onValueChange={([v]) => setMusicVolume(v)} />
            </div>
            {musicUrl && <audio ref={musicRef} src={musicUrl} controls className="w-full" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
