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
  drawRoundBadge,
  RoundBadgePicker,
  type RoundTransitionSpec,
  defaultRoundTransition,
  drawRoundTransition,
  roundTransitionCoverage,
  RoundTransitionControls,
  ANSWER_BOX_STYLES,
  drawAnswerBox,
} from "@/lib/kid-elements";
import {
  KidAudioCard,
  VoTimingControls,
  type VoTimingMode,
  defaultKidAudio,
  useKidAudioEngine,
  renderKidSfxBuffer,
  renderKidMusicBuffer,
  audioBufferToStream,
  type KidAudioSettings,
  type KidAudioCue,
} from "@/lib/kid-audio";

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

type VoSlot = {
  script: string;
  url: string | null;
  blob: Blob | null;
  dur: number;
  volume: number;
};

function emptyVoSlot(): VoSlot {
  return { script: "", url: null, blob: null, dur: 0, volume: 1 };
}

type Round = {
  id: string;
  emojis: string;
  answer: string;
  category: string;
  hint: string;
  voIntro: VoSlot;
  voMid: VoSlot;
  voAnswer: VoSlot;
  /** Seconds after the guessing phase starts before the mid/hint VO plays. */
  voMidOffset: number;
};

type EmojiBoxSpec = {
  width: number; // % of canvas width
  height: number; // % of canvas height
  x: number; // % of canvas width, center
  y: number; // % of canvas height, center
  radius: number; // % of min(w,h)
  padding: number; // % of min(w,h)
  emojiSize: number;
  spacing: number;
  opacity: number;
  bg: string;
  borderColor: string;
  borderWidth: number;
  shadow: boolean;
};

function defaultEmojiBox(): EmojiBoxSpec {
  return {
    width: 78,
    height: 24,
    x: 50,
    y: 46,
    radius: 6,
    padding: 5,
    emojiSize: 1,
    spacing: 1,
    opacity: 1,
    bg: "#000000",
    borderColor: "",
    borderWidth: 0.5,
    shadow: true,
  };
}

type StyleId = "bubble" | "arcade" | "chalk" | "confetti" | "clean" | "quizshow" | "hq";
const STYLES: { id: StyleId; name: string; desc: string }[] = [
  { id: "bubble", name: "Bubble Pop", desc: "Soft rounded card with bouncy emoji pop-in." },
  { id: "arcade", name: "Arcade", desc: "Pixel frame, scanlines and a chunky timer." },
  { id: "chalk", name: "Chalkboard", desc: "Classroom board with hand-drawn keylines." },
  { id: "confetti", name: "Confetti Party", desc: "Falling confetti on the answer reveal." },
  { id: "clean", name: "Clean Studio", desc: "Minimal, big type, no distractions." },
  { id: "quizshow", name: "Quiz Show", desc: "Stage lights, spotlight glow and a bold banner." },
  { id: "hq", name: "HQ Diamond", desc: "Blue diamond-tile backdrop, big cartoon title, side texts and a striped time bar." },
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
    voIntro: emptyVoSlot(),
    voMid: emptyVoSlot(),
    voAnswer: emptyVoSlot(),
    voMidOffset: 1.5,
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
  const [highlightWord, setHighlightWord] = useState("Emoji");
  const [emojiOutlineWidth, setEmojiOutlineWidth] = useState(0);
  const [emojiOutlineColor, setEmojiOutlineColor] = useState("#ffffff");
  const [sideText, setSideText] = useState({
    left: "GUESS THE WORD • ",
    right: "GUESS THE WORD • ",
    leftVisible: false,
    rightVisible: false,
  });
  const [channelLogoEmoji, setChannelLogoEmoji] = useState("");

  const [channelLogo, setChannelLogo] = useState<ChannelLogoSpec>(defaultChannelLogo());
  const [channelLogoUrl, setChannelLogoUrl] = useState<string | null>(null);
  const channelLogoImgRef = useRef<HTMLImageElement | null>(null);

  const [roundBadgeId, setRoundBadgeId] = useState<RoundBadgeId>("pill");
  const [roundTransition, setRoundTransition] = useState<RoundTransitionSpec>(defaultRoundTransition());

  const [voMode, setVoMode] = useState<VoTimingMode>("overlap");
  const [emojiBox, setEmojiBox] = useState<EmojiBoxSpec>(defaultEmojiBox());
  const setEmojiBoxPatch = (patch: Partial<EmojiBoxSpec>) => setEmojiBox((b) => ({ ...b, ...patch }));
  const [answerBoxStyle, setAnswerBoxStyle] = useState<string>(ANSWER_BOX_STYLES[0].id);
  const [answerBoxAccent, setAnswerBoxAccent] = useState("");
  const [answerBoxTextColor, setAnswerBoxTextColor] = useState("");
  const [answerBoxBg, setAnswerBoxBg] = useState("");
  const [answerBoxScale, setAnswerBoxScale] = useState(1);
  const [answerBoxDx, setAnswerBoxDx] = useState(0);
  const [answerBoxDy, setAnswerBoxDy] = useState(0);
  const [audio, setAudio] = useState<KidAudioSettings>(defaultKidAudio());
  const { playSfx } = useKidAudioEngine(audio);
  const lastTimerSecRef = useRef<Map<string, number>>(new Map());

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
  const sfxPlayedRef = useRef<Set<string>>(new Set());
  const voAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

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

  /** Narration that plays before / during the guessing phase. */
  const voLeadOf = useCallback(
    (r: Round) => (r.voIntro.dur || 0) + (r.voMidOffset || 0) + (r.voMid.dur || 0),
    [],
  );

  // "hold" waits for the narration before starting the countdown, so the round
  // grows by the narration length; "overlap" narrates over a running timer.
  const roundDur = useCallback(
    (r: Round) => {
      const vo = voLeadOf(r);
      const reveal = Math.max(revealSecs, (r.voAnswer.dur || 0) + 0.4);
      return voMode === "hold"
        ? vo + 0.3 + timerSecs + reveal
        : Math.max(timerSecs, vo + 0.6) + reveal;
    },
    [timerSecs, revealSecs, voMode, voLeadOf],
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
      if (style === "hq") {
        const cell = Math.min(w, h) * 0.09;
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = Math.max(1, cell * 0.02);
        for (let y = -cell * 2; y < h + cell * 2; y += cell) {
          for (let x = -cell * 2; x < w + cell * 2; x += cell) {
            ctx.save();
            ctx.translate(x + ((y / cell) % 2) * (cell / 2), y);
            ctx.beginPath();
            ctx.moveTo(0, -cell / 2);
            ctx.lineTo(cell / 2, 0);
            ctx.lineTo(0, cell / 2);
            ctx.lineTo(-cell / 2, 0);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
          }
        }
        ctx.restore();
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

      const revealHold = Math.max(revealSecs, (r.voAnswer.dur || 0) + 0.4);
      const guessDur = Math.max(0.5, dur - revealHold);
      // In "hold" mode the countdown only starts once narration is done.
      const voLead = voMode === "hold" ? Math.min(guessDur - 0.2, voLeadOf(r) + 0.3) : 0;
      const timerSpan = Math.max(0.2, guessDur - voLead);
      const timerElapsed = Math.max(0, local - voLead);
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
        const hw = highlightWord.trim() ? (uppercase ? highlightWord.toUpperCase() : highlightWord) : "";
        if (hw && title.includes(hw)) {
          const idx = title.indexOf(hw);
          const before = title.slice(0, idx);
          const after = title.slice(idx + hw.length);
          ctx.textAlign = "left";
          const beforeW = ctx.measureText(before).width;
          const hwW = ctx.measureText(hw).width;
          const startX = w / 2 - tw / 2;
          ctx.fillStyle = pal.text;
          ctx.fillText(before, startX, by);
          ctx.fillStyle = pal.accent;
          ctx.fillText(hw, startX + beforeW, by);
          ctx.fillStyle = pal.text;
          ctx.fillText(after, startX + beforeW + hwW, by);
        } else {
          ctx.fillStyle = pal.text;
          ctx.fillText(title, w / 2, by, w - M * 2 - padX * 2);
        }
        ctx.restore();
      }

      // ---- round number badge / category chip ----
      const chipY = by + hs * 1.9;
      const roundNoStyleSpec = styles.roundNo ?? defaultStyle();
      const cs = Math.round(hs * 0.5);
      const hasCategory = showCategory && r.category.trim().length > 0;
      if (showRoundNo && roundNoStyleSpec.visible) {
        const roundAnim = computeAnim(anims.roundNo ?? defaultAnim(), local);
        const badgeY = hasCategory ? chipY - cs * 0.9 : chipY;
        ctx.save();
        applyStyle(ctx, roundNoStyleSpec, w / 2, badgeY, w, h);
        applyAnim(ctx, roundAnim, w / 2, badgeY);
        ctx.globalAlpha *= inK;
        ctx.font = `800 ${cs}px system-ui, sans-serif`;
        drawRoundBadge(
          ctx,
          roundBadgeId,
          `ROUND ${index + 1}`,
          w / 2,
          badgeY,
          cs,
          { primary: pal.primary, accent: pal.accent, text: pal.text },
          { t: absT },
        );
        ctx.restore();
      }
      if (hasCategory) {
        const catY = showRoundNo && roundNoStyleSpec.visible ? chipY + cs * 1.1 : chipY;
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${cs}px ${FX_FONT}`;
        const label = r.category.toUpperCase();
        const wch = ctx.measureText(label).width + cs * 1.6;
        const x = w / 2 - wch / 2;
        ctx.globalAlpha *= inK;
        ctx.fillStyle = hexA(pal.accent, 0.18);
        roundRect(ctx, x, catY - cs, wch, cs * 2, cs);
        ctx.fill();
        ctx.strokeStyle = hexA(pal.accent, 0.7);
        ctx.lineWidth = Math.max(1.5, cs * 0.08);
        ctx.stroke();
        ctx.fillStyle = pal.accent;
        ctx.fillText(label, x + cs * 0.8, catY + cs * 0.04);
        ctx.restore();
      }

      // ---- emoji card (fully controllable via emojiBox) ----
      const cardW = (emojiBox.width / 100) * w;
      const cardH = (emojiBox.height / 100) * h;
      const cx = (emojiBox.x / 100) * w;
      const cyCard = (emojiBox.y / 100) * h;
      const cardTop = cyCard - cardH / 2;
      const minWH = Math.min(w, h);

      ctx.save();
      ctx.globalAlpha = inK * emojiBox.opacity;
      const breathe = 1 + Math.sin(absT * 1.4) * 0.006 * bounce;
      ctx.translate(cx, cyCard);
      ctx.scale(breathe, breathe);
      ctx.translate(-cx, -cyCard);
      if (style !== "clean" || emojiBox.borderWidth > 0 || emojiBox.opacity > 0) {
        const boxRadius = (emojiBox.radius / 100) * minWH;
        if (emojiBox.shadow) {
          ctx.shadowColor = "rgba(0,0,0,0.45)";
          ctx.shadowBlur = minWH * 0.02;
          ctx.shadowOffsetY = minWH * 0.006;
        }
        ctx.fillStyle = hexA(emojiBox.bg, style === "chalk" ? 0.28 : 0.35 * emojiBox.opacity + (emojiBox.opacity < 1 ? 0 : 0));
        roundRect(ctx, cx - cardW / 2, cyCard - cardH / 2, cardW, cardH, boxRadius);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        const borderCol = emojiBox.borderColor || pal.primary;
        if (emojiBox.borderWidth > 0) {
          ctx.strokeStyle = hexA(borderCol, style === "chalk" ? 0.5 : 0.75);
          ctx.lineWidth = Math.max(1, minWH * (emojiBox.borderWidth / 100));
          if (style === "chalk") ctx.setLineDash([minWH * 0.02, minWH * 0.012]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();

      // emojis, laid out on a fitted row (wraps to two rows if needed)
      const list = emojiList(r.emojis);
      const emojiStyleSpec = styles.emoji ?? defaultStyle();
      if (list.length && emojiStyleSpec.visible) {
        const perRow = list.length > 4 ? Math.ceil(list.length / 2) : list.length;
        const rows: string[][] = [];
        for (let i = 0; i < list.length; i += perRow) rows.push(list.slice(i, i + perRow));
        const padFrac = Math.max(0, 1 - (emojiBox.padding / 100) * 2);
        const maxCell = Math.min(
          (cardW * padFrac) / perRow,
          (cardH * padFrac) / rows.length,
        );
        const size = maxCell * 0.92 * emojiScale * emojiBox.emojiSize;
        const emojiAnim = computeAnim(anims.emoji ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, emojiStyleSpec, cx, cyCard, w, h);
        applyAnim(ctx, emojiAnim, cx, cyCard);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
        rows.forEach((row, ri) => {
          const rowY = cyCard + (ri - (rows.length - 1) / 2) * maxCell * 1.02 * emojiLineHeight * emojiBox.spacing;
          row.forEach((e, i) => {
            const idx = ri * perRow + i;
            const pop = ease.back(Math.max(0, Math.min(1, (local - 0.12 * idx) / 0.45)));
            const wobble = Math.sin(absT * 2 + idx * 1.2) * 0.02 * bounce;
            const x = cx + (i - (row.length - 1) / 2) * maxCell * 1.02 * emojiGap * emojiBox.spacing;
            ctx.save();
            ctx.translate(x, rowY);
            ctx.scale(pop * (1 + wobble), pop * (1 - wobble));
            ctx.rotate(Math.sin(absT * 1.1 + idx) * 0.02 * bounce);
            ctx.globalAlpha = Math.max(0, Math.min(1, pop));
            if (emojiOutlineWidth > 0) {
              ctx.lineJoin = "round";
              ctx.miterLimit = 2;
              ctx.strokeStyle = emojiOutlineColor;
              ctx.lineWidth = emojiOutlineWidth;
              ctx.strokeText(e, 0, 0);
            }
            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = size * 0.08;
            ctx.shadowOffsetY = size * 0.02;
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
        const left = Math.max(0, timerSpan - timerElapsed);
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
          timerSpan,
          { primary: pal.primary, accent: "#ef4444", text: pal.text },
          local,
        );
        ctx.restore();
      }

      // ---- time bar (guessing phase only) ----
      const timebarStyleSpec = styles.timebar ?? defaultStyle();
      if (timebarStyleSpec.visible && !revealing) {
        const barW = w - M * 2;
        const barH = Math.max(6, h * 0.012);
        const barX = M;
        const barY = M * 0.55;
        const frac2 = Math.max(0, Math.min(1, 1 - timerElapsed / Math.max(0.01, timerSpan)));
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
        const bandH = Math.min(w, h) * 0.22 * answerBoxScale;
        const bandW = Math.min(w - M * 2, Math.min(w, h) * 1.1) * answerBoxScale;
        const bandCx = w / 2 + (answerBoxDx / 100) * w;
        const bandCy = h - M - bandH / 2 + (answerBoxDy / 100) * h;
        const bandX = bandCx - bandW / 2;
        const bandY = bandCy - bandH / 2;
        ctx.save();
        applyStyle(ctx, answerStyleSpec, bandCx, bandCy, w, h);
        applyAnim(ctx, answerAnim, bandCx, bandCy);
        ctx.translate(0, (1 - revealK) * bandH * 0.4);
        const answer = uppercase ? r.answer.toUpperCase() : r.answer;
        drawAnswerBox(ctx, {
          style: answerBoxStyle,
          x: bandX,
          y: bandY,
          w: bandW,
          h: bandH,
          text: answer,
          t: revealK,
          accent: answerBoxAccent.trim() || pal.accent,
          textColor: answerBoxTextColor.trim() || pal.text,
          bg: answerBoxBg.trim() || pal.primary,
          font: FX_FONT,
        });
        ctx.restore();
      }

      // ---- vertical side text ----
      {
        const items: { x: number; rot: number; text: string }[] = [];
        if (sideText.leftVisible && sideText.left.trim()) {
          items.push({ x: M * 0.4, rot: -Math.PI / 2, text: sideText.left });
        }
        if (sideText.rightVisible && sideText.right.trim()) {
          items.push({ x: w - M * 0.4, rot: Math.PI / 2, text: sideText.right });
        }
        items.forEach(({ x, rot, text }) => {
          ctx.save();
          ctx.translate(x, h / 2);
          ctx.rotate(rot);
          ctx.font = `700 ${Math.round(Math.min(w, h) * 0.018)}px ${FX_FONT}`;
          ctx.fillStyle = hexA(pal.text, 0.35);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text.repeat(3), 0, 0);
          ctx.restore();
        });
      }

      // ---- channel logo (always on top) ----
      if (channelLogo.visible && !channelLogoImgRef.current && channelLogoEmoji.trim()) {
        const base = Math.min(w, h) * 0.11 * channelLogo.scale;
        const pad = base * 0.9;
        let ax = w - pad;
        let ay = h - pad;
        if (channelLogo.corner === "top-left") { ax = pad; ay = pad; }
        else if (channelLogo.corner === "top-right") { ax = w - pad; ay = pad; }
        else if (channelLogo.corner === "top-center") { ax = w / 2; ay = pad; }
        else if (channelLogo.corner === "bottom-left") { ax = pad; ay = h - pad; }
        else if (channelLogo.corner === "bottom-center") { ax = w / 2; ay = h - pad; }
        ax += (channelLogo.dx / 100) * w;
        ay += (channelLogo.dy / 100) * h;
        ctx.save();
        ctx.globalAlpha = channelLogo.opacity;
        ctx.translate(ax, ay);
        ctx.rotate((channelLogo.rotate * Math.PI) / 180);
        ctx.font = `${Math.round(base * 1.4)}px ${EMOJI_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(channelLogoEmoji, 0, 0);
        ctx.restore();
      } else {
        drawChannelLogo(ctx, channelLogoImgRef.current, channelLogo, w, h, absT);
      }
    },
    [
      anims,
      voMode,
      voLeadOf,
      answerBoxAccent,
      answerBoxBg,
      answerBoxDx,
      answerBoxDy,
      answerBoxScale,
      answerBoxStyle,
      answerBoxTextColor,
      aspect,
      bounce,
      channelLogo,
      channelLogoEmoji,
      drawBackground,
      drawConfetti,
      emojiBox,
      emojiGap,
      emojiLineHeight,
      emojiOutlineColor,
      emojiOutlineWidth,
      emojiScale,
      heading,
      highlightWord,
      pal,
      revealSecs,
      roundBadgeId,
      showCategory,
      showHint,
      showRoundNo,
      showTimer,
      sideText,
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
      // ---- round-to-round transition overlay ----
      const half = roundTransition.duration / 2;
      for (let i = 0; i < timeline.segs.length - 1; i++) {
        const boundary = timeline.segs[i + 1].start;
        if (t >= boundary - half && t <= boundary + half) {
          const progress = (t - (boundary - half)) / Math.max(0.01, roundTransition.duration);
          const cov = roundTransitionCoverage(roundTransition, progress);
          const activeSeg = cov < 1 && progress < 0.5 ? timeline.segs[i] : timeline.segs[i + 1];
          const local = Math.max(0, Math.min(activeSeg.dur, t - activeSeg.start));
          drawRound(ctx, w, h, activeSeg.round, activeSeg.index, local, activeSeg.dur, t);
          drawRoundTransition(ctx, roundTransition, progress, w, h);
          return;
        }
      }

      const seg =
        timeline.segs.find((s) => t >= s.start && t < s.start + s.dur) ??
        timeline.segs[timeline.segs.length - 1];
      if (!seg) return;
      drawRound(ctx, w, h, seg.round, seg.index, Math.max(0, t - seg.start), seg.dur, t);
    },
    [dims, drawRound, intro, outro, timeline, roundTransition],
  );

  // preview loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const playVoOnce = (key: string, url: string | null, vol: number) => {
      if (!url || playedRef.current.has(key)) return;
      playedRef.current.add(key);
      const el = new Audio(url);
      el.volume = Math.max(0, Math.min(1, vol));
      audioElRef.current = el;
      void el.play().catch(() => {});
    };
    const loop = (now: number) => {
      if (playing) {
        const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
        timeRef.current = Math.min(timeline.total, timeRef.current + dt);
        if (timeRef.current >= timeline.total) {
          setPlaying(false);
          timeRef.current = 0;
          playedRef.current.clear();
          lastTimerSecRef.current.clear();
        }
        const seg = timeline.segs.find(
          (sg) => timeRef.current >= sg.start && timeRef.current < sg.start + sg.dur,
        );
        if (seg) {
          const startKey = `${seg.round.id}-start`;
          if (!playedRef.current.has(startKey)) {
            playedRef.current.add(startKey);
            playSfx("start");
            playVoOnce(`${seg.round.id}-intro`, seg.round.voIntro.url, seg.round.voIntro.volume);
          }
          const guessDur = Math.max(0.5, seg.dur - revealSecs);
          const local = timeRef.current - seg.start;
          if (
            seg.round.voMid.url &&
            local >= seg.round.voMidOffset &&
            local < guessDur
          ) {
            playVoOnce(`${seg.round.id}-mid`, seg.round.voMid.url, seg.round.voMid.volume);
          }
          if (!revealSegHandled(seg.round.id) && local >= guessDur) {
            markRevealHandled(seg.round.id);
            playSfx("reveal");
            playVoOnce(`${seg.round.id}-answer`, seg.round.voAnswer.url, seg.round.voAnswer.volume);
          }
          if (local < guessDur) {
            const remaining = Math.max(0, guessDur - local);
            const intRemaining = Math.ceil(remaining);
            if (intRemaining <= 3 && intRemaining >= 1) {
              const last = lastTimerSecRef.current.get(seg.round.id);
              if (last !== intRemaining) {
                lastTimerSecRef.current.set(seg.round.id, intRemaining);
                playSfx("timer");
              }
            }
          }
        }
        timeline.segs.forEach((sg, i) => {
          if (i === 0) return;
          const key = `transition-${sg.round.id}`;
          if (Math.abs(timeRef.current - sg.start) < 0.05 && !playedRef.current.has(key)) {
            playedRef.current.add(key);
            playSfx("transition");
          }
        });
        setTime(timeRef.current);
      }
      lastRef.current = now;
      drawFrame(ctx, timeRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    const revealSegHandled = (id: string) => playedRef.current.has(`${id}-reveal`);
    const markRevealHandled = (id: string) => playedRef.current.add(`${id}-reveal`);
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawFrame, playing, timeline, playSfx, revealSecs]);

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

  const buildIntroScript = (r: Round) =>
    r.voIntro.script.trim() ||
    `Can you guess this one?${r.category ? ` It's a ${r.category.toLowerCase()}.` : ""}`;
  const buildMidScript = (r: Round) =>
    r.voMid.script.trim() || (r.hint ? `Here's a hint: ${r.hint}.` : "Think carefully, you can do it!");
  const buildAnswerScript = (r: Round) =>
    r.voAnswer.script.trim() || `The answer is ${r.answer || "coming up"}!`;

  const generateVoSlot = async (
    roundId: string,
    slot: "voIntro" | "voMid" | "voAnswer",
    text: string,
  ) => {
    setGenerating(true);
    try {
      const { url, blob } = await generateSpeech(text, { provider, voice, styleDirection: voStyle });
      const dur = await blobDuration(blob);
      setRounds((rs) =>
        rs.map((r) =>
          r.id === roundId ? { ...r, [slot]: { ...r[slot], url, blob, dur } } : r,
        ),
      );
      toast.success("Voiceover generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voiceover failed");
    } finally {
      setGenerating(false);
    }
  };

  const generateAll = async () => {
    if (!rounds.length) return;
    setGenerating(true);
    try {
      for (const r of rounds) {
        const intro = await generateSpeech(buildIntroScript(r), { provider, voice, styleDirection: voStyle });
        const introDur = await blobDuration(intro.blob);
        const mid = await generateSpeech(buildMidScript(r), { provider, voice, styleDirection: voStyle });
        const midDur = await blobDuration(mid.blob);
        const ans = await generateSpeech(buildAnswerScript(r), { provider, voice, styleDirection: voStyle });
        const ansDur = await blobDuration(ans.blob);
        setRound(r.id, {
          voIntro: { ...r.voIntro, url: intro.url, blob: intro.blob, dur: introDur },
          voMid: { ...r.voMid, url: mid.url, blob: mid.blob, dur: midDur },
          voAnswer: { ...r.voAnswer, url: ans.url, blob: ans.blob, dur: ansDur },
        });
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
      const cues: KidAudioCue[] = [];
      const playVo = async (blob: Blob | null, atSeconds: number, vol: number) => {
        if (!blob) return;
        const buf = await audioCtx.decodeAudioData(await blob.arrayBuffer());
        const src = audioCtx.createBufferSource();
        const g = audioCtx.createGain();
        g.gain.value = Math.max(0, vol);
        src.buffer = buf;
        src.connect(g);
        g.connect(dest);
        src.start(Math.max(0, audioCtx.currentTime + atSeconds));
      };
      for (const seg of timeline.segs) {
        const guessDur = Math.max(0.5, seg.dur - revealSecs);
        cues.push({ kind: "start", time: seg.start });
        if (seg.index > 0) cues.push({ kind: "transition", time: seg.start });
        cues.push({ kind: "reveal", time: seg.start + guessDur });
        for (let s = 1; s <= 3; s++) {
          const t = seg.start + guessDur - s;
          if (t >= seg.start) cues.push({ kind: "timer", time: t });
        }
        await playVo(seg.round.voIntro.blob, seg.start + 0.15, seg.round.voIntro.volume);
        await playVo(seg.round.voMid.blob, seg.start + seg.round.voMidOffset, seg.round.voMid.volume);
        await playVo(seg.round.voAnswer.blob, seg.start + guessDur + 0.1, seg.round.voAnswer.volume);
      }
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

      const sfxBuf = await renderKidSfxBuffer(audio, cues, timeline.total);
      const musicBuf = await renderKidMusicBuffer(audio, timeline.total);
      for (const buf of [sfxBuf, musicBuf]) {
        if (!buf) continue;
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start(audioCtx.currentTime);
      }

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
                  <div className="mt-3 space-y-3 rounded-lg border border-dashed p-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Intro voiceover (round start)</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={generating}
                          onClick={() => generateVoSlot(r.id, "voIntro", buildIntroScript(r))}
                        >
                          <Wand2 className="mr-1 h-3 w-3" /> Generate
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        value={r.voIntro.script}
                        placeholder={buildIntroScript(r)}
                        onChange={(e) => setRound(r.id, { voIntro: { ...r.voIntro, script: e.target.value } })}
                      />
                      {r.voIntro.url && (
                        <audio controls src={r.voIntro.url} className="w-full h-8">
                          <track kind="captions" />
                        </audio>
                      )}
                      <div>
                        <Label className="text-[11px] text-muted-foreground">
                          Volume · {Math.round(r.voIntro.volume * 100)}%
                        </Label>
                        <Slider
                          value={[r.voIntro.volume]}
                          min={0}
                          max={1.5}
                          step={0.05}
                          onValueChange={([v]) => setRound(r.id, { voIntro: { ...r.voIntro, volume: v } })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Hint/middle voiceover (during guessing)</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={generating}
                          onClick={() => generateVoSlot(r.id, "voMid", buildMidScript(r))}
                        >
                          <Wand2 className="mr-1 h-3 w-3" /> Generate
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        value={r.voMid.script}
                        placeholder={buildMidScript(r)}
                        onChange={(e) => setRound(r.id, { voMid: { ...r.voMid, script: e.target.value } })}
                      />
                      {r.voMid.url && (
                        <audio controls src={r.voMid.url} className="w-full h-8">
                          <track kind="captions" />
                        </audio>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">
                            Offset · {r.voMidOffset.toFixed(1)}s
                          </Label>
                          <Slider
                            value={[r.voMidOffset]}
                            min={0}
                            max={8}
                            step={0.1}
                            onValueChange={([v]) => setRound(r.id, { voMidOffset: v })}
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">
                            Volume · {Math.round(r.voMid.volume * 100)}%
                          </Label>
                          <Slider
                            value={[r.voMid.volume]}
                            min={0}
                            max={1.5}
                            step={0.05}
                            onValueChange={([v]) => setRound(r.id, { voMid: { ...r.voMid, volume: v } })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Answer voiceover (reveal)</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={generating}
                          onClick={() => generateVoSlot(r.id, "voAnswer", buildAnswerScript(r))}
                        >
                          <Wand2 className="mr-1 h-3 w-3" /> Generate
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        value={r.voAnswer.script}
                        placeholder={buildAnswerScript(r)}
                        onChange={(e) => setRound(r.id, { voAnswer: { ...r.voAnswer, script: e.target.value } })}
                      />
                      {r.voAnswer.url && (
                        <audio controls src={r.voAnswer.url} className="w-full h-8">
                          <track kind="captions" />
                        </audio>
                      )}
                      <div>
                        <Label className="text-[11px] text-muted-foreground">
                          Volume · {Math.round(r.voAnswer.volume * 100)}%
                        </Label>
                        <Slider
                          value={[r.voAnswer.volume]}
                          min={0}
                          max={1.5}
                          step={0.05}
                          onValueChange={([v]) => setRound(r.id, { voAnswer: { ...r.voAnswer, volume: v } })}
                        />
                      </div>
                    </div>
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
                <Label className="text-xs text-muted-foreground">Highlighted word in heading</Label>
                <Input
                  value={highlightWord}
                  placeholder="Word to colour with accent"
                  onChange={(e) => setHighlightWord(e.target.value)}
                />
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
              <div>
                <Label className="text-xs text-muted-foreground">
                  Emoji spacing · {Math.round(emojiGap * 100)}%
                </Label>
                <Slider
                  value={[emojiGap]}
                  min={0.6}
                  max={1.8}
                  step={0.02}
                  onValueChange={([v]) => setEmojiGap(v)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Emoji line height · {Math.round(emojiLineHeight * 100)}%
                </Label>
                <Slider
                  value={[emojiLineHeight]}
                  min={0.6}
                  max={1.8}
                  step={0.02}
                  onValueChange={([v]) => setEmojiLineHeight(v)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Emoji outline width · {emojiOutlineWidth}px
                </Label>
                <Slider
                  value={[emojiOutlineWidth]}
                  min={0}
                  max={24}
                  step={1}
                  onValueChange={([v]) => setEmojiOutlineWidth(v)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Emoji outline colour</Label>
                <input
                  type="color"
                  value={emojiOutlineColor}
                  onChange={(e) => setEmojiOutlineColor(e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border"
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
              <VoTimingControls
                mode={voMode}
                onModeChange={setVoMode}
                resultSecs={revealSecs}
                onResultSecsChange={setRevealSecs}
              />
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
              <CardDescription>The progress bar only runs during the guessing phase.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <TimerStylePicker value={timerStyle} onChange={setTimerStyle} />
              <TimeBarStylePicker value={timebarStyle} onChange={setTimebarStyle} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Round badge</CardTitle>
              <CardDescription>Pick how the round number is displayed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RoundBadgePicker value={roundBadgeId} onChange={setRoundBadgeId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Round transition</CardTitle>
              <CardDescription>Plays between rounds, in both preview and export.</CardDescription>
            </CardHeader>
            <CardContent>
              <RoundTransitionControls value={roundTransition} onChange={setRoundTransition} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Channel logo</CardTitle>
              <CardDescription>Upload a badge/logo shown on the frame.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                {channelLogoUrl && (
                  <img
                    src={channelLogoUrl}
                    alt="Channel logo preview"
                    className="h-10 w-10 rounded-full border object-cover"
                  />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={(e) => onChannelLogoFile(e.target.files?.[0] ?? null)}
                />
                {channelLogoUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setChannelLogoUrl(null)}>
                    Remove
                  </Button>
                )}
              </div>
              <ChannelLogoControls value={channelLogo} onChange={setChannelLogo} />
              <div>
                <Label className="text-xs text-muted-foreground">Or use an emoji as the logo</Label>
                <Input
                  value={channelLogoEmoji}
                  placeholder="⚡"
                  onChange={(e) => setChannelLogoEmoji(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used when no image is uploaded above.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Side text</CardTitle>
              <CardDescription>Editable vertical text on the left/right edges.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  Left text
                  <Switch
                    checked={sideText.leftVisible}
                    onCheckedChange={(v) => setSideText((s) => ({ ...s, leftVisible: v }))}
                  />
                </label>
                <Input value={sideText.left} onChange={(e) => setSideText((s) => ({ ...s, left: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  Right text
                  <Switch
                    checked={sideText.rightVisible}
                    onCheckedChange={(v) => setSideText((s) => ({ ...s, rightVisible: v }))}
                  />
                </label>
                <Input value={sideText.right} onChange={(e) => setSideText((s) => ({ ...s, right: e.target.value }))} />
              </div>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emoji box</CardTitle>
              <CardDescription>Resize and reposition the box so the other elements fit around it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {([
                ["width", "Width", 20, 100, 1, "%"],
                ["height", "Height", 8, 70, 1, "%"],
                ["x", "Center X", 0, 100, 1, "%"],
                ["y", "Center Y", 0, 100, 1, "%"],
                ["radius", "Corner radius", 0, 20, 0.5, ""],
                ["padding", "Inner padding", 0, 20, 0.5, ""],
                ["emojiSize", "Emoji size", 0.4, 2, 0.02, "x"],
                ["spacing", "Emoji spacing", 0.2, 3, 0.02, "x"],
                ["opacity", "Box opacity", 0, 1, 0.02, ""],
                ["borderWidth", "Border width", 0, 4, 0.1, ""],
              ] as const).map(([key, label, min, max, step, unit]) => (
                <div key={key}>
                  <Label className="text-[11px] text-muted-foreground">
                    {label} · {Number(emojiBox[key]).toFixed(step < 1 ? 2 : 0)}
                    {unit}
                  </Label>
                  <Slider
                    value={[Number(emojiBox[key])]}
                    min={min}
                    max={max}
                    step={step}
                    onValueChange={([v]) => setEmojiBoxPatch({ [key]: v } as Partial<EmojiBoxSpec>)}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Box colour</Label>
                  <Input
                    value={emojiBox.bg}
                    onChange={(e) => setEmojiBoxPatch({ bg: e.target.value })}
                    placeholder="#000000"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Border colour</Label>
                  <Input
                    value={emojiBox.borderColor}
                    onChange={(e) => setEmojiBoxPatch({ borderColor: e.target.value })}
                    placeholder="auto"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Drop shadow</Label>
                <Switch
                  checked={emojiBox.shadow}
                  onCheckedChange={(v) => setEmojiBoxPatch({ shadow: v })}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setEmojiBox(defaultEmojiBox())}>
                Reset box
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Answer box</CardTitle>
              <CardDescription>Style, colours and placement of the reveal chip.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={answerBoxStyle} onValueChange={setAnswerBoxStyle}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANSWER_BOX_STYLES.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Accent</Label>
                  <Input
                    value={answerBoxAccent}
                    onChange={(e) => setAnswerBoxAccent(e.target.value)}
                    placeholder="auto"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Text</Label>
                  <Input
                    value={answerBoxTextColor}
                    onChange={(e) => setAnswerBoxTextColor(e.target.value)}
                    placeholder="auto"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Fill</Label>
                  <Input
                    value={answerBoxBg}
                    onChange={(e) => setAnswerBoxBg(e.target.value)}
                    placeholder="auto"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Scale · {answerBoxScale.toFixed(2)}x</Label>
                <Slider value={[answerBoxScale]} min={0.5} max={1.8} step={0.02} onValueChange={([v]) => setAnswerBoxScale(v)} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Offset X · {answerBoxDx}%</Label>
                <Slider value={[answerBoxDx]} min={-40} max={40} step={1} onValueChange={([v]) => setAnswerBoxDx(v)} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Offset Y · {answerBoxDy}%</Label>
                <Slider value={[answerBoxDy]} min={-60} max={20} step={1} onValueChange={([v]) => setAnswerBoxDy(v)} />
              </div>
            </CardContent>
          </Card>

          <KidAudioCard value={audio} onChange={setAudio} />

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
