import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Loader2, Pause, Play, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackgroundPicker, TIMER_STYLES, TIMEBAR_STYLES, drawBackground, drawTimeBar, drawTimer, type BackgroundId, type TimerStyleId, type TimeBarStyleId } from "@/lib/kid-elements";
import { KidAudioCard, defaultKidAudio, renderKidMusicBuffer, renderKidSfxBuffer, type KidAudioSettings, type KidAudioCue } from "@/lib/kid-audio";
import { downloadKidVideo, recordKidCanvas } from "@/lib/kid-export";
import { roundRect } from "@/lib/video-fx";

export type KidQuizKind = "knowledge" | "atoz" | "sound";
type Round = { id: string; prompt: string; answer: string; options: string[]; mediaUrl: string; duration: number };
const id = () => Math.random().toString(36).slice(2, 10);
const defaults: Record<KidQuizKind, Round[]> = {
  knowledge: [{ id: "knowledge-1", prompt: "What planet do we live on?", answer: "Earth", options: ["Earth", "Mars", "Jupiter"], mediaUrl: "", duration: 7 }],
  atoz: [{ id: "atoz-1", prompt: "Name a country that starts with the letter…", answer: "Argentina, Algeria, Afghanistan", options: ["A"], mediaUrl: "", duration: 8 }],
  sound: [{ id: "sound-1", prompt: "Guess the animal by its sound", answer: "Cat", options: ["1", "2", "3"], mediaUrl: "", duration: 8 }],
};
const info = {
  knowledge: { title: "General Knowledge Quiz", description: "Bright, fast multi-choice quizzes with timed answer reveals.", accent: "#fb0051", bg: ["#ffb800", "#ffd84c"] as [string, string] },
  atoz: { title: "From A to Z", description: "Letter challenges with ranked answers and animated reveals.", accent: "#1fc83c", bg: ["#087cea", "#22b8ff"] as [string, string] },
  sound: { title: "Guess The Sound", description: "Audio-led guessing rounds with image grids and reveal cards.", accent: "#ff2b26", bg: ["#d80f0a", "#ff514b"] as [string, string] },
};

export function KidQuizStudio({ kind }: { kind: KidQuizKind }) {
  const meta = info[kind];
  const [rounds, setRounds] = useState<Round[]>(defaults[kind]);
  const [background, setBackground] = useState<BackgroundId>(kind === "sound" ? "rays" : "bubbles");
  const [timerStyle, setTimerStyle] = useState<TimerStyleId>("ring");
  const [timebarStyle, setTimebarStyle] = useState<TimeBarStyleId>("bar");
  const [revealSeconds, setRevealSeconds] = useState(2);
  const [audio, setAudio] = useState<KidAudioSettings>(defaultKidAudio());
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anchorRef = useRef(0);
  const timeRef = useRef(0);
  const soundRef = useRef<HTMLAudioElement | null>(null);
  const soundRoundRef = useRef("");

  const timeline = useMemo(() => {
    let cursor = 0;
    const segs = rounds.map((round, index) => {
      const start = cursor;
      cursor += Math.max(3, round.duration) + revealSeconds;
      return { round, index, start, duration: Math.max(3, round.duration) + revealSeconds };
    });
    return { segs, total: cursor };
  }, [rounds, revealSeconds]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const w = 1920;
    const h = 1080;
    const seg = timeline.segs.find((item) => t >= item.start && t < item.start + item.duration) ?? timeline.segs.at(-1);
    if (!seg) return;
    const local = Math.max(0, t - seg.start);
    const guessDuration = seg.duration - revealSeconds;
    const reveal = local >= guessDuration;
    drawBackground(ctx, background, { bg: meta.bg, primary: meta.accent, accent: "#fff23d" }, w, h, t, 1);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 10;
    ctx.font = "900 72px Arial, sans-serif";
    ctx.fillText(reveal && kind === "atoz" ? "ANSWERS…" : seg.round.prompt, w / 2, 92, w - 260);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = meta.accent;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    roundRect(ctx, 36, 28, 96, 96, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 52px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(seg.index + 1), 84, 76);
    ctx.restore();

    if (kind === "knowledge") {
      const imageX = 100;
      const imageY = 210;
      const imageW = 820;
      const imageH = 650;
      ctx.fillStyle = "rgba(255,255,255,.18)";
      roundRect(ctx, imageX, imageY, imageW, imageH, 80);
      ctx.fill();
      ctx.font = "260px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🌍", imageX + imageW / 2, imageY + imageH / 2 + 40);
      seg.round.options.slice(0, 4).forEach((option, index) => {
        const x = 1000;
        const y = 230 + index * 180;
        const correct = reveal && option.toLowerCase() === seg.round.answer.toLowerCase();
        ctx.fillStyle = correct ? "#23d66f" : reveal ? "rgba(255,255,255,.55)" : "#ffffff";
        roundRect(ctx, x, y, 780, 140, 36);
        ctx.fill();
        ctx.fillStyle = correct ? "#ffffff" : "#111111";
        ctx.font = "900 62px Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${String.fromCharCode(65 + index)}   ${option}`, x + 48, y + 74, 690);
      });
    } else if (kind === "atoz") {
      if (!reveal) {
        ctx.fillStyle = meta.accent;
        roundRect(ctx, 700, 290, 520, 430, 60);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.fillStyle = "#fff23d";
        ctx.font = "900 300px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(seg.round.options[0] || "A", 960, 525);
      } else {
        seg.round.answer.split(",").slice(0, 5).forEach((answer, index) => {
          ctx.fillStyle = "#ffffff";
          ctx.font = "900 76px Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${index + 1}   ${answer.trim()}`, 960, 290 + index * 135);
        });
      }
    } else {
      const cells = 16;
      for (let i = 0; i < cells; i++) {
        const col = i < 7 ? i : i < 9 ? (i === 7 ? 7 : 0) : 16 - i;
        const row = i < 7 ? 0 : i < 9 ? 1 : 2;
        const x = 45 + col * 260;
        const y = row === 0 ? 45 : row === 1 ? 390 : 750;
        ctx.fillStyle = "rgba(255,255,255,.92)";
        roundRect(ctx, x, y, 225, 285, 28);
        ctx.fill();
        ctx.fillStyle = "#202020";
        ctx.font = "140px Arial";
        ctx.textAlign = "center";
        ctx.fillText(["🐹", "🦁", "🦚", "🐫", "🐘", "🫏", "🦦", "🦗", "🐐", "🐸", "🐯", "🦊", "🐿️", "🐈", "🦃", "🐕"][i], x + 112, y + 145);
      }
      ctx.fillStyle = "rgba(255,255,255,.96)";
      roundRect(ctx, 520, 390, 880, 285, 44);
      ctx.fill();
      ctx.fillStyle = "#171717";
      ctx.font = "900 92px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(reveal ? seg.round.answer.toUpperCase() : "🔊  LISTEN…", 960, 535, 760);
    }

    if (!reveal) {
      drawTimer(ctx, timerStyle, 1760, 940, 78, Math.max(0, guessDuration - local), guessDuration, { primary: meta.accent, accent: "#fff23d", text: "#ffffff" }, t);
      drawTimeBar(ctx, timebarStyle, 360, 950, 1200, 42, Math.max(0, 1 - local / guessDuration), { primary: meta.accent, accent: "#fff23d", text: "#ffffff" }, t);
    }
  }, [background, kind, meta, revealSeconds, timeline, timerStyle, timebarStyle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const loop = (now: number) => {
      if (playing) {
        timeRef.current = Math.min(timeline.total, (now - anchorRef.current) / 1000);
        if (kind === "sound") {
          const current = timeline.segs.find((item) => timeRef.current >= item.start && timeRef.current < item.start + item.duration);
          if (current?.round.mediaUrl && soundRoundRef.current !== current.round.id) {
            soundRef.current?.pause();
            const player = new Audio(current.round.mediaUrl);
            soundRef.current = player;
            soundRoundRef.current = current.round.id;
            void player.play().catch(() => undefined);
          }
        }
        if (timeRef.current >= timeline.total) {
          setPlaying(false);
          timeRef.current = 0;
          soundRef.current?.pause();
          soundRoundRef.current = "";
        }
        setTime(timeRef.current);
      }
      draw(ctx, timeRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, kind, playing, timeline]);

  const toggle = () => {
    if (playing) {
      soundRef.current?.pause();
      setPlaying(false);
    }
    else {
      anchorRef.current = performance.now() - timeRef.current * 1000;
      setPlaying(true);
    }
  };

  const exportVideo = async () => {
    setExporting(true);
    setProgress(0);
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    try {
      const cues: KidAudioCue[] = timeline.segs.flatMap((seg, index) => [
        { kind: "start" as const, time: seg.start },
        ...(index ? [{ kind: "transition" as const, time: seg.start }] : []),
        { kind: "reveal" as const, time: seg.start + seg.duration - revealSeconds },
      ]);
      const [sfx, music] = await Promise.all([
        renderKidSfxBuffer(audio, cues, timeline.total),
        renderKidMusicBuffer(audio, timeline.total),
      ]);
      for (const buffer of [sfx, music]) {
        if (!buffer) continue;
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(dest);
        source.start();
      }
      if (kind === "sound") {
        for (const seg of timeline.segs) {
          if (!seg.round.mediaUrl) continue;
          try {
            const response = await fetch(seg.round.mediaUrl);
            if (!response.ok) continue;
            const buffer = await audioCtx.decodeAudioData(await response.arrayBuffer());
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(dest);
            source.start(audioCtx.currentTime + seg.start, 0, Math.min(buffer.duration, seg.duration - revealSeconds));
          } catch {
            // Keep exporting other rounds if one uploaded/remote sound is unreadable.
          }
        }
      }
      const result = await recordKidCanvas({ canvas, duration: timeline.total, drawFrame: draw, audioStream: dest.stream, onProgress: setProgress });
      downloadKidVideo(result.blob, kind, result.extension);
      toast.success("Export complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      await audioCtx.close().catch(() => undefined);
      setExporting(false);
    }
  };

  const update = (roundId: string, patch: Partial<Round>) => setRounds((all) => all.map((round) => round.id === roundId ? { ...round, ...patch } : round));
  return <div className="mx-auto flex h-full max-w-7xl flex-col gap-5 overflow-hidden p-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/kid-videos"><ArrowLeft className="mr-1 h-4 w-4" />Kid Videos</Link></Button><h1 className="text-2xl font-semibold">{meta.title}</h1><p className="text-sm text-muted-foreground">{meta.description}</p></div>
      <div className="flex gap-2"><Button variant="secondary" onClick={toggle}>{playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}{playing ? "Pause" : "Preview"}</Button><Button onClick={exportVideo} disabled={exporting}>{exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}Export 1080p</Button></div>
    </header>
    {exporting && <Progress value={progress} />}
    <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-h-0 space-y-4 overflow-y-auto pr-2"><Card><CardContent className="p-3"><canvas ref={canvasRef} width={1920} height={1080} className="h-auto max-h-[58vh] w-full rounded-md border object-contain" /></CardContent></Card><div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{time.toFixed(1)} / {timeline.total.toFixed(1)}s</span><Slider value={[time]} min={0} max={Math.max(1, timeline.total)} step={0.05} onValueChange={([value]) => { timeRef.current = value; setTime(value); }} /></div><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Rounds</CardTitle><CardDescription>Edit every prompt, answer and option.</CardDescription></div><Button size="sm" variant="secondary" onClick={() => setRounds((all) => [...all, { ...defaults[kind][0], id: id() }])}><Plus className="mr-1 h-4 w-4" />Add</Button></CardHeader><CardContent className="space-y-4">{rounds.map((round, index) => <div key={round.id} className="space-y-3 rounded-md border p-3"><div className="flex justify-between"><strong className="text-sm">Round {index + 1}</strong><Button size="icon" variant="ghost" disabled={rounds.length === 1} onClick={() => setRounds((all) => all.filter((item) => item.id !== round.id))}><Trash2 className="h-4 w-4" /></Button></div><Input value={round.prompt} onChange={(event) => update(round.id, { prompt: event.target.value })} placeholder="Prompt" /><Input value={round.answer} onChange={(event) => update(round.id, { answer: event.target.value })} placeholder="Answer" />{kind !== "sound" && <Input value={round.options.join(", ")} onChange={(event) => update(round.id, { options: event.target.value.split(",").map((value) => value.trim()) })} placeholder="Options, separated by commas" />}{kind === "sound" && <><Input value={round.mediaUrl} onChange={(event) => update(round.id, { mediaUrl: event.target.value })} placeholder="Sound URL" /><label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-2 text-xs"><Upload className="h-4 w-4" />Upload sound<input type="file" accept="audio/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) update(round.id, { mediaUrl: URL.createObjectURL(file) }); }} /></label></>}<Label className="text-xs">Guess time · {round.duration.toFixed(1)}s</Label><Slider value={[round.duration]} min={3} max={20} step={0.5} onValueChange={([value]) => update(round.id, { duration: value })} /></div>)}</CardContent></Card></div>
      <aside className="min-h-0 space-y-4 overflow-y-auto pr-2"><Card><CardHeader><CardTitle className="text-base">Format</CardTitle></CardHeader><CardContent className="space-y-4"><Tabs value="16:9"><TabsList className="w-full"><TabsTrigger value="16:9" className="flex-1">16:9 YouTube HD</TabsTrigger></TabsList></Tabs><BackgroundPicker value={background} onChange={setBackground} /><div><Label className="text-xs">Timer style</Label><Select value={timerStyle} onValueChange={(value) => setTimerStyle(value as TimerStyleId)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIMER_STYLES.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Time bar style</Label><Select value={timebarStyle} onValueChange={(value) => setTimebarStyle(value as TimeBarStyleId)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIMEBAR_STYLES.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><Label className="text-xs">Answer reveal · {revealSeconds.toFixed(1)}s</Label><Slider value={[revealSeconds]} min={1} max={5} step={0.25} onValueChange={([value]) => setRevealSeconds(value)} /></CardContent></Card><KidAudioCard value={audio} onChange={setAudio} /></aside>
    </div>
  </div>;
}