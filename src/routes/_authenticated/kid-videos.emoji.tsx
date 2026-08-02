import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Smile,
  Play,
  Pause,
  Download,
  Loader2,
  Trash2,
  Plus,
  Wand2,
  Shuffle,
  ArrowLeft,
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
import { FX_FONT, INTRO_ANIMATIONS, OUTRO_ANIMATIONS, fitText, hexA, roundRect, wrapText, ease } from "@/lib/video-fx";
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
  type ElementStyleSpec,
  drawBackground as drawSharedBackground,
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
  ROUND_BADGES,
  drawRoundBadge,
  RoundBadgePicker,
  type RoundTransitionSpec,
  defaultRoundTransition,
  drawRoundTransition,
  roundTransitionCoverage,
  RoundTransitionControls,
} from "@/lib/kid-elements";

export const Route = createFileRoute("/_authenticated/kid-videos/emoji")({
  head: () => ({
    meta: [
      { title: "Guess the Emoji Videos — Orbit" },
      {
        name: "description",
        content:
          "Make multi-round Guess the Emoji videos: emoji puzzles, categories, countdown timers, AI voiceover and 1080p export.",
      },
      { property: "og:title", content: "Guess the Emoji Videos — Orbit" },
      {
        property: "og:description",
        content:
          "Emoji guessing games for kids: rounds, countdowns, answer reveals and AI narration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmojiPage,
});

type AspectKey = "9:16" | "1:1" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · TikTok/Reels/Shorts" },
  "1:1": { w: 1080, h: 1080, label: "Square · Feed" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

const EMOJI_FONT = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;

const ANIM_ELEMENTS: { key: string; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "title", label: "Heading" },
  { key: "emoji", label: "Emoji tiles" },
  { key: "answer", label: "Answer text" },
  { key: "timer", label: "Timer" },
  { key: "timebar", label: "Progress bar" },
  { key: "roundNo", label: "Round number" },
];

function defaultAnimMap(): Record<string, ElementAnimSpec> {
  return {
    background: defaultAnim({ preset: "none", loop: "none" }),
    title: defaultAnim({ preset: "slide-down", duration: 0.5 }),
    emoji: defaultAnim({ preset: "bounce-in", duration: 0.6, loop: "breathe", intensity: 0.5 }),
    answer: defaultAnim({ preset: "pop", duration: 0.45 }),
    timer: defaultAnim({ preset: "zoom-in", loop: "pulse", intensity: 0.6 }),
    timebar: defaultAnim({ preset: "fade", duration: 0.3 }),
    roundNo: defaultAnim({ preset: "fade" }),
  };
}

const STYLE_ELEMENTS: { key: string; label: string }[] = [
  { key: "title", label: "Heading" },
  { key: "emoji", label: "Emoji row" },
  { key: "answer", label: "Answer text" },
  { key: "hint", label: "Hint" },
  { key: "timer", label: "Timer" },
  { key: "timebar", label: "Progress bar" },
  { key: "roundNo", label: "Round number" },
];

function defaultStyleMap(): Record<string, ElementStyleSpec> {
  return {
    title: defaultStyle(),
    emoji: defaultStyle(),
    answer: defaultStyle(),
    hint: defaultStyle(),
    timer: defaultStyle(),
    timebar: defaultStyle(),
    roundNo: defaultStyle(),
  };
}

type Round = {
  id: string;
  emojis: string;
  answer: string;
  category: string;
  hint: string;
  script: string;
  voUrl: string | null;
  voBlob: Blob | null;
  voDur: number;
};

type StyleId = "bubble" | "arcade" | "chalk" | "confetti" | "clean" | "quizshow";
const STYLES: { id: StyleId; name: string; desc: string }[] = [
  { id: "bubble", name: "Bubble Pop", desc: "Soft rounded card with bouncy emoji pop-in." },
  { id: "arcade", name: "Arcade", desc: "Pixel frame, scanlines and a chunky timer." },
  { id: "chalk", name: "Chalkboard", desc: "Classroom board with hand-drawn keylines." },
  { id: "confetti", name: "Confetti Party", desc: "Falling confetti on the answer reveal." },
  { id: "clean", name: "Clean Studio", desc: "Minimal, big type, no distractions." },
  { id: "quizshow", name: "Quiz Show", desc: "Stage lights, spotlight glow and a bold banner." },
];

type Pal = PaletteLike & { id: string; name: string };
const PALETTES: Pal[] = [
  {
    id: "candy",
    name: "Candy Pop",
    bg: ["#2b1155", "#7c3aed"],
    primary: "#fbbf24",
    accent: "#34d399",
    text: "#ffffff",
    muted: "#c7bff0",
  },
  {
    id: "sunny",
    name: "Sunny Day",
    bg: ["#0f3d3e", "#0ea5e9"],
    primary: "#fde047",
    accent: "#fb7185",
    text: "#ffffff",
    muted: "#bfe6f5",
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    bg: ["#3a0c2a", "#db2777"],
    primary: "#f9a8d4",
    accent: "#67e8f9",
    text: "#fff1f7",
    muted: "#f0c2da",
  },
  {
    id: "chalkboard",
    name: "Chalkboard",
    bg: ["#0d1a14", "#1f3b2c"],
    primary: "#f8fafc",
    accent: "#facc15",
    text: "#f8fafc",
    muted: "#9db5a6",
  },
  {
    id: "night",
    name: "Neon Night",
    bg: ["#06070f", "#111a3a"],
    primary: "#22d3ee",
    accent: "#f472b6",
    text: "#ffffff",
    muted: "#94a3b8",
  },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const SAMPLES: { emojis: string; answer: string; category: string }[] = [
  { emojis: "🦁👑", answer: "The Lion King", category: "Movie" },
  { emojis: "🕷️👨", answer: "Spider-Man", category: "Movie" },
  { emojis: "🌧️🌈", answer: "Rainbow", category: "Nature" },
  { emojis: "🐟🔎", answer: "Finding Nemo", category: "Movie" },
  { emojis: "🍫🏭", answer: "Charlie and the Chocolate Factory", category: "Movie" },
  { emojis: "❄️👸", answer: "Frozen", category: "Movie" },
  { emojis: "🐝🎬", answer: "Bee Movie", category: "Movie" },
  { emojis: "🚗⚡", answer: "Lightning McQueen", category: "Character" },
];

function emptyRound(i = 0): Round {
  const s = SAMPLES[i % SAMPLES.length];
  return {
    id: uid(),
    emojis: s.emojis,
    answer: s.answer,
    category: s.category,
    hint: "",
    script: "",
    voUrl: null,
    voBlob: null,
    voDur: 0,
  };
}

/** Split a string into visual emoji clusters. */
function emojiList(s: string): string[] {
  const seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (seg) {
    return Array.from(new seg(undefined, { granularity: "grapheme" }).segment(s.trim()))
      .map((g) => g.segment)
      .filter((g) => g.trim().length > 0);
  }
  return Array.from(s.trim()).filter((c) => c.trim().length > 0);
}

function EmojiPage() {
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [style, setStyle] = useState<StyleId>("bubble");
  const [paletteId, setPaletteId] = useState(PALETTES[0].id);
  const [colors, setColors] = useState<ColorOverrides>({});
  const [rounds, setRounds] = useState<Round[]>([emptyRound(0), emptyRound(1), emptyRound(2)]);
  const [heading, setHeading] = useState("Guess the Emoji");
  const [timerSecs, setTimerSecs] = useState(5);
  const [revealSecs, setRevealSecs] = useState(2.5);
  const [showTimer, setShowTimer] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [showRoundNo, setShowRoundNo] = useState(true);
  const [uppercase, setUppercase] = useState(true);
  const [emojiScale, setEmojiScale] = useState(1);
  const [bounce, setBounce] = useState(1);
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
  const [emojiGap, setEmojiGap] = useState(1);
  const [emojiLineHeight, setEmojiLineHeight] = useState(1);

  const [channelLogo, setChannelLogo] = useState<ChannelLogoSpec>(defaultChannelLogo());
  const [channelLogoUrl, setChannelLogoUrl] = useState<string | null>(null);
  const channelLogoImgRef = useRef<HTMLImageElement | null>(null);

  const [roundBadgeId, setRoundBadgeId] = useState<RoundBadgeId>("pill");
  const [roundTransition, setRoundTransition] = useState<RoundTransitionSpec>(defaultRoundTransition());

  const [provider, setProvider] = useState<TtsProvider>("elevenlabs");
  const [voice, setVoice] = useState(TTS_VOICES.elevenlabs[0].id);
  const [voStyle, setVoStyle] = useState("Bright, playful game-show host for kids");
  const [generating, setGenerating] = useState(false);

  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, title: "Guess the Emoji" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, title: "How many did you get?" });

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

  useEffect(() => {
    if (!channelLogoUrl) {
      channelLogoImgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      channelLogoImgRef.current = img;
    };
    img.src = channelLogoUrl;
  }, [channelLogoUrl]);

  const onChannelLogoFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setChannelLogoUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const dims = ASPECTS[aspect];
  const basePalette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  const pal = useMemo(() => applyOverrides(basePalette, colors), [basePalette, colors]);

  const roundDur = useCallback(
    (r: Round) => Math.max(timerSecs, (r.voDur || 0) + 0.6) + revealSecs,
    [timerSecs, revealSecs],
  );

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

  // ---------------- rendering ----------------

  const drawBackground = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      drawSharedBackground(
        ctx,
        background,
        { bg: [pal.bg[0], pal.bg[1]], primary: pal.primary, accent: pal.accent },
        w,
        h,
        t,
        bgIntensity,
      );

      if (style === "chalk") {
        ctx.strokeStyle = hexA(pal.text, 0.06);
        ctx.lineWidth = Math.max(1, w * 0.0012);
        for (let x = 0; x < w; x += w * 0.06) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
      }
      if (style === "quizshow") {
        const sg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.6);
        sg.addColorStop(0, hexA("#ffffff", 0.12));
        sg.addColorStop(1, hexA("#000000", 0.35));
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, w, h);
      }
      if (style === "arcade") {
        ctx.fillStyle = "rgba(0,0,0,0.07)";
        for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2);
      }
      // subtle rotating ray-burst for a lively, non-static backdrop
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(t * 0.06);
      const rays = 14;
      for (let i = 0; i < rays; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const a0 = (i / rays) * Math.PI * 2;
        const a1 = a0 + Math.PI / rays;
        ctx.arc(0, 0, Math.max(w, h), a0, a1);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0)";
        ctx.fill();
      }
      ctx.restore();
      // gentle vignette keeps everything reading as one frame
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    },
    [pal, style, background, bgIntensity],
  );

  const drawConfetti = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, k: number) => {
      const cols = [pal.primary, pal.accent, pal.text];
      for (let i = 0; i < 70; i++) {
        const seed = (i * 9301 + 49297) % 233280;
        const x = ((seed / 233280) * 1.2 - 0.1) * w;
        const speed = 0.4 + ((seed % 97) / 97) * 0.9;
        const y = ((k * speed + (seed % 53) / 53) % 1.2 - 0.1) * h;
        const s = Math.min(w, h) * (0.008 + ((seed % 31) / 31) * 0.008);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(k * 6 + i);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(-s / 2, -s / 2, s, s * 1.6);
        ctx.restore();
      }
    },
    [pal],
  );

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
      drawBackground(ctx, w, h, absT);

      const guessDur = Math.max(0.5, dur - revealSecs);
      const revealing = local >= guessDur;
      const revealK = revealing ? ease.out(Math.min(1, (local - guessDur) / 0.45)) : 0;
      const inK = ease.out(Math.min(1, local / 0.4));
      const M = Math.min(w, h) * 0.07; // safe margin

      // ---- header banner ----
      const titleStyleSpec = styles.title ?? defaultStyle();
      const hs = Math.round(Math.min(w, h) * (aspect === "16:9" ? 0.055 : 0.045));
      const by = M + hs * 0.9;
      if (titleStyleSpec.visible) {
        const titleAnim = computeAnim(anims.title ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, titleStyleSpec, w / 2, by, w, h);
        applyAnim(ctx, titleAnim, w / 2, by);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${hs}px ${FX_FONT}`;
        const title = uppercase ? heading.toUpperCase() : heading;
        const tw = Math.min(ctx.measureText(title).width, w - M * 2 - hs * 1.4);
        const padX = hs * 0.75;
        ctx.globalAlpha *= inK;
        ctx.fillStyle = hexA("#000000", 0.42);
        roundRect(ctx, w / 2 - tw / 2 - padX, by - hs * 0.95, tw + padX * 2, hs * 1.9, hs);
        ctx.fill();
        ctx.strokeStyle = hexA(pal.primary, 0.7);
        ctx.lineWidth = Math.max(2, hs * 0.05);
        ctx.stroke();
        ctx.fillStyle = pal.text;
        ctx.fillText(title, w / 2, by, w - M * 2 - padX * 2);
        ctx.restore();
      }

      // ---- round number / category chips ----
      const chipY = by + hs * 1.9;
      const chips: { label: string; color: string }[] = [];
      if (showRoundNo) chips.push({ label: `Round ${index + 1}`, color: pal.primary });
      if (showCategory && r.category.trim()) chips.push({ label: r.category, color: pal.accent });
      const roundNoStyleSpec = styles.roundNo ?? defaultStyle();
      if (chips.length && roundNoStyleSpec.visible) {
        const roundAnim = computeAnim(anims.roundNo ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, roundNoStyleSpec, w / 2, chipY, w, h);
        applyAnim(ctx, roundAnim, w / 2, chipY);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const cs = Math.round(hs * 0.5);
        ctx.font = `800 ${cs}px ${FX_FONT}`;
        const widths = chips.map((c) => ctx.measureText(c.label.toUpperCase()).width + cs * 1.6);
        const gap = cs * 0.6;
        let x = w / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1)) / 2;
        ctx.globalAlpha *= inK;
        chips.forEach((c, i) => {
          ctx.fillStyle = hexA(c.color, 0.18);
          roundRect(ctx, x, chipY - cs, widths[i], cs * 2, cs);
          ctx.fill();
          ctx.strokeStyle = hexA(c.color, 0.7);
          ctx.lineWidth = Math.max(1.5, cs * 0.08);
          ctx.stroke();
          ctx.fillStyle = c.color;
          ctx.fillText(c.label.toUpperCase(), x + cs * 0.8, chipY + cs * 0.04);
          x += widths[i] + gap;
        });
        ctx.restore();
      }

      // ---- emoji card ----
      const cardTop = chipY + hs * 1.6;
      const cardBottom = h - M - Math.min(w, h) * (revealSecs > 0 ? 0.3 : 0.2);
      const cardH = Math.max(Math.min(w, h) * 0.22, cardBottom - cardTop);
      const cardW = w - M * 2;
      const cx = w / 2;
      const cyCard = cardTop + cardH / 2;

      ctx.save();
      ctx.globalAlpha = inK;
      const breathe = 1 + Math.sin(absT * 1.4) * 0.006 * bounce;
      ctx.translate(cx, cyCard);
      ctx.scale(breathe, breathe);
      ctx.translate(-cx, -cyCard);
      if (style !== "clean") {
        ctx.fillStyle = hexA("#000000", style === "chalk" ? 0.28 : 0.35);
        roundRect(
          ctx,
          cx - cardW / 2,
          cyCard - cardH / 2,
          cardW,
          cardH,
          style === "arcade" ? Math.min(w, h) * 0.01 : Math.min(w, h) * 0.06,
        );
        ctx.fill();
        ctx.strokeStyle = hexA(pal.primary, style === "chalk" ? 0.5 : 0.75);
        ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.005);
        if (style === "chalk") ctx.setLineDash([Math.min(w, h) * 0.02, Math.min(w, h) * 0.012]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      // emojis, laid out on a fitted row (wraps to two rows if needed)
      const list = emojiList(r.emojis);
      const emojiStyleSpec = styles.emoji ?? defaultStyle();
      if (list.length && emojiStyleSpec.visible) {
        const perRow = list.length > 4 ? Math.ceil(list.length / 2) : list.length;
        const rows: string[][] = [];
        for (let i = 0; i < list.length; i += perRow) rows.push(list.slice(i, i + perRow));
        const maxCell = Math.min(
          (cardW * 0.86) / perRow,
          (cardH * 0.78) / rows.length,
        );
        const size = maxCell * 0.92 * emojiScale;
        const emojiAnim = computeAnim(anims.emoji ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, emojiStyleSpec, cx, cyCard, w, h);
        applyAnim(ctx, emojiAnim, cx, cyCard);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
        rows.forEach((row, ri) => {
          const rowY = cyCard + (ri - (rows.length - 1) / 2) * maxCell * 1.02;
          row.forEach((e, i) => {
            const idx = ri * perRow + i;
            const pop = ease.back(Math.max(0, Math.min(1, (local - 0.12 * idx) / 0.45)));
            const wobble = Math.sin(absT * 2 + idx * 1.2) * 0.02 * bounce;
            const x = cx + (i - (row.length - 1) / 2) * maxCell * 1.02;
            ctx.save();
            ctx.translate(x, rowY);
            ctx.scale(pop * (1 + wobble), pop * (1 - wobble));
            ctx.rotate(Math.sin(absT * 1.1 + idx) * 0.02 * bounce);
            ctx.globalAlpha = Math.max(0, Math.min(1, pop));
            ctx.fillText(e, 0, 0);
            ctx.restore();
          });
        });
        ctx.restore();
      }

      // ---- hint ----
      const hintStyleSpec = styles.hint ?? defaultStyle();
      if (showHint && r.hint.trim() && !revealing && hintStyleSpec.visible) {
        const s = Math.round(Math.min(w, h) * 0.032);
        ctx.save();
        applyStyle(ctx, hintStyleSpec, cx, cardTop + cardH + s * 1.8, w, h);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `600 ${s}px ${FX_FONT}`;
        ctx.globalAlpha *= inK * 0.9;
        ctx.fillStyle = pal.muted;
        const rowsH = wrapText(ctx, `Hint: ${r.hint}`, cardW * 0.9);
        rowsH.forEach((line, i) => {
          ctx.fillText(line, cx, cardTop + cardH + s * (1.2 + i * 1.25));
        });
        ctx.restore();
      }

      // ---- countdown timer ----
      const timerStyleSpec = styles.timer ?? defaultStyle();
      if (showTimer && !revealing && timerStyleSpec.visible) {
        const left = Math.max(0, guessDur - local);
        const rr = Math.min(w, h) * 0.065;
        const ccx = w - M - rr;
        const ccy = h - M - rr;
        const timerAnim = computeAnim(anims.timer ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, timerStyleSpec, ccx, ccy, w, h);
        applyAnim(ctx, timerAnim, ccx, ccy);
        drawTimer(
          ctx,
          timerStyle,
          ccx,
          ccy,
          rr,
          left,
          guessDur,
          { primary: pal.primary, accent: "#ef4444", text: pal.text },
          local,
        );
        ctx.restore();
      }

      // ---- time bar ----
      const timebarStyleSpec = styles.timebar ?? defaultStyle();
      if (timebarStyleSpec.visible) {
        const barW = w - M * 2;
        const barH = Math.max(6, h * 0.012);
        const barX = M;
        const barY = M * 0.55;
        const frac2 = Math.max(0, Math.min(1, 1 - local / Math.max(0.01, dur)));
        const timebarAnim = computeAnim(anims.timebar ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, timebarStyleSpec, barX + barW / 2, barY + barH / 2, w, h);
        applyAnim(ctx, timebarAnim, barX + barW / 2, barY + barH / 2);
        drawTimeBar(
          ctx,
          timebarStyle,
          barX,
          barY,
          barW,
          barH,
          frac2,
          { primary: pal.primary, accent: pal.accent, text: pal.text },
          local,
        );
        ctx.restore();
      }

      // ---- answer reveal ----
      const answerStyleSpec = styles.answer ?? defaultStyle();
      if (revealing && r.answer.trim() && answerStyleSpec.visible) {
        if (style === "confetti") drawConfetti(ctx, w, h, (local - guessDur) / Math.max(0.6, revealSecs));
        const answerAnim = computeAnim(anims.answer ?? defaultAnim(), local - guessDur);
        const bandH0 = Math.min(w, h) * 0.2;
        const bandY0 = h - M - bandH0;
        ctx.save();
        applyStyle(ctx, answerStyleSpec, w / 2, bandY0 + bandH0 / 2, w, h);
        applyAnim(ctx, answerAnim, w / 2, bandY0 + bandH0 / 2);
        ctx.globalAlpha *= revealK;
        const bandH = bandH0;
        const bandY = bandY0;
        ctx.translate(0, (1 - revealK) * bandH * 0.4);
        ctx.fillStyle = hexA("#000000", 0.55);
        roundRect(ctx, M, bandY, w - M * 2, bandH, Math.min(w, h) * 0.05);
        ctx.fill();
        ctx.strokeStyle = hexA(pal.accent, 0.85);
        ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.005);
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const ls = Math.round(Math.min(w, h) * 0.028);
        ctx.font = `800 ${ls}px ${FX_FONT}`;
        ctx.fillStyle = pal.accent;
        ctx.fillText("ANSWER", w / 2, bandY + bandH * 0.26);

        const answer = uppercase ? r.answer.toUpperCase() : r.answer;
        const base = Math.round(Math.min(w, h) * 0.075);
        fitText(ctx, answer, w - M * 2 - Math.min(w, h) * 0.06, base, 900);
        const asz = parseInt(ctx.font, 10);
        const lines = wrapText(ctx, answer, w - M * 2 - Math.min(w, h) * 0.06).slice(0, 2);
        const startY = bandY + bandH * 0.62 - ((lines.length - 1) * asz * 1.05) / 2;
        ctx.fillStyle = pal.text;
        ctx.shadowColor = hexA(pal.accent, 0.5);
        ctx.shadowBlur = asz * 0.35;
        lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * asz * 1.05));
        ctx.restore();
      }
    },
    [
      anims,
      aspect,
      bounce,
      drawBackground,
      drawConfetti,
      emojiScale,
      heading,
      pal,
      revealSecs,
      showCategory,
      showHint,
      showRoundNo,
      showTimer,
      style,
      styles,
      timerStyle,
      timebarStyle,
      uppercase,
    ],
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
          playedRef.current.clear();
        }
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
    `Can you guess this one?${r.category ? ` It's a ${r.category.toLowerCase()}.` : ""} ${
      r.hint ? `Hint: ${r.hint}.` : ""
    } The answer is ${r.answer || "coming up"}!`;

  const generateAll = async () => {
    if (!rounds.length) return;
    setGenerating(true);
    try {
      for (const r of rounds) {
        const { url, blob } = await generateSpeech(buildScript(r), {
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
      a.download = `guess-the-emoji.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setExportProgress(100);
      toast.success("Export complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const shuffleSamples = () =>
    setRounds((rs) =>
      rs.map(() => {
        const s = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
        return { ...emptyRound(), emojis: s.emojis, answer: s.answer, category: s.category };
      }),
    );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:flex lg:h-full lg:flex-col lg:space-y-0 lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/kid-videos">
              <ArrowLeft className="mr-1 h-4 w-4" /> Kid Videos
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Smile className="h-6 w-6" /> Guess the Emoji studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-round emoji puzzles with countdowns, answer reveals and AI narration.
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

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Rounds</CardTitle>
                <CardDescription>Each round is one emoji puzzle and its answer.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={shuffleSamples}>
                  <Shuffle className="mr-1 h-4 w-4" /> Shuffle ideas
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRounds((r) => [...r, emptyRound(r.length)])}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add round
                </Button>
              </div>
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
                      <Label className="text-xs text-muted-foreground">Emojis</Label>
                      <Input
                        value={r.emojis}
                        placeholder="🦁👑"
                        onChange={(e) => setRound(r.id, { emojis: e.target.value })}
                        className="text-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Answer</Label>
                      <Input
                        value={r.answer}
                        placeholder="The Lion King"
                        onChange={(e) => setRound(r.id, { answer: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <Input
                        value={r.category}
                        placeholder="Movie · Song · Food"
                        onChange={(e) => setRound(r.id, { category: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Hint (optional)</Label>
                      <Input
                        value={r.hint}
                        placeholder="A Disney classic"
                        onChange={(e) => setRound(r.id, { hint: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Voiceover script (optional)
                    </Label>
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
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

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
                <Label className="text-xs text-muted-foreground">Heading</Label>
                <Input value={heading} onChange={(e) => setHeading(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Guess time · {timerSecs}s</Label>
                <Slider
                  value={[timerSecs]}
                  min={2}
                  max={15}
                  step={1}
                  onValueChange={([v]) => setTimerSecs(v)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Answer reveal · {revealSecs.toFixed(1)}s
                </Label>
                <Slider
                  value={[revealSecs]}
                  min={1}
                  max={6}
                  step={0.1}
                  onValueChange={([v]) => setRevealSecs(v)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Emoji size · {Math.round(emojiScale * 100)}%
                </Label>
                <Slider
                  value={[emojiScale]}
                  min={0.6}
                  max={1.3}
                  step={0.02}
                  onValueChange={([v]) => setEmojiScale(v)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Motion · {Math.round(bounce * 100)}%
                </Label>
                <Slider
                  value={[bounce]}
                  min={0}
                  max={2}
                  step={0.05}
                  onValueChange={([v]) => setBounce(v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex items-center justify-between gap-2">
                  Timer <Switch checked={showTimer} onCheckedChange={setShowTimer} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Category <Switch checked={showCategory} onCheckedChange={setShowCategory} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Hint <Switch checked={showHint} onCheckedChange={setShowHint} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Round no. <Switch checked={showRoundNo} onCheckedChange={setShowRoundNo} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Uppercase <Switch checked={uppercase} onCheckedChange={setUppercase} />
                </label>
              </div>
            </CardContent>
          </Card>

          <ColorCustomiser base={basePalette} value={colors} onChange={setColors} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Animations</CardTitle>
              <CardDescription>Entrance and looping motion per element.</CardDescription>
            </CardHeader>
            <CardContent>
              <AnimControlGroup items={ANIM_ELEMENTS} values={anims} onChange={setAnim} />
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
              <CardTitle className="text-base">Background</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BackgroundPicker
                value={background}
                onChange={setBackground}
                intensity={bgIntensity}
                onIntensityChange={setBgIntensity}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timer & bar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <TimerStylePicker value={timerStyle} onChange={setTimerStyle} />
              <TimeBarStylePicker value={timebarStyle} onChange={setTimebarStyle} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Layout</CardTitle>
              <CardDescription>Position, scale, rotation and visibility per element.</CardDescription>
            </CardHeader>
            <CardContent>
              <ElementStyleGroup items={STYLE_ELEMENTS} values={styles} onChange={setElStyle} />
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
