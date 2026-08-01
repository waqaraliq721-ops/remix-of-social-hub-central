import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  Play,
  Pause,
  Download,
  Loader2,
  Trash2,
  Plus,
  Shuffle,
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

export const Route = createFileRoute("/_authenticated/kid-videos/math")({
  head: () => ({
    meta: [
      { title: "Mental Math Quiz Videos — Orbit" },
      {
        name: "description",
        content:
          "Create multi-round Mental Math quiz videos: auto-generated or manual arithmetic questions, four-option answers, difficulty levels, animated timers and 1080p export.",
      },
      { property: "og:title", content: "Mental Math Quiz Videos — Orbit" },
      {
        property: "og:description",
        content:
          "Ray-burst mental math quizzes for kids: rounds, difficulty levels, animated answer reveals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MathPage,
});

type AspectKey = "9:16" | "1:1" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · TikTok/Reels/Shorts" },
  "1:1": { w: 1080, h: 1080, label: "Square · Feed" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

type Difficulty = "easy" | "medium" | "hard" | "impossible";
const DIFFICULTIES: { id: Difficulty; label: string; color: string }[] = [
  { id: "easy", label: "Easy", color: "#22c55e" },
  { id: "medium", label: "Medium", color: "#eab308" },
  { id: "hard", label: "Hard", color: "#f97316" },
  { id: "impossible", label: "Impossible", color: "#ef4444" },
];

const LETTER_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981"];

type Pal = PaletteLike & { id: string; name: string };
const PALETTES: Pal[] = [
  {
    id: "electric",
    name: "Electric",
    bg: ["#1e0a4e", "#7c2ae8"],
    primary: "#fbbf24",
    accent: "#22d3ee",
    text: "#ffffff",
    muted: "#d8c9f5",
  },
  {
    id: "inferno",
    name: "Inferno",
    bg: ["#3b0a0a", "#dc2626"],
    primary: "#fde047",
    accent: "#fb923c",
    text: "#ffffff",
    muted: "#fecaca",
  },
  {
    id: "ocean",
    name: "Ocean Bolt",
    bg: ["#03264d", "#0ea5e9"],
    primary: "#facc15",
    accent: "#34d399",
    text: "#ffffff",
    muted: "#bae6fd",
  },
  {
    id: "grape",
    name: "Grape Zap",
    bg: ["#1a0a2e", "#9333ea"],
    primary: "#f472b6",
    accent: "#a3e635",
    text: "#ffffff",
    muted: "#e9d5ff",
  },
];

const ELEMENT_LIST: { key: string; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "question", label: "Expression" },
  { key: "answer", label: "Answer highlight" },
  { key: "options", label: "Answer options" },
  { key: "timer", label: "Countdown timer" },
  { key: "timebar", label: "Time bar" },
  { key: "roundNumber", label: "Round number" },
  { key: "footer", label: "Footer text" },
];

const ANIM_ELEMENTS: { key: string; label: string }[] = [
  { key: "background", label: "Background" },
  ...ELEMENT_LIST,
];

function defaultAnimMap(): Record<string, ElementAnimSpec> {
  return {
    background: defaultAnim({ preset: "none", loop: "none" }),
    title: defaultAnim({ preset: "slide-down", duration: 0.45 }),
    question: defaultAnim({ preset: "bounce-in", duration: 0.6 }),
    answer: defaultAnim({ preset: "pop", duration: 0.4 }),
    options: defaultAnim({ preset: "slide-up", duration: 0.5, delay: 0.15 }),
    timer: defaultAnim({ preset: "fade", duration: 0.3 }),
    timebar: defaultAnim({ preset: "fade", duration: 0.3 }),
    roundNumber: defaultAnim({ preset: "pop", duration: 0.4, loop: "float", intensity: 0.5 }),
    footer: defaultAnim({ preset: "fade", duration: 0.5, loop: "none" }),
  };
}

function defaultStyleMap(): Record<string, ElementStyleSpec> {
  return Object.fromEntries(ELEMENT_LIST.map((e) => [e.key, defaultStyle()]));
}

const uid = () => Math.random().toString(36).slice(2, 9);

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeOptions(answer: number): { options: string[]; correctIndex: number } {
  const set = new Set<number>([answer]);
  const spread = Math.max(2, Math.round(Math.abs(answer) * 0.15) + 1);
  while (set.size < 4) {
    const delta = randInt(-spread * 3, spread * 3);
    const candidate = answer + (delta === 0 ? spread : delta);
    set.add(candidate);
  }
  const values = Array.from(set);
  // shuffle
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  const correctIndex = values.indexOf(answer);
  return { options: values.map((v) => String(v)), correctIndex };
}

function genQuestion(diff: Difficulty): { expr: string; answer: number } {
  if (diff === "easy") {
    const a = randInt(1, 20);
    const b = randInt(1, 20);
    const op = Math.random() < 0.5 ? "+" : "-";
    const [x, y] = op === "-" && b > a ? [b, a] : [a, b];
    return { expr: `${x} ${op} ${y}`, answer: op === "+" ? x + y : x - y };
  }
  if (diff === "medium") {
    if (Math.random() < 0.5) {
      const a = randInt(2, 12);
      const b = randInt(2, 12);
      return { expr: `${a} × ${b}`, answer: a * b };
    }
    const a = randInt(20, 99);
    const b = randInt(10, 60);
    const op = Math.random() < 0.5 ? "+" : "-";
    const [x, y] = op === "-" && b > a ? [b, a] : [a, b];
    return { expr: `${x} ${op} ${y}`, answer: op === "+" ? x + y : x - y };
  }
  if (diff === "hard") {
    if (Math.random() < 0.5) {
      const a = randInt(2, 20);
      const b = randInt(2, 12);
      const c = randInt(1, 20);
      const op = Math.random() < 0.5 ? "+" : "-";
      const base = a * b;
      return { expr: `${a} × ${b} ${op} ${c}`, answer: op === "+" ? base + c : base - c };
    }
    const b = randInt(2, 12);
    const answer = randInt(2, 12);
    return { expr: `${b * answer} ÷ ${b}`, answer };
  }
  // impossible
  if (Math.random() < 0.4) {
    const a = randInt(11, 30);
    const b = randInt(11, 30);
    return { expr: `${a} × ${b}`, answer: a * b };
  }
  if (Math.random() < 0.6) {
    const a = randInt(2, 12);
    return { expr: `${a}²`, answer: a * a };
  }
  const a = randInt(10, 30);
  const b = randInt(2, 12);
  const c = randInt(2, 12);
  const base = a * b;
  return { expr: `${a} × ${b} + ${c}`, answer: base + c };
}

type Round = {
  id: string;
  difficulty: Difficulty;
  expr: string;
  answer: number;
  options: string[];
  correctIndex: number;
  duration: number;
};

function generateRound(difficulty: Difficulty, duration = 6): Round {
  const { expr, answer } = genQuestion(difficulty);
  const { options, correctIndex } = makeOptions(answer);
  return { id: uid(), difficulty, expr, answer, options, correctIndex, duration };
}

function MathPage() {
  const [aspect, setAspect] = useState<AspectKey>("16:9");
  const [paletteId, setPaletteId] = useState(PALETTES[0].id);
  const [colors, setColors] = useState<ColorOverrides>({});
  const [rounds, setRounds] = useState<Round[]>([
    generateRound("easy"),
    generateRound("medium"),
    generateRound("hard"),
  ]);
  const [heading, setHeading] = useState("Mental Math");
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

  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, title: "Mental Math" });
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

      // ---- lightning difficulty badge, top-right ----
      if (styles.roundNumber?.visible ?? true) {
        const badgeAnim = computeAnim(anims.roundNumber ?? defaultAnim(), local);
        const r0 = Math.min(w, h) * 0.055;
        const bx = w - M - r0;
        const by = M + r0;
        const diffColor = DIFFICULTIES.find((d) => d.id === r.difficulty)?.color ?? pal.accent;
        ctx.save();
        applyStyle(ctx, styles.roundNumber, bx, by, w, h);
        applyAnim(ctx, badgeAnim, bx, by);
        ctx.beginPath();
        ctx.arc(bx, by, r0, 0, Math.PI * 2);
        ctx.fillStyle = hexA("#000000", 0.5);
        ctx.fill();
        ctx.strokeStyle = diffColor;
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
      if (styles.footer?.visible ?? true) {
        const sideAnim = computeAnim(anims.footer ?? defaultAnim(), local);
        const label = "MENTAL MATH • ";
        [M * 0.4, w - M * 0.4].forEach((x, i) => {
          ctx.save();
          applyStyle(ctx, styles.footer, x, h / 2, w, h);
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

      // ---- title + level pill ----
      if (styles.title?.visible ?? true) {
        const titleAnim = computeAnim(anims.title ?? defaultAnim(), local);
        const ts = Math.round(Math.min(w, h) * 0.055);
        ctx.save();
        applyStyle(ctx, styles.title, w / 2, M + ts * 0.5, w, h);
        applyAnim(ctx, titleAnim, w / 2, M + ts * 0.5);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${ts}px ${FX_FONT}`;
        ctx.fillStyle = pal.text;
        ctx.shadowColor = hexA("#000000", 0.5);
        ctx.shadowBlur = ts * 0.2;
        ctx.fillText(heading.toUpperCase(), w / 2, M + ts * 0.55);
        ctx.restore();

        const diff = DIFFICULTIES.find((d) => d.id === r.difficulty) ?? DIFFICULTIES[0];
        const ps = Math.round(ts * 0.42);
        ctx.save();
        applyAnim(ctx, titleAnim, w / 2, M + ts * 1.45);
        ctx.font = `800 ${ps}px ${FX_FONT}`;
        const pw = ctx.measureText(diff.label.toUpperCase()).width + ps * 2.4;
        ctx.fillStyle = hexA(diff.color, 0.85);
        roundRect(ctx, w / 2 - pw / 2, M + ts * 1.15, pw, ps * 1.8, ps);
        ctx.fill();
        ctx.fillStyle = "#0a0a0a";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(diff.label.toUpperCase(), w / 2, M + ts * 1.15 + ps * 0.94);
        ctx.restore();
      }

      // ---- expression ----
      const exprY = h * (aspect === "16:9" ? 0.36 : 0.32);
      if (styles.question?.visible ?? true) {
        const qAnim = computeAnim(anims.question ?? defaultAnim(), local);
        ctx.save();
        applyStyle(ctx, styles.question, w / 2, exprY, w, h);
        applyAnim(ctx, qAnim, w / 2, exprY);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const base = Math.round(Math.min(w, h) * 0.14);
        const size = fitText(ctx, r.expr, w - M * 2, base, 900);
        ctx.font = `900 ${size}px ${FX_FONT}`;
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = hexA("#000000", 0.55);
        ctx.shadowBlur = size * 0.25;
        ctx.shadowOffsetY = size * 0.03;
        ctx.fillText(r.expr, w / 2, exprY);
        ctx.restore();
      }

      // ---- options ----
      const grid = aspect === "16:9";
      const optTop = h * (aspect === "16:9" ? 0.52 : 0.46);
      const optBottom = h - M - Math.min(w, h) * 0.08;
      const optArea = optBottom - optTop;
      const rowH = grid ? optArea * 0.42 : optArea * 0.22;
      const gap = grid ? optArea * 0.08 : optArea * 0.06;
      const colW = grid ? (w - M * 2 - gap) / 2 : w - M * 2;

      const positions = r.options.map((_, i) => {
        if (grid) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          return {
            x: M + col * (colW + gap),
            y: optTop + row * (rowH + gap),
          };
        }
        return { x: M, y: optTop + i * (rowH + gap) };
      });

      if (styles.options?.visible ?? true)
      r.options.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const isCorrect = i === r.correctIndex;
        const pos = positions[i];
        const optAnim = computeAnim(
          { ...(anims.options ?? defaultAnim()), delay: (anims.options?.delay ?? 0) + i * 0.08 },
          local,
        );
        const cx0 = pos.x + colW / 2;
        const cy0 = pos.y + rowH / 2;
        ctx.save();
        applyStyle(ctx, styles.options, cx0, cy0, w, h);
        applyAnim(ctx, optAnim, cx0, cy0);
        let alpha = 1;
        let scale = 1;
        if (revealing) {
          if (isCorrect) {
            scale = 1 + ease.back(revealK) * 0.08;
          } else {
            alpha = 1 - revealK * 0.6;
          }
        }
        ctx.globalAlpha *= alpha;
        ctx.translate(cx0, cy0);
        ctx.scale(scale, scale);
        ctx.translate(-cx0, -cy0);

        // pill
        ctx.fillStyle = isCorrect && revealing ? hexA(pal.accent, 0.95) : "#ffffff";
        roundRect(ctx, pos.x, pos.y, colW, rowH, rowH * 0.4);
        ctx.fill();
        if (isCorrect && revealing) {
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = Math.max(3, rowH * 0.08);
          ctx.stroke();
          if (styles.answer?.visible ?? true) {
            const ansAnim = computeAnim(anims.answer ?? defaultAnim(), local - guessDur);
            ctx.save();
            applyStyle(ctx, styles.answer, pos.x + colW - rowH * 0.3, pos.y + rowH * 0.3, w, h);
            applyAnim(ctx, ansAnim, pos.x + colW - rowH * 0.3, pos.y + rowH * 0.3);
            ctx.beginPath();
            ctx.arc(pos.x + colW - rowH * 0.3, pos.y + rowH * 0.3, rowH * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = "#22c55e";
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = `900 ${Math.round(rowH * 0.28)}px ${FX_FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("✓", pos.x + colW - rowH * 0.3, pos.y + rowH * 0.32);
            ctx.restore();
          }
        }

        // letter badge
        const badgeR = rowH * 0.36;
        const badgeCx = pos.x + badgeR * 1.3;
        const badgeCy = pos.y + rowH / 2;
        ctx.beginPath();
        ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = LETTER_COLORS[i % LETTER_COLORS.length];
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${Math.round(badgeR * 1.05)}px ${FX_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, badgeCx, badgeCy + badgeR * 0.05);

        // option text
        ctx.fillStyle = "#111827";
        ctx.font = `800 ${Math.round(rowH * 0.42)}px ${FX_FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(opt, badgeCx + badgeR * 1.5, badgeCy + rowH * 0.02);
        ctx.restore();
      });

      // ---- countdown timer ----
      if (showTimer && (styles.timer?.visible ?? true)) {
        const timerAnim = computeAnim(anims.timer ?? defaultAnim(), local);
        const remaining = Math.max(0, guessDur - local);
        const tr = Math.min(w, h) * 0.05;
        const tx = w - M - tr;
        const ty = h - M - tr;
        ctx.save();
        applyStyle(ctx, styles.timer, tx, ty, w, h);
        applyAnim(ctx, timerAnim, tx, ty);
        drawTimer(ctx, timerStyle, tx, ty, tr, remaining, guessDur, {
          primary: pal.primary,
          accent: pal.accent,
          text: pal.text,
        }, absT);
        ctx.restore();
      }

      // ---- bottom time bar ----
      if (showTimer && (styles.timebar?.visible ?? true)) {
        const timebarAnim = computeAnim(anims.timebar ?? defaultAnim(), local);
        const barW = w - M * 2.4;
        const barH = Math.min(w, h) * 0.022;
        const barY = h - M * 0.9;
        const frac = 1 - Math.max(0, Math.min(1, local / Math.max(0.01, guessDur)));
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
    },
    [aspect, anims, styles, backgroundId, backgroundIntensity, timerStyle, timeBarStyle, heading, pal, revealSecs, showTimer],
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
      a.download = `mental-math-quiz.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setExportProgress(100);
      toast.success("Export complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const regenerate = (id: string) =>
    setRounds((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const { expr, answer } = genQuestion(r.difficulty);
        const { options, correctIndex } = makeOptions(answer);
        return { ...r, expr, answer, options, correctIndex };
      }),
    );

  const shuffleAll = () =>
    setRounds((rs) => rs.map((r) => generateRound(r.difficulty, r.duration)));

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
            <Calculator className="h-6 w-6" /> Math Quiz studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-round mental math quizzes with difficulty levels, four-choice answers and animated reveals.
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

      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        <div className="min-w-0 space-y-4 lg:overflow-hidden">
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
                <CardDescription>Each round is one arithmetic question and four options.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={shuffleAll}>
                  <Shuffle className="mr-1 h-4 w-4" /> Regenerate all
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRounds((r) => [...r, generateRound("easy")])}
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => regenerate(r.id)}>
                        <Shuffle className="mr-1 h-4 w-4" /> New question
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setRounds((rs) => rs.filter((x) => x.id !== r.id))}
                        disabled={rounds.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Difficulty</Label>
                      <Select
                        value={r.difficulty}
                        onValueChange={(v) => {
                          const difficulty = v as Difficulty;
                          const { expr, answer } = genQuestion(difficulty);
                          const { options, correctIndex } = makeOptions(answer);
                          setRound(r.id, { difficulty, expr, answer, options, correctIndex });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIFFICULTIES.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Expression</Label>
                      <Input
                        value={r.expr}
                        onChange={(e) => setRound(r.id, { expr: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {r.options.map((opt, oi) => (
                      <div key={oi} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {String.fromCharCode(65 + oi)}
                          {oi === r.correctIndex ? " ✓" : ""}
                        </Label>
                        <Input
                          value={opt}
                          onChange={(e) =>
                            setRound(r.id, {
                              options: r.options.map((o, k) => (k === oi ? e.target.value : o)),
                            })
                          }
                          onClick={() => setRound(r.id, { correctIndex: oi })}
                          className={oi === r.correctIndex ? "border-emerald-500" : ""}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">
                      Round duration · {r.duration.toFixed(1)}s
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
