// HQ Videos studio — cut-out subject motivational edits driven by a real
// voiceover transcript.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Play,
  Pause,
  Download,
  Loader2,
  Wand2,
  Scissors,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
  STT_PROVIDERS,
  type SttProvider,
  type TranscriptWord,
} from "@/lib/transcribe";
import {
  HQ_ASPECTS,
  HQ_BACKDROPS,
  HQ_CAMERA_MOTIONS,
  HQ_CAPTION_ANIMS,
  HQ_PARTICLES,
  HQ_TEMPLATES,
  SUBJECT_ANIMS,
  configForTemplate,
  groupHqLines,
  hqWordKey,
  markImportant,
  renderHqFrame,
  textToHqLines,
  type HqAnimId,
  type HqAspect,
  type HqCameraMotionId,
  type HqConfig,
  type HqLine,
  type HqWordStyle,
  type ParticleId,
  type SubjectAnimId,
} from "@/lib/motiv-hq";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function NumSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label} · {fmt ? fmt(value) : value.toFixed(2)}
      </Label>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

export default function MotivHqStudio() {
  const [aspect, setAspect] = useState<HqAspect>("9:16");
  const dims = HQ_ASPECTS[aspect];

  const [templateId, setTemplateId] = useState(HQ_TEMPLATES[0].id);
  const template = useMemo(
    () => HQ_TEMPLATES.find((t) => t.id === templateId) ?? HQ_TEMPLATES[0],
    [templateId],
  );
  const has = useCallback(
    (key: string) => template.controls.includes(key as (typeof template.controls)[number]),
    [template],
  );
  const [cfg, setCfg] = useState<HqConfig>(() => configForTemplate(HQ_TEMPLATES[0]));
  const set = useCallback(
    <K extends keyof HqConfig>(k: K, v: HqConfig[K]) => setCfg((c) => ({ ...c, [k]: v })),
    [],
  );

  const [selectedWord, setSelectedWord] = useState<{ lineIndex: number; wordIndex: number } | null>(null);
  const setWordStyle = useCallback((key: string, patch: Partial<HqWordStyle>) => {
    setCfg((c) => ({
      ...c,
      wordStyles: { ...c.wordStyles, [key]: { ...c.wordStyles[key], ...patch } },
    }));
  }, []);
  const clearWordStyle = useCallback((key: string) => {
    setCfg((c) => {
      const next = { ...c.wordStyles };
      delete next[key];
      return { ...c, wordStyles: next };
    });
  }, []);

  // Swapping template resets the look but keeps the writing/transcript.
  useEffect(() => {
    setCfg((prev) =>
      configForTemplate(template, {
        heading: prev.heading,
        subheading: prev.subheading,
        author: prev.author,
        wordsPerLine: prev.wordsPerLine,
        keywords: prev.keywords,
      }),
    );
  }, [template]);

  /* ------------------------------------------------------------- assets */
  const [subjectUrl, setSubjectUrl] = useState("");
  const [cutoutUrl, setCutoutUrl] = useState("");
  const [cutting, setCutting] = useState(false);
  const originalImg = useRef<HTMLImageElement | null>(null);
  const cutoutImg = useRef<HTMLImageElement | null>(null);
  const [assetsTick, setAssetsTick] = useState(0);

  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const [bgVideoUrl, setBgVideoUrl] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);

  const [provider, setProvider] = useState<SttProvider>("auto");
  const [transcribing, setTranscribing] = useState(false);
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [transcript, setTranscript] = useState("");

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadImage = (url: string, into: React.RefObject<HTMLImageElement | null>) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      into.current = img;
      setAssetsTick((n) => n + 1);
    };
    img.src = url;
  };

  const onSubject = (file: File) => {
    const url = URL.createObjectURL(file);
    setSubjectUrl(url);
    setCutoutUrl("");
    cutoutImg.current = null;
    loadImage(url, originalImg);
  };

  const runCutout = async () => {
    if (!subjectUrl) {
      toast("Upload a subject photo first");
      return;
    }
    setCutting(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(subjectUrl);
      const url = URL.createObjectURL(blob);
      setCutoutUrl(url);
      loadImage(url, cutoutImg);
      set("removeBg", true);
      toast.success("Subject cut out");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Background removal failed");
    } finally {
      setCutting(false);
    }
  };

  const onVoice = (file: File) => {
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaFile(file);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    a.src = url;
  };

  const onBgVideo = (file: File) => {
    const url = URL.createObjectURL(file);
    setBgVideoUrl(url);
    const v = document.createElement("video");
    v.src = url;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.play().catch(() => {});
    bgVideoRef.current = v;
    setAssetsTick((n) => n + 1);
  };

  const runTranscribe = async () => {
    if (!mediaFile) {
      toast("Upload the voiceover (mp3) or the talking video first");
      return;
    }
    setTranscribing(true);
    try {
      const res = await transcribeFile(mediaFile, { provider });
      setWords(res.words);
      setTranscript(res.text || res.words.map((w) => w.text).join(" "));
      toast.success(`Transcribed with ${res.provider}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const lines: HqLine[] = useMemo(() => {
    if (words.length) {
      const marked = markImportant(words, {
        minLength: cfg.importantMinLength,
        keywords: cfg.keywords,
        auto: cfg.autoImportant,
      });
      return groupHqLines(marked, cfg.wordsPerLine);
    }
    if (transcript.trim()) return textToHqLines(transcript, duration || 12, cfg.wordsPerLine);
    return [];
  }, [words, transcript, duration, cfg.wordsPerLine, cfg.autoImportant, cfg.importantMinLength, cfg.keywords]);

  const total = duration || (lines.length ? lines[lines.length - 1].end + 0.6 : 8);

  const lineIndexAt = useCallback(
    (t: number) => {
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const next = lines[i + 1];
        if (t >= l.start && (t < (next ? next.start : l.end + 1.2))) return i;
      }
      if (lines.length && t < lines[0].start) return -1;
      return lines.length ? lines.length - 1 : -1;
    },
    [lines],
  );

  /* -------------------------------------------------------------- render */
  const paint = useCallback(
    (t: number) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const li = lineIndexAt(t);
      renderHqFrame({
        ctx,
        w: dims.w,
        h: dims.h,
        t,
        cfg,
        template,
        subject: cfg.removeBg ? cutoutImg.current : null,
        original: originalImg.current,
        bgVideo: bgVideoRef.current,
        line: li >= 0 ? lines[li] : null,
        lineIndex: li >= 0 ? li : undefined,
      });
    },
    [cfg, dims.h, dims.w, template, lineIndexAt, lines],
  );

  useEffect(() => {
    paint(time);
  }, [paint, time, assetsTick]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = performance.now() - time * 1000;
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= total) {
        setPlaying(false);
        setTime(0);
        audioRef.current?.pause();
        return;
      }
      setTime(t);
      paint(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, total, paint]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (playing) {
      a?.pause();
      setPlaying(false);
      return;
    }
    if (a && mediaUrl) {
      a.currentTime = time;
      a.play().catch(() => {});
    }
    setPlaying(true);
  };

  /* -------------------------------------------------------------- export */
  const exportVideo = async () => {
    if (!lines.length) {
      toast("Transcribe the voiceover or type the text first");
      return;
    }
    setExporting(true);
    setExportProgress(0);
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
      let src: AudioBufferSourceNode | null = null;
      if (mediaUrl) {
        try {
          const ab = await (await fetch(mediaUrl)).arrayBuffer();
          const buf = await ac.decodeAudioData(ab.slice(0));
          src = ac.createBufferSource();
          src.buffer = buf;
          src.connect(dest);
        } catch {
          console.warn("Voiceover could not be decoded for export");
        }
      }
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
        videoBitsPerSecond: 12_000_000,
        audioBitsPerSecond: 192_000,
      });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] || "video/webm" }));
      });

      let running = true;
      const t0 = performance.now();
      src?.start();
      rec.start(100);
      const loop = () => {
        if (!running) return;
        const t = (performance.now() - t0) / 1000;
        if (t >= total) {
          running = false;
          rec.stop();
          src?.stop();
          return;
        }
        const li = lineIndexAt(t);
        renderHqFrame({
          ctx: octx,
          w: dims.w,
          h: dims.h,
          t,
          cfg,
          template,
          subject: cfg.removeBg ? cutoutImg.current : null,
          original: originalImg.current,
          bgVideo: bgVideoRef.current,
          line: li >= 0 ? lines[li] : null,
          lineIndex: li >= 0 ? li : undefined,
        });
        setExportProgress(Math.min(100, (t / total) * 100));
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      const blob = await done;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `motivational-hq-${template.id}.${mime.startsWith("video/mp4") ? "mp4" : "webm"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  /* ----------------------------------------------------------------- UI */
  return (
    <div className="grid min-h-0 gap-4 lg:h-full lg:grid-cols-[330px_minmax(0,1fr)_340px]">
      {/* Left: sources */}
      <div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template</CardTitle>
            <CardDescription>{template.desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HQ_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subject image</CardTitle>
            <CardDescription>Cut the subject out or keep the original plate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && onSubject(e.target.files[0])}
            />
            {subjectUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={cutoutUrl || subjectUrl}
                  alt="Subject preview"
                  className="h-20 w-20 rounded-lg border object-cover"
                />
                <Button size="sm" variant="secondary" onClick={runCutout} disabled={cutting}>
                  {cutting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Cutting…
                    </>
                  ) : (
                    <>
                      <Scissors className="mr-1 h-4 w-4" /> Remove background
                    </>
                  )}
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Use the cut-out</Label>
              <Switch
                checked={cfg.removeBg}
                onCheckedChange={(v) => set("removeBg", v)}
                disabled={!cutoutUrl}
              />
            </div>
            <Row label="Background video (optional)">
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => e.target.files?.[0] && onBgVideo(e.target.files[0])}
              />
            </Row>
            {bgVideoUrl && <p className="text-xs text-muted-foreground">Background video loaded.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voiceover &amp; captions</CardTitle>
            <CardDescription>Upload an mp3 or a video — the text comes from it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => e.target.files?.[0] && onVoice(e.target.files[0])}
            />
            <Row label="Transcription engine">
              <Select value={provider} onValueChange={(v) => setProvider(v as SttProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STT_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.note}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Button className="w-full" onClick={runTranscribe} disabled={transcribing || !mediaFile}>
              {transcribing ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Transcribing…
                </>
              ) : (
                <>
                  <Wand2 className="mr-1 h-4 w-4" /> Transcribe
                </>
              )}
            </Button>
            <NumSlider
              label="Words per caption"
              min={1}
              max={10}
              step={1}
              value={cfg.wordsPerLine}
              onChange={(v) => set("wordsPerLine", v)}
              fmt={(v) => String(v)}
            />
            <Textarea
              rows={6}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setWords([]);
              }}
              placeholder="Transcript appears here — or type it yourself."
              className="text-sm"
            />
            {lines.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {lines.length} captions{words.length ? " · word-timed" : " · evenly spread"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Highlighted words</CardTitle>
            <CardDescription>The punch words get their own styling.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto-detect key words</Label>
              <Switch checked={cfg.autoImportant} onCheckedChange={(v) => set("autoImportant", v)} />
            </div>
            <NumSlider
              label="Minimum length"
              min={3}
              max={12}
              step={1}
              value={cfg.importantMinLength}
              onChange={(v) => set("importantMinLength", v)}
              fmt={(v) => `${v} chars`}
            />
            <Row label="Always highlight (comma separated)">
              <Input value={cfg.keywords} onChange={(e) => set("keywords", e.target.value)} />
            </Row>
            <NumSlider
              label="Highlight size"
              min={1}
              max={2.4}
              value={cfg.highlightScale}
              onChange={(v) => set("highlightScale", v)}
              fmt={(v) => `${v.toFixed(2)}×`}
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Highlight bold</Label>
              <Switch checked={cfg.highlightBold} onCheckedChange={(v) => set("highlightBold", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Highlight italic</Label>
              <Switch
                checked={cfg.highlightItalic}
                onCheckedChange={(v) => set("highlightItalic", v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Row label="Text colour">
                <Input
                  type="color"
                  value={cfg.textColor}
                  onChange={(e) => set("textColor", e.target.value)}
                  className="h-9 p-1"
                />
              </Row>
              <Row label="Highlight colour">
                <Input
                  type="color"
                  value={cfg.highlightColor}
                  onChange={(e) => set("highlightColor", e.target.value)}
                  className="h-9 p-1"
                />
              </Row>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Centre: preview */}
      <div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        <Card className="lg:sticky lg:top-0 lg:z-10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>
                {dims.label} · {dims.w}×{dims.h} · 60fps
              </CardDescription>
            </div>
            <Tabs value={aspect} onValueChange={(v) => setAspect(v as HqAspect)}>
              <TabsList>
                <TabsTrigger value="9:16">9:16</TabsTrigger>
                <TabsTrigger value="1:1">1:1</TabsTrigger>
                <TabsTrigger value="16:9">16:9</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="mx-auto flex justify-center rounded-xl bg-black p-2">
              <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                className="h-auto max-h-[52vh] w-full max-w-full rounded-lg object-contain"
              />
            </div>
            <audio ref={audioRef} src={mediaUrl || undefined} className="hidden" />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={togglePlay}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Slider
                min={0}
                max={Math.max(0.1, total)}
                step={0.02}
                value={[time]}
                onValueChange={(v) => {
                  setTime(v[0]);
                  if (audioRef.current) audioRef.current.currentTime = v[0];
                }}
                className="flex-1"
              />
              <span className="w-24 text-right text-xs text-muted-foreground">
                {time.toFixed(1)}s / {total.toFixed(1)}s
              </span>
              <Button size="sm" variant="secondary" onClick={exportVideo} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
            {exporting && <Progress value={exportProgress} />}
          </CardContent>
        </Card>

        {has("backdrop") && <Card>
          <CardHeader>
            <CardTitle className="text-base">Backdrop</CardTitle>
            <CardDescription>Textured, gently animated plates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {HQ_BACKDROPS.map((b) => (
                <Button
                  key={b.id}
                  size="sm"
                  variant={cfg.backdropId === b.id ? "default" : "outline"}
                  onClick={() => {
                    set("backdropId", b.id);
                    set("backdropColor", b.base);
                  }}
                >
                  {b.name}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Row label="Backdrop colour">
                <Input
                  type="color"
                  value={cfg.backdropColor}
                  onChange={(e) => set("backdropColor", e.target.value)}
                  className="h-9 p-1"
                />
              </Row>
              <Row label="Light colour">
                <Input
                  type="color"
                  value={cfg.lightColor}
                  onChange={(e) => set("lightColor", e.target.value)}
                  className="h-9 p-1"
                />
              </Row>
            </div>
            <NumSlider
              label="Light intensity"
              min={0}
              max={1.5}
              value={cfg.lightIntensity}
              onChange={(v) => set("lightIntensity", v)}
            />
            <NumSlider label="Photo dim" min={0} max={0.9} value={cfg.bgDim} onChange={(v) => set("bgDim", v)} />
            <NumSlider
              label="Photo blur"
              min={0}
              max={40}
              step={1}
              value={cfg.bgBlur}
              onChange={(v) => set("bgBlur", v)}
              fmt={(v) => `${v}px`}
            />
            <NumSlider label="Photo zoom" min={1} max={1.6} value={cfg.bgZoom} onChange={(v) => set("bgZoom", v)} />
          </CardContent>
        </Card>}

        {has("headline") && <Card>
          <CardHeader>
            <CardTitle className="text-base">Headline</CardTitle>
            <CardDescription>The big static text this template composes around.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Heading">
              <Textarea
                rows={3}
                value={cfg.heading}
                onChange={(e) => set("heading", e.target.value)}
                className="text-sm"
              />
            </Row>
            {has("signature") && (
              <>
                <Row label="Sub-heading">
                  <Input value={cfg.subheading} onChange={(e) => set("subheading", e.target.value)} />
                </Row>
                <Row label="Attribution / signature">
                  <Input
                    value={cfg.author}
                    onChange={(e) => set("author", e.target.value)}
                    placeholder="e.g. Marcus Aurelius"
                  />
                </Row>
              </>
            )}
          </CardContent>
        </Card>}

        {has("particles") && <Card>
          <CardHeader>
            <CardTitle className="text-base">Animated elements</CardTitle>
            <CardDescription>Falling props layered over the frame.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Element type">
              <Select value={cfg.particles} onValueChange={(v) => set("particles", v as ParticleId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HQ_PARTICLES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <NumSlider
              label="Element count"
              min={0}
              max={60}
              step={1}
              value={cfg.particleCount}
              onChange={(v) => set("particleCount", v)}
              fmt={(v) => String(v)}
            />
            <NumSlider
              label="Element speed"
              min={0.1}
              max={4}
              value={cfg.particleSpeed}
              onChange={(v) => set("particleSpeed", v)}
            />
            <Row label="Element colour">
              <Input
                type="color"
                value={cfg.particleColor}
                onChange={(e) => set("particleColor", e.target.value)}
                className="h-9 p-1"
              />
            </Row>
          </CardContent>
        </Card>}
      </div>

      {/* Right: typography + subject */}
      <div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        {has("typography") && <Card>
          <CardHeader>
            <CardTitle className="text-base">Typography</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Font">
              <Select value={cfg.font} onValueChange={(v) => set("font", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="'Archivo Black', Impact, sans-serif">Archivo Black</SelectItem>
                  <SelectItem value="'Helvetica Neue', Arial, sans-serif">Helvetica</SelectItem>
                  <SelectItem value="Georgia, 'Times New Roman', serif">Georgia Serif</SelectItem>
                  <SelectItem value="'Courier New', monospace">Typewriter</SelectItem>
                  <SelectItem value="Impact, sans-serif">Impact</SelectItem>
                  <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <div className="grid grid-cols-2 gap-2">
              <Row label="Weight">
                <Select value={cfg.fontWeight} onValueChange={(v) => set("fontWeight", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["300", "400", "500", "600", "700", "800", "900"].map((w) => (
                      <SelectItem key={w} value={w}>
                        {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Alignment">
                <Select
                  value={cfg.align}
                  onValueChange={(v) => set("align", v as HqConfig["align"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Uppercase</Label>
              <Switch checked={cfg.uppercase} onCheckedChange={(v) => set("uppercase", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Italic</Label>
              <Switch checked={cfg.italic} onCheckedChange={(v) => set("italic", v)} />
            </div>
            <NumSlider
              label="Text size"
              min={0.02}
              max={0.16}
              step={0.002}
              value={cfg.textSize}
              onChange={(v) => set("textSize", v)}
              fmt={(v) => `${Math.round(v * dims.h)}px`}
            />
            <NumSlider label="Line gap" min={0.7} max={2} value={cfg.lineGap} onChange={(v) => set("lineGap", v)} />
            <NumSlider label="Text X" min={0} max={1} value={cfg.textX} onChange={(v) => set("textX", v)} />
            <NumSlider label="Text Y" min={0} max={1} value={cfg.textY} onChange={(v) => set("textY", v)} />
            <NumSlider
              label="Text block width"
              min={0.3}
              max={1}
              value={cfg.textWidth}
              onChange={(v) => set("textWidth", v)}
            />
            <NumSlider
              label="Outline"
              min={0}
              max={16}
              step={1}
              value={cfg.stroke}
              onChange={(v) => set("stroke", v)}
              fmt={(v) => `${v}px`}
            />
            <Row label="Outline colour">
              <Input
                type="color"
                value={cfg.strokeColor}
                onChange={(e) => set("strokeColor", e.target.value)}
                className="h-9 p-1"
              />
            </Row>
            <NumSlider label="Shadow" min={0} max={1} value={cfg.shadow} onChange={(v) => set("shadow", v)} />
          </CardContent>
        </Card>}

        {has("wordAnimation") && <Card>
          <CardHeader>
            <CardTitle className="text-base">Text animation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Animation">
              <Select value={cfg.anim} onValueChange={(v) => set("anim", v as HqAnimId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HQ_CAPTION_ANIMS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <NumSlider
              label="Intensity"
              min={0}
              max={2.5}
              value={cfg.animIntensity}
              onChange={(v) => set("animIntensity", v)}
            />
            <NumSlider
              label="Word stagger"
              min={0}
              max={0.4}
              value={cfg.animStagger}
              onChange={(v) => set("animStagger", v)}
              fmt={(v) => `${v.toFixed(2)}s`}
            />
          </CardContent>
        </Card>}

        {has("subject") && <Card>
          <CardHeader>
            <CardTitle className="text-base">Subject</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <NumSlider
              label="Scale"
              min={0.3}
              max={2}
              value={cfg.subjectScale}
              onChange={(v) => set("subjectScale", v)}
            />
            <NumSlider label="Position X" min={0} max={1} value={cfg.subjectX} onChange={(v) => set("subjectX", v)} />
            <NumSlider label="Position Y" min={0} max={1.2} value={cfg.subjectY} onChange={(v) => set("subjectY", v)} />
            <Row label="Intro animation">
              <Select
                value={cfg.subjectAnim}
                onValueChange={(v) => set("subjectAnim", v as SubjectAnimId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_ANIMS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <NumSlider
              label="Animation length"
              min={0.2}
              max={4}
              value={cfg.subjectAnimDur}
              onChange={(v) => set("subjectAnimDur", v)}
              fmt={(v) => `${v.toFixed(1)}s`}
            />
            <NumSlider
              label="Animation amount"
              min={0}
              max={2.5}
              value={cfg.subjectAnimAmount}
              onChange={(v) => set("subjectAnimAmount", v)}
            />
            <NumSlider
              label="Drop shadow"
              min={0}
              max={1}
              value={cfg.subjectShadow}
              onChange={(v) => set("subjectShadow", v)}
            />
            {!subjectUrl && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Upload a subject photo to see these apply.
              </p>
            )}
          </CardContent>
        </Card>}

        {has("camera") && <Card>
          <CardHeader>
            <CardTitle className="text-base">Camera motion</CardTitle>
            <CardDescription>A continuous move applied to the whole composed frame.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Motion">
              <Select
                value={cfg.cameraMotion}
                onValueChange={(v) => set("cameraMotion", v as HqCameraMotionId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HQ_CAMERA_MOTIONS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <NumSlider
              label="Speed"
              min={0.1}
              max={3}
              value={cfg.cameraSpeed}
              onChange={(v) => set("cameraSpeed", v)}
            />
            <NumSlider
              label="Intensity"
              min={0}
              max={2}
              value={cfg.cameraIntensity}
              onChange={(v) => set("cameraIntensity", v)}
            />
          </CardContent>
        </Card>}

        {has("layoutOptions") && <Card>
          <CardHeader>
            <CardTitle className="text-base">Layout options</CardTitle>
            <CardDescription>Controls specific to this template's composition.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {template.layout === "splitKinetic" && (
              <NumSlider
                label="Panel gap"
                min={0}
                max={0.25}
                value={cfg.splitGap}
                onChange={(v) => set("splitGap", v)}
              />
            )}
            {template.layout === "duotoneHalftone" && (
              <NumSlider
                label="Halftone dot size"
                min={4}
                max={26}
                step={1}
                value={cfg.halftoneDot}
                onChange={(v) => set("halftoneDot", v)}
                fmt={(v) => `${v}px`}
              />
            )}
            {template.layout === "verticalMarquee" && (
              <>
                <Row label="Marquee words (comma separated)">
                  <Input
                    value={cfg.subheading}
                    onChange={(e) => set("subheading", e.target.value)}
                    placeholder="focus, grind, rise, repeat"
                  />
                </Row>
                <NumSlider
                  label="Scroll speed"
                  min={0.1}
                  max={3}
                  value={cfg.marqueeSpeed}
                  onChange={(v) => set("marqueeSpeed", v)}
                />
              </>
            )}
            {template.layout === "filmStrip" && (
              <>
                <Row label="Timecode">
                  <Input value={cfg.author} onChange={(e) => set("author", e.target.value)} placeholder="00:00:12:04" />
                </Row>
                <Row label="Chapter label">
                  <Input
                    value={cfg.subheading}
                    onChange={(e) => set("subheading", e.target.value)}
                    placeholder="chapter i · the grind"
                  />
                </Row>
              </>
            )}
            {template.layout === "glitchTerminal" && (
              <NumSlider
                label="Glitch burst amount"
                min={0}
                max={2}
                value={cfg.glitchAmount}
                onChange={(v) => set("glitchAmount", v)}
              />
            )}
            {template.layout === "liquidReveal" && (
              <p className="text-xs text-muted-foreground">
                The ink-blot mask reveal timing follows the word stagger and animation intensity settings above.
              </p>
            )}
          </CardContent>
        </Card>}

        {has("wordEditor") && <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-word styling</CardTitle>
            <CardDescription>Click a word to override its look and motion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2">
              {lines.length === 0 && (
                <p className="text-xs text-muted-foreground">Transcribe or type captions first.</p>
              )}
              {lines.map((ln, li) => (
                <div key={li} className="flex flex-wrap gap-1">
                  {ln.words.map((w, wi) => {
                    const key = hqWordKey(li, wi);
                    const active =
                      selectedWord?.lineIndex === li && selectedWord?.wordIndex === wi;
                    const overridden = Boolean(cfg.wordStyles[key]);
                    return (
                      <button
                        key={wi}
                        type="button"
                        onClick={() => setSelectedWord({ lineIndex: li, wordIndex: wi })}
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : overridden
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {w.text}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {selectedWord && (() => {
              const key = hqWordKey(selectedWord.lineIndex, selectedWord.wordIndex);
              const ov = cfg.wordStyles[key] ?? {};
              const word = lines[selectedWord.lineIndex]?.words[selectedWord.wordIndex];
              if (!word) return null;
              return (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">"{word.text}"</p>
                    <Button size="sm" variant="ghost" onClick={() => clearWordStyle(key)}>
                      Reset
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Emphasise</Label>
                    <Switch
                      checked={ov.emphasis ?? word.important}
                      onCheckedChange={(v) => setWordStyle(key, { emphasis: v })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="Colour">
                      <Input
                        type="color"
                        value={ov.color ?? cfg.textColor}
                        onChange={(e) => setWordStyle(key, { color: e.target.value })}
                        className="h-9 p-1"
                      />
                    </Row>
                    <Row label="Weight">
                      <Select
                        value={ov.weight ?? cfg.fontWeight}
                        onValueChange={(v) => setWordStyle(key, { weight: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["300", "400", "500", "600", "700", "800", "900"].map((w) => (
                            <SelectItem key={w} value={w}>
                              {w}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Row>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Italic</Label>
                    <Switch
                      checked={ov.italic ?? false}
                      onCheckedChange={(v) => setWordStyle(key, { italic: v })}
                    />
                  </div>
                  <NumSlider
                    label="Scale"
                    min={0.4}
                    max={2.5}
                    value={ov.scale ?? 1}
                    onChange={(v) => setWordStyle(key, { scale: v })}
                    fmt={(v) => `${v.toFixed(2)}×`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <NumSlider
                      label="Nudge X"
                      min={-200}
                      max={200}
                      step={1}
                      value={ov.dx ?? 0}
                      onChange={(v) => setWordStyle(key, { dx: v })}
                      fmt={(v) => `${v}px`}
                    />
                    <NumSlider
                      label="Nudge Y"
                      min={-200}
                      max={200}
                      step={1}
                      value={ov.dy ?? 0}
                      onChange={(v) => setWordStyle(key, { dy: v })}
                      fmt={(v) => `${v}px`}
                    />
                  </div>
                  <Row label="Animation override">
                    <Select
                      value={ov.anim ?? cfg.anim}
                      onValueChange={(v) => setWordStyle(key, { anim: v as HqAnimId })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HQ_CAPTION_ANIMS.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Row>
                  <NumSlider
                    label="Extra delay"
                    min={0}
                    max={1}
                    value={ov.delay ?? 0}
                    onChange={(v) => setWordStyle(key, { delay: v })}
                    fmt={(v) => `${v.toFixed(2)}s`}
                  />
                </div>
              );
            })()}
          </CardContent>
        </Card>}

        <Card>
          <CardContent className="pt-6">
            <Button className="w-full" onClick={exportVideo} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Exporting {Math.round(exportProgress)}%
                </>
              ) : (
                <>
                  <Upload className="mr-1 h-4 w-4" /> Export HQ video
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
