import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageIcon,
  Play,
  Pause,
  Download,
  Loader2,
  Trash2,
  Plus,
  Upload,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FX_FONT, INTRO_ANIMATIONS, OUTRO_ANIMATIONS, fitText, hexA, roundRect, ease } from "@/lib/video-fx";
import {
  IntroOutroCard,
  defaultIntro,
  defaultOutro,
  paletteOf,
  type CardConfig,
} from "@/components/intro-outro-card";
import {
  ColorCustomiser,
  applyOverrides,
  type ColorOverrides,
  type PaletteLike,
} from "@/components/color-customiser";
import {
  AnimControlGroup,
  computeAnim,
  defaultAnim,
  applyAnim,
  type ElementAnimSpec,
} from "@/lib/kid-anim";
import {
  ElementStyleGroup,
  defaultStyle,
  applyStyle,
  drawBackground as drawSharedBackground,
  BackgroundPicker,
  type BackgroundId,
  drawTimer,
  TimerStylePicker,
  type TimerStyleId,
  drawTimeBar,
  TimeBarStylePicker,
  type TimeBarStyleId,
  type ElementStyleSpec,
} from "@/lib/kid-elements";

export const Route = createFileRoute("/_authenticated/kid-videos/logo")({
  head: () => ({
    meta: [
      { title: "Guess The Logo Videos — Orbit" },
      {
        name: "description",
        content:
          "Create multi-round Guess The Logo videos: uploaded brand logos, animated blue swirl backgrounds, countdown timers and 1080p export.",
      },
      { property: "og:title", content: "Guess The Logo Videos — Orbit" },
      {
        property: "og:description",
        content:
          "Logo guessing games for kids: rounds, countdowns, and animated answer reveals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogoPage,
});

type AspectKey = "9:16" | "1:1" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · TikTok/Reels/Shorts" },
  "1:1": { w: 1080, h: 1080, label: "Square · Feed" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

type Pal = PaletteLike & { id: string; name: string };
const PALETTES: Pal[] = [
  {
    id: "sapphire",
    name: "Sapphire Swirl",
    bg: ["#020617", "#1d4ed8"],
    primary: "#38bdf8",
    accent: "#fbbf24",
    text: "#ffffff",
    muted: "#bfdbfe",
  },
  {
    id: "midnight",
    name: "Midnight Blue",
    bg: ["#030712", "#1e3a8a"],
    primary: "#60a5fa",
    accent: "#f472b6",
    text: "#ffffff",
    muted: "#c7d2fe",
  },
  {
    id: "azure",
    name: "Azure Blast",
    bg: ["#001220", "#0284c7"],
    primary: "#7dd3fc",
    accent: "#facc15",
    text: "#ffffff",
    muted: "#bae6fd",
  },
];

const ELEMENT_LIST: { key: string; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "logo", label: "Logo image" },
  { key: "card", label: "Reveal card" },
  { key: "answer", label: "Answer" },
  { key: "hint", label: "Hint label" },
  { key: "timer", label: "Countdown timer" },
  { key: "timebar", label: "Time bar" },
  { key: "roundNumber", label: "Round number" },
];

const ANIM_ELEMENTS: { key: string; label: string }[] = [
  { key: "background", label: "Background" },
  ...ELEMENT_LIST,
];

function defaultAnimMap(): Record<string, ElementAnimSpec> {
  return {
    background: defaultAnim({ preset: "none", loop: "none" }),
    title: defaultAnim({ preset: "slide-down", duration: 0.45 }),
    logo: defaultAnim({ preset: "zoom-in", duration: 0.55, loop: "breathe", intensity: 0.4 }),
    card: defaultAnim({ preset: "fade", duration: 0.4 }),
    answer: defaultAnim({ preset: "bounce-in", duration: 0.5 }),
    hint: defaultAnim({ preset: "fade", duration: 0.3 }),
    timer: defaultAnim({ preset: "fade", duration: 0.3, loop: "pulse", intensity: 0.5 }),
    timebar: defaultAnim({ preset: "fade", duration: 0.3 }),
    roundNumber: defaultAnim({ preset: "pop", duration: 0.4, loop: "float", intensity: 0.5 }),
    side: defaultAnim({ preset: "fade", duration: 0.5, loop: "none" }),
  };
}

function defaultStyleMap(): Record<string, ElementStyleSpec> {
  return Object.fromEntries(ELEMENT_LIST.map((e) => [e.key, defaultStyle()]));
}

const uid = () => Math.random().toString(36).slice(2, 9);

type Round = {
  id: string;
  imgUrl: string | null;
  img: HTMLImageElement | null;
  answer: string;
  duration: number;
};

function emptyRound(): Round {
  return { id: uid(), imgUrl: null, img: null, answer: "", duration: 6 };
}

function LogoPage() {
  const [aspect, setAspect] = useState<AspectKey>("16:9");
  const [paletteId, setPaletteId] = useState(PALETTES[0].id);
  const [colors, setColors] = useState<ColorOverrides>({});
  const [rounds, setRounds] = useState<Round[]>([emptyRound(), emptyRound()]);
  const [heading, setHeading] = useState("Guess The Logo");
  const [revealSecs, setRevealSecs] = useState(2);
  const [showTimer, setShowTimer] = useState(true);
  const [anims, setAnims] = useState<Record<string, ElementAnimSpec>>(defaultAnimMap());
  const setAnim = (key: string, spec: ElementAnimSpec) =>
    setAnims((a) => ({ ...a, [key]: spec }));
  const [styles, setStyles] = useState<Record<string, ElementStyleSpec>>(defaultStyleMap());
  const setStyleFor = (key: string, spec: ElementStyleSpec) =>
    setStyles((s) => ({ ...s, [key]: spec }));
  const [backgroundId, setBackgroundId] = useState<BackgroundId>("rays");
  const [backgroundIntensity, setBackgroundIntensity] = useState(1);
  const [timerStyle, setTimerStyle] = useState<TimerStyleId>("ring");
  const [timeBarStyle, setTimeBarStyle] = useState<TimeBarStyleId>("bar");

  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, title: "Guess The Logo" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, title: "How many did you get?" });

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const timeRef = useRef(0);
  const lastRef = useRef(0);

  const dims = ASPECTS[aspect];
  const basePalette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  const pal = useMemo(() => applyOverrides(basePalette, colors), [basePalette, colors]);

  const roundDur = useCallback((r: Round) => Math.max(3, r.duration) + revealSecs, [revealSecs]);

  const timeline = useMemo(() => {
    let t = intro.id !== "none" ? intro.seconds : 0;
    const segs = rounds.map((r, i) => {
      const start = t;
      const dur = roundDur(r);
      t += dur;
      return { round: r, index: i, start, dur };
    });
    const outroStart = t;
    const total = t + (outro.id !== "none" ? outro.seconds : 0);
    return { segs, outroStart, total, introEnd: intro.id !== "none" ? intro.seconds : 0 };
  }, [rounds, roundDur, intro, outro]);

  const setRound = (id: string, patch: Partial<Round>) =>
    setRounds((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const onImage = (id: string, file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setRound(id, { imgUrl: url, img });
    img.src = url;
  };

  // ---------------- rendering ----------------

  const drawRound = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      r: Round,
      index: number,
      local: number,
      dur: number,
      absT: number,
    ) => {
      const bgAnim = computeAnim(anims.background ?? defaultAnim(), local);
      ctx.save();
      applyAnim(ctx, bgAnim, w / 2, h / 2);
      drawSharedBackground(
        ctx,
        backgroundId,
        { bg: pal.bg, primary: pal.primary, accent: pal.accent },
        w,
        h,
        absT,
        backgroundIntensity,
      );
      ctx.restore();
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);

      const guessDur = Math.max(0.5, dur - revealSecs);
      const revealing = local >= guessDur;
      const revealK = revealing ? ease.out(Math.min(1, (local - guessDur) / 0.45)) : 0;
      const M = Math.min(w, h) * 0.06;

      // ---- star round badge, top-left ----
      if (styles.roundNumber?.visible ?? true) {
        const badgeAnim = computeAnim(anims.roundNumber ?? defaultAnim(), local);
        const r0 = Math.min(w, h) * 0.055;
        const bx = M + r0;
        const by = M + r0;
        ctx.save();
        applyStyle(ctx, styles.roundNumber, bx, by, w, h);
        applyAnim(ctx, badgeAnim, bx, by);
        ctx.beginPath();
        ctx.arc(bx, by, r0, 0, Math.PI * 2);
        ctx.fillStyle = hexA("#000000", 0.5);
        ctx.fill();
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = Math.max(2, r0 * 0.1);
        ctx.stroke();
        ctx.fillStyle = "#fde047";
        ctx.font = `900 ${Math.round(r0 * 0.9)}px ${FX_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", bx, by - r0 * 0.32);
        ctx.font = `800 ${Math.round(r0 * 0.5)}px ${FX_FONT}`;
        ctx.fillStyle = pal.text;
        ctx.fillText(`${index + 1}`, bx, by + r0 * 0.42);
        ctx.restore();
      }

      // ---- lightning badge, top-right ----
      if (styles.roundNumber?.visible ?? true) {
        const badgeAnim = computeAnim(anims.roundNumber ?? defaultAnim(), local);
        const r0 = Math.min(w, h) * 0.055;
        const bx = w - M - r0;
        const by = M + r0;
        ctx.save();
        applyStyle(ctx, styles.roundNumber, bx, by, w, h);
        applyAnim(ctx, badgeAnim, bx, by);
        ctx.beginPath();
        ctx.arc(bx, by, r0, 0, Math.PI * 2);
        ctx.fillStyle = hexA("#000000", 0.5);
        ctx.fill();
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = Math.max(2, r0 * 0.1);
        ctx.stroke();
        ctx.fillStyle = "#facc15";
        ctx.font = `900 ${Math.round(r0 * 0.9)}px ${FX_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚡", bx, by);
        ctx.restore();
      }

      // ---- vertical side text ----
      {
        const sideAnim = computeAnim(anims.side ?? defaultAnim(), local);
        const label = "GUESS THE LOGO • ";
        [M * 0.4, w - M * 0.4].forEach((x, i) => {
          ctx.save();
          applyAnim(ctx, sideAnim, x, h / 2);
          ctx.translate(x, h / 2);
          ctx.rotate(i === 0 ? -Math.PI / 2 : Math.PI / 2);
          ctx.font = `700 ${Math.round(Math.min(w, h) * 0.018)}px ${FX_FONT}`;
          ctx.fillStyle = hexA(pal.text, 0.35);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label.repeat(3), 0, 0);
          ctx.restore();
        });
      }

      // ---- title ----
      if (styles.title?.visible ?? true) {
        const titleAnim = computeAnim(anims.title ?? defaultAnim(), local);
        const words = heading.toUpperCase().split(" ");
        const last = words.pop() ?? "";
        const rest = words.join(" ");
        const ts = Math.round(Math.min(w, h) * 0.05);
        ctx.save();
        applyStyle(ctx, styles.title, w / 2, M + ts * 0.5, w, h);
        applyAnim(ctx, titleAnim, w / 2, M + ts * 0.5);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${ts}px ${FX_FONT}`;
        const full = `${rest} ${last}`.trim();
        const fitted = fitText(ctx, full, w - M * 2, ts, 900);
        ctx.font = `900 ${fitted}px ${FX_FONT}`;
        const restW = ctx.measureText(rest ? rest + " " : "").width;
        const lastW = ctx.measureText(last).width;
        const totalW = restW + lastW;
        const startX = w / 2 - totalW / 2;
        ctx.textAlign = "left";
        ctx.shadowColor = hexA("#000000", 0.5);
        ctx.shadowBlur = fitted * 0.2;
        ctx.fillStyle = pal.text;
        ctx.fillText(rest ? rest + " " : "", startX, M + ts * 0.55);
        ctx.fillStyle = pal.accent;
        ctx.fillText(last, startX + restW, M + ts * 0.55);
        ctx.restore();
      }

      // ---- logo card ----
      const cardTop = h * (aspect === "16:9" ? 0.22 : 0.2);
      const cardBottom = h - M - Math.min(w, h) * 0.1;
      const cardW = Math.min(w * 0.5, cardBottom - cardTop);
      const cardH = cardW;
      const cx = w / 2;
      const cy = cardTop + (cardBottom - cardTop) / 2;
      if (styles.logo?.visible ?? true) {
        const logoAnim = computeAnim(anims.logo ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, styles.logo, cx, cy, w, h);
        applyAnim(ctx, logoAnim, cx, cy);
        ctx.fillStyle = hexA("#000000", 0.35);
        roundRect(ctx, cx - cardW / 2 + cardH * 0.03, cy - cardH / 2 + cardH * 0.03, cardW, cardH, cardH * 0.12);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, cx - cardW / 2, cy - cardH / 2, cardW, cardH, cardH * 0.12);
        ctx.fill();
        ctx.save();
        roundRect(ctx, cx - cardW / 2, cy - cardH / 2, cardW, cardH, cardH * 0.12);
        ctx.clip();
        if (r.img) {
          const pad = cardW * 0.14;
          const iw = r.img.naturalWidth;
          const ih = r.img.naturalHeight;
          const ratio = Math.min((cardW - pad * 2) / iw, (cardH - pad * 2) / ih);
          const dw = iw * ratio;
          const dh = ih * ratio;
          ctx.drawImage(r.img, cx - dw / 2, cy - dh / 2, dw, dh);
        } else {
          ctx.fillStyle = "#94a3b8";
          ctx.font = `800 ${Math.round(cardW * 0.12)}px ${FX_FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("LOGO?", cx, cy);
        }
        ctx.restore();
        ctx.restore();
      }

      // ---- answer reveal ----
      if (revealing && r.answer.trim()) {
        const bandH = Math.min(w, h) * 0.18;
        const bandY = cardBottom + Math.min(w, h) * 0.02;
        const bcx = w / 2;
        const bcy = bandY + bandH / 2;

        if (styles.card?.visible ?? true) {
          const cardAnim = computeAnim(anims.card ?? defaultAnim(), local - guessDur);
          ctx.save();
          ctx.globalAlpha *= revealK;
          applyStyle(ctx, styles.card, bcx, bcy, w, h);
          applyAnim(ctx, cardAnim, bcx, bcy);
          ctx.fillStyle = hexA("#000000", 0.6);
          roundRect(ctx, M, bandY, w - M * 2, bandH, bandH * 0.25);
          ctx.fill();
          ctx.strokeStyle = hexA(pal.accent, 0.85);
          ctx.lineWidth = Math.max(2, bandH * 0.04);
          ctx.stroke();
          ctx.restore();
        }

        if (styles.hint?.visible ?? true) {
          const hintAnim = computeAnim(anims.hint ?? defaultAnim(), local - guessDur);
          const ls = Math.round(bandH * 0.22);
          ctx.save();
          ctx.globalAlpha *= revealK;
          applyStyle(ctx, styles.hint, bcx, bandY + bandH * 0.26, w, h);
          applyAnim(ctx, hintAnim, bcx, bandY + bandH * 0.26);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `800 ${ls}px ${FX_FONT}`;
          ctx.fillStyle = pal.accent;
          ctx.fillText("ANSWER", bcx, bandY + bandH * 0.26);
          ctx.restore();
        }

        if (styles.answer?.visible ?? true) {
          const answerAnim = computeAnim(anims.answer ?? defaultAnim(), local - guessDur);
          ctx.save();
          ctx.globalAlpha *= revealK;
          applyStyle(ctx, styles.answer, bcx, bandY + bandH * 0.66, w, h);
          applyAnim(ctx, answerAnim, bcx, bandY + bandH * 0.66);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const answer = r.answer.toUpperCase();
          const asz = fitText(ctx, answer, w - M * 2 - bandH * 0.5, bandH * 0.4, 900);
          ctx.font = `900 ${asz}px ${FX_FONT}`;
          ctx.fillStyle = pal.text;
          ctx.shadowColor = hexA(pal.accent, 0.5);
          ctx.shadowBlur = asz * 0.35;
          ctx.fillText(answer, bcx, bandY + bandH * 0.66);
          ctx.restore();
        }
      }

      // ---- bottom time bar ----
      const barW = w - M * 2.4;
      const barH = Math.min(w, h) * 0.022;
      const barY = h - M * 0.9;
      if (showTimer && (styles.timebar?.visible ?? true)) {
        const timebarAnim = computeAnim(anims.timebar ?? defaultAnim(), local);
        const frac = Math.max(0, Math.min(1, local / Math.max(0.01, guessDur)));
        ctx.save();
        applyStyle(ctx, styles.timebar, w / 2, barY + barH / 2, w, h);
        applyAnim(ctx, timebarAnim, w / 2, barY + barH / 2);
        drawTimeBar(
          ctx,
          timeBarStyle,
          w / 2 - barW / 2,
          barY,
          barW,
          barH,
          frac,
          { primary: pal.primary, accent: pal.accent, text: pal.text },
          absT,
        );
        ctx.restore();
      }

      // ---- countdown timer ----
      if (showTimer && (styles.timer?.visible ?? true)) {
        const timerAnim = computeAnim(anims.timer ?? defaultAnim(), local);
        const remaining = Math.max(0, guessDur - local);
        const tr = Math.min(w, h) * 0.045;
        const tx = w - M - tr;
        const ty = barY - tr * 1.6;
        ctx.save();
        applyStyle(ctx, styles.timer, tx, ty, w, h);
        applyAnim(ctx, timerAnim, tx, ty);
        drawTimer(
          ctx,
          timerStyle,
          tx,
          ty,
          tr,
          remaining,
          guessDur,
          { primary: pal.primary, accent: pal.accent, text: pal.text },
          absT,
        );
        ctx.restore();
      }
    },
    [aspect, anims, styles, backgroundId, backgroundIntensity, heading, pal, revealSecs, showTimer, timerStyle, timeBarStyle],
  );

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const { w, h } = dims;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#07070a";
      ctx.fillRect(0, 0, w, h);

      if (intro.id !== "none" && t < timeline.introEnd) {
        INTRO_ANIMATIONS.find((a) => a.id === intro.id)?.draw({
          ctx,
          w,
          h,
          p: Math.min(1, t / Math.max(0.2, intro.seconds)),
          palette: paletteOf(intro.paletteId),
          title: intro.title,
          subtitle: intro.subtitle,
          logo: null,
        });
        return;
      }
      if (outro.id !== "none" && t >= timeline.outroStart) {
        OUTRO_ANIMATIONS.find((a) => a.id === outro.id)?.draw({
          ctx,
          w,
          h,
          p: Math.min(1, (t - timeline.outroStart) / Math.max(0.2, outro.seconds)),
          palette: paletteOf(outro.paletteId),
          title: outro.title,
          subtitle: outro.subtitle,
          logo: null,
        });
        return;
      }
      const seg =
        timeline.segs.find((s) => t >= s.start && t < s.start + s.dur) ??
        timeline.segs[timeline.segs.length - 1];
      if (!seg) return;
      drawRound(ctx, w, h, seg.round, seg.index, Math.max(0, t - seg.start), seg.dur, t);
    },
    [dims, drawRound, intro, outro, timeline],
  );

  // preview loop
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
        }
        setTime(timeRef.current);
      }
      lastRef.current = now;
      drawFrame(ctx, timeRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawFrame, playing, timeline]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
    } else {
      if (timeRef.current >= timeline.total - 0.05) timeRef.current = 0;
      lastRef.current = 0;
      setPlaying(true);
    }
  };

  // ---------------- export ----------------

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

      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `guess-the-logo.${mime.includes("mp4") ? "mp4" : "webm"}`;
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
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/kid-videos">
              <ArrowLeft className="mr-1 h-4 w-4" /> Kid Videos
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ImageIcon className="h-6 w-6" /> Guess The Logo studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-round logo guessing games with a swirling blue background and animated reveals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={togglePlay}>
            {playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
            {playing ? "Pause" : "Preview"}
          </Button>
          <Button onClick={exportVideo} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            Export 1080p
          </Button>
        </div>
      </div>

      {exporting && <Progress value={exportProgress} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4 lg:sticky lg:top-4 lg:z-10 lg:self-start">
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
            <span>
              {time.toFixed(1)}s / {timeline.total.toFixed(1)}s
            </span>
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
                <CardTitle className="text-base">Rounds</CardTitle>
                <CardDescription>Each round is one uploaded logo and its answer.</CardDescription>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setRounds((r) => [...r, emptyRound()])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add round
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {rounds.map((r, i) => (
                <div key={r.id} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Round {i + 1}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setRounds((rs) => rs.filter((x) => x.id !== r.id))}
                      disabled={rounds.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Logo</Label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                        <Upload className="h-4 w-4" />
                        {r.imgUrl ? "Replace logo" : "Upload logo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onImage(r.id, f);
                          }}
                        />
                      </label>
                      {r.imgUrl && (
                        <img
                          src={r.imgUrl}
                          alt={`Logo ${i + 1}`}
                          className="h-20 w-full rounded bg-white object-contain p-2"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Answer</Label>
                      <Input
                        value={r.answer}
                        placeholder="Nike"
                        onChange={(e) => setRound(r.id, { answer: e.target.value })}
                      />
                      <Label className="text-xs text-muted-foreground">
                        Duration · {r.duration.toFixed(1)}s
                      </Label>
                      <Slider
                        value={[r.duration]}
                        min={3}
                        max={15}
                        step={0.5}
                        onValueChange={([v]) => setRound(r.id, { duration: v })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Format & style</CardTitle>
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
              <div>
                <Label className="text-xs text-muted-foreground">Palette</Label>
                <Select value={paletteId} onValueChange={setPaletteId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PALETTES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input value={heading} onChange={(e) => setHeading(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Answer reveal · {revealSecs.toFixed(1)}s
                </Label>
                <Slider
                  value={[revealSecs]}
                  min={1}
                  max={5}
                  step={0.1}
                  onValueChange={([v]) => setRevealSecs(v)}
                />
              </div>
              <label className="flex items-center justify-between gap-2 text-sm">
                Timer bar <Switch checked={showTimer} onCheckedChange={setShowTimer} />
              </label>
            </CardContent>
          </Card>

          <ColorCustomiser base={basePalette} value={colors} onChange={setColors} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Background & timers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BackgroundPicker
                value={backgroundId}
                onChange={setBackgroundId}
                intensity={backgroundIntensity}
                onIntensityChange={setBackgroundIntensity}
              />
              <TimerStylePicker value={timerStyle} onChange={setTimerStyle} />
              <TimeBarStylePicker value={timeBarStyle} onChange={setTimeBarStyle} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Element layout</CardTitle>
              <CardDescription>Position, scale, rotation and visibility per element.</CardDescription>
            </CardHeader>
            <CardContent>
              <ElementStyleGroup items={ELEMENT_LIST} values={styles} onChange={setStyleFor} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Animations</CardTitle>
              <CardDescription>Entrance and looping motion per element.</CardDescription>
            </CardHeader>
            <CardContent>
              <AnimControlGroup items={ANIM_ELEMENTS} values={anims} onChange={setAnim} />
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
      </div>
    </div>
  );
}
