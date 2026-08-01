import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy,
  ArrowLeft,
  Play,
  Pause,
  Download,
  Loader2,
  Plus,
  Trash2,
  ImagePlus,
  Music,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FX_FONT, ease, hexA, roundRect, wrapText, fitText } from "@/lib/video-fx";
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
import { INTRO_ANIMATIONS, OUTRO_ANIMATIONS } from "@/lib/video-fx";
import { TTS_PROVIDERS, TTS_VOICES, generateSpeech, blobDuration, type TtsProvider } from "@/lib/tts";

export const Route = createFileRoute("/_authenticated/gaming-videos/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking Studio — Gaming Videos — Orbit" },
      {
        name: "description",
        content:
          "Build countdown and tier-list ranking videos for games, characters and loadouts with 6 animated templates, custom palettes and 1080p 60fps export.",
      },
      { property: "og:title", content: "Ranking Studio — Gaming Videos — Orbit" },
      {
        property: "og:description",
        content:
          "Rank anything — countdown #10 to #1 or an S/A/B/C/D tier list — with animated reveals and music.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RankingPage,
});

type AspectKey = "9:16" | "1:1" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · TikTok/Reels/Shorts" },
  "1:1": { w: 1080, h: 1080, label: "Square · Feed" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

type Mode = "countdown" | "tier";
type Tier = "S" | "A" | "B" | "C" | "D";
const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
const TIER_COLORS: Record<Tier, string> = {
  S: "#f87171",
  A: "#fb923c",
  B: "#facc15",
  C: "#4ade80",
  D: "#60a5fa",
};

type Entry = {
  id: string;
  label: string;
  score: string;
  tier: Tier;
  imgUrl: string | null;
  img: HTMLImageElement | null;
};

type TemplateId = "neon" | "tiergrid" | "esports" | "podium" | "split" | "minimal";
const TEMPLATES: { id: TemplateId; name: string; desc: string }[] = [
  { id: "neon", name: "Neon Countdown", desc: "Huge glowing rank number with a floating card." },
  { id: "tiergrid", name: "Tier Grid", desc: "Classic S/A/B/C/D rows filling live." },
  { id: "esports", name: "Esports Card", desc: "Trading-card style badge with stat bar." },
  { id: "podium", name: "Podium Reveal", desc: "Score bars rise like a podium as each entry lands." },
  { id: "split", name: "Split Reveal", desc: "Image and info wipe in from opposite sides." },
  { id: "minimal", name: "Minimal Rank", desc: "Clean big type, no clutter." },
];

type Pal = PaletteLike & { id: string; name: string };
const PALETTES: Pal[] = [
  { id: "arena", name: "Arena Violet", bg: ["#0b0620", "#3b0a6b"], primary: "#a855f7", accent: "#22d3ee", text: "#ffffff", muted: "#c4b5fd" },
  { id: "esports", name: "Esports Red", bg: ["#120404", "#4a0d0d"], primary: "#ef4444", accent: "#fbbf24", text: "#ffffff", muted: "#e5b8b8" },
  { id: "cyber", name: "Cyber Lime", bg: ["#040a04", "#0d2f13"], primary: "#a3e635", accent: "#22d3ee", text: "#ffffff", muted: "#b7d8b0" },
  { id: "gold", name: "Champion Gold", bg: ["#100b00", "#3d2a00"], primary: "#fbbf24", accent: "#f472b6", text: "#fff8e7", muted: "#d9c48a" },
  { id: "steel", name: "Steel Blue", bg: ["#03060c", "#0e2440"], primary: "#38bdf8", accent: "#f472b6", text: "#ffffff", muted: "#9db8d1" },
];

const uid = () => Math.random().toString(36).slice(2, 9);
function emptyEntry(i: number): Entry {
  return { id: uid(), label: `Entry ${i + 1}`, score: "", tier: TIERS[i % TIERS.length], imgUrl: null, img: null };
}

function RankingPage() {
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [template, setTemplate] = useState<TemplateId>("neon");
  const [mode, setMode] = useState<Mode>("countdown");
  const [paletteId, setPaletteId] = useState(PALETTES[0].id);
  const [colors, setColors] = useState<ColorOverrides>({});
  const [entries, setEntries] = useState<Entry[]>([emptyEntry(0), emptyEntry(1), emptyEntry(2), emptyEntry(3)]);
  const [heading, setHeading] = useState("Top Loadouts");
  const [perEntry, setPerEntry] = useState(3);

  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const musicElRef = useRef<HTMLAudioElement | null>(null);

  const [voProvider, setVoProvider] = useState<TtsProvider>("elevenlabs");
  const [voVoice, setVoVoice] = useState(TTS_VOICES.elevenlabs[0].id);
  const [voScript, setVoScript] = useState("");
  const [voUrl, setVoUrl] = useState<string | null>(null);
  const [voBlob, setVoBlob] = useState<Blob | null>(null);
  const [voDuration, setVoDuration] = useState(0);
  const [voLoading, setVoLoading] = useState(false);
  const [voError, setVoError] = useState<string | null>(null);
  const [voVolume, setVoVolume] = useState(0.9);
  const [matchVoDuration, setMatchVoDuration] = useState(false);
  const voAudioRef = useRef<HTMLAudioElement | null>(null);

  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, title: "Top Loadouts" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, title: "Which was #1 for you?" });

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

  const orderedEntries = useMemo(() => {
    if (mode !== "tier") return entries;
    const order: Record<Tier, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
    return [...entries].sort((a, b) => order[a.tier] - order[b.tier]);
  }, [entries, mode]);

  const timeline = useMemo(() => {
    const introEnd = intro.id !== "none" ? intro.seconds : 0;
    let t = introEnd;
    const segs = orderedEntries.map((e, i) => {
      const start = t;
      t += perEntry;
      return { entry: e, index: i, start, dur: perEntry };
    });
    let outroStart = t;
    if (matchVoDuration && voDuration > 0) {
      outroStart = Math.max(outroStart, introEnd + voDuration);
    }
    const total = outroStart + (outro.id !== "none" ? outro.seconds : 0);
    return { segs, outroStart, total, introEnd };
  }, [orderedEntries, perEntry, intro, outro, matchVoDuration, voDuration]);

  const setEntry = (id: string, patch: Partial<Entry>) =>
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addImage = (id: string, f: File) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setEntry(id, { imgUrl: url, img });
    img.src = url;
  };

  const onMusic = (f: File) => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    const url = URL.createObjectURL(f);
    setMusicFile(f);
    setMusicUrl(url);
    const el = new Audio(url);
    el.loop = true;
    el.volume = musicVolume;
    musicElRef.current = el;
  };

  useEffect(() => {
    if (musicElRef.current) musicElRef.current.volume = musicVolume;
  }, [musicVolume]);

  useEffect(() => {
    if (voAudioRef.current) voAudioRef.current.volume = voVolume;
  }, [voVolume]);

  const composeVoScript = useCallback(() => {
    const lines = orderedEntries
      .filter((e) => e.label.trim())
      .map((e, i) => {
        const rank = mode === "countdown" ? orderedEntries.length - i : i + 1;
        const bits = [`Number ${rank}, ${e.label}.`];
        if (e.score) bits.push(`Score: ${e.score}.`);
        return bits.join(" ");
      });
    return [heading, ...lines].filter(Boolean).join(" ");
  }, [orderedEntries, mode, heading]);

  const useMyContent = () => setVoScript(composeVoScript());

  const generateVoiceover = async () => {
    const script = voScript.trim() || composeVoScript();
    if (!script) {
      setVoError("Add some entries or a script first.");
      return;
    }
    setVoScript(script);
    setVoLoading(true);
    setVoError(null);
    try {
      const { url, blob } = await generateSpeech(script, { provider: voProvider, voice: voVoice });
      const dur = await blobDuration(blob);
      if (voUrl) URL.revokeObjectURL(voUrl);
      voAudioRef.current?.pause();
      const el = new Audio(url);
      el.volume = voVolume;
      voAudioRef.current = el;
      setVoUrl(url);
      setVoBlob(blob);
      setVoDuration(dur);
      toast.success("Voiceover generated");
    } catch (e) {
      setVoError(e instanceof Error ? e.message : "Voiceover failed");
    } finally {
      setVoLoading(false);
    }
  };

  const clearVoiceover = () => {
    if (voUrl) URL.revokeObjectURL(voUrl);
    voAudioRef.current?.pause();
    voAudioRef.current = null;
    setVoUrl(null);
    setVoBlob(null);
    setVoDuration(0);
    setVoError(null);
  };

  // ---------------- rendering ----------------

  const drawBackground = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
      g.addColorStop(0, pal.bg[0]);
      g.addColorStop(1, pal.bg[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const blobs = [
        { x: 0.2, y: 0.2, c: pal.primary, r: 0.5 },
        { x: 0.85, y: 0.75, c: pal.accent, r: 0.45 },
      ];
      blobs.forEach((b, i) => {
        const dx = Math.sin(t * 0.2 + i * 2) * w * 0.03;
        const dy = Math.cos(t * 0.16 + i * 1.3) * h * 0.02;
        const rad = Math.min(w, h) * b.r;
        const rg = ctx.createRadialGradient(w * b.x + dx, h * b.y + dy, 0, w * b.x + dx, h * b.y + dy, rad);
        rg.addColorStop(0, hexA(b.c, 0.2));
        rg.addColorStop(1, hexA(b.c, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      });
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 1.4);
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    },
    [pal],
  );

  const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number) => {
    if (!img || !img.naturalWidth) {
      ctx.fillStyle = hexA(pal.primary, 0.15);
      roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.08);
      ctx.fill();
      return;
    }
    ctx.save();
    roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.08);
    ctx.clip();
    const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * ratio;
    const dh = img.naturalHeight * ratio;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  };

  const drawEntry = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      seg: { entry: Entry; index: number },
      local: number,
      dur: number,
      absT: number,
    ) => {
      drawBackground(ctx, w, h, absT);
      const { entry: e, index } = seg;
      const total = orderedEntries.length;
      const rank = mode === "countdown" ? total - index : index + 1;
      const inK = ease.out(Math.min(1, local / 0.45));
      const M = Math.min(w, h) * 0.07;

      // heading
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const hs = Math.round(Math.min(w, h) * 0.045);
      ctx.font = `900 ${hs}px ${FX_FONT}`;
      ctx.fillStyle = hexA("#000000", 0.4);
      const title = heading.toUpperCase();
      const tw = Math.min(ctx.measureText(title).width, w - M * 2);
      roundRect(ctx, w / 2 - tw / 2 - hs * 0.7, M, tw + hs * 1.4, hs * 1.9, hs);
      ctx.fill();
      ctx.fillStyle = pal.text;
      ctx.fillText(title, w / 2, M + hs * 0.95);
      ctx.restore();

      const bodyTop = M + hs * 2.4;
      const bodyH = h - bodyTop - M;

      if (template === "neon") {
        ctx.save();
        ctx.globalAlpha = inK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const rs = Math.min(w, h) * 0.22;
        ctx.font = `900 ${Math.round(rs)}px ${FX_FONT}`;
        ctx.shadowColor = pal.primary;
        ctx.shadowBlur = rs * 0.4;
        ctx.fillStyle = pal.primary;
        ctx.fillText(`#${rank}`, w / 2, bodyTop + bodyH * 0.24);
        ctx.shadowBlur = 0;
        ctx.restore();
        const cardW = w - M * 2;
        const cardH = bodyH * 0.5;
        const cardY = bodyTop + bodyH * 0.44;
        ctx.save();
        ctx.globalAlpha = inK;
        drawImageCover(ctx, e.img, w / 2 - cardW / 2, cardY, cardW, cardH);
        ctx.strokeStyle = hexA(pal.accent, 0.8);
        ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.006);
        roundRect(ctx, w / 2 - cardW / 2, cardY, cardW, cardH, Math.min(w, h) * 0.08);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = inK;
        ctx.textAlign = "center";
        ctx.font = `800 ${Math.round(Math.min(w, h) * 0.045)}px ${FX_FONT}`;
        ctx.fillStyle = pal.text;
        ctx.fillText(e.label, w / 2, cardY + cardH + Math.min(w, h) * 0.06);
        if (e.score) {
          ctx.font = `600 ${Math.round(Math.min(w, h) * 0.03)}px ${FX_FONT}`;
          ctx.fillStyle = pal.muted;
          ctx.fillText(e.score, w / 2, cardY + cardH + Math.min(w, h) * 0.11);
        }
        ctx.restore();
      } else if (template === "tiergrid") {
        const rowH = bodyH / TIERS.length;
        TIERS.forEach((tr, ti) => {
          const y = bodyTop + ti * rowH;
          ctx.fillStyle = hexA(TIER_COLORS[tr], 0.85);
          roundRect(ctx, M, y + rowH * 0.08, rowH * 0.8, rowH * 0.84, rowH * 0.15);
          ctx.fill();
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `900 ${Math.round(rowH * 0.42)}px ${FX_FONT}`;
          ctx.fillStyle = "#0a0a0a";
          ctx.fillText(tr, M + rowH * 0.4, y + rowH * 0.5);
          ctx.restore();
          const cellX0 = M + rowH * 0.95;
          const cellSize = Math.min(rowH * 0.82, (w - M * 2 - rowH) / 8);
          const rowEntries = orderedEntries.filter((en) => en.tier === tr);
          rowEntries.forEach((en, ci) => {
            const globalIdx = orderedEntries.indexOf(en);
            const revealed = globalIdx <= index;
            if (!revealed) return;
            const k = globalIdx === index ? inK : 1;
            const cx = cellX0 + ci * (cellSize + rowH * 0.1);
            if (cx + cellSize > w - M) return;
            ctx.save();
            ctx.globalAlpha = k;
            drawImageCover(ctx, en.img, cx, y + rowH * 0.09, cellSize, rowH * 0.82);
            ctx.restore();
          });
        });
      } else if (template === "esports") {
        const cardW = Math.min(w * 0.7, bodyH * 0.62);
        const cardH = bodyH * 0.72;
        const cx = w / 2 - cardW / 2;
        const cy = bodyTop + bodyH * 0.06;
        ctx.save();
        ctx.globalAlpha = inK;
        ctx.translate(w / 2, cy + cardH / 2);
        ctx.scale(0.9 + inK * 0.1, 0.9 + inK * 0.1);
        ctx.translate(-w / 2, -(cy + cardH / 2));
        ctx.fillStyle = hexA("#000000", 0.5);
        roundRect(ctx, cx - 8, cy - 8, cardW + 16, cardH + 16, Math.min(w, h) * 0.05);
        ctx.fill();
        drawImageCover(ctx, e.img, cx, cy, cardW, cardH * 0.68);
        ctx.strokeStyle = hexA(pal.primary, 0.9);
        ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.007);
        roundRect(ctx, cx, cy, cardW, cardH, Math.min(w, h) * 0.05);
        ctx.stroke();
        ctx.fillStyle = pal.primary;
        const badgeR = Math.min(w, h) * 0.055;
        ctx.beginPath();
        ctx.arc(cx + cardW - badgeR * 0.6, cy + badgeR * 0.6, badgeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a0a0a";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.round(badgeR * 0.9)}px ${FX_FONT}`;
        ctx.fillText(`#${rank}`, cx + cardW - badgeR * 0.6, cy + badgeR * 0.65);
        ctx.textAlign = "center";
        ctx.fillStyle = pal.text;
        ctx.font = `800 ${Math.round(cardH * 0.09)}px ${FX_FONT}`;
        ctx.fillText(e.label, cx + cardW / 2, cy + cardH * 0.8);
        if (e.score) {
          const barW = cardW * 0.8;
          const barX = cx + cardW * 0.1;
          const barY = cy + cardH * 0.88;
          ctx.fillStyle = hexA(pal.text, 0.2);
          roundRect(ctx, barX, barY, barW, cardH * 0.05, cardH * 0.02);
          ctx.fill();
          const pct = Math.max(0.05, Math.min(1, parseFloat(e.score) / 100 || 0.7));
          ctx.fillStyle = pal.accent;
          roundRect(ctx, barX, barY, barW * pct * inK, cardH * 0.05, cardH * 0.02);
          ctx.fill();
        }
        ctx.restore();
      } else if (template === "podium") {
        const maxScore = Math.max(1, ...orderedEntries.map((en) => parseFloat(en.score) || 1));
        const slots = Math.min(orderedEntries.length, 6);
        const slotW = (w - M * 2) / slots;
        for (let i = 0; i < slots; i++) {
          if (i > index) break;
          const en = orderedEntries[i];
          const score = parseFloat(en.score) || 30;
          const k = i === index ? inK : 1;
          const barH = (score / maxScore) * bodyH * 0.65 * k;
          const bx = M + i * slotW + slotW * 0.15;
          const bw = slotW * 0.7;
          const by = bodyTop + bodyH * 0.85 - barH;
          ctx.fillStyle = i === index ? pal.accent : hexA(pal.primary, 0.6);
          roundRect(ctx, bx, by, bw, barH, slotW * 0.1);
          ctx.fill();
          const imgSize = Math.min(bw, slotW * 0.7);
          drawImageCover(ctx, en.img, bx + (bw - imgSize) / 2, by - imgSize * 1.05, imgSize, imgSize);
          ctx.save();
          ctx.globalAlpha = k;
          ctx.textAlign = "center";
          ctx.fillStyle = pal.text;
          ctx.font = `800 ${Math.round(slotW * 0.16)}px ${FX_FONT}`;
          ctx.fillText(`#${mode === "countdown" ? orderedEntries.length - i : i + 1}`, bx + bw / 2, by - imgSize * 1.15);
          const rows = wrapText(ctx, en.label, slotW * 0.9);
          ctx.font = `700 ${Math.round(slotW * 0.11)}px ${FX_FONT}`;
          rows.slice(0, 2).forEach((row, ri) => ctx.fillText(row, bx + bw / 2, bodyTop + bodyH * 0.85 + slotW * 0.16 + ri * slotW * 0.14));
          ctx.restore();
        }
      } else if (template === "split") {
        const k = ease.out(Math.min(1, local / 0.5));
        ctx.save();
        ctx.beginPath();
        ctx.rect(M, bodyTop, (w - M * 2) * 0.5, bodyH);
        ctx.clip();
        ctx.translate(-(1 - k) * w * 0.5, 0);
        drawImageCover(ctx, e.img, M, bodyTop, (w - M * 2) * 0.5 - 8, bodyH);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(w / 2, bodyTop, (w - M * 2) * 0.5, bodyH);
        ctx.clip();
        ctx.translate((1 - k) * w * 0.5, 0);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = pal.primary;
        ctx.font = `900 ${Math.round(bodyH * 0.18)}px ${FX_FONT}`;
        ctx.fillText(`#${rank}`, w / 2 + 20, bodyTop + bodyH * 0.35);
        ctx.fillStyle = pal.text;
        ctx.font = `800 ${Math.round(bodyH * 0.08)}px ${FX_FONT}`;
        const rows = wrapText(ctx, e.label, (w - M * 2) * 0.42);
        rows.forEach((row, ri) => ctx.fillText(row, w / 2 + 20, bodyTop + bodyH * 0.55 + ri * bodyH * 0.09));
        if (e.score) {
          ctx.fillStyle = pal.muted;
          ctx.font = `600 ${Math.round(bodyH * 0.05)}px ${FX_FONT}`;
          ctx.fillText(e.score, w / 2 + 20, bodyTop + bodyH * 0.72 + rows.length * bodyH * 0.09);
        }
        ctx.restore();
      } else {
        // minimal
        ctx.save();
        ctx.globalAlpha = inK;
        ctx.translate(0, (1 - inK) * 30);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = pal.muted;
        ctx.font = `700 ${Math.round(Math.min(w, h) * 0.05)}px ${FX_FONT}`;
        ctx.fillText(`RANK #${rank}`, w / 2, bodyTop + bodyH * 0.12);
        const imgSize = Math.min(w, h) * 0.42;
        drawImageCover(ctx, e.img, w / 2 - imgSize / 2, bodyTop + bodyH * 0.2, imgSize, imgSize);
        ctx.fillStyle = pal.text;
        ctx.font = `900 ${Math.round(Math.min(w, h) * 0.06)}px ${FX_FONT}`;
        ctx.fillText(e.label, w / 2, bodyTop + bodyH * 0.75);
        if (e.score) {
          ctx.fillStyle = pal.accent;
          ctx.font = `700 ${Math.round(Math.min(w, h) * 0.035)}px ${FX_FONT}`;
          ctx.fillText(e.score, w / 2, bodyTop + bodyH * 0.85);
        }
        ctx.restore();
      }
    },
    [drawBackground, heading, mode, orderedEntries, pal, template],
  );

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const { w, h } = dims;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#07070a";
      ctx.fillRect(0, 0, w, h);
      if (intro.id !== "none" && t < timeline.introEnd) {
        INTRO_ANIMATIONS.find((a) => a.id === intro.id)?.draw({
          ctx, w, h, p: Math.min(1, t / Math.max(0.2, intro.seconds)),
          palette: paletteOf(intro.paletteId), title: intro.title, subtitle: intro.subtitle, logo: null,
        });
        return;
      }
      if (outro.id !== "none" && t >= timeline.outroStart) {
        OUTRO_ANIMATIONS.find((a) => a.id === outro.id)?.draw({
          ctx, w, h, p: Math.min(1, (t - timeline.outroStart) / Math.max(0.2, outro.seconds)),
          palette: paletteOf(outro.paletteId), title: outro.title, subtitle: outro.subtitle, logo: null,
        });
        return;
      }
      const seg = timeline.segs.find((s) => t >= s.start && t < s.start + s.dur) ?? timeline.segs[timeline.segs.length - 1];
      if (!seg) return;
      drawEntry(ctx, w, h, seg, Math.max(0, t - seg.start), seg.dur, t);
    },
    [dims, drawEntry, intro, outro, timeline],
  );

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
          musicElRef.current?.pause();
          voAudioRef.current?.pause();
        }
        setTime(timeRef.current);
      }
      lastRef.current = now;
      if (voAudioRef.current) {
        const target = timeRef.current - timeline.introEnd;
        if (!playing || target < 0 || target > voDuration + 0.2) {
          if (!voAudioRef.current.paused) voAudioRef.current.pause();
        } else if (voAudioRef.current.paused || Math.abs(voAudioRef.current.currentTime - target) > 0.4) {
          voAudioRef.current.currentTime = target;
          void voAudioRef.current.play().catch(() => {});
        }
      }
      drawFrame(ctx, timeRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawFrame, playing, timeline]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      musicElRef.current?.pause();
      voAudioRef.current?.pause();
    } else {
      if (timeRef.current >= timeline.total - 0.05) timeRef.current = 0;
      lastRef.current = 0;
      setPlaying(true);
      if (musicElRef.current) {
        musicElRef.current.currentTime = 0;
        void musicElRef.current.play().catch(() => {});
      }
    }
  };

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
      if (voBlob) {
        const buf = await audioCtx.decodeAudioData(await voBlob.arrayBuffer());
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const gain = audioCtx.createGain();
        gain.gain.value = voVolume;
        src.connect(gain).connect(dest);
        src.start(audioCtx.currentTime + timeline.introEnd);
      }
      if (musicFile) {
        const buf = await audioCtx.decodeAudioData(await musicFile.arrayBuffer());
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = audioCtx.createGain();
        gain.gain.value = musicVolume;
        src.connect(gain).connect(dest);
        src.start(audioCtx.currentTime);
        src.stop(audioCtx.currentTime + timeline.total);
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
      a.download = `ranking-video.${mime.includes("mp4") ? "mp4" : "webm"}`;
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
            <Link to="/gaming-videos">
              <ArrowLeft className="mr-1 h-4 w-4" /> Gaming Videos
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Trophy className="h-6 w-6" /> Ranking studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Countdown or tier-list videos with animated reveals and music.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={togglePlay}>
            {playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
            {playing ? "Pause" : "Preview"}
          </Button>
          <Button onClick={exportVideo} disabled={exporting}>
            {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
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
                className="max-h-[70vh] w-auto rounded-xl border bg-black"
                style={{ aspectRatio: `${dims.w}/${dims.h}` }}
              />
            </CardContent>
          </Card>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{time.toFixed(1)}s / {timeline.total.toFixed(1)}s</span>
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
                <CardTitle className="text-base">Entries</CardTitle>
                <CardDescription>Add ranked items with an image, name and optional score.</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEntries((es) => [...es, emptyEntry(es.length)])}>
                <Plus className="mr-1 h-4 w-4" /> Add entry
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {entries.map((e, i) => (
                <div key={e.id} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Entry {i + 1}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEntries((es) => es.filter((x) => x.id !== e.id))}
                      disabled={entries.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Label</Label>
                      <Input value={e.label} onChange={(ev) => setEntry(e.id, { label: ev.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Score / stat (optional)</Label>
                      <Input value={e.score} onChange={(ev) => setEntry(e.id, { score: ev.target.value })} placeholder="e.g. 92" />
                    </div>
                    {mode === "tier" && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Tier</Label>
                        <Select value={e.tier} onValueChange={(v) => setEntry(e.id, { tier: v as Tier })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIERS.map((t) => (
                              <SelectItem key={t} value={t}>{t} Tier</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Image</Label>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground hover:bg-muted/50">
                        <ImagePlus className="h-3.5 w-3.5" /> {e.imgUrl ? "Replace" : "Upload"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(ev) => ev.target.files?.[0] && addImage(e.id, ev.target.files[0])}
                        />
                      </label>
                    </div>
                  </div>
                  {e.imgUrl && (
                    <img src={e.imgUrl} alt={e.label} className="mt-3 h-20 w-full rounded-md object-cover" />
                  )}
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
                    <TabsTrigger key={k} value={k} className="flex-1">{k}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div>
                <Label className="text-xs text-muted-foreground">Mode</Label>
                <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="countdown" className="flex-1">Countdown</TabsTrigger>
                    <TabsTrigger value="tier" className="flex-1">Tier list</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Template</Label>
                <Select value={template} onValueChange={(v) => setTemplate(v as TemplateId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {TEMPLATES.find((t) => t.id === template)?.desc}
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
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Heading</Label>
                <Input value={heading} onChange={(e) => setHeading(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Seconds per entry · {perEntry}s</Label>
                <Slider value={[perEntry]} min={1.5} max={8} step={0.5} onValueChange={([v]) => setPerEntry(v)} />
              </div>
            </CardContent>
          </Card>

          <ColorCustomiser base={basePalette} value={colors} onChange={setColors} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voiceover</CardTitle>
              <CardDescription>Generate an AI narration for the whole ranking and mix it into the export.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={voProvider}
                  onValueChange={(v) => {
                    const p = v as TtsProvider;
                    setVoProvider(p);
                    setVoVoice(TTS_VOICES[p][0].id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={voVoice} onValueChange={setVoVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_VOICES[voProvider].map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Script</Label>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={useMyContent}>
                    Use my content
                  </Button>
                </div>
                <Textarea
                  value={voScript}
                  onChange={(e) => setVoScript(e.target.value)}
                  placeholder="Click “Use my content” to auto-write a script from your ranking, or write your own."
                  className="min-h-24 text-sm"
                />
              </div>
              <Button onClick={generateVoiceover} disabled={voLoading} className="w-full">
                {voLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
                {voUrl ? "Regenerate voiceover" : "Generate voiceover"}
              </Button>
              {voError && <p className="text-xs text-destructive">{voError}</p>}
              {voUrl && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <audio controls src={voUrl} className="h-9 flex-1">
                      <track kind="captions" />
                    </audio>
                    <Button size="icon" variant="ghost" onClick={clearVoiceover}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Voiceover volume · {Math.round(voVolume * 100)}%</Label>
                    <Slider value={[voVolume]} min={0} max={1} step={0.05} onValueChange={([v]) => setVoVolume(v)} />
                  </div>
                  <label className="flex items-center justify-between gap-2 text-sm">
                    Match duration to voiceover
                    <Switch checked={matchVoDuration} onCheckedChange={setMatchVoDuration} />
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Music</CardTitle>
              <CardDescription>Optional background track, mixed into the export.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {musicUrl ? (
                <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="flex items-center gap-1 truncate"><Music className="h-3.5 w-3.5" /> {musicFile?.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (musicUrl) URL.revokeObjectURL(musicUrl);
                      musicElRef.current?.pause();
                      musicElRef.current = null;
                      setMusicFile(null);
                      setMusicUrl(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="mr-2 h-4 w-4" /> Upload music
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && onMusic(e.target.files[0])} />
                </label>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Volume · {Math.round(musicVolume * 100)}%</Label>
                <Slider value={[musicVolume]} min={0} max={1} step={0.05} onValueChange={([v]) => setMusicVolume(v)} />
              </div>
            </CardContent>
          </Card>

          <IntroOutroCard intro={intro} outro={outro} onIntro={setIntro} onOutro={setOutro} ratio={dims.w / dims.h} />
        </div>
      </div>
    </div>
  );
}
