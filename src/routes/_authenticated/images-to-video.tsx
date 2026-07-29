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

type ImgItem = {
  id: string;
  src: string; // object URL
  bitmap: HTMLImageElement;
  name: string;
};

type AspectKey = "9:16" | "1:1" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · Reels/TikTok/Shorts" },
  "1:1": { w: 1080, h: 1080, label: "Square · Instagram feed" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

type TransitionKind = "none" | "fade" | "slide";
type MotionKind = "none" | "kenburns" | "zoom-in" | "zoom-out";
type CaptionPosition = "top" | "middle" | "bottom";
type CaptionStyle = "pop" | "clean" | "bold" | "underline";

const VOICES = [
  { id: "alloy", label: "Alloy — neutral" },
  { id: "verse", label: "Verse — warm" },
  { id: "sage", label: "Sage — calm" },
  { id: "coral", label: "Coral — bright" },
  { id: "ballad", label: "Ballad — cinematic" },
  { id: "ash", label: "Ash — deep" },
];

const MODELS = [
  { id: "openai/gpt-4o-mini-tts", label: "GPT-4o Mini TTS (default)" },
  { id: "google/gemini-2.5-flash-tts", label: "Gemini 2.5 Flash TTS" },
  { id: "google/gemini-2.5-pro-tts", label: "Gemini 2.5 Pro TTS" },
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

function splitCaptions(script: string, wordsPer: number) {
  const words = script.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPer) {
    chunks.push(words.slice(i, i + wordsPer).join(" "));
  }
  return chunks;
}

function ImagesToVideoPage() {
  const [images, setImages] = useState<ImgItem[]>([]);
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [perImageDuration, setPerImageDuration] = useState(3);
  const [motion, setMotion] = useState<MotionKind>("kenburns");
  const [transition, setTransition] = useState<TransitionKind>("fade");
  const [transitionMs, setTransitionMs] = useState(500);

  const [script, setScript] = useState("");
  const [voice, setVoice] = useState(VOICES[0].id);
  const [model, setModel] = useState(MODELS[0].id);
  const [voUrl, setVoUrl] = useState<string | null>(null);
  const [voLoading, setVoLoading] = useState(false);
  const [voDuration, setVoDuration] = useState(0);

  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicName, setMusicName] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(20);
  const [voVolume, setVoVolume] = useState(100);

  const [captionsOn, setCaptionsOn] = useState(true);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("pop");
  const [captionPos, setCaptionPos] = useState<CaptionPosition>("bottom");
  const [captionWords, setCaptionWords] = useState(3);
  const [captionSize, setCaptionSize] = useState(72);
  const [captionColor, setCaptionColor] = useState("#ffffff");
  const [captionAccent, setCaptionAccent] = useState("#c084fc");

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

  const dims = ASPECTS[aspect];

  const totalDuration = useMemo(() => {
    if (images.length === 0) return 0;
    if (voDuration > 0) return Math.max(voDuration, images.length * 1.2);
    return images.length * perImageDuration;
  }, [images.length, perImageDuration, voDuration]);

  const captionChunks = useMemo(() => splitCaptions(script, captionWords), [script, captionWords]);
  const captionSchedule = useMemo(() => {
    if (!captionChunks.length || totalDuration <= 0) return [] as { start: number; end: number; text: string }[];
    const per = totalDuration / captionChunks.length;
    return captionChunks.map((text, i) => ({ start: i * per, end: (i + 1) * per, text }));
  }, [captionChunks, totalDuration]);

  // -------- Image loading --------
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const items: ImgItem[] = [];
    for (const f of arr) {
      const src = URL.createObjectURL(f);
      try {
        const bmp = await loadImageFromUrl(src);
        items.push({ id: uid(), src, bitmap: bmp, name: f.name });
      } catch {
        URL.revokeObjectURL(src);
      }
    }
    if (items.length) setImages((prev) => [...prev, ...items]);
  }, []);

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

  // -------- Rendering --------
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

      // Motion effect: scale factor and offset
      let scale = 1;
      let ox = 0;
      let oy = 0;
      if (motion === "kenburns") {
        scale = 1 + 0.12 * local;
        ox = (idx % 2 === 0 ? -1 : 1) * 40 * local;
        oy = -30 * local;
      } else if (motion === "zoom-in") {
        scale = 1 + 0.15 * local;
      } else if (motion === "zoom-out") {
        scale = 1.15 - 0.15 * local;
      }

      // Cover-fit
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.bitmap.naturalWidth;
      const ih = img.bitmap.naturalHeight;
      const ratio = Math.max(cw / iw, ch / ih) * scale;
      const dw = iw * ratio;
      const dh = ih * ratio;
      const dx = (cw - dw) / 2 + ox;
      const dy = (ch - dh) / 2 + oy;

      ctx.save();
      // Transition: fade with previous image at end of clip
      const transDur = transitionMs / 1000;
      if (transition === "fade" && idx < images.length - 1 && per - (t - idx * per) < transDur) {
        const nextImg = images[idx + 1];
        const fadeProgress = 1 - (per - (t - idx * per)) / transDur;
        ctx.globalAlpha = 1;
        ctx.drawImage(img.bitmap, dx, dy, dw, dh);
        const niw = nextImg.bitmap.naturalWidth;
        const nih = nextImg.bitmap.naturalHeight;
        const nratio = Math.max(cw / niw, ch / nih);
        const ndw = niw * nratio;
        const ndh = nih * nratio;
        ctx.globalAlpha = fadeProgress;
        ctx.drawImage(nextImg.bitmap, (cw - ndw) / 2, (ch - ndh) / 2, ndw, ndh);
        ctx.globalAlpha = 1;
      } else if (transition === "slide" && idx < images.length - 1 && per - (t - idx * per) < transDur) {
        const nextImg = images[idx + 1];
        const p = 1 - (per - (t - idx * per)) / transDur;
        ctx.drawImage(img.bitmap, dx - cw * p, dy, dw, dh);
        const niw = nextImg.bitmap.naturalWidth;
        const nih = nextImg.bitmap.naturalHeight;
        const nratio = Math.max(cw / niw, ch / nih);
        const ndw = niw * nratio;
        const ndh = nih * nratio;
        ctx.drawImage(nextImg.bitmap, cw + (cw - ndw) / 2 - cw * p, (ch - ndh) / 2, ndw, ndh);
      } else {
        ctx.drawImage(img.bitmap, dx, dy, dw, dh);
      }
      ctx.restore();

      // Captions
      if (captionsOn && captionSchedule.length) {
        const active = captionSchedule.find((c) => t >= c.start && t < c.end);
        if (active) {
          drawCaption(ctx, active.text, canvas.width, canvas.height);
        }
      }
    },
    [images, totalDuration, motion, transition, transitionMs, captionsOn, captionSchedule],
  );

  const drawCaption = useCallback(
    (ctx: CanvasRenderingContext2D, text: string, w: number, h: number) => {
      const size = captionSize;
      const paddingX = size * 0.6;
      const paddingY = size * 0.35;
      ctx.font = `800 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const metrics = ctx.measureText(text);
      const textW = metrics.width;
      const boxW = Math.min(w - 80, textW + paddingX * 2);
      const boxH = size + paddingY * 2;
      let y = h - boxH - size;
      if (captionPos === "top") y = size;
      if (captionPos === "middle") y = (h - boxH) / 2;
      const x = (w - boxW) / 2;

      if (captionStyle === "pop") {
        ctx.fillStyle = captionAccent;
        roundRect(ctx, x, y, boxW, boxH, size * 0.25);
        ctx.fill();
        ctx.fillStyle = captionColor;
        ctx.fillText(text, w / 2, y + boxH / 2);
      } else if (captionStyle === "bold") {
        ctx.lineWidth = size * 0.15;
        ctx.strokeStyle = "#000";
        ctx.strokeText(text, w / 2, y + boxH / 2);
        ctx.fillStyle = captionColor;
        ctx.fillText(text, w / 2, y + boxH / 2);
      } else if (captionStyle === "underline") {
        ctx.fillStyle = captionColor;
        ctx.fillText(text, w / 2, y + boxH / 2);
        ctx.strokeStyle = captionAccent;
        ctx.lineWidth = size * 0.08;
        ctx.beginPath();
        ctx.moveTo(w / 2 - textW / 2, y + boxH / 2 + size * 0.55);
        ctx.lineTo(w / 2 + textW / 2, y + boxH / 2 + size * 0.55);
        ctx.stroke();
      } else {
        ctx.fillStyle = captionColor;
        ctx.fillText(text, w / 2, y + boxH / 2);
      }
    },
    [captionAccent, captionColor, captionPos, captionSize, captionStyle],
  );

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Redraw preview when state changes
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    drawFrame(c, playing ? currentTime : Math.min(currentTime, totalDuration));
  }, [drawFrame, currentTime, playing, totalDuration]);

  // Playback loop
  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    startedAtRef.current = performance.now() - pausedAtRef.current * 1000;
    const tick = () => {
      const t = (performance.now() - startedAtRef.current) / 1000;
      if (t >= totalDuration) {
        setCurrentTime(totalDuration);
        setPlaying(false);
        pausedAtRef.current = 0;
        if (voAudioRef.current) voAudioRef.current.pause();
        if (musicAudioRef.current) musicAudioRef.current.pause();
        return;
      }
      setCurrentTime(t);
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
      pausedAtRef.current = currentTime;
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
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script, voice, model }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `TTS failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (voUrl) URL.revokeObjectURL(voUrl);
      setVoUrl(url);
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        setVoDuration(audio.duration);
      });
      voAudioRef.current = audio;
      toast.success("Voiceover generated");
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
    voAudioRef.current = null;
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

      // Audio mix
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

      // Give recorder a beat to flush
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

  // -------- Drag & drop for images --------
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
            Drop images, add an AI voiceover, layer background music and animated captions, then
            export a ready-to-post short — all in your browser.
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

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr_minmax(300px,380px)]">
        {/* LEFT — Images */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" /> Images
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

            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className="group flex items-center gap-2 rounded-lg border bg-card p-2"
                >
                  <img src={img.src} alt={img.name} className="h-14 w-14 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{img.name}</div>
                    <div className="text-[10px] text-muted-foreground">#{i + 1}</div>
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
              ))}
            </div>

            <div className="space-y-3 border-t pt-3">
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-1 block text-xs">Motion</Label>
                  <Select value={motion} onValueChange={(v) => setMotion(v as MotionKind)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="kenburns">Ken Burns</SelectItem>
                      <SelectItem value="zoom-in">Zoom in</SelectItem>
                      <SelectItem value="zoom-out">Zoom out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Transition</Label>
                  <Select value={transition} onValueChange={(v) => setTransition(v as TransitionKind)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="slide">Slide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
              <div className="grid grid-cols-2 gap-2">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
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
                    {VOICES.map((v) => (
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
                Captions are generated from your script and timed across the video.
              </p>
              <Tabs value={captionStyle} onValueChange={(v) => setCaptionStyle(v as CaptionStyle)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="pop">Pop</TabsTrigger>
                  <TabsTrigger value="clean">Clean</TabsTrigger>
                  <TabsTrigger value="bold">Bold</TabsTrigger>
                  <TabsTrigger value="underline">Under</TabsTrigger>
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
                  <Label className="mb-1 block text-xs">Words per caption</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={captionWords}
                    onChange={(e) => setCaptionWords(Math.max(1, Math.min(10, Number(e.target.value) || 3)))}
                    className="h-9"
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <Label>Font size</Label>
                  <span className="text-muted-foreground">{captionSize}px</span>
                </div>
                <Slider min={32} max={140} step={2} value={[captionSize]} onValueChange={(v) => setCaptionSize(v[0])} />
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
