// Shared studio engine for the TikTok Videos section. Every template here is
// locked to 9:16 · 1080×1920 · 60fps and exports frame-by-frame through the
// WebCodecs pipeline in kid-export.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Download, Loader2, Pause, Play, Plus, Trash2, Volume2, Wand2 } from "lucide-react";

import {
  BACKGROUNDS,
  drawBackground,
  drawChannelLogo,
  drawRoundTransition,
  drawTimeBar,
  drawTimer,
  defaultChannelLogo,
  defaultRoundTransition,
  BackgroundPicker,
  ChannelLogoControls,
  RoundTransitionControls,
  TimerStylePicker,
  TimeBarStylePicker,
  type BackgroundId,
  type BgColors,
  type ChannelLogoSpec,
  type RoundTransitionSpec,
  type TimerStyleId,
  type TimeBarStyleId,
} from "@/lib/kid-elements";
import { KidAudioCard, defaultKidAudio, type KidAudioCue, type KidAudioSettings } from "@/lib/kid-audio";
import { recordKidCanvas, downloadKidVideo } from "@/lib/kid-export";
import { TTS_PROVIDERS, TTS_VOICES, generateSpeech, type TtsProvider } from "@/lib/tts";
import {
  TIKTOK_W,
  TIKTOK_H,
  TikTokFormatBadge,
  composeOfflineAudio,
  defaultTextStyle,
  drawCoverCached,
  loadImageFromFile,
  uid,
  TextBlockControls,
  type TextBlockStyle,
} from "@/lib/tiktok-shared";

export type TikTokKind = "wyr" | "ranking" | "facts";

type Item = {
  id: string;
  duration: number;
  revealAt: number;
  // Would you rather
  a: string;
  b: string;
  pctA: number;
  imgA: HTMLImageElement | null;
  imgB: HTMLImageElement | null;
  // Ranking / facts
  title: string;
  subtitle: string;
  img: HTMLImageElement | null;
  // Voiceover
  voText: string;
  voBlob: Blob | null;
  voUrl: string | null;
};

function newItem(kind: TikTokKind, index: number): Item {
  return {
    id: `${kind}-${index}`,
    duration: kind === "facts" ? 7 : 9,
    revealAt: kind === "facts" ? 2.5 : 6,
    a: index === 0 ? "Be able to fly" : "",
    b: index === 0 ? "Be invisible" : "",
    pctA: 62,
    imgA: null,
    imgB: null,
    title: kind === "ranking" ? `Pick #${index + 1}` : index === 0 ? "Did you know?" : "",
    subtitle: kind === "ranking" ? "98 pts" : "",
    img: null,
    voText: "",
    voBlob: null,
    voUrl: null,
  };
}

const KIND_COPY: Record<TikTokKind, { title: string; desc: string; header: string }> = {
  wyr: {
    title: "TikTok · Would You Rather",
    desc: "Vertical split-screen rounds with countdown and percentage reveal.",
    header: "WOULD YOU RATHER",
  },
  ranking: {
    title: "TikTok · Ranking Videos",
    desc: "Countdown rank reveals with images, labels and scores.",
    header: "TOP RANKING",
  },
  facts: {
    title: "TikTok · Fact Videos",
    desc: "Hook, fact and punchline cards with animated reveals.",
    header: "MIND-BLOWING FACTS",
  },
};

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${line} ${words[i]}`;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else line = next;
  }
  lines.push(line);
  return lines;
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  fontSize: number,
  color: string,
  weight = 800,
) {
  ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapLines(ctx, text, maxWidth);
  const lh = fontSize * 1.14;
  const startY = cy - ((lines.length - 1) * lh) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = fontSize * 0.28;
  ctx.fillStyle = color;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lh));
  ctx.restore();
  return lines.length * lh;
}

const easeOut = (p: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);

// ---------------------------------------------------------------------------

export function TikTokStudio({ kind }: { kind: TikTokKind }) {
  const copy = KIND_COPY[kind];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coverCache = useRef(new Map<string, HTMLCanvasElement>());
  const rafRef = useRef<number | null>(null);
  const startedAt = useRef(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const [items, setItems] = useState<Item[]>(() => [newItem(kind, 0), newItem(kind, 1), newItem(kind, 2)]);
  const [heading, setHeading] = useState(copy.header);
  const [background, setBackground] = useState<BackgroundId>(kind === "facts" ? "aurora-ribbons" : "spiral-sunburst");
  const [intensity, setIntensity] = useState(1);
  const [colors, setColors] = useState<BgColors>({
    bg: ["#160726", "#3b0764"],
    primary: "#ec4899",
    accent: "#22d3ee",
  });
  const [timerStyle, setTimerStyle] = useState<TimerStyleId>("neon-ring");
  const [timeBarStyle, setTimeBarStyle] = useState<TimeBarStyleId>(kind === "facts" ? "none" : "rounded");
  const [transition, setTransition] = useState<RoundTransitionSpec>(() => defaultRoundTransition({ id: "swipe-up" }));
  const [logo, setLogo] = useState<ChannelLogoSpec>(() => defaultChannelLogo({ visible: false }));
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [headingStyle, setHeadingStyle] = useState<TextBlockStyle>(() => defaultTextStyle({ size: 3.6, dy: -40 }));
  const [bodyStyle, setBodyStyle] = useState<TextBlockStyle>(() => defaultTextStyle({ size: 5.2 }));
  const [audio, setAudio] = useState<KidAudioSettings>(() => defaultKidAudio());

  const [provider, setProvider] = useState<TtsProvider>("elevenlabs");
  const [voice, setVoice] = useState(TTS_VOICES.elevenlabs[0].id);
  const [voBusy, setVoBusy] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const total = useMemo(() => items.reduce((sum, it) => sum + it.duration, 0), [items]);

  const starts = useMemo(() => {
    let acc = 0;
    return items.map((it) => {
      const s = acc;
      acc += it.duration;
      return s;
    });
  }, [items]);

  const patch = (id: string, next: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const W = TIKTOK_W;
      const H = TIKTOK_H;
      const clamped = Math.max(0, Math.min(total - 0.0001, t));
      let index = 0;
      for (let i = 0; i < items.length; i++) if (clamped >= starts[i]) index = i;
      const item = items[index];
      const local = clamped - starts[index];

      ctx.clearRect(0, 0, W, H);
      drawBackground(ctx, background, colors, W, H, clamped, intensity);

      const headFont = (headingStyle.size / 100) * H;
      const bodyFont = (bodyStyle.size / 100) * H;
      const headY = H * 0.14 + (headingStyle.dy / 100) * H;
      const headX = W / 2 + (headingStyle.dx / 100) * W;

      // Section heading
      if (heading.trim()) {
        ctx.save();
        ctx.font = `900 ${headFont}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tw = ctx.measureText(heading).width;
        const padX = headFont * 0.7;
        const bh = headFont * 1.7;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.roundRect(headX - tw / 2 - padX, headY - bh / 2, tw + padX * 2, bh, bh / 2);
        ctx.fill();
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = Math.max(2, headFont * 0.06);
        ctx.stroke();
        ctx.fillStyle = headingStyle.color;
        ctx.fillText(heading, headX, headY);
        ctx.restore();
      }

      const bodyCx = W / 2 + (bodyStyle.dx / 100) * W;
      const bodyCy = H / 2 + (bodyStyle.dy / 100) * H;
      const revealed = local >= item.revealAt;
      const revealP = easeOut((local - item.revealAt) / 0.6);
      const inP = easeOut(local / 0.5);

      if (kind === "wyr") {
        const gap = H * 0.012;
        const panelH = (H * 0.62 - gap) / 2;
        const top = bodyCy - H * 0.31;
        const panels: { text: string; img: HTMLImageElement | null; y: number; tint: string; pct: number }[] = [
          { text: item.a, img: item.imgA, y: top, tint: colors.primary, pct: item.pctA },
          { text: item.b, img: item.imgB, y: top + panelH + gap, tint: colors.accent, pct: 100 - item.pctA },
        ];
        panels.forEach((p, i) => {
          const slide = (1 - inP) * (i === 0 ? -1 : 1) * W * 0.5;
          ctx.save();
          ctx.translate(slide, 0);
          const x = W * 0.06;
          const w = W * 0.88;
          ctx.beginPath();
          ctx.roundRect(x, p.y, w, panelH, W * 0.05);
          ctx.clip();
          if (p.img) drawCoverCached(ctx, coverCache.current, p.img, x, p.y, w, panelH);
          else {
            const g = ctx.createLinearGradient(x, p.y, x + w, p.y + panelH);
            g.addColorStop(0, p.tint);
            g.addColorStop(1, "rgba(0,0,0,0.65)");
            ctx.fillStyle = g;
            ctx.fillRect(x, p.y, w, panelH);
          }
          ctx.fillStyle = "rgba(0,0,0,0.42)";
          ctx.fillRect(x, p.y, w, panelH);
          ctx.restore();

          ctx.save();
          ctx.translate(slide, 0);
          ctx.beginPath();
          ctx.roundRect(x, p.y, w, panelH, W * 0.05);
          ctx.strokeStyle = p.tint;
          ctx.lineWidth = W * 0.008;
          ctx.stroke();
          drawWrapped(ctx, p.text, bodyCx, p.y + panelH / 2, w * 0.84, bodyFont, bodyStyle.color);

          if (revealed) {
            const barH = panelH * 0.1;
            const barY = p.y + panelH - barH * 1.5;
            const barX = x + w * 0.08;
            const barW = w * 0.84;
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, barH / 2);
            ctx.fill();
            ctx.fillStyle = p.tint;
            ctx.beginPath();
            ctx.roundRect(barX, barY, Math.max(barH, barW * (p.pct / 100) * revealP), barH, barH / 2);
            ctx.fill();
            ctx.font = `900 ${barH * 0.78}px system-ui, sans-serif`;
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(`${Math.round(p.pct * revealP)}%`, barX + barW - barH * 0.4, barY + barH / 2);
          }
          ctx.restore();
        });

        // OR badge
        const orY = top + panelH + gap / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, orY, W * 0.075, 0, Math.PI * 2);
        ctx.fillStyle = "#0b0713";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = W * 0.006;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${W * 0.055}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("OR", W / 2, orY);
        ctx.restore();

        if (!revealed) {
          drawTimer(
            ctx,
            timerStyle,
            W / 2,
            H * 0.87,
            W * 0.11,
            item.revealAt - local,
            item.revealAt,
            { primary: colors.primary, accent: colors.accent, text: "#ffffff" },
            clamped,
          );
          drawTimeBar(
            ctx,
            timeBarStyle,
            W * 0.1,
            H * 0.955,
            W * 0.8,
            H * 0.016,
            1 - local / Math.max(0.001, item.revealAt),
            { primary: colors.primary, accent: colors.accent, text: "#ffffff" },
            clamped,
          );
        }
      } else if (kind === "ranking") {
        const cardW = W * 0.82;
        const cardH = H * 0.46;
        const cardX = (W - cardW) / 2;
        const cardY = bodyCy - cardH * 0.62;
        ctx.save();
        ctx.globalAlpha = inP;
        ctx.translate(0, (1 - inP) * H * 0.08);
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, W * 0.05);
        ctx.save();
        ctx.clip();
        if (item.img) drawCoverCached(ctx, coverCache.current, item.img, cardX, cardY, cardW, cardH);
        else {
          const g = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
          g.addColorStop(0, colors.primary);
          g.addColorStop(1, colors.accent);
          ctx.fillStyle = g;
          ctx.fillRect(cardX, cardY, cardW, cardH);
        }
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.restore();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = W * 0.007;
        ctx.stroke();

        // rank badge
        const rank = items.length - index;
        const br = W * 0.11;
        ctx.beginPath();
        ctx.arc(cardX + br * 0.85, cardY + br * 0.85, br, 0, Math.PI * 2);
        ctx.fillStyle = colors.primary;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = W * 0.006;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${br * 0.95}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`#${rank}`, cardX + br * 0.85, cardY + br * 0.85);
        ctx.restore();

        drawWrapped(ctx, item.title, bodyCx, cardY + cardH + H * 0.06, W * 0.84, bodyFont, bodyStyle.color);
        if (revealed && item.subtitle) {
          ctx.save();
          ctx.globalAlpha = revealP;
          const sf = bodyFont * 0.72;
          ctx.font = `800 ${sf}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const tw = ctx.measureText(item.subtitle).width;
          const bw = tw + sf * 1.4;
          const by = cardY + cardH + H * 0.13;
          ctx.fillStyle = colors.accent;
          ctx.beginPath();
          ctx.roundRect(bodyCx - bw / 2, by - sf, bw, sf * 2, sf);
          ctx.fill();
          ctx.fillStyle = "#0b0713";
          ctx.fillText(item.subtitle, bodyCx, by);
          ctx.restore();
        }
        if (!revealed) {
          drawTimeBar(
            ctx,
            timeBarStyle,
            W * 0.1,
            H * 0.955,
            W * 0.8,
            H * 0.016,
            1 - local / Math.max(0.001, item.revealAt),
            { primary: colors.primary, accent: colors.accent, text: "#ffffff" },
            clamped,
          );
        }
      } else {
        // facts
        const cardW = W * 0.86;
        const cardH = H * 0.5;
        const cardX = (W - cardW) / 2;
        const cardY = bodyCy - cardH / 2;
        ctx.save();
        ctx.globalAlpha = inP;
        ctx.translate(0, (1 - inP) * H * 0.05);
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, W * 0.06);
        ctx.save();
        ctx.clip();
        if (item.img) drawCoverCached(ctx, coverCache.current, item.img, cardX, cardY, cardW, cardH);
        ctx.fillStyle = item.img ? "rgba(6,3,14,0.66)" : "rgba(6,3,14,0.55)";
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.restore();
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = W * 0.006;
        ctx.stroke();

        const nf = W * 0.05;
        ctx.font = `900 ${nf}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = colors.primary;
        ctx.fillText(`FACT #${index + 1}`, W / 2, cardY + nf * 1.6);

        drawWrapped(ctx, item.title, bodyCx, cardY + cardH * 0.44, cardW * 0.84, bodyFont, bodyStyle.color);
        if (revealed && item.subtitle) {
          ctx.save();
          ctx.globalAlpha = revealP;
          ctx.translate(0, (1 - revealP) * H * 0.03);
          drawWrapped(
            ctx,
            item.subtitle,
            bodyCx,
            cardY + cardH * 0.78,
            cardW * 0.84,
            bodyFont * 0.62,
            colors.accent,
            700,
          );
          ctx.restore();
        }
        ctx.restore();
      }

      // Transition overlay between items
      const tr = transition.duration;
      if (tr > 0 && index < items.length - 1) {
        const untilEnd = item.duration - local;
        if (untilEnd < tr / 2) drawRoundTransition(ctx, transition, 0.5 - untilEnd / tr, W, H);
      }
      if (tr > 0 && index > 0 && local < tr / 2) {
        drawRoundTransition(ctx, transition, 0.5 + (tr / 2 - local) / tr, W, H);
      }

      drawChannelLogo(ctx, logoImg, logo, W, H, clamped);
    },
    [
      items,
      starts,
      total,
      background,
      colors,
      intensity,
      heading,
      headingStyle,
      bodyStyle,
      kind,
      timerStyle,
      timeBarStyle,
      transition,
      logo,
      logoImg,
    ],
  );

  // Paint whenever anything changes (and while playing)
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawFrame(ctx, time);
  }, [drawFrame, time]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    startedAt.current = performance.now() - time * 1000;
    const tick = () => {
      const t = (performance.now() - startedAt.current) / 1000;
      if (t >= total) {
        setTime(0);
        setPlaying(false);
        return;
      }
      setTime(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, total]);

  // Voiceover preview during playback
  useEffect(() => {
    if (!playing) {
      audioElRef.current?.pause();
      return;
    }
    let index = 0;
    for (let i = 0; i < items.length; i++) if (time >= starts[i]) index = i;
    const url = items[index]?.voUrl;
    const el = audioElRef.current;
    if (!el) return;
    if (!url) {
      el.pause();
      return;
    }
    if (el.dataset["src"] !== url) {
      el.dataset["src"] = url;
      el.src = url;
      el.currentTime = Math.max(0, time - starts[index]);
      void el.play().catch(() => undefined);
    }
  }, [playing, time, items, starts]);

  const cues = useMemo<KidAudioCue[]>(() => {
    const out: KidAudioCue[] = [];
    items.forEach((it, i) => {
      out.push({ kind: i === 0 ? "start" : "transition", time: starts[i] });
      out.push({ kind: "reveal", time: starts[i] + it.revealAt });
    });
    return out;
  }, [items, starts]);

  const generateVo = async (item: Item) => {
    const text = item.voText.trim() || [item.title, item.a, item.b, item.subtitle].filter(Boolean).join(". ");
    if (!text) {
      toast.error("Add some text for the voiceover first.");
      return;
    }
    setVoBusy(item.id);
    try {
      const { url, blob } = await generateSpeech(text, { provider, voice });
      patch(item.id, { voUrl: url, voBlob: blob });
      toast.success("Voiceover ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Voiceover failed");
    } finally {
      setVoBusy(null);
    }
  };

  const onExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;
    setPlaying(false);
    setExporting(true);
    setProgress(0);
    try {
      const audioBuffer = await composeOfflineAudio({
        totalDuration: total,
        voiceovers: items.map((it, i) => ({ blob: it.voBlob, at: starts[i] })),
        audio,
        cues,
      });
      const { blob, extension } = await recordKidCanvas({
        canvas,
        duration: total,
        drawFrame,
        fps: 60,
        audioBuffer,
        onProgress: setProgress,
      });
      downloadKidVideo(blob, `tiktok-${kind}`, extension);
      toast.success("Export complete — 1080×1920 at 60fps");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  const itemLabel = kind === "wyr" ? "Round" : kind === "ranking" ? "Entry" : "Fact";

  return (
    <div className="grid h-screen grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* Preview */}
      <div className="flex min-h-0 flex-col gap-3 lg:sticky lg:top-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{copy.title}</h1>
            <p className="text-xs text-muted-foreground">{copy.desc}</p>
          </div>
          <TikTokFormatBadge />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border bg-black/40 p-3">
          <canvas
            ref={canvasRef}
            width={TIKTOK_W}
            height={TIKTOK_H}
            className="h-full max-h-full w-auto max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Slider
            value={[Math.min(time, total)]}
            min={0}
            max={Math.max(0.1, total)}
            step={1 / 60}
            onValueChange={([v]) => {
              setPlaying(false);
              setTime(v);
            }}
            className="flex-1"
          />
          <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
            {time.toFixed(2)}s / {total.toFixed(2)}s
          </span>
          <Button size="sm" onClick={onExport} disabled={exporting || total <= 0}>
            {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            {exporting ? `${Math.round(progress * 100)}%` : "Export"}
          </Button>
        </div>
        <audio ref={audioElRef} className="hidden" />
      </div>

      {/* Settings */}
      <div className="min-h-0 space-y-4 overflow-y-auto pr-1 lg:overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{itemLabel}s</CardTitle>
            <CardDescription>Every {itemLabel.toLowerCase()} adds to the total video length.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-[11px] text-muted-foreground">Heading</Label>
              <Input value={heading} onChange={(e) => setHeading(e.target.value)} />
            </div>
            {items.map((item, i) => (
              <div key={item.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    {itemLabel} {i + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                    disabled={items.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {kind === "wyr" ? (
                  <>
                    <Input
                      placeholder="Option A"
                      defaultValue={item.a}
                      onBlur={(e) => patch(item.id, { a: e.target.value })}
                    />
                    <Input
                      placeholder="Option B"
                      defaultValue={item.b}
                      onBlur={(e) => patch(item.id, { b: e.target.value })}
                    />
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Option A share · {item.pctA}%</Label>
                      <Slider
                        value={[item.pctA]}
                        min={1}
                        max={99}
                        step={1}
                        onValueChange={([v]) => patch(item.id, { pctA: v })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(["imgA", "imgB"] as const).map((key) => (
                        <div key={key}>
                          <Label className="text-[11px] text-muted-foreground">
                            Image {key === "imgA" ? "A" : "B"}
                          </Label>
                          <Input
                            type="file"
                            accept="image/*"
                            className="h-8 text-xs"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) loadImageFromFile(file, (img) => patch(item.id, { [key]: img }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <Textarea
                      placeholder={kind === "ranking" ? "Entry name" : "The fact"}
                      defaultValue={item.title}
                      rows={2}
                      onBlur={(e) => patch(item.id, { title: e.target.value })}
                    />
                    <Input
                      placeholder={kind === "ranking" ? "Score / stat" : "Punchline (revealed later)"}
                      defaultValue={item.subtitle}
                      onBlur={(e) => patch(item.id, { subtitle: e.target.value })}
                    />
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Image</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        className="h-8 text-xs"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) loadImageFromFile(file, (img) => patch(item.id, { img }));
                        }}
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Length · {item.duration.toFixed(1)}s</Label>
                    <Slider
                      value={[item.duration]}
                      min={2}
                      max={20}
                      step={0.5}
                      onValueChange={([v]) =>
                        patch(item.id, { duration: v, revealAt: Math.min(item.revealAt, v - 0.5) })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Reveal at · {item.revealAt.toFixed(1)}s</Label>
                    <Slider
                      value={[item.revealAt]}
                      min={0.5}
                      max={Math.max(1, item.duration - 0.5)}
                      step={0.5}
                      onValueChange={([v]) => patch(item.id, { revealAt: v })}
                    />
                  </div>
                </div>

                <Separator />
                <Label className="text-[11px] text-muted-foreground">Voiceover script</Label>
                <Textarea
                  rows={2}
                  placeholder="Leave empty to narrate the text above"
                  defaultValue={item.voText}
                  onBlur={(e) => patch(item.id, { voText: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => generateVo(item)} disabled={voBusy === item.id}>
                    {voBusy === item.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1 h-3.5 w-3.5" />
                    )}
                    Generate voiceover
                  </Button>
                  {item.voUrl && <Volume2 className="h-4 w-4 text-emerald-500" />}
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setItems((prev) => [...prev, newItem(kind, prev.length + Date.now() % 1000)])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add {itemLabel.toLowerCase()}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voice</CardTitle>
            <CardDescription>Pick the provider and voice used for every generated line.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  const p = v as TtsProvider;
                  setProvider(p);
                  setVoice(TTS_VOICES[p][0].id);
                }}
              >
                <SelectTrigger className="h-9">
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
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Voice</Label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TTS_VOICES[provider].map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Look</CardTitle>
            <CardDescription>Background, colours, timers and transitions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <BackgroundPicker
              value={background}
              onChange={setBackground}
              intensity={intensity}
              onIntensityChange={setIntensity}
            />
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["Top", 0],
                  ["Bottom", 1],
                ] as const
              ).map(([label, i]) => (
                <div key={label}>
                  <Label className="text-[11px] text-muted-foreground">{label}</Label>
                  <input
                    type="color"
                    value={colors.bg[i]}
                    onChange={(e) => {
                      const bg: [string, string] = [...colors.bg];
                      bg[i] = e.target.value;
                      setColors({ ...colors, bg });
                    }}
                    className="h-8 w-full cursor-pointer rounded border bg-transparent"
                  />
                </div>
              ))}
              <div>
                <Label className="text-[11px] text-muted-foreground">Primary</Label>
                <input
                  type="color"
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded border bg-transparent"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Accent</Label>
                <input
                  type="color"
                  value={colors.accent}
                  onChange={(e) => setColors({ ...colors, accent: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded border bg-transparent"
                />
              </div>
            </div>
            <TextBlockControls label="Heading text" value={headingStyle} onChange={setHeadingStyle} />
            <TextBlockControls label="Body text" value={bodyStyle} onChange={setBodyStyle} />
            <TimerStylePicker value={timerStyle} onChange={setTimerStyle} />
            <TimeBarStylePicker value={timeBarStyle} onChange={setTimeBarStyle} />
            <RoundTransitionControls value={transition} onChange={setTransition} />
            <Separator />
            <ChannelLogoControls value={logo} onChange={setLogo} />
            <div>
              <Label className="text-[11px] text-muted-foreground">Channel logo image</Label>
              <Input
                type="file"
                accept="image/*"
                className="h-8 text-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) loadImageFromFile(file, (img) => setLogoImg(img));
                }}
              />
            </div>
          </CardContent>
        </Card>

        <KidAudioCard value={audio} onChange={setAudio} />
        <div className="h-6" />
      </div>
    </div>
  );
}

export default TikTokStudio;
export { uid, BACKGROUNDS };
