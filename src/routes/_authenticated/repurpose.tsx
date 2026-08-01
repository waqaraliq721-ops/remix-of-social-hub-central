import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Scissors,
  Youtube,
  Upload,
  Sparkles,
  Loader2,
  Download,
  Play,
  Pause,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
  type TimedLine,
} from "@/lib/transcribe";
import { FX_FONT, hexA, roundRect, wrapText, fitText, ease, INTRO_ANIMATIONS, OUTRO_ANIMATIONS } from "@/lib/video-fx";
import { IntroOutroCard, defaultIntro, defaultOutro, paletteOf, type CardConfig } from "@/components/intro-outro-card";

export const Route = createFileRoute("/_authenticated/repurpose")({
  head: () => ({
    meta: [
      { title: "Repurpose Long-Form — Orbit" },
      {
        name: "description",
        content:
          "Turn a YouTube link or uploaded video into complete short clips with AI analysis, auto captions, effects and transitions. Export 1080p vertical shorts.",
      },
      { property: "og:title", content: "Repurpose Long-Form — Orbit" },
      {
        property: "og:description",
        content: "AI finds self-contained clips in your long-form video and exports ready-to-post shorts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RepurposePage,
});

type Clip = {
  title: string;
  hook: string;
  start: number;
  end: number;
  summary: string;
  score: number;
  keywords: string[];
};

type AspectKey = "9:16" | "1:1" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1920, h: 1080 },
};

type CaptionStyle = "bold" | "karaoke" | "boxed" | "minimal" | "neon";
const CAPTION_STYLES: { id: CaptionStyle; name: string }[] = [
  { id: "bold", name: "Bold pop" },
  { id: "karaoke", name: "Karaoke highlight" },
  { id: "boxed", name: "Boxed band" },
  { id: "minimal", name: "Minimal" },
  { id: "neon", name: "Neon glow" },
];

const ACCENTS = ["#facc15", "#22d3ee", "#a855f7", "#f43f5e", "#34d399", "#ffffff"];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function RepurposePage() {
  const [tab, setTab] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [lines, setLines] = useState<TimedLine[]>([]);
  const [sttProvider, setSttProvider] = useState<SttProvider>("auto");
  const [notes, setNotes] = useState("");
  const [minLen, setMinLen] = useState(25);
  const [maxLen, setMaxLen] = useState(75);

  const [working, setWorking] = useState<"idle" | "transcribing" | "analyzing">("idle");
  const [clips, setClips] = useState<Clip[]>([]);
  const [selected, setSelected] = useState(0);

  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [captions, setCaptions] = useState(true);
  const [capStyle, setCapStyle] = useState<CaptionStyle>("bold");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [capSize, setCapSize] = useState(0.042);
  const [capY, setCapY] = useState(0.76);
  const [zoomEffect, setZoomEffect] = useState(true);
  const [shake, setShake] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [progressBar, setProgressBar] = useState(true);
  const [fadeEdges, setFadeEdges] = useState(true);

  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, id: "none" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, id: "none" });

  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const dims = ASPECTS[aspect];
  const clip = clips[selected];

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setFileUrl(u);
    const v = document.createElement("video");
    v.src = u;
    v.muted = false;
    v.playsInline = true;
    v.preload = "auto";
    videoRef.current = v;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const timedTranscript = useMemo(
    () => lines.map((l) => `[${l.time.toFixed(1)}] ${l.text}`).join("\n"),
    [lines],
  );

  const runTranscribe = async () => {
    if (!file) return toast.error("Upload a video or audio file first");
    setWorking("transcribing");
    try {
      const { words, text, provider } = await transcribeFile(file, { provider: sttProvider });
      const ls = wordsToLines(words.length ? words : [], { maxWords: 8 });
      setLines(ls);
      setTranscript(ls.length ? ls.map((l) => `[${l.time.toFixed(1)}] ${l.text}`).join("\n") : text);
      toast.success(`Transcribed with ${provider}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setWorking("idle");
    }
  };

  const analyze = async () => {
    setWorking("analyzing");
    try {
      const body =
        tab === "link"
          ? { youtubeUrl: url.trim(), minLen, maxLen, notes }
          : { transcript: timedTranscript || transcript, minLen, maxLen, notes };
      if (tab === "link" && !url.trim()) throw new Error("Paste a YouTube link");
      if (tab === "upload" && !(timedTranscript || transcript)) throw new Error("Transcribe the video first");
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { clips?: Clip[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      if (!data.clips?.length) throw new Error("No complete clips found — try a longer source");
      setClips(data.clips);
      setSelected(0);
      toast.success(`${data.clips.length} clips found`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setWorking("idle");
    }
  };

  // ---------------- render ----------------

  const linesIn = useCallback(
    (t: number) => lines.find((l) => t >= l.time && t <= l.end + 0.15),
    [lines],
  );

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, absTime: number) => {
      const { w, h } = dims;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const v = videoRef.current;
      const c = clip;
      if (!c) return;
      const local = absTime - c.start;
      const dur = Math.max(0.1, c.end - c.start);

      if (v && v.videoWidth) {
        const zoom = zoomEffect ? 1.04 + (local / dur) * 0.08 : 1.02;
        const jitter = shake ? Math.sin(local * 22) * w * 0.002 : 0;
        const ratio = Math.max(w / v.videoWidth, h / v.videoHeight) * zoom;
        const dw = v.videoWidth * ratio;
        const dh = v.videoHeight * ratio;
        ctx.drawImage(v, (w - dw) / 2 + jitter, (h - dh) / 2, dw, dh);
      } else {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, "#12121a");
        g.addColorStop(1, "#241a2e");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.textAlign = "center";
        ctx.font = `600 ${Math.round(h * 0.022)}px ${FX_FONT}`;
        ctx.fillText("Upload the source video to preview & export this clip", w / 2, h * 0.5);
      }

      if (fadeEdges) {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "rgba(0,0,0,0.55)");
        g.addColorStop(0.25, "rgba(0,0,0,0)");
        g.addColorStop(0.7, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.7)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      if (showTitle) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const size = fitText(ctx, c.hook || c.title, w * 0.86, h * 0.036, 900);
        const rows = wrapText(ctx, (c.hook || c.title).toUpperCase(), w * 0.86);
        let y = h * 0.09;
        for (const row of rows.slice(0, 2)) {
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillText(row, w / 2 + 2, y + 2);
          ctx.fillStyle = "#fff";
          ctx.fillText(row, w / 2, y);
          y += size * 1.18;
        }
        ctx.restore();
      }

      if (captions) {
        const line = linesIn(absTime);
        if (line) {
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const size = Math.round(h * capSize);
          ctx.font = `900 ${size}px ${FX_FONT}`;
          const rows = wrapText(ctx, line.text.toUpperCase(), w * 0.82);
          let y = h * capY - ((rows.length - 1) * size * 1.16) / 2;
          if (capStyle === "boxed") {
            const bw = w * 0.86;
            const bh = rows.length * size * 1.16 + size * 0.7;
            ctx.fillStyle = "rgba(0,0,0,0.62)";
            roundRect(ctx, w / 2 - bw / 2, y - size * 0.8, bw, bh, size * 0.28);
            ctx.fill();
          }
          for (const row of rows) {
            if (capStyle === "karaoke") {
              const words = row.split(" ");
              const widths = words.map((x) => ctx.measureText(x + " ").width);
              let x = w / 2 - widths.reduce((a, b) => a + b, 0) / 2;
              ctx.textAlign = "left";
              words.forEach((word, i) => {
                const wordObj = line.words.find((z) => z.text.toUpperCase() === word);
                const spoken = wordObj ? absTime >= wordObj.start : false;
                ctx.lineWidth = size * 0.14;
                ctx.strokeStyle = "#000";
                ctx.lineJoin = "round";
                ctx.strokeText(word, x, y);
                ctx.fillStyle = spoken ? accent : "#fff";
                ctx.fillText(word, x, y);
                x += widths[i];
              });
              ctx.textAlign = "center";
            } else {
              if (capStyle === "neon") {
                ctx.shadowColor = accent;
                ctx.shadowBlur = size * 0.6;
              } else if (capStyle !== "minimal") {
                ctx.lineWidth = size * 0.16;
                ctx.strokeStyle = "#000";
                ctx.lineJoin = "round";
                ctx.strokeText(row, w / 2, y);
              }
              ctx.fillStyle = capStyle === "bold" ? accent : "#fff";
              ctx.fillText(row, w / 2, y);
              ctx.shadowBlur = 0;
            }
            y += size * 1.16;
          }
          ctx.restore();
        }
      }

      if (progressBar) {
        const p = Math.max(0, Math.min(1, local / dur));
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(0, h - Math.max(4, h * 0.006), w, Math.max(4, h * 0.006));
        ctx.fillStyle = accent;
        ctx.fillRect(0, h - Math.max(4, h * 0.006), w * p, Math.max(4, h * 0.006));
      }

      // intro / outro overlays inside the clip window
      if (intro.id !== "none" && local < intro.seconds) {
        ctx.save();
        ctx.globalAlpha = 1 - ease.in(local / intro.seconds) * 0.15;
        INTRO_ANIMATIONS.find((a) => a.id === intro.id)?.draw({
          ctx,
          w,
          h,
          p: local / intro.seconds,
          palette: paletteOf(intro.paletteId),
          title: intro.title,
          subtitle: intro.subtitle,
          logo: null,
        });
        ctx.restore();
      }
      if (outro.id !== "none" && local > dur - outro.seconds) {
        OUTRO_ANIMATIONS.find((a) => a.id === outro.id)?.draw({
          ctx,
          w,
          h,
          p: (local - (dur - outro.seconds)) / outro.seconds,
          palette: paletteOf(outro.paletteId),
          title: outro.title,
          subtitle: outro.subtitle,
          logo: null,
        });
      }
    },
    [
      accent, aspect, capSize, capStyle, capY, captions, clip, dims, fadeEdges, intro,
      linesIn, outro, progressBar, shake, showTitle, zoomEffect,
    ],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const loop = () => {
      const v = videoRef.current;
      drawFrame(ctx, v ? v.currentTime : (clip?.start ?? 0));
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawFrame, clip]);

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v || !clip) return toast.error("Upload the source video to preview");
    if (playing) {
      v.pause();
      setPlaying(false);
      return;
    }
    v.currentTime = clip.start;
    await v.play();
    setPlaying(true);
    const stop = () => {
      if (v.currentTime >= clip.end) {
        v.pause();
        setPlaying(false);
      } else if (!v.paused) requestAnimationFrame(stop);
    };
    stop();
  };

  const exportClip = async () => {
    const v = videoRef.current;
    if (!v || !clip) return toast.error("Upload the source video to export");
    const canvas = document.createElement("canvas");
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const stream = canvas.captureStream(60);
      const audioCtx = new AudioContext();
      const src = audioCtx.createMediaElementSource(v);
      const dest = audioCtx.createMediaStreamDestination();
      src.connect(dest);
      src.connect(audioCtx.destination);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

      const mime = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
        ? "video/mp4;codecs=avc1"
        : "video/webm;codecs=vp9";
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<void>((res) => (rec.onstop = () => res()));

      v.currentTime = clip.start;
      await new Promise((r) => setTimeout(r, 250));
      await v.play();
      rec.start();
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (v.currentTime >= clip.end || v.ended) return resolve();
          drawFrame(ctx, v.currentTime);
          setExportProgress(
            Math.min(99, ((v.currentTime - clip.start) / (clip.end - clip.start)) * 100),
          );
          requestAnimationFrame(tick);
        };
        tick();
      });
      v.pause();
      rec.stop();
      await done;
      await audioCtx.close();

      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${clip.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setExportProgress(100);
      toast.success("Clip exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:flex lg:h-full lg:flex-col lg:space-y-0 lg:overflow-hidden">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Scissors className="h-6 w-6" /> Repurpose long-form
        </h1>
        <p className="text-sm text-muted-foreground">
          Paste a YouTube link or upload a video — AI reads the whole thing and cuts out
          self-contained clips, then you style and export them.
        </p>
      </div>

      <div className="grid gap-6 lg:mt-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[380px_minmax(0,1fr)] lg:overflow-hidden">
        <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={tab} onValueChange={(v) => setTab(v as "link" | "upload")}>
                <TabsList className="w-full">
                  <TabsTrigger value="link" className="flex-1">
                    <Youtube className="mr-1 h-4 w-4" /> YouTube
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">
                    <Upload className="mr-1 h-4 w-4" /> Upload
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {tab === "link" ? (
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              ) : (
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    {file ? file.name : "Choose a video or audio file"}
                    <input
                      type="file"
                      accept="video/*,audio/*"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <Label className="text-xs text-muted-foreground">Transcription model</Label>
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
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={runTranscribe}
                    disabled={working !== "idle"}
                  >
                    {working === "transcribing" ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-4 w-4" />
                    )}
                    Transcribe
                  </Button>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">
                  Clip length · {minLen}s – {maxLen}s
                </Label>
                <Slider
                  value={[minLen, maxLen]}
                  min={10}
                  max={180}
                  step={5}
                  onValueChange={([a, b]) => {
                    setMinLen(a);
                    setMaxLen(b);
                  }}
                />
              </div>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes for the editor AI (audience, tone, what to prioritise)…"
              />
              <Button className="w-full" onClick={analyze} disabled={working !== "idle"}>
                {working === "analyzing" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                Find clips
              </Button>
              {tab === "upload" && transcript && (
                <Textarea
                  rows={5}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="font-mono text-xs"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Styling</CardTitle>
              <CardDescription>Applies to the exported clip.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={aspect} onValueChange={(v) => setAspect(v as AspectKey)}>
                <TabsList className="w-full">
                  {(Object.keys(ASPECTS) as AspectKey[]).map((k) => (
                    <TabsTrigger key={k} value={k} className="flex-1">
                      {k}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex items-center justify-between gap-2">
                  Captions <Switch checked={captions} onCheckedChange={setCaptions} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Hook title <Switch checked={showTitle} onCheckedChange={setShowTitle} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Slow zoom <Switch checked={zoomEffect} onCheckedChange={setZoomEffect} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Shake <Switch checked={shake} onCheckedChange={setShake} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Progress <Switch checked={progressBar} onCheckedChange={setProgressBar} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Edge fade <Switch checked={fadeEdges} onCheckedChange={setFadeEdges} />
                </label>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Caption style</Label>
                <Select value={capStyle} onValueChange={(v) => setCapStyle(v as CaptionStyle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPTION_STYLES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Accent ${c}`}
                    onClick={() => setAccent(c)}
                    className={`h-7 w-7 rounded-full border-2 ${accent === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Caption size · {(capSize * 100).toFixed(1)}%
                </Label>
                <Slider value={[capSize]} min={0.025} max={0.07} step={0.002} onValueChange={([v]) => setCapSize(v)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Caption position · {(capY * 100).toFixed(0)}%
                </Label>
                <Slider value={[capY]} min={0.3} max={0.92} step={0.01} onValueChange={([v]) => setCapY(v)} />
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
        </div>

        <div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-4">
              <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                className="max-h-[60vh] w-auto rounded-xl border bg-black"
                style={{ aspectRatio: `${dims.w}/${dims.h}` }}
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={togglePlay} disabled={!clip}>
                  {playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                  Preview clip
                </Button>
                <Button onClick={exportClip} disabled={!clip || exporting}>
                  {exporting ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-4 w-4" />
                  )}
                  Export clip
                </Button>
              </div>
              {exporting && <Progress value={exportProgress} className="w-full" />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clips ({clips.length})</CardTitle>
              <CardDescription>
                Ranked by predicted performance. Each one is a complete, standalone idea.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!clips.length && (
                <p className="text-sm text-muted-foreground">
                  No clips yet — add a source and hit “Find clips”.
                </p>
              )}
              {clips.map((c, i) => (
                <button
                  key={`${c.start}-${i}`}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    i === selected ? "border-primary bg-muted/50" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-sm text-muted-foreground">{c.hook}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      <Flame className="mr-1 h-3 w-3" />
                      {c.score}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{c.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {fmt(c.start)} → {fmt(c.end)} · {Math.round(c.end - c.start)}s
                    </span>
                    {c.keywords.map((k) => (
                      <Badge key={k} variant="outline" className="text-[10px]">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
