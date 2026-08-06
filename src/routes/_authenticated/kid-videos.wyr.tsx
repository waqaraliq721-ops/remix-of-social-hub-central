import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Split,
  Upload,
  Play,
  Pause,
  Download,
  Loader2,
  Trash2,
  Plus,
  Wand2,
  Shuffle,
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
  TTS_PROVIDERS,
  TTS_VOICES,
  generateSpeech,
  blobDuration,
  type TtsProvider,
} from "@/lib/tts";
import {
  FX_FONT,
  FX_PALETTES,
  INTRO_ANIMATIONS,
  OUTRO_ANIMATIONS,
  fitText,
  hexA,
  roundRect,
  wrapText,
  ease,
} from "@/lib/video-fx";
import {
  IntroOutroCard,
  defaultIntro,
  defaultOutro,
  paletteOf,
  type CardConfig,
} from "@/components/intro-outro-card";
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
  type ElementStyleSpec,
  drawBackground,
  BackgroundPicker,
  type BackgroundId,
  drawTimer,
  TimerStylePicker,
  type TimerStyleId,
  drawTimeBar,
  TimeBarStylePicker,
  type TimeBarStyleId,
  type ChannelLogoSpec,
  defaultChannelLogo,
  drawChannelLogo,
  ChannelLogoControls,
  type RoundBadgeId,
  drawRoundBadge,
  RoundBadgePicker,
  type RoundTransitionSpec,
  defaultRoundTransition,
  drawRoundTransition,
  roundTransitionCoverage,
  RoundTransitionControls,
} from "@/lib/kid-elements";

export const Route = createFileRoute("/_authenticated/kid-videos/wyr")({
  head: () => ({
    meta: [
      { title: "Would You Rather Videos — Orbit" },
      {
        name: "description",
        content:
          "Build TikTok-style Would You Rather videos: split-screen images, custom choices, AI voiceover from ElevenLabs, Google or Lovable AI, countdown timers and 1080p export.",
      },
      { property: "og:title", content: "Would You Rather Videos — Orbit" },
      {
        property: "og:description",
        content:
          "Split-screen WYR videos with AI voiceover, countdown timers and full customisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WyrPage,
});

type AspectKey = "9:16" | "1:1" | "16:9" | "16:9-hq" | "16:9-uhd";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · TikTok/Reels/Shorts" },
  "1:1": { w: 1080, h: 1080, label: "Square · Feed" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
  "16:9-hq": { w: 1920, h: 1080, label: "16:9 HQ · Quiz-show layout" },
  "16:9-uhd": { w: 1920, h: 1080, label: "ULTRA HD Vid · Sunburst quiz show" },
};

const ANIM_ELEMENTS: { key: string; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "title", label: "Heading" },
  { key: "imageA", label: "Option A image" },
  { key: "imageB", label: "Option B image" },
  { key: "labelA", label: "Option A text" },
  { key: "labelB", label: "Option B text" },
  { key: "timer", label: "Timer" },
  { key: "timebar", label: "Time bar" },
  { key: "roundNo", label: "Round numbering" },
  { key: "badge", label: "VS / badges" },
];

const STYLE_ELEMENTS: { key: string; label: string }[] = [
  { key: "title", label: "Heading" },
  { key: "imageA", label: "Option A card" },
  { key: "imageB", label: "Option B card" },
  { key: "labelA", label: "Option A text" },
  { key: "labelB", label: "Option B text" },
  { key: "timer", label: "Timer" },
  { key: "timebar", label: "Time bar" },
  { key: "roundNo", label: "Round numbering" },
  { key: "badge", label: "VS / badges" },
];

function defaultStyleMap(): Record<string, ElementStyleSpec> {
  return {
    title: defaultStyle(),
    imageA: defaultStyle(),
    imageB: defaultStyle(),
    labelA: defaultStyle(),
    labelB: defaultStyle(),
    timer: defaultStyle(),
    timebar: defaultStyle(),
    roundNo: defaultStyle(),
    badge: defaultStyle(),
  };
}

function defaultAnimMap(): Record<string, ElementAnimSpec> {
  return {
    background: defaultAnim({ preset: "none", loop: "none" }),
    title: defaultAnim({ preset: "slide-down", duration: 0.5, loop: "none" }),
    imageA: defaultAnim({ preset: "slide-left", duration: 0.55 }),
    imageB: defaultAnim({ preset: "slide-right", duration: 0.55 }),
    labelA: defaultAnim({ preset: "pop", delay: 0.15 }),
    labelB: defaultAnim({ preset: "pop", delay: 0.2 }),
    timer: defaultAnim({ preset: "zoom-in", loop: "pulse", intensity: 0.6 }),
    timebar: defaultAnim({ preset: "fade", duration: 0.3 }),
    roundNo: defaultAnim({ preset: "fade", loop: "none" }),
    badge: defaultAnim({ preset: "bounce-in", duration: 0.6, loop: "float", intensity: 0.5 }),
  };
}

type Round = {
  id: string;
  textA: string;
  textB: string;
  urlA: string | null;
  urlB: string | null;
  imgA: HTMLImageElement | null;
  imgB: HTMLImageElement | null;
  script: string;
  voUrl: string | null;
  voBlob: Blob | null;
  voDur: number;
  pctA: number;
};

type StyleId = "classic" | "neon" | "glass" | "comic" | "minimal" | "arcade";
const STYLES: { id: StyleId; name: string; desc: string }[] = [
  { id: "classic", name: "Classic Split", desc: "Bold split with red/blue tint and VS badge." },
  { id: "neon", name: "Neon Arena", desc: "Glowing outlines, dark seam and neon type." },
  { id: "glass", name: "Glass Cards", desc: "Frosted rounded cards floating over the images." },
  { id: "comic", name: "Comic Punch", desc: "Heavy outlines, tilted labels, halftone energy." },
  { id: "minimal", name: "Editorial", desc: "Clean type, thin rules, no tint." },
  { id: "arcade", name: "Arcade", desc: "Pixel-ish frames, scanlines and a big timer." },
];

const SIDE_COLORS: { id: string; name: string; a: string; b: string }[] = [
  { id: "redblue", name: "Red / Blue", a: "#ef4444", b: "#3b82f6" },
  { id: "violet", name: "Violet / Cyan", a: "#a855f7", b: "#06b6d4" },
  { id: "lime", name: "Lime / Magenta", a: "#84cc16", b: "#ec4899" },
  { id: "amber", name: "Amber / Teal", a: "#f59e0b", b: "#14b8a6" },
  { id: "mono", name: "Mono", a: "#ffffff", b: "#9ca3af" },
];

const uid = () => Math.random().toString(36).slice(2, 9);

function emptyRound(): Round {
  return {
    id: uid(),
    textA: "",
    textB: "",
    urlA: null,
    urlB: null,
    imgA: null,
    imgB: null,
    script: "",
    voUrl: null,
    voBlob: null,
    voDur: 0,
    pctA: 50,
  };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1,
) {
  const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * ratio;
  const dh = img.naturalHeight * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function WyrPage() {
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [style, setStyle] = useState<StyleId>("classic");
  const [sideColor, setSideColor] = useState(SIDE_COLORS[0].id);
  const [rounds, setRounds] = useState<Round[]>([emptyRound()]);
  const [heading, setHeading] = useState("Would you rather…");
  const [timerSecs, setTimerSecs] = useState(5);
  const [showTimer, setShowTimer] = useState(true);
  const [showVs, setShowVs] = useState(true);
  const [showPct, setShowPct] = useState(false);
  const [tint, setTint] = useState(0.35);
  const [zoom, setZoom] = useState(1.04);
  const [uppercase, setUppercase] = useState(true);
  const [anims, setAnims] = useState<Record<string, ElementAnimSpec>>(defaultAnimMap());
  const setAnim = (key: string, spec: ElementAnimSpec) =>
    setAnims((a) => ({ ...a, [key]: spec }));
  const [styles, setStyles] = useState<Record<string, ElementStyleSpec>>(defaultStyleMap());
  const setElStyle = (key: string, spec: ElementStyleSpec) =>
    setStyles((s) => ({ ...s, [key]: spec }));
  const [background, setBackground] = useState<BackgroundId>("gradient");
  const [bgIntensity, setBgIntensity] = useState(1);
  const [timerStyle, setTimerStyle] = useState<TimerStyleId>("ring");
  const [timebarStyle, setTimebarStyle] = useState<TimeBarStyleId>("thin");
  const [showHeading, setShowHeading] = useState(true);
  const [sideLabel, setSideLabel] = useState("QUIZ BLITZ");
  const [showSideLabel, setShowSideLabel] = useState(true);
  const [channelLogo, setChannelLogo] = useState<ChannelLogoSpec>(defaultChannelLogo());
  const [channelLogoUrl, setChannelLogoUrl] = useState<string | null>(null);
  const [channelLogoImg, setChannelLogoImg] = useState<HTMLImageElement | null>(null);
  const [roundBadgeStyle, setRoundBadgeStyle] = useState<RoundBadgeId>("pill");
  const [roundTransition, setRoundTransition] = useState<RoundTransitionSpec>(defaultRoundTransition());
  // ULTRA HD Vid layout specific controls
  const [uhdLogoMode, setUhdLogoMode] = useState<"image" | "emoji">("emoji");
  const [uhdLogoEmoji, setUhdLogoEmoji] = useState("⚡");
  const [uhdRiderEmoji, setUhdRiderEmoji] = useState("🏃");
  const [showUhdRider, setShowUhdRider] = useState(true);
  const [sideLabelColor, setSideLabelColor] = useState("#ffffff");

  const onChannelLogo = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setChannelLogoImg(img);
    img.src = url;
    setChannelLogoUrl(url);
  };

  const [provider, setProvider] = useState<TtsProvider>("elevenlabs");
  const [voice, setVoice] = useState(TTS_VOICES.elevenlabs[0].id);
  const [voStyle, setVoStyle] = useState("Say it with hype, like a TikTok narrator");
  const [generating, setGenerating] = useState(false);

  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, title: "Would You Rather" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, title: "Comment your pick" });

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const timeRef = useRef(0);
  const lastRef = useRef(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const playedRef = useRef<Set<string>>(new Set());

  const dims = ASPECTS[aspect];
  const colors = SIDE_COLORS.find((c) => c.id === sideColor) ?? SIDE_COLORS[0];

  const roundDur = useCallback(
    (r: Round) => Math.max(timerSecs + 1.2, (r.voDur || 0) + timerSecs * 0.6 + 0.8),
    [timerSecs],
  );

  const timeline = useMemo(() => {
    let t = intro.id !== "none" ? intro.seconds : 0;
    const segs = rounds.map((r, index) => {
      const start = t;
      const dur = roundDur(r);
      t += dur;
      return { round: r, start, dur, index };
    });
    const outroStart = t;
    const total = t + (outro.id !== "none" ? outro.seconds : 0);
    return { segs, outroStart, total, introEnd: intro.id !== "none" ? intro.seconds : 0 };
  }, [rounds, roundDur, intro, outro]);

  const setRound = (id: string, patch: Partial<Round>) =>
    setRounds((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const onImage = (id: string, side: "A" | "B", file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      setRound(id, side === "A" ? { urlA: url, imgA: img } : { urlB: url, imgB: img });
    img.src = url;
  };

  // ---------------- rendering ----------------

  const drawRound = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      r: Round,
      local: number,
      dur: number,
      roundIndex = 0,
    ) => {
      const vertical = aspect !== "16:9" && aspect !== "16:9-hq";
      const halfW = vertical ? w : w / 2;
      const halfH = vertical ? h / 2 : h;
      const seam = Math.max(4, (vertical ? h : w) * 0.005);

      const intro01 = ease.out(Math.min(1, local / 0.45));
      const sides: { img: HTMLImageElement | null; text: string; color: string; x: number; y: number; dir: number }[] = [
        { img: r.imgA, text: r.textA, color: colors.a, x: 0, y: 0, dir: -1 },
        {
          img: r.imgB,
          text: r.textB,
          color: colors.b,
          x: vertical ? 0 : w / 2,
          y: vertical ? h / 2 : 0,
          dir: 1,
        },
      ];

      sides.forEach((s, i) => {
        const imgKey = i === 0 ? "imageA" : "imageB";
        const imgStyle = styles[imgKey] ?? defaultStyle();
        if (!imgStyle.visible) return;
        ctx.save();
        const imgAnim = computeAnim(anims[imgKey] ?? defaultAnim(), local);
        ctx.beginPath();
        ctx.rect(s.x, s.y, halfW, halfH);
        ctx.clip();
        applyStyle(ctx, imgStyle, s.x + halfW / 2, s.y + halfH / 2, w, h);
        applyAnim(ctx, imgAnim, s.x + halfW / 2, s.y + halfH / 2);
        const slide = (1 - intro01) * (vertical ? halfH : halfW) * 0.25 * s.dir;
        ctx.translate(vertical ? 0 : slide, vertical ? slide : 0);
        if (s.img) {
          drawCover(ctx, s.img, s.x, s.y, halfW, halfH, zoom + local * 0.01);
        } else {
          const g = ctx.createLinearGradient(s.x, s.y, s.x + halfW, s.y + halfH);
          g.addColorStop(0, hexA(s.color, 0.35));
          g.addColorStop(1, "#0b0b0f");
          ctx.fillStyle = g;
          ctx.fillRect(s.x, s.y, halfW, halfH);
        }
        // tint
        if (style !== "minimal") {
          ctx.fillStyle = hexA(s.color, tint * 0.55);
          ctx.fillRect(s.x, s.y, halfW, halfH);
        }
        ctx.fillStyle = `rgba(0,0,0,${0.18 + tint * 0.3})`;
        ctx.fillRect(s.x, s.y, halfW, halfH);
        ctx.restore();

        // choice label
        const cx = s.x + halfW / 2;
        const cy = s.y + halfH * (vertical ? (i === 0 ? 0.58 : 0.42) : 0.5);
        const label = uppercase ? s.text.toUpperCase() : s.text;
        if (!label) return;
        const labelKey = i === 0 ? "labelA" : "labelB";
        const labelStyle = styles[labelKey] ?? defaultStyle();
        if (!labelStyle.visible) return;
        const labelAnim = computeAnim(anims[labelKey] ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, labelStyle, cx, cy, w, h);
        applyAnim(ctx, labelAnim, cx, cy);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const base = Math.round(Math.min(halfW, halfH) * (vertical ? 0.11 : 0.14));
        fitText(ctx, label, halfW * 0.86, base, 900);
        const size = parseInt(ctx.font, 10);
        const rows = wrapText(ctx, label, halfW * 0.86);
        const boxH = rows.length * size * 1.12;

        if (style === "glass") {
          ctx.fillStyle = "rgba(10,10,14,0.42)";
          roundRect(ctx, cx - halfW * 0.44, cy - boxH / 2 - size * 0.5, halfW * 0.88, boxH + size, size * 0.4);
          ctx.fill();
          ctx.strokeStyle = hexA(s.color, 0.8);
          ctx.lineWidth = Math.max(2, size * 0.04);
          ctx.stroke();
        }
        if (style === "arcade") {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = Math.max(3, size * 0.06);
          ctx.strokeRect(cx - halfW * 0.44, cy - boxH / 2 - size * 0.4, halfW * 0.88, boxH + size * 0.8);
        }

        let y = cy - (boxH - size * 1.12) / 2;
        for (const row of rows) {
          if (style === "comic") {
            ctx.lineWidth = size * 0.16;
            ctx.strokeStyle = "#000";
            ctx.lineJoin = "round";
            ctx.strokeText(row, cx, y);
          } else if (style === "neon") {
            ctx.shadowColor = s.color;
            ctx.shadowBlur = size * 0.55;
          } else {
            ctx.shadowColor = "rgba(0,0,0,0.75)";
            ctx.shadowBlur = size * 0.3;
          }
          ctx.fillStyle = style === "minimal" ? "#fff" : "#ffffff";
          ctx.fillText(row, cx, y);
          ctx.shadowBlur = 0;
          y += size * 1.12;
        }

        // accent underline
        if (style === "classic" || style === "minimal") {
          ctx.fillStyle = s.color;
          ctx.fillRect(cx - halfW * 0.12, y - size * 0.35, halfW * 0.24, Math.max(3, size * 0.06));
        }
        ctx.restore();
      });

      // seam
      ctx.fillStyle = style === "neon" ? hexA("#ffffff", 0.9) : "#0b0b0f";
      if (vertical) ctx.fillRect(0, h / 2 - seam / 2, w, seam);
      else ctx.fillRect(w / 2 - seam / 2, 0, seam, h);

      // heading
      const titleStyle = styles.title ?? defaultStyle();
      if (heading && showHeading && titleStyle.visible) {
        const titleAnim = computeAnim(anims.title ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, titleStyle, w / 2, h * 0.045, w, h);
        applyAnim(ctx, titleAnim, w / 2, h * 0.045);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const hs = Math.round(h * 0.032);
        ctx.font = `800 ${hs}px ${FX_FONT}`;
        const pad = hs * 0.7;
        const tw = ctx.measureText(heading.toUpperCase()).width;
        ctx.globalAlpha *= intro01;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(ctx, w / 2 - tw / 2 - pad, h * 0.045 - hs * 0.9, tw + pad * 2, hs * 1.8, hs);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(heading.toUpperCase(), w / 2, h * 0.045);
        ctx.restore();
      }

      // VS badge
      const badgeStyle = styles.badge ?? defaultStyle();
      if (showVs && badgeStyle.visible) {
        const cx = vertical ? w / 2 : w / 2;
        const cy = vertical ? h / 2 : h / 2;
        const rr = Math.min(w, h) * 0.085;
        const pop = ease.back(Math.min(1, local / 0.5));
        const badgeAnim = computeAnim(anims.badge ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, badgeStyle, cx, cy, w, h);
        applyAnim(ctx, badgeAnim, cx, cy);
        ctx.translate(cx, cy);
        ctx.scale(pop, pop);
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.fillStyle = "#0b0b0f";
        ctx.fill();
        ctx.lineWidth = Math.max(3, rr * 0.08);
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.round(rr * 0.85)}px ${FX_FONT}`;
        ctx.fillText("VS", 0, rr * 0.03);
        ctx.restore();
      }

      // timer
      const timerStyleSpec = styles.timer ?? defaultStyle();
      if (showTimer && timerStyleSpec.visible) {
        const left = Math.max(0, Math.min(timerSecs, dur - local));
        const rr = Math.min(w, h) * 0.06;
        const cx = w - rr * 1.8;
        const cy = h - rr * 1.8;
        const timerAnim = computeAnim(anims.timer ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, timerStyleSpec, cx, cy, w, h);
        applyAnim(ctx, timerAnim, cx, cy);
        drawTimer(ctx, timerStyle, cx, cy, rr, left, timerSecs, { primary: colors.a, accent: "#ef4444", text: "#ffffff" }, local);
        ctx.restore();
      }

      // time bar
      const timebarStyleSpec = styles.timebar ?? defaultStyle();
      if (timebarStyleSpec.visible) {
        const barW = w * 0.86;
        const barH = Math.max(6, h * 0.012);
        const barX = (w - barW) / 2;
        const barY = h - barH * 2.4;
        const guessDur2 = Math.min(timerSecs, dur);
        const frac2 = Math.max(0, Math.min(1, 1 - local / Math.max(0.01, guessDur2)));
        const timebarAnim = computeAnim(anims.timebar ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, timebarStyleSpec, barX + barW / 2, barY + barH / 2, w, h);
        applyAnim(ctx, timebarAnim, barX + barW / 2, barY + barH / 2);
        drawTimeBar(ctx, timebarStyle, barX, barY, barW, barH, frac2, { primary: colors.a, accent: colors.b, text: "#ffffff" }, local);
        ctx.restore();
      }

      // round numbering
      const roundNoStyle = styles.roundNo ?? defaultStyle();
      if (roundNoStyle.visible) {
        const roundAnim = computeAnim(anims.roundNo ?? defaultAnim(), local);
        const rcx = Math.min(w, h) * 0.09;
        const rcy = Math.min(w, h) * 0.09;
        ctx.save();
        applyStyle(ctx, roundNoStyle, rcx, rcy, w, h);
        applyAnim(ctx, roundAnim, rcx, rcy);
        drawRoundBadge(
          ctx,
          roundBadgeStyle,
          `#${roundIndex + 1}`,
          rcx,
          rcy,
          Math.min(w, h) * 0.024,
          { primary: colors.a, accent: colors.b, text: "#ffffff" },
        );
        ctx.restore();
      }

      // channel logo
      drawChannelLogo(ctx, channelLogoImg, channelLogo, w, h, local);

      // percentage reveal after the timer finishes
      if (showPct && local >= timerSecs) {
        const k = ease.out(Math.min(1, (local - timerSecs) / 0.8));
        const label = (pct: number) => `${Math.round(pct)}%`;
        ctx.save();
        ctx.globalAlpha = k;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.round(Math.min(w, h) * 0.09)}px ${FX_FONT}`;
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 20;
        if (aspect === "16:9") {
          ctx.fillText(label(r.pctA), w * 0.25, h * 0.82);
          ctx.fillText(label(100 - r.pctA), w * 0.75, h * 0.82);
        } else {
          ctx.fillText(label(r.pctA), w * 0.5, h * 0.2);
          ctx.fillText(label(100 - r.pctA), w * 0.5, h * 0.8);
        }
        ctx.restore();
      }


      // scanlines for arcade
      if (style === "arcade") {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 2);
      }
    },
    [
      aspect,
      colors,
      heading,
      showHeading,
      showPct,
      showTimer,
      showVs,
      style,
      timerSecs,
      tint,
      uppercase,
      zoom,
      anims,
      styles,
      timerStyle,
      timebarStyle,
      roundBadgeStyle,
      channelLogo,
      channelLogoImg,
    ],
  );

  const drawRoundHQ = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      r: Round,
      local: number,
      dur: number,
      absT: number,
      roundIndex = 0,
    ) => {
      drawBackground(
        ctx,
        background,
        { bg: ["#1e0b4e", "#0b0a2e"], primary: colors.a, accent: colors.b },
        w,
        h,
        absT,
        bgIntensity,
      );
      const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.85);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);

      const intro01 = ease.out(Math.min(1, local / 0.45));
      const M = h * 0.06;

      // side text (editable)
      if (showSideLabel && sideLabel) {
        ctx.save();
        ctx.font = `900 ${Math.round(h * 0.03)}px ${FX_FONT}`;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.translate(M * 0.55, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(sideLabel.toUpperCase(), 0, 0);
        ctx.restore();
        ctx.save();
        ctx.translate(w - M * 0.55, h / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(sideLabel.toUpperCase(), 0, 0);
        ctx.restore();
        ctx.restore();
      }

      // round badge top-left
      const roundNoStyleHQ = styles.roundNo ?? defaultStyle();
      if (roundNoStyleHQ.visible) {
        const roundAnim = computeAnim(anims.roundNo ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, roundNoStyleHQ, M + h * 0.05, M + h * 0.05, w, h);
        applyAnim(ctx, roundAnim, M + h * 0.05, M + h * 0.05);
        drawRoundBadge(
          ctx,
          roundBadgeStyle,
          `#${roundIndex + 1}`,
          M + h * 0.05,
          M + h * 0.05,
          h * 0.032,
          { primary: colors.a, accent: colors.b, text: "#ffffff" },
        );
        ctx.restore();
      }

      // channel logo, top-right
      drawChannelLogo(ctx, channelLogoImg, channelLogo, w, h, local);

      // title
      const titleStyleHQ = styles.title ?? defaultStyle();
      if (heading && showHeading && titleStyleHQ.visible) {
        const titleAnim = computeAnim(anims.title ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, titleStyleHQ, w / 2, M + h * 0.02, w, h);
        applyAnim(ctx, titleAnim, w / 2, M + h * 0.02);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.round(h * 0.075)}px ${FX_FONT}`;
        ctx.globalAlpha *= intro01;
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = h * 0.02;
        ctx.fillStyle = "#fff";
        ctx.fillText(heading.toUpperCase(), w / 2, M + h * 0.02);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fbbf24";
        ctx.font = `900 ${Math.round(h * 0.02)}px ${FX_FONT}`;
        ctx.fillText("WOULD YOU RATHER", w / 2, M + h * 0.07);
        ctx.restore();
      }

      // two panels
      const panelTop = h * 0.2;
      const panelH = h * 0.58;
      const gap = w * 0.03;
      const panelW = (w - M * 2.6 - gap) / 2;
      const panels = [
        { img: r.imgA, text: r.textA, color: colors.a, x: M * 1.3, key: "imageA" as const },
        { img: r.imgB, text: r.textB, color: colors.b, x: M * 1.3 + panelW + gap, key: "imageB" as const },
      ];
      panels.forEach((p, i) => {
        const panelStyle = styles[p.key] ?? defaultStyle();
        if (!panelStyle.visible) return;
        const anim = computeAnim(anims[p.key] ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, panelStyle, p.x + panelW / 2, panelTop + panelH / 2, w, h);
        applyAnim(ctx, anim, p.x + panelW / 2, panelTop + panelH / 2);
        roundRect(ctx, p.x, panelTop, panelW, panelH, h * 0.03);
        ctx.save();
        ctx.clip();
        if (p.img) {
          drawCover(ctx, p.img, p.x, panelTop, panelW, panelH, zoom);
        } else {
          ctx.fillStyle = hexA(p.color, 0.4);
          ctx.fillRect(p.x, panelTop, panelW, panelH);
        }
        ctx.fillStyle = hexA(p.color, 0.16);
        ctx.fillRect(p.x, panelTop, panelW, panelH);
        ctx.restore();
        ctx.lineWidth = h * 0.006;
        ctx.strokeStyle = p.color;
        ctx.stroke();
        ctx.restore();

        // label pill
        const labelKeyHQ = i === 0 ? "labelA" : "labelB";
        const labelStyleHQ = styles[labelKeyHQ] ?? defaultStyle();
        const labelAnim = computeAnim(anims[labelKeyHQ] ?? defaultAnim(), local);
        const label = uppercase ? p.text.toUpperCase() : p.text;
        if (label && labelStyleHQ.visible) {
          ctx.save();
          applyStyle(ctx, labelStyleHQ, p.x + panelW / 2, panelTop + panelH + h * 0.05, w, h);
          applyAnim(ctx, labelAnim, p.x + panelW / 2, panelTop + panelH + h * 0.05);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const base = Math.round(h * 0.04);
          fitText(ctx, label, panelW * 0.9, base, 800);
          const size = parseInt(ctx.font, 10);
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = "#fff";
          roundRect(
            ctx,
            p.x + panelW / 2 - tw / 2 - size * 0.6,
            panelTop + panelH + h * 0.02,
            tw + size * 1.2,
            size * 1.6,
            size * 0.8,
          );
          ctx.fill();
          ctx.fillStyle = p.color;
          ctx.fillText(label, p.x + panelW / 2, panelTop + panelH + h * 0.05);
          ctx.restore();
        }
      });

      // VS badge
      const badgeStyleHQ = styles.badge ?? defaultStyle();
      if (showVs && badgeStyleHQ.visible) {
        const pop = ease.back(Math.min(1, local / 0.5));
        const badgeAnim2 = computeAnim(anims.badge ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, badgeStyleHQ, w / 2, panelTop + panelH / 2, w, h);
        applyAnim(ctx, badgeAnim2, w / 2, panelTop + panelH / 2);
        ctx.translate(w / 2, panelTop + panelH / 2);
        ctx.scale(pop, pop);
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = "#0b0a2e";
        ctx.fill();
        ctx.lineWidth = h * 0.006;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.round(h * 0.045)}px ${FX_FONT}`;
        ctx.fillText("VS", 0, h * 0.002);
        ctx.restore();
      }

      // timer
      const timerStyleHQ = styles.timer ?? defaultStyle();
      if (showTimer && timerStyleHQ.visible) {
        const left = Math.max(0, Math.min(timerSecs, dur - local));
        const timerAnim = computeAnim(anims.timer ?? defaultAnim(), local);
        const rr = h * 0.055;
        const tcx = w / 2;
        const tcy = h - M * 0.7;
        ctx.save();
        applyStyle(ctx, timerStyleHQ, tcx, tcy, w, h);
        applyAnim(ctx, timerAnim, tcx, tcy);
        drawTimer(ctx, timerStyle, tcx, tcy, rr, left, timerSecs, { primary: colors.a, accent: "#ef4444", text: "#ffffff" }, local);
        ctx.restore();
      }

      // bottom progress bar
      const timebarStyleHQ = styles.timebar ?? defaultStyle();
      const barW = w - M * 2.6;
      const barH = h * 0.02;
      const barY = h - M * 0.32;
      const guessDurHQ = Math.min(timerSecs, dur);
      const frac = Math.max(0, Math.min(1, 1 - local / Math.max(0.01, guessDurHQ)));
      if (timebarStyleHQ.visible) {
        const timebarAnim = computeAnim(anims.timebar ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, timebarStyleHQ, M * 1.3 + barW / 2, barY + barH / 2, w, h);
        applyAnim(ctx, timebarAnim, M * 1.3 + barW / 2, barY + barH / 2);
        drawTimeBar(ctx, timebarStyle, M * 1.3, barY, barW, barH, frac, { primary: "#34d399", accent: colors.b, text: "#ffffff" }, local);
        ctx.restore();
      }
    },
    [
      anims,
      colors,
      heading,
      showHeading,
      showTimer,
      showVs,
      timerSecs,
      uppercase,
      zoom,
      styles,
      background,
      bgIntensity,
      timerStyle,
      timebarStyle,
      roundBadgeStyle,
      channelLogo,
      channelLogoImg,
      sideLabel,
      showSideLabel,
    ],
  );

  const drawRoundUHD = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      r: Round,
      local: number,
      dur: number,
      absT: number,
      roundIndex = 0,
    ) => {
      // Orange sunburst-style animated background (uses the shared registry so
      // any style added there is available here too — default leans warm/orange).
      drawBackground(
        ctx,
        background,
        { bg: ["#ff8a00", "#7a2a00"], primary: "#ffb545", accent: "#ff5b1f" },
        w,
        h,
        absT,
        bgIntensity,
      );
      const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.9);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);

      const intro01 = ease.out(Math.min(1, local / 0.45));
      const M = h * 0.055;

      // vertical side texts, both edges
      if (showSideLabel && sideLabel) {
        ctx.save();
        ctx.font = `900 ${Math.round(h * 0.028)}px ${FX_FONT}`;
        ctx.fillStyle = hexA(sideLabelColor, 0.55);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.translate(M * 0.5, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(sideLabel.toUpperCase(), 0, 0);
        ctx.restore();
        ctx.save();
        ctx.translate(w - M * 0.5, h / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(sideLabel.toUpperCase(), 0, 0);
        ctx.restore();
        ctx.restore();
      }

      // round-number badge, top-left
      const roundNoStyleUHD = styles.roundNo ?? defaultStyle();
      if (roundNoStyleUHD.visible) {
        const roundAnim = computeAnim(anims.roundNo ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, roundNoStyleUHD, M + h * 0.045, M + h * 0.045, w, h);
        applyAnim(ctx, roundAnim, M + h * 0.045, M + h * 0.045);
        drawRoundBadge(
          ctx,
          roundBadgeStyle,
          `#${roundIndex + 1}`,
          M + h * 0.045,
          M + h * 0.045,
          h * 0.03,
          { primary: "#ffdd55", accent: "#ff5b1f", text: "#3a1400" },
        );
        ctx.restore();
      }

      // top-right logo: uploaded image via the shared channel-logo helper, or
      // an emoji/text logo drawn locally so no image upload is required.
      if (uhdLogoMode === "image") {
        drawChannelLogo(ctx, channelLogoImg, channelLogo, w, h, local);
      } else if (channelLogo.visible) {
        const size = Math.min(w, h) * 0.11 * channelLogo.scale;
        const ax = w - size * 0.9 + (channelLogo.dx / 100) * w;
        const ay = size * 0.9 + (channelLogo.dy / 100) * h;
        ctx.save();
        ctx.globalAlpha *= Math.max(0, Math.min(1, channelLogo.opacity));
        ctx.translate(ax, ay);
        ctx.rotate((channelLogo.rotate * Math.PI) / 180);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.round(size * 1.6)}px ${FX_FONT}`;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = size * 0.3;
        ctx.fillText(uhdLogoEmoji, 0, 0);
        ctx.restore();
      }

      // title, white with heavy outline
      const titleStyleUHD = styles.title ?? defaultStyle();
      if (heading && showHeading && titleStyleUHD.visible) {
        const titleAnim = computeAnim(anims.title ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, titleStyleUHD, w / 2, M + h * 0.075, w, h);
        applyAnim(ctx, titleAnim, w / 2, M + h * 0.075);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.round(h * 0.085)}px ${FX_FONT}`;
        ctx.globalAlpha *= intro01;
        ctx.lineJoin = "round";
        ctx.lineWidth = h * 0.014;
        ctx.strokeStyle = "#3a1400";
        ctx.strokeText(heading.toUpperCase(), w / 2, M + h * 0.075);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(heading.toUpperCase(), w / 2, M + h * 0.075);
        ctx.restore();
      }

      // two rounded, white-framed image cards
      const panelTop = h * 0.22;
      const panelH = h * 0.55;
      const gap = w * 0.035;
      const panelW = (w - M * 2.8 - gap) / 2;
      const panels = [
        { img: r.imgA, text: r.textA, x: M * 1.4, key: "imageA" as const },
        { img: r.imgB, text: r.textB, x: M * 1.4 + panelW + gap, key: "imageB" as const },
      ];
      panels.forEach((p, i) => {
        const panelStyle = styles[p.key] ?? defaultStyle();
        if (!panelStyle.visible) return;
        const anim = computeAnim(anims[p.key] ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, panelStyle, p.x + panelW / 2, panelTop + panelH / 2, w, h);
        applyAnim(ctx, anim, p.x + panelW / 2, panelTop + panelH / 2);
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = h * 0.03;
        roundRect(ctx, p.x, panelTop, panelW, panelH, h * 0.035);
        ctx.fillStyle = "#111";
        ctx.fill();
        ctx.restore();
        roundRect(ctx, p.x, panelTop, panelW, panelH, h * 0.035);
        ctx.save();
        ctx.clip();
        if (p.img) {
          drawCover(ctx, p.img, p.x, panelTop, panelW, panelH, zoom);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fillRect(p.x, panelTop, panelW, panelH);
        }
        ctx.restore();
        ctx.lineWidth = h * 0.009;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.restore();

        // white answer plate below each card
        const labelKeyUHD = i === 0 ? "labelA" : "labelB";
        const labelStyleUHD = styles[labelKeyUHD] ?? defaultStyle();
        const label = uppercase ? p.text.toUpperCase() : p.text;
        if (label && labelStyleUHD.visible) {
          const plateY = panelTop + panelH + h * 0.055;
          const labelAnim = computeAnim(anims[labelKeyUHD] ?? defaultAnim(), local);
          ctx.save();
          applyStyle(ctx, labelStyleUHD, p.x + panelW / 2, plateY, w, h);
          applyAnim(ctx, labelAnim, p.x + panelW / 2, plateY);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const base = Math.round(h * 0.038);
          fitText(ctx, label, panelW * 0.88, base, 800);
          const size = parseInt(ctx.font, 10);
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = "#ffffff";
          roundRect(
            ctx,
            p.x + panelW / 2 - tw / 2 - size * 0.7,
            plateY - size * 0.85,
            tw + size * 1.4,
            size * 1.7,
            size * 0.85,
          );
          ctx.fill();
          ctx.fillStyle = "#e8590c";
          ctx.fillText(label, p.x + panelW / 2, plateY);
          ctx.restore();
        }
      });

      // VS badge
      const badgeStyleUHD = styles.badge ?? defaultStyle();
      if (showVs && badgeStyleUHD.visible) {
        const pop = ease.back(Math.min(1, local / 0.5));
        const badgeAnimUHD = computeAnim(anims.badge ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, badgeStyleUHD, w / 2, panelTop + panelH / 2, w, h);
        applyAnim(ctx, badgeAnimUHD, w / 2, panelTop + panelH / 2);
        ctx.translate(w / 2, panelTop + panelH / 2);
        ctx.scale(pop, pop);
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = "#3a1400";
        ctx.fill();
        ctx.lineWidth = h * 0.006;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.round(h * 0.045)}px ${FX_FONT}`;
        ctx.fillText("VS", 0, h * 0.002);
        ctx.restore();
      }

      // timer
      const timerStyleUHD = styles.timer ?? defaultStyle();
      if (showTimer && timerStyleUHD.visible) {
        const left = Math.max(0, Math.min(timerSecs, dur - local));
        const timerAnim = computeAnim(anims.timer ?? defaultAnim(), local);
        const rr = h * 0.05;
        const tcx = w / 2;
        const tcy = panelTop - h * 0.06;
        ctx.save();
        applyStyle(ctx, timerStyleUHD, tcx, tcy, w, h);
        applyAnim(ctx, timerAnim, tcx, tcy);
        drawTimer(ctx, timerStyle, tcx, tcy, rr, left, timerSecs, { primary: "#34d399", accent: "#ef4444", text: "#ffffff" }, local);
        ctx.restore();
      }

      // green chevron time bar with a rider emoji, bottom of frame
      const timebarStyleUHD = styles.timebar ?? defaultStyle();
      const barW = w - M * 2.8;
      const barH = h * 0.024;
      const barY = h - M * 0.85;
      const guessDurUHD = Math.min(timerSecs, dur);
      const frac = Math.max(0, Math.min(1, 1 - local / Math.max(0.01, guessDurUHD)));
      if (timebarStyleUHD.visible) {
        const timebarAnim = computeAnim(anims.timebar ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, timebarStyleUHD, M * 1.4 + barW / 2, barY + barH / 2, w, h);
        applyAnim(ctx, timebarAnim, M * 1.4 + barW / 2, barY + barH / 2);
        drawTimeBar(ctx, timebarStyle, M * 1.4, barY, barW, barH, frac, { primary: "#22c55e", accent: "#16a34a", text: "#ffffff" }, local);
        if (showUhdRider) {
          const riderX = M * 1.4 + barW * frac;
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `${Math.round(barH * 3.2)}px ${FX_FONT}`;
          ctx.translate(riderX, barY + barH / 2 - barH * 0.4);
          ctx.rotate(Math.sin(local * 8) * 0.1);
          ctx.fillText(uhdRiderEmoji, 0, 0);
          ctx.restore();
        }
        ctx.restore();
      }
    },
    [
      anims,
      colors,
      heading,
      showHeading,
      showTimer,
      showVs,
      timerSecs,
      uppercase,
      zoom,
      styles,
      background,
      bgIntensity,
      timerStyle,
      timebarStyle,
      roundBadgeStyle,
      channelLogo,
      channelLogoImg,
      sideLabel,
      showSideLabel,
      sideLabelColor,
      uhdLogoMode,
      uhdLogoEmoji,
      uhdRiderEmoji,
      showUhdRider,
    ],
  );

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const { w, h } = dims;
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
      const idx = timeline.segs.findIndex((s) => t >= s.start && t < s.start + s.dur);
      const seg = idx >= 0 ? timeline.segs[idx] : timeline.segs[timeline.segs.length - 1];
      if (!seg) return;

      // round-to-round transition overlay
      let renderSeg = seg;
      let inTransition = false;
      let transProgress = 0;
      const half = roundTransition.duration / 2;
      if (idx > 0) {
        const boundary = seg.start;
        if (t < boundary + half) {
          inTransition = true;
          transProgress = Math.max(0, Math.min(1, (t - (boundary - half)) / roundTransition.duration));
          if (transProgress < 0.5) renderSeg = timeline.segs[idx - 1];
        }
      }
      const localT = Math.max(0, t - renderSeg.start);

      if (aspect === "16:9-hq") {
        drawRoundHQ(ctx, w, h, renderSeg.round, localT, renderSeg.dur, t, renderSeg.index);
      } else if (aspect === "16:9-uhd") {
        drawRoundUHD(ctx, w, h, renderSeg.round, localT, renderSeg.dur, t, renderSeg.index);
      } else {
        drawRound(ctx, w, h, renderSeg.round, localT, renderSeg.dur, renderSeg.index);
      }
      if (inTransition) {
        drawRoundTransition(ctx, roundTransition, transProgress, w, h);
      }
    },
    [aspect, dims, drawRound, drawRoundHQ, drawRoundUHD, intro, outro, timeline, roundTransition],
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
          playedRef.current.clear();
        }
        // fire voiceovers
        for (const seg of timeline.segs) {
          if (
            seg.round.voUrl &&
            !playedRef.current.has(seg.round.id) &&
            timeRef.current >= seg.start &&
            timeRef.current < seg.start + 0.35
          ) {
            playedRef.current.add(seg.round.id);
            const el = new Audio(seg.round.voUrl);
            audioElRef.current = el;
            void el.play().catch(() => {});
          }
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
      audioElRef.current?.pause();
      setPlaying(false);
    } else {
      if (timeRef.current >= timeline.total - 0.05) {
        timeRef.current = 0;
        playedRef.current.clear();
      }
      lastRef.current = 0;
      setPlaying(true);
    }
  };

  // ---------------- voiceover ----------------

  const buildScript = (r: Round) =>
    r.script.trim() ||
    `Would you rather ${r.textA || "option A"}… or ${r.textB || "option B"}?`;

  const generateAll = async () => {
    if (!rounds.length) return;
    setGenerating(true);
    try {
      for (const r of rounds) {
        const text = buildScript(r);
        const { url, blob } = await generateSpeech(text, {
          provider,
          voice,
          styleDirection: voStyle,
        });
        const dur = await blobDuration(blob);
        setRound(r.id, { voUrl: url, voBlob: blob, voDur: dur });
      }
      toast.success("Voiceovers generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voiceover failed");
    } finally {
      setGenerating(false);
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
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      for (const seg of timeline.segs) {
        if (!seg.round.voBlob) continue;
        const buf = await audioCtx.decodeAudioData(await seg.round.voBlob.arrayBuffer());
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start(audioCtx.currentTime + seg.start + 0.15);
      }
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

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
      await audioCtx.close();

      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `would-you-rather.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setExportProgress(100);
      toast.success("Export complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const randomizePct = () =>
    setRounds((rs) => rs.map((r) => ({ ...r, pctA: 20 + Math.round(Math.random() * 60) })));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:flex lg:h-full lg:flex-col lg:space-y-0 lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Split className="h-6 w-6" /> Would You Rather studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Split-screen WYR videos with AI voiceover, countdown timers and full customisation.
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

      <div className="grid gap-6 lg:mt-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        {/* preview */}
        <div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <Card>
            <CardContent className="flex justify-center p-4">
              <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                className="max-h-[58vh] h-auto w-auto max-w-full object-contain rounded-xl border bg-black"
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

          {/* rounds */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Rounds</CardTitle>
                <CardDescription>Each round is one “would you rather” question.</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setRounds((r) => [...r, emptyRound()])}>
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
                    {(["A", "B"] as const).map((side) => {
                      const url = side === "A" ? r.urlA : r.urlB;
                      return (
                        <div key={side} className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Option {side}</Label>
                          <Input
                            value={side === "A" ? r.textA : r.textB}
                            placeholder={side === "A" ? "fly like a bird" : "breathe underwater"}
                            onChange={(e) =>
                              setRound(r.id, side === "A" ? { textA: e.target.value } : { textB: e.target.value })
                            }
                          />
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                            <Upload className="h-4 w-4" />
                            {url ? "Replace image" : "Upload image"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onImage(r.id, side, f);
                              }}
                            />
                          </label>
                          {url && (
                            <img src={url} alt={`Option ${side}`} className="h-20 w-full rounded object-cover" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 space-y-2">
                    <Label className="text-xs text-muted-foreground">Voiceover script (optional)</Label>
                    <Textarea
                      rows={2}
                      value={r.script}
                      placeholder={buildScript(r)}
                      onChange={(e) => setRound(r.id, { script: e.target.value })}
                    />
                    {r.voUrl && (
                      <audio controls src={r.voUrl} className="w-full">
                        <track kind="captions" />
                      </audio>
                    )}
                  </div>
                  {showPct && (
                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground">
                        Option A share · {r.pctA}%
                      </Label>
                      <Slider
                        value={[r.pctA]}
                        min={0}
                        max={100}
                        onValueChange={([v]) => setRound(r.id, { pctA: v })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* controls */}
        <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
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
                <Label className="text-xs text-muted-foreground">Template</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as StyleId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {STYLES.find((s) => s.id === style)?.desc}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Side colours</Label>
                <Select value={sideColor} onValueChange={setSideColor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIDE_COLORS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Heading</Label>
                  <Switch checked={showHeading} onCheckedChange={setShowHeading} />
                </div>
                <Input value={heading} onChange={(e) => setHeading(e.target.value)} disabled={!showHeading} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Side label (16:9 HQ / ULTRA HD)</Label>
                  <Switch checked={showSideLabel} onCheckedChange={setShowSideLabel} />
                </div>
                <Input value={sideLabel} onChange={(e) => setSideLabel(e.target.value)} disabled={!showSideLabel} />
                {aspect === "16:9-uhd" && (
                  <Input
                    type="color"
                    className="mt-2 h-8 w-16 p-1"
                    value={sideLabelColor}
                    onChange={(e) => setSideLabelColor(e.target.value)}
                    disabled={!showSideLabel}
                  />
                )}
              </div>
              {aspect === "16:9-uhd" && (
                <div className="space-y-3 rounded-lg border p-3">
                  <Label className="text-xs font-medium">ULTRA HD Vid extras</Label>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Top-right logo</Label>
                    <Select value={uhdLogoMode} onValueChange={(v) => setUhdLogoMode(v as "image" | "emoji")}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="emoji">Emoji / text</SelectItem>
                        <SelectItem value="image">Uploaded image</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {uhdLogoMode === "emoji" && (
                    <Input value={uhdLogoEmoji} onChange={(e) => setUhdLogoEmoji(e.target.value)} placeholder="⚡" />
                  )}
                  {uhdLogoMode === "image" && (
                    <p className="text-[11px] text-muted-foreground">
                      Uses the logo uploaded in the “Channel logo” card below.
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground">Time bar rider</Label>
                    <Switch checked={showUhdRider} onCheckedChange={setShowUhdRider} />
                  </div>
                  <Input
                    value={uhdRiderEmoji}
                    onChange={(e) => setUhdRiderEmoji(e.target.value)}
                    disabled={!showUhdRider}
                    placeholder="🏃"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Countdown · {timerSecs}s</Label>
                <Slider value={[timerSecs]} min={2} max={12} step={1} onValueChange={([v]) => setTimerSecs(v)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Image tint · {Math.round(tint * 100)}%</Label>
                <Slider value={[tint]} min={0} max={0.8} step={0.05} onValueChange={([v]) => setTint(v)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Image zoom · {zoom.toFixed(2)}x</Label>
                <Slider value={[zoom]} min={1} max={1.4} step={0.01} onValueChange={([v]) => setZoom(v)} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex items-center justify-between gap-2">
                  Timer <Switch checked={showTimer} onCheckedChange={setShowTimer} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  VS badge <Switch checked={showVs} onCheckedChange={setShowVs} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Uppercase <Switch checked={uppercase} onCheckedChange={setUppercase} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Results <Switch checked={showPct} onCheckedChange={setShowPct} />
                </label>
              </div>
              {showPct && (
                <Button size="sm" variant="outline" onClick={randomizePct} className="w-full">
                  <Shuffle className="mr-1 h-4 w-4" /> Randomise results
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI voiceover</CardTitle>
              <CardDescription>Pick any provider — no single provider can block you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={provider}
                onValueChange={(v) => {
                  const p = v as TtsProvider;
                  setProvider(p);
                  setVoice(TTS_VOICES[p][0].id);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TTS_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.note}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger>
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
              {provider === "google" && (
                <Input
                  value={voStyle}
                  onChange={(e) => setVoStyle(e.target.value)}
                  placeholder="Delivery direction"
                />
              )}
              <Button onClick={generateAll} disabled={generating} className="w-full">
                {generating ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-1 h-4 w-4" />
                )}
                Generate voiceover for all rounds
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Background & timers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BackgroundPicker
                value={background}
                onChange={setBackground}
                intensity={bgIntensity}
                onIntensityChange={setBgIntensity}
              />
              <TimerStylePicker value={timerStyle} onChange={setTimerStyle} />
              <TimeBarStylePicker value={timebarStyle} onChange={setTimebarStyle} />
              <RoundBadgePicker value={roundBadgeStyle} onChange={setRoundBadgeStyle} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Channel logo</CardTitle>
              <CardDescription>Upload a badge that stays on screen every round.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                <Upload className="h-4 w-4" />
                {channelLogoUrl ? "Replace logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onChannelLogo(f);
                  }}
                />
              </label>
              {channelLogoUrl && (
                <img src={channelLogoUrl} alt="Channel logo" className="h-16 w-16 rounded-full border object-cover" />
              )}
              <ChannelLogoControls value={channelLogo} onChange={setChannelLogo} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Round transition</CardTitle>
              <CardDescription>Plays between every round, in preview and export.</CardDescription>
            </CardHeader>
            <CardContent>
              <RoundTransitionControls value={roundTransition} onChange={setRoundTransition} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Element layout</CardTitle>
              <CardDescription>Position, scale, rotation and visibility per element.</CardDescription>
            </CardHeader>
            <CardContent>
              <ElementStyleGroup items={STYLE_ELEMENTS} values={styles} onChange={setElStyle} />
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
