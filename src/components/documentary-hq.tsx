import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, Plus, Play, Pause, Download, Loader2, Mic, Music2, Film, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { generateSpeech, TTS_PROVIDERS, TTS_VOICES, type TtsProvider } from "@/lib/tts";
import { wrapText, roundRect, ease } from "@/lib/video-fx";
import {
  STAGE_W as W,
  STAGE_H as H,
  fmtTime,
  newClip,
  newTrack,
  uid,
  type Clip,
  type MediaItem,
  type Track,
} from "@/lib/doc-hq-types";
import { getAnimation } from "@/lib/doc-hq-animations";
import { drawTransitionOverlay } from "@/lib/doc-hq-transitions";
import { BACKGROUNDS, drawBackground, effectsFilterString, applyClipEffects, type BackgroundKind } from "@/lib/doc-hq-render";
import { Timeline } from "@/components/doc-hq/Timeline";
import { ClipInspector } from "@/components/doc-hq/Inspector";

const FONT_SANS = `"Inter", "Helvetica Neue", Arial, sans-serif`;
const FONT_SERIF = `Georgia, "Times New Roman", serif`;

function drawCover(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  mw: number,
  mh: number,
  w: number,
  h: number,
  fit: "cover" | "contain" | "fill",
  scale = 1,
  dx = 0,
  dy = 0,
) {
  if (!mw || !mh) return;
  if (fit === "fill") {
    ctx.drawImage(media, dx, dy, w * scale, h * scale);
    return;
  }
  const ratio = (fit === "contain" ? Math.min(w / mw, h / mh) : Math.max(w / mw, h / mh)) * scale;
  const dw = mw * ratio;
  const dh = mh * ratio;
  ctx.drawImage(media, (w - dw) / 2 + dx, (h - dh) / 2 + dy, dw, dh);
}

function drawClipText(ctx: CanvasRenderingContext2D, w: number, h: number, clip: Clip) {
  const t = clip.text;
  if (!t) return;
  const weight = t.styleKind === "title" ? 800 : t.styleKind === "subtitle" ? 600 : 700;
  const font = t.styleKind === "title" ? FONT_SERIF : FONT_SANS;
  ctx.font = `${weight} ${t.fontSize}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = w * 0.8;
  const rows = wrapText(ctx, t.content || "", maxWidth);
  const lineH = t.fontSize * 1.25;
  if (t.styleKind === "lower-third") {
    const boxW = Math.max(...rows.map((r) => ctx.measureText(r).width)) + t.fontSize * 1.4;
    const boxH = rows.length * lineH + t.fontSize * 0.6;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 6);
    ctx.fill();
    ctx.fillStyle = t.color;
    ctx.fillRect(-boxW / 2, -boxH / 2, 4, boxH);
  }
  ctx.fillStyle = t.color;
  let ty = -(rows.length - 1) * lineH * 0.5;
  for (const row of rows) {
    ctx.fillText(row, 0, ty);
    ty += lineH;
  }
}

function drawGraphic(ctx: CanvasRenderingContext2D, w: number, h: number, clip: Clip) {
  const g = clip.graphic;
  if (!g) return;
  const size = Math.min(w, h) * 0.4;
  ctx.fillStyle = g.color;
  ctx.strokeStyle = g.strokeColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  switch (g.shape) {
    case "circle":
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      break;
    case "triangle":
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, size / 2);
      ctx.lineTo(-size / 2, size / 2);
      ctx.closePath();
      break;
    case "hexagon":
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const x = Math.cos(a) * (size / 2);
        const y = Math.sin(a) * (size / 2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    case "ring":
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      break;
    case "line":
      ctx.moveTo(-size / 2, 0);
      ctx.lineTo(size / 2, 0);
      break;
    case "arrow":
      ctx.moveTo(-size / 2, 0);
      ctx.lineTo(size / 3, 0);
      ctx.moveTo(size / 4, -size / 4);
      ctx.lineTo(size / 2, 0);
      ctx.lineTo(size / 4, size / 4);
      break;
    case "star": {
      const spikes = 5;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? size / 2 : size / 4;
        const a = (Math.PI / spikes) * i - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case "rect":
    default:
      ctx.rect(-size / 2, -size / 2, size, size);
  }
  if (g.filled && g.shape !== "line" && g.shape !== "arrow") ctx.fill();
  ctx.stroke();
}

export function DocumentaryHQ() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [tracks, setTracks] = useState<Track[]>(() => [newTrack("Visuals", "visual")]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundKind>("none");

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

  const selectedClip = useMemo(() => {
    for (const t of tracks) {
      const c = t.clips.find((c) => c.id === selectedClipId);
      if (c) return c;
    }
    return null;
  }, [tracks, selectedClipId]);

  const rawTotal = useMemo(() => {
    let max = 0;
    for (const t of tracks) for (const c of t.clips) max = Math.max(max, c.start + c.duration);
    return max;
  }, [tracks]);
  const scale = matchDuration && narrationDuration > 0 && rawTotal > 0 ? narrationDuration / rawTotal : 1;
  const totalDuration = matchDuration && narrationDuration > 0 ? narrationDuration : rawTotal;

  // -------------------- media library --------------------

  const addFiles = (files: FileList) => {
    Array.from(files).forEach((f) => {
      const url = URL.createObjectURL(f);
      if (f.type.startsWith("video/")) {
        const v = document.createElement("video");
        v.src = url;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = "auto";
        v.addEventListener("loadedmetadata", () => {
          setMedia((prev) => [...prev, { id: uid(), kind: "video", url, name: f.name, el: v, w: v.videoWidth, h: v.videoHeight, duration: v.duration || 0 }]);
        });
      } else if (f.type.startsWith("audio/")) {
        const a = new Audio(url);
        a.addEventListener("loadedmetadata", () => {
          setMedia((prev) => [...prev, { id: uid(), kind: "audio", url, name: f.name, el: a, w: 0, h: 0, duration: a.duration || 0 }]);
        });
      } else {
        const img = new Image();
        img.onload = () => {
          setMedia((prev) => [...prev, { id: uid(), kind: "image", url, name: f.name, el: img, w: img.naturalWidth, h: img.naturalHeight, duration: 0 }]);
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
    setTracks((prev) => prev.map((t) => ({ ...t, clips: t.clips.map((c) => (c.mediaId === id ? { ...c, mediaId: null } : c)) })));
  };

  // -------------------- tracks & clips --------------------

  const addTrack = (kind: "visual" | "audio") => {
    setTracks((prev) => [...prev, newTrack(kind === "visual" ? `Visual ${prev.length + 1}` : `Audio ${prev.length + 1}`, kind)]);
  };
  const deleteTrack = (id: string) => setTracks((prev) => prev.filter((t) => t.id !== id));
  const updateTrack = (id: string, patch: Partial<Track>) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const reorderTrack = (id: string, dir: -1 | 1) => {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const findClipEnd = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track || track.clips.length === 0) return 0;
    return Math.max(...track.clips.map((c) => c.start + c.duration));
  };

  const addClip = (trackId: string, mediaId: string | null = null) => {
    const track = tracks.find((t) => t.id === trackId);
    const kind = track?.kind === "audio" ? "audio" : mediaId ? (media.find((m) => m.id === mediaId)?.kind === "video" ? "video" : "image") : "text";
    const c = newClip(kind as Clip["kind"], trackId, findClipEnd(trackId), mediaId);
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, c] } : t)));
    setSelectedClipId(c.id);
  };

  const isTrackCompatible = (clipKind: Clip["kind"], trackKind: Track["kind"]) =>
    clipKind === "audio" ? trackKind === "audio" : trackKind === "visual";

  const updateClip = useCallback((id: string, patch: Partial<Clip>) => {
    setTracks((prev) => {
      if (patch.trackId) {
        let clip: Clip | null = null;
        let srcTrack: Track | null = null;
        for (const t of prev) {
          const c = t.clips.find((c) => c.id === id);
          if (c) {
            clip = c;
            srcTrack = t;
            break;
          }
        }
        if (!clip || !srcTrack) return prev;
        const destTrack = prev.find((t) => t.id === patch.trackId);
        if (!destTrack || (destTrack.locked && destTrack.id !== srcTrack.id)) return prev;
        if (!isTrackCompatible(clip.kind, destTrack.kind)) return prev;
        if (destTrack.id === srcTrack.id) {
          return prev.map((t) => (t.id === srcTrack!.id ? { ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : t));
        }
        const updatedClip: Clip = { ...clip, ...patch };
        return prev.map((t) => {
          if (t.id === srcTrack!.id) return { ...t, clips: t.clips.filter((c) => c.id !== id) };
          if (t.id === destTrack.id) return { ...t, clips: [...t.clips, updatedClip] };
          return t;
        });
      }
      return prev.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    });
  }, []);

  const duplicateClip = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        const c = t.clips.find((c) => c.id === id);
        if (!c) return t;
        const copy: Clip = { ...c, id: uid(), start: c.start + c.duration };
        return { ...t, clips: [...t.clips, copy] };
      }),
    );
  };

  const deleteClip = (id: string) => {
    setTracks((prev) => prev.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== id) })));
    if (selectedClipId === id) setSelectedClipId(null);
  };

  // -------------------- audio (narration / music) --------------------

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

  // -------------------- composite render --------------------

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, t: number) => {
      ctx.save();
      ctx.filter = "none";
      drawBackground(ctx, W, H, background, t);

      for (const track of tracks) {
        if (track.hidden) continue;
        for (const clip of track.clips) {
          const start = clip.start * scale;
          const dur = clip.duration * scale;
          if (t < start || t >= start + dur) continue;
          const localT = t - start;
          const p = dur > 0 ? localT / dur : 0;

          const anim = getAnimation(clip.animation).apply(p);
          const tf = clip.transform;

          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, tf.opacity * anim.opacity));
          ctx.filter = effectsFilterString(clip.effects) + (anim.extraFilter ? ` ${anim.extraFilter}` : "");

          const cx = (tf.x / 100) * W;
          const cy = (tf.y / 100) * H;
          ctx.translate(cx + anim.dx, cy + anim.dy);
          ctx.rotate(((tf.rotation + anim.rotation) * Math.PI) / 180);
          if (anim.skewX) ctx.transform(1, 0, anim.skewX, 1, 0, 0);
          ctx.scale(tf.scale * anim.scale, tf.scale * anim.scale);
          ctx.translate(-W / 2, -H / 2);

          if (anim.clip) {
            ctx.beginPath();
            ctx.rect(anim.clip.x * W, anim.clip.y * H, anim.clip.w * W, anim.clip.h * H);
            ctx.clip();
          }

          if (clip.kind === "text") {
            ctx.translate(W / 2, H / 2);
            drawClipText(ctx, W, H, clip);
          } else if (clip.kind === "graphic") {
            ctx.translate(W / 2, H / 2);
            drawGraphic(ctx, W, H, clip);
          } else {
            const m = clip.mediaId ? media.find((mm) => mm.id === clip.mediaId) : null;
            if (m && m.kind !== "audio") {
              const el = m.el as HTMLImageElement | HTMLVideoElement;
              const mw = m.kind === "video" ? (el as HTMLVideoElement).videoWidth || m.w : m.w;
              const mh = m.kind === "video" ? (el as HTMLVideoElement).videoHeight || m.h : m.h;
              try {
                drawCover(ctx, el, mw, mh, W, H, tf.fit);
              } catch {
                /* mid-decode */
              }
            }
          }
          ctx.restore();

          if (anim.flash) {
            ctx.save();
            ctx.globalAlpha = anim.flash;
            ctx.fillStyle = "#fff6e0";
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
          }

          ctx.save();
          ctx.filter = "none";
          applyClipEffects(ctx, canvas, W, H, t, clip.effects);
          ctx.restore();

          const transInDur = Math.min(dur * 0.5, clip.transitionIn.duration);
          if (transInDur > 0 && localT < transInDur) {
            drawTransitionOverlay(ctx, W, H, clip.transitionIn.kind, localT / transInDur, "in", clip.transitionIn.easing, clip.transitionIn.color);
          }
          const transOutDur = Math.min(dur * 0.5, clip.transitionOut.duration);
          if (transOutDur > 0 && localT > dur - transOutDur) {
            drawTransitionOverlay(ctx, W, H, clip.transitionOut.kind, (dur - localT) / transOutDur, "out", clip.transitionOut.easing, clip.transitionOut.color);
          }
        }
      }

      if (tracks.every((t) => t.clips.length === 0)) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = `600 32px ${FONT_SANS}`;
        ctx.textAlign = "center";
        ctx.fillText("Add clips to a track to preview", W / 2, H / 2);
      }
      ctx.restore();
    },
    [tracks, media, background, scale],
  );

  const drawAt = useCallback(
    (canvas: HTMLCanvasElement, t: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        paint(ctx, canvas, t);
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

  const allVideos = useMemo(() => media.filter((m) => m.kind === "video").map((m) => m.el as HTMLVideoElement), [media]);

  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frames = 0;
    const started = performance.now() / 1000 - timeRef.current;
    const nar = narrationAudioRef.current;
    const mus = musicAudioRef.current;
    if (nar) {
      nar.currentTime = timeRef.current;
      nar.play().catch(() => {});
    }
    if (mus) {
      mus.currentTime = 0;
      mus.play().catch(() => {});
    }
    allVideos.forEach((v) => v.play().catch(() => {}));
    const tick = () => {
      const t = performance.now() / 1000 - started;
      timeRef.current = t;
      if (frames++ % 4 === 0) setCurrentTime(t);
      drawAt(canvas, t);
      if (totalDuration > 0 && t >= totalDuration - 0.02) {
        nar?.pause();
        mus?.pause();
        allVideos.forEach((v) => v.pause());
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
      allVideos.forEach((v) => v.pause());
    };
  }, [playing, drawAt, totalDuration, allVideos]);

  const togglePlay = () => {
    const hasClips = tracks.some((t) => t.clips.length > 0);
    if (!hasClips) {
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
    const hasClips = tracks.some((t) => t.clips.length > 0);
    if (!hasClips) {
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
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 192_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const doneP = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] || "video/webm" }));
      });

      allVideos.forEach((v) => {
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
        paint(octx, off, t);
        if (t >= totalDuration) {
          running = false;
          sources.forEach((s) => {
            try {
              s.stop();
            } catch {
              /* noop */
            }
          });
          allVideos.forEach((v) => v.pause());
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
    <div className="grid gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[340px_minmax(0,1fr)_360px] lg:overflow-hidden">
      {/* Left: media library */}
      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Media library</CardTitle>
            <CardDescription>Import images, video and audio for the timeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50">
              <Upload className="mr-2 h-4 w-4" /> Import media
              <input type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </label>
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m) => (
                  <div key={m.id} className="group relative overflow-hidden rounded-md border">
                    {m.kind === "image" ? (
                      <img src={m.url} alt={m.name} className="h-16 w-full object-cover" />
                    ) : (
                      <div className="flex h-16 w-full items-center justify-center bg-muted text-muted-foreground">
                        <Film className="h-5 w-5" />
                      </div>
                    )}
                    <button
                      onClick={() => {
                        const wantKind = m.kind === "audio" ? "audio" : "visual";
                        const preferred = selectedTrackId ? tracks.find((t) => t.id === selectedTrackId && t.kind === wantKind && !t.locked) : null;
                        const target = preferred ?? tracks.find((t) => t.kind === wantKind && !t.locked) ?? tracks[0];
                        if (target) addClip(target.id, m.id);
                      }}
                      className="absolute inset-x-0 bottom-0 flex h-6 items-center justify-center bg-black/60 text-[10px] text-white opacity-0 group-hover:opacity-100"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add clip
                    </button>
                    <button onClick={() => removeMedia(m.id)} className="absolute right-1 top-1 hidden rounded bg-black/60 p-0.5 text-white group-hover:block">
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
            <CardTitle className="text-base">Background</CardTitle>
            <CardDescription>Procedural backdrop rendered behind every track.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={background} onValueChange={(v) => setBackground(v as BackgroundKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BACKGROUNDS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Middle: preview + timeline */}
      <div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
        <Card>
          <CardContent className="p-4">
            <div className="mx-auto overflow-hidden rounded-lg bg-black" style={{ maxWidth: 900 }}>
              <canvas ref={canvasRef} className="mx-auto block max-h-[46vh] w-full object-contain" style={{ aspectRatio: `${W} / ${H}` }} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button size="icon" variant="secondary" onClick={togglePlay}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span className="w-24 text-xs text-muted-foreground">
                {fmtTime(currentTime)} / {fmtTime(totalDuration)}
              </span>
              <Slider className="flex-1" min={0} max={Math.max(0.1, totalDuration)} step={0.05} value={[Math.min(currentTime, totalDuration)]} onValueChange={(v) => seek(v[0])} />
            </div>
            <Button onClick={exportVideo} disabled={exporting || !tracks.some((t) => t.clips.length)} className="mt-3 w-full">
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

        <Timeline
          tracks={tracks}
          media={media}
          selectedClipId={selectedClipId}
          selectedTrackId={selectedTrackId}
          currentTime={currentTime}
          totalDuration={totalDuration}
          onSeek={seek}
          onSelectClip={setSelectedClipId}
          onSelectTrack={setSelectedTrackId}
          onUpdateClip={updateClip}
          onDuplicateClip={duplicateClip}
          onDeleteClip={deleteClip}
          onAddClip={(trackId) => addClip(trackId)}
          onAddTrack={addTrack}
          onDeleteTrack={deleteTrack}
          onUpdateTrack={updateTrack}
          onReorderTrack={reorderTrack}
        />

        {selectedClip && <ClipInspector clip={selectedClip} media={media} tracks={tracks} onUpdate={(patch) => updateClip(selectedClip.id, patch)} />}
      </div>

      {/* Right: audio + tips */}
      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
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
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && onNarrationFile(e.target.files[0])} />
              </label>
            )}
            {narrationDuration > 0 && <p className="text-xs text-muted-foreground">{fmtTime(narrationDuration)} duration</p>}
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs">Or generate a voiceover</Label>
              <Textarea rows={3} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Paste the narration script here…" className="text-sm" />
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
                <p className="text-xs text-muted-foreground">Scales the whole timeline to fit the narration length.</p>
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
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && onMusicFile(e.target.files[0])} />
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
            <p>Drag clips to move, drag the edges to trim. Z-order follows track order top-to-bottom.</p>
            <p>Select a clip to edit position, animation, transitions and effects.</p>
            <p>Export renders at 1920×1080, 60fps, compositing every visible track plus voiceover and music.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
