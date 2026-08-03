import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ListOrdered,
  ArrowLeft,
  Play,
  Pause,
  Download,
  Loader2,
  Plus,
  Trash2,
  ImagePlus,
  Upload,
  X,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
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
import { FX_FONT, ease, hexA, roundRect, fitText } from "@/lib/video-fx";
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
} from "@/components/color-customiser";
import { INTRO_ANIMATIONS, OUTRO_ANIMATIONS } from "@/lib/video-fx";
import { TTS_PROVIDERS, TTS_VOICES, generateSpeech, blobDuration, type TtsProvider } from "@/lib/tts";
import {
  TIER_TEMPLATES,
  TIER_PALETTES,
  ITEM_TRANSITIONS,
  DEFAULT_TIER_COLORS,
  type TierTemplateId,
  type ItemTransitionId,
} from "@/lib/tier-list-templates";

export const Route = createFileRoute("/_authenticated/tier-list-videos")({
  head: () => ({
    meta: [
      { title: "Tier List Videos — Orbit" },
      {
        name: "description",
        content:
          "Build animated S/A/B/C/D/F tier-list videos — drag items into rows, pick from 6 animated templates and export vertical or widescreen 1080p clips with voiceover.",
      },
      { property: "og:title", content: "Tier List Videos — Orbit" },
      {
        property: "og:description",
        content: "Rank anything into a tier list with animated reveals, custom rows and 1080p export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TierListPage,
});

type AspectKey = "9:16" | "16:9";
const ASPECTS: Record<AspectKey, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Vertical · TikTok/Reels/Shorts" },
  "16:9": { w: 1920, h: 1080, label: "Widescreen · YouTube" },
};

type Row = {
  id: string;
  label: string;
  color: string;
  weight: number; // relative row height 1..3
};

const UNRANKED = "__unranked__";

function defaultRows(): Row[] {
  return ["S", "A", "B", "C", "D", "F"].map((l) => ({
    id: l,
    label: l,
    color: DEFAULT_TIER_COLORS[l],
    weight: 1,
  }));
}

type Item = {
  id: string;
  name: string;
  emoji: string;
  imgUrl: string | null;
  img: HTMLImageElement | null;
  tierId: string; // row id or UNRANKED
  duration: number | null; // override, seconds
};

const uid = () => Math.random().toString(36).slice(2, 9);
const EMOJIS = ["⭐", "🔥", "🎮", "🏆", "💎", "🚀", "🐉", "🎯"];
function emptyItem(i: number): Item {
  return {
    id: uid(),
    name: `Item ${i + 1}`,
    emoji: EMOJIS[i % EMOJIS.length],
    imgUrl: null,
    img: null,
    tierId: UNRANKED,
    duration: null,
  };
}

type CardStyle = {
  corner: "rounded" | "square";
  border: boolean;
  shadow: boolean;
  labelPos: "under" | "over";
};

function TierListPage() {
  const [aspect, setAspect] = useState<AspectKey>("9:16");
  const [template, setTemplate] = useState<TierTemplateId>("classic");
  const [paletteId, setPaletteId] = useState(TIER_PALETTES[0].id);
  const [colors, setColors] = useState<ColorOverrides>({});
  const [transition, setTransition] = useState<ItemTransitionId>("fly");

  const [title, setTitle] = useState("Ultimate Tier List");
  const [subtitle, setSubtitle] = useState("Ranking every option");
  const [titleSize, setTitleSize] = useState(1);

  const [rows, setRows] = useState<Row[]>(defaultRows());
  const [items, setItems] = useState<Item[]>([emptyItem(0), emptyItem(1), emptyItem(2), emptyItem(3), emptyItem(4)]);
  const [perItemHold, setPerItemHold] = useState(1.8);
  const [finalHold, setFinalHold] = useState(2.5);

  const [cardStyle, setCardStyle] = useState<CardStyle>({ corner: "rounded", border: true, shadow: true, labelPos: "under" });

  const [dragId, setDragId] = useState<string | null>(null);

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

  const [useIntroOutro, setUseIntroOutro] = useState(true);
  const [intro, setIntro] = useState<CardConfig>({ ...defaultIntro, title: "Ultimate Tier List" });
  const [outro, setOutro] = useState<CardConfig>({ ...defaultOutro, title: "Where would YOU rank it?" });

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const timeRef = useRef(0);
  const lastRef = useRef(0);

  const dims = ASPECTS[aspect];
  const basePalette = TIER_PALETTES.find((p) => p.id === paletteId) ?? TIER_PALETTES[0];
  const pal = useMemo(() => applyOverrides(basePalette, colors), [basePalette, colors]);

  // items ordered: row order, then insertion order within each row
  const flatOrder = useMemo(
    () => rows.flatMap((r) => items.filter((it) => it.tierId === r.id)),
    [rows, items],
  );
  const staging = useMemo(() => items.filter((it) => it.tierId === UNRANKED), [items]);

  const timeline = useMemo(() => {
    const introEnd = useIntroOutro && intro.id !== "none" ? intro.seconds : 0;
    let t = introEnd;
    const segs = flatOrder.map((it, i) => {
      const dur = it.duration ?? perItemHold;
      const start = t;
      t += dur;
      return { item: it, index: i, start, dur };
    });
    let boardEnd = t + finalHold;
    if (matchVoDuration && voDuration > 0) {
      boardEnd = Math.max(boardEnd, introEnd + voDuration);
    }
    const outroStart = boardEnd;
    const total = outroStart + (useIntroOutro && outro.id !== "none" ? outro.seconds : 0);
    return { segs, introEnd, boardEnd, outroStart, total };
  }, [flatOrder, perItemHold, finalHold, intro, outro, useIntroOutro, matchVoDuration, voDuration]);

  const setItem = (id: string, patch: Partial<Item>) =>
    setItems((its) => its.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addImage = (id: string, f: File) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setItem(id, { imgUrl: url, img });
    img.src = url;
  };

  const moveItemTo = (id: string, tierId: string) => {
    setItems((its) => {
      const found = its.find((i) => i.id === id);
      if (!found) return its;
      const rest = its.filter((i) => i.id !== id);
      return [...rest, { ...found, tierId }];
    });
  };

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => [...rs, { id: uid(), label: "New", color: "#94a3b8", weight: 1 }]);
  const removeRow = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setItems((its) => its.map((it) => (it.tierId === id ? { ...it, tierId: UNRANKED } : it)));
  };

  useEffect(() => {
    if (voAudioRef.current) voAudioRef.current.volume = voVolume;
  }, [voVolume]);

  const composeVoScript = useCallback(() => {
    const lines = rows
      .map((r) => {
        const names = items.filter((it) => it.tierId === r.id).map((it) => it.name).filter(Boolean);
        if (!names.length) return null;
        return `${r.label} tier: ${names.join(", ")}.`;
      })
      .filter(Boolean);
    return [title, ...lines].filter(Boolean).join(" ");
  }, [rows, items, title]);

  const useMyContent = () => setVoScript(composeVoScript());

  const generateVoiceover = async () => {
    const script = voScript.trim() || composeVoScript();
    if (!script) {
      setVoError("Place a few items into tiers first.");
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
      const g = ctx.createLinearGradient(0, 0, w * 0.25, h);
      g.addColorStop(0, pal.bg[0]);
      g.addColorStop(1, pal.bg[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const blobs = [
        { x: 0.18, y: 0.18, c: pal.primary, r: 0.5 },
        { x: 0.85, y: 0.8, c: pal.accent, r: 0.42 },
      ];
      blobs.forEach((b, i) => {
        const dx = Math.sin(t * 0.2 + i * 2) * w * 0.03;
        const dy = Math.cos(t * 0.16 + i * 1.3) * h * 0.02;
        const rad = Math.min(w, h) * b.r;
        const rg = ctx.createRadialGradient(w * b.x + dx, h * b.y + dy, 0, w * b.x + dx, h * b.y + dy, rad);
        rg.addColorStop(0, hexA(b.c, 0.18));
        rg.addColorStop(1, hexA(b.c, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      });

      if (template === "neon") {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.4);
        ctx.strokeStyle = hexA(pal.accent, 0.15 + 0.05 * Math.sin(t * 2));
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(0, (h / 4) * i + Math.sin(t + i) * 10);
          ctx.lineTo(w, (h / 4) * i + Math.cos(t + i) * 10);
          ctx.stroke();
        }
      } else if (template === "sports") {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = pal.text;
        for (let x = -h; x < w + h; x += 90) {
          ctx.beginPath();
          ctx.moveTo(x + t * 20, 0);
          ctx.lineTo(x + 40 + t * 20, 0);
          ctx.lineTo(x + 40 + t * 20 - h, h);
          ctx.lineTo(x + t * 20 - h, h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else if (template === "glass") {
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, w * 0.05, h * 0.04, w * 0.9, h * 0.25, 40);
        ctx.fill();
        ctx.restore();
      } else if (template === "retro") {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = pal.accent;
        const step = Math.max(14, Math.min(w, h) * 0.02);
        for (let y = 0; y < h; y += step) {
          for (let x = (y / step) % 2 === 0 ? 0 : step / 2; x < w; x += step) {
            ctx.beginPath();
            ctx.arc(x, y, step * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      } else if (template === "minimal") {
        // keep clean — no extra texture
      } else {
        // classic
        ctx.fillStyle = "rgba(255,255,255,0.02)";
        for (let x = 0; x < w; x += 60) ctx.fillRect(x, 0, 1, h);
      }

      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    },
    [pal, template],
  );

  const drawItemCard = useCallback(
    (ctx: CanvasRenderingContext2D, it: Item, x: number, y: number, w: number, h: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const radius = cardStyle.corner === "rounded" ? Math.min(w, h) * 0.16 : 2;
      if (cardStyle.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = Math.min(w, h) * 0.15;
        ctx.shadowOffsetY = Math.min(w, h) * 0.04;
      }
      const imgH = cardStyle.labelPos === "under" ? h * 0.78 : h;
      if (it.img && it.img.naturalWidth) {
        ctx.save();
        roundRect(ctx, x, y, w, imgH, radius);
        ctx.clip();
        ctx.fillStyle = hexA(pal.primary, 0.15);
        ctx.fillRect(x, y, w, imgH);
        const ratio = Math.max(w / it.img.naturalWidth, imgH / it.img.naturalHeight);
        const dw = it.img.naturalWidth * ratio;
        const dh = it.img.naturalHeight * ratio;
        ctx.drawImage(it.img, x + (w - dw) / 2, y + (imgH - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = hexA(pal.primary, 0.2);
        roundRect(ctx, x, y, w, imgH, radius);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${Math.round(imgH * 0.5)}px ${FX_FONT}`;
        ctx.fillText(it.emoji || "⭐", x + w / 2, y + imgH / 2);
      }
      if (cardStyle.border) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = hexA(pal.accent, 0.8);
        ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.03);
        roundRect(ctx, x, y, w, imgH, radius);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (cardStyle.labelPos === "under") {
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = pal.text;
        ctx.font = `700 ${Math.max(9, Math.round(h * 0.14))}px ${FX_FONT}`;
        const label = it.name.length > 14 ? it.name.slice(0, 13) + "…" : it.name;
        ctx.fillText(label, x + w / 2, y + imgH + h * 0.03);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        roundRect(ctx, x, y + h - h * 0.26, w, h * 0.26, radius);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.max(9, Math.round(h * 0.12))}px ${FX_FONT}`;
        const label = it.name.length > 14 ? it.name.slice(0, 13) + "…" : it.name;
        ctx.fillText(label, x + w / 2, y + h - h * 0.13);
      }
      ctx.restore();
    },
    [cardStyle, pal],
  );

  const drawBoard = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, activeIndex: number, activeK: number, absT: number) => {
      drawBackground(ctx, w, h, absT);
      const M = Math.min(w, h) * 0.05;

      // header
      ctx.save();
      ctx.textAlign = "center";
      const ts = Math.round(Math.min(w, h) * 0.05 * titleSize);
      ctx.font = `900 ${ts}px ${FX_FONT}`;
      ctx.fillStyle = pal.text;
      ctx.textBaseline = "top";
      ctx.fillText(title.toUpperCase(), w / 2, M * 0.5);
      if (subtitle) {
        ctx.font = `600 ${Math.round(ts * 0.42)}px ${FX_FONT}`;
        ctx.fillStyle = pal.muted;
        ctx.fillText(subtitle, w / 2, M * 0.5 + ts * 1.15);
      }
      ctx.restore();

      const bodyTop = M * 0.5 + ts * 1.8;
      const bodyH = h - bodyTop - M * 0.6;
      const totalWeight = rows.reduce((s, r) => s + r.weight, 0) || 1;

      let y = bodyTop;
      rows.forEach((row) => {
        const rowH = (row.weight / totalWeight) * bodyH;
        const chipW = Math.min(w * 0.16, rowH * 1.1);
        ctx.save();
        ctx.fillStyle = hexA(row.color, 0.9);
        roundRect(ctx, M, y + rowH * 0.06, chipW, rowH * 0.88, rowH * 0.16);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#0a0a0a";
        fitText(ctx, row.label, chipW * 0.82, rowH * 0.6, 900);
        ctx.fillText(row.label, M + chipW / 2, y + rowH / 2);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = hexA(pal.text, 0.08);
        ctx.lineWidth = 2;
        roundRect(ctx, M + chipW + rowH * 0.08, y + rowH * 0.06, w - M * 2 - chipW - rowH * 0.08, rowH * 0.88, rowH * 0.12);
        ctx.stroke();
        ctx.restore();

        const rowItems = items.filter((it) => it.tierId === row.id);
        const cellGap = rowH * 0.1;
        const cellSize = Math.min(rowH * 0.78, (w - M * 2 - chipW - rowH * 0.2) / 7);
        let cx = M + chipW + rowH * 0.25;
        rowItems.forEach((it) => {
          const globalIdx = flatOrder.indexOf(it);
          if (globalIdx > activeIndex) return;
          if (cx + cellSize > w - M) return;
          const cellY = y + rowH * 0.11;
          if (globalIdx === activeIndex) {
            drawTransitioningItem(ctx, it, cx, cellY, cellSize, rowH * 0.78, activeK, w, h);
          } else {
            drawItemCard(ctx, it, cx, cellY, cellSize, rowH * 0.78, 1);
          }
          cx += cellSize + cellGap;
        });

        y += rowH;
      });
    },
    [drawBackground, drawItemCard, flatOrder, items, pal, rows, subtitle, title, titleSize],
  );

  const drawTransitioningItem = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      it: Item,
      x: number,
      y: number,
      w: number,
      h: number,
      k: number,
      cw: number,
      ch: number,
    ) => {
      const inK = ease.out(Math.min(1, k));
      ctx.save();
      if (transition === "fade") {
        drawItemCard(ctx, it, x, y, w, h, inK);
      } else if (transition === "pop") {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(0.4 + inK * 0.6, 0.4 + inK * 0.6);
        ctx.translate(-(x + w / 2), -(y + h / 2));
        drawItemCard(ctx, it, x, y, w, h, inK);
      } else if (transition === "slide") {
        const off = (1 - inK) * cw * 0.4;
        drawItemCard(ctx, it, x + off, y, w, h, inK);
      } else if (transition === "flip") {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(Math.max(0.05, inK), 1);
        ctx.translate(-(x + w / 2), -(y + h / 2));
        drawItemCard(ctx, it, x, y, w, h, Math.max(0.2, inK));
      } else {
        // fly — from bottom-center staging area
        const fromX = cw / 2 - w / 2;
        const fromY = ch - h * 1.3;
        const px = fromX + (x - fromX) * inK;
        const py = fromY + (y - fromY) * inK;
        drawItemCard(ctx, it, px, py, w, h, Math.max(0.3, inK));
      }
      ctx.restore();
    },
    [drawItemCard, transition],
  );

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const { w, h } = dims;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#07070a";
      ctx.fillRect(0, 0, w, h);
      if (useIntroOutro && intro.id !== "none" && t < timeline.introEnd) {
        INTRO_ANIMATIONS.find((a) => a.id === intro.id)?.draw({
          ctx, w, h, p: Math.min(1, t / Math.max(0.2, intro.seconds)),
          palette: paletteOf(intro.paletteId), title: intro.title, subtitle: intro.subtitle, logo: null,
        });
        return;
      }
      if (useIntroOutro && outro.id !== "none" && t >= timeline.outroStart) {
        OUTRO_ANIMATIONS.find((a) => a.id === outro.id)?.draw({
          ctx, w, h, p: Math.min(1, (t - timeline.outroStart) / Math.max(0.2, outro.seconds)),
          palette: paletteOf(outro.paletteId), title: outro.title, subtitle: outro.subtitle, logo: null,
        });
        return;
      }
      const seg = timeline.segs.find((s) => t >= s.start && t < s.start + s.dur);
      if (seg) {
        drawBoard(ctx, w, h, seg.index, Math.max(0, t - seg.start) / seg.dur, t);
      } else {
        // all revealed — final hold or nothing placed
        drawBoard(ctx, w, h, timeline.segs.length - 1, 1, t);
      }
    },
    [dims, drawBoard, intro, outro, timeline, useIntroOutro],
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
  }, [drawFrame, playing, timeline, voDuration]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      voAudioRef.current?.pause();
    } else {
      if (timeRef.current >= timeline.total - 0.05) timeRef.current = 0;
      lastRef.current = 0;
      setPlaying(true);
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
      a.download = `tier-list-video.${mime.includes("mp4") ? "mp4" : "webm"}`;
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
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:flex lg:h-full lg:flex-col lg:space-y-0 lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/videos">
              <ArrowLeft className="mr-1 h-4 w-4" /> Videos
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ListOrdered className="h-6 w-6" /> Tier List studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Drag items into S/A/B/C/D/F rows and watch them animate onto the board.
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
                <CardTitle className="text-base">Tier rows</CardTitle>
                <CardDescription>Add, rename, recolour or resize rows. Drag items below into a row.</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={addRow}>
                <Plus className="mr-1 h-4 w-4" /> Add row
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border p-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) moveItemTo(dragId, row.id);
                    setDragId(null);
                  }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={row.color}
                      onChange={(e) => updateRow(row.id, { color: e.target.value })}
                      className="h-8 w-8 cursor-pointer rounded border p-0"
                    />
                    <Input
                      value={row.label}
                      onChange={(e) => updateRow(row.id, { label: e.target.value })}
                      className="w-24"
                    />
                    <div className="flex-1 min-w-[100px]">
                      <Slider
                        value={[row.weight]}
                        min={0.5}
                        max={3}
                        step={0.1}
                        onValueChange={([v]) => updateRow(row.id, { weight: v })}
                      />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeRow(row.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex min-h-[52px] flex-wrap gap-2 rounded-lg border border-dashed p-2">
                    {items.filter((it) => it.tierId === row.id).map((it) => (
                      <div
                        key={it.id}
                        draggable
                        onDragStart={() => setDragId(it.id)}
                        className="flex cursor-grab items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs"
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        {it.imgUrl ? (
                          <img src={it.imgUrl} alt="" className="h-5 w-5 rounded object-cover" />
                        ) : (
                          <span>{it.emoji}</span>
                        )}
                        {it.name}
                      </div>
                    ))}
                    {items.filter((it) => it.tierId === row.id).length === 0 && (
                      <span className="text-xs text-muted-foreground">Drop items here</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Items</CardTitle>
                <CardDescription>Unranked items live in the staging tray — drag into a row above.</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setItems((its) => [...its, emptyItem(its.length)])}>
                <Plus className="mr-1 h-4 w-4" /> Add item
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className="flex min-h-[60px] flex-wrap gap-2 rounded-lg border border-dashed p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) moveItemTo(dragId, UNRANKED);
                  setDragId(null);
                }}
              >
                {staging.length === 0 && <span className="text-xs text-muted-foreground">All items ranked</span>}
                {staging.map((it) => (
                  <div
                    key={it.id}
                    draggable
                    onDragStart={() => setDragId(it.id)}
                    className="flex cursor-grab items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs"
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    {it.imgUrl ? (
                      <img src={it.imgUrl} alt="" className="h-5 w-5 rounded object-cover" />
                    ) : (
                      <span>{it.emoji}</span>
                    )}
                    {it.name}
                  </div>
                ))}
              </div>

              {items.map((it, i) => (
                <div key={it.id} className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Item {i + 1}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setItems((its) => its.filter((x) => x.id !== it.id))}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input value={it.name} onChange={(e) => setItem(it.id, { name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Emoji (used if no image)</Label>
                      <Input value={it.emoji} onChange={(e) => setItem(it.id, { emoji: e.target.value })} maxLength={4} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Image</Label>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground hover:bg-muted/50">
                        <ImagePlus className="h-3.5 w-3.5" /> {it.imgUrl ? "Replace" : "Upload"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && addImage(it.id, e.target.files[0])}
                        />
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Hold duration override {it.duration ? `· ${it.duration.toFixed(1)}s` : "· default"}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          className="flex-1"
                          value={[it.duration ?? perItemHold]}
                          min={0.5}
                          max={6}
                          step={0.1}
                          onValueChange={([v]) => setItem(it.id, { duration: v })}
                        />
                        {it.duration != null && (
                          <Button size="icon" variant="ghost" onClick={() => setItem(it.id, { duration: null })}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
                    <TabsTrigger key={k} value={k} className="flex-1">{k}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div>
                <Label className="text-xs text-muted-foreground">Template</Label>
                <Select value={template} onValueChange={(v) => setTemplate(v as TierTemplateId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIER_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {TIER_TEMPLATES.find((t) => t.id === template)?.desc}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Palette</Label>
                <Select value={paletteId} onValueChange={setPaletteId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIER_PALETTES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Reveal transition</Label>
                <Select value={transition} onValueChange={(v) => setTransition(v as ItemTransitionId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TRANSITIONS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Subtitle</Label>
                <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Title size · {titleSize.toFixed(2)}x</Label>
                <Slider value={[titleSize]} min={0.6} max={1.6} step={0.05} onValueChange={([v]) => setTitleSize(v)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Seconds per item · {perItemHold.toFixed(1)}s</Label>
                <Slider value={[perItemHold]} min={0.5} max={6} step={0.1} onValueChange={([v]) => setPerItemHold(v)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Final hold before outro · {finalHold.toFixed(1)}s</Label>
                <Slider value={[finalHold]} min={0} max={6} step={0.1} onValueChange={([v]) => setFinalHold(v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Item card style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Corners</Label>
                <Tabs value={cardStyle.corner} onValueChange={(v) => setCardStyle((s) => ({ ...s, corner: v as CardStyle["corner"] }))}>
                  <TabsList className="w-full">
                    <TabsTrigger value="rounded" className="flex-1">Rounded</TabsTrigger>
                    <TabsTrigger value="square" className="flex-1">Square</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Label position</Label>
                <Tabs value={cardStyle.labelPos} onValueChange={(v) => setCardStyle((s) => ({ ...s, labelPos: v as CardStyle["labelPos"] }))}>
                  <TabsList className="w-full">
                    <TabsTrigger value="under" className="flex-1">Under image</TabsTrigger>
                    <TabsTrigger value="over" className="flex-1">Over image</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Border</Label>
                <Switch checked={cardStyle.border} onCheckedChange={(v) => setCardStyle((s) => ({ ...s, border: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Shadow</Label>
                <Switch checked={cardStyle.shadow} onCheckedChange={(v) => setCardStyle((s) => ({ ...s, shadow: v }))} />
              </div>
            </CardContent>
          </Card>

          <ColorCustomiser base={basePalette} value={colors} onChange={setColors} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voiceover</CardTitle>
              <CardDescription>Generate an AI narration listing every tier and item.</CardDescription>
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
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Script</Label>
                <Button size="sm" variant="ghost" onClick={useMyContent}>Use my tiers</Button>
              </div>
              <textarea
                value={voScript}
                onChange={(e) => setVoScript(e.target.value)}
                placeholder="Leave blank to auto-generate from your tier rows"
                className="min-h-[80px] w-full rounded-md border bg-transparent p-2 text-sm"
              />
              {voError && <p className="text-xs text-destructive">{voError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={generateVoiceover} disabled={voLoading}>
                  {voLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                  Generate
                </Button>
                {voUrl && (
                  <Button size="sm" variant="ghost" onClick={clearVoiceover}>
                    <X className="mr-1 h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
              {voUrl && (
                <div className="space-y-2">
                  <audio src={voUrl} controls className="w-full" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Voice volume</Label>
                    <Slider value={[voVolume]} min={0} max={1} step={0.05} onValueChange={([v]) => setVoVolume(v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Stretch board hold to match voiceover</Label>
                    <Switch checked={matchVoDuration} onCheckedChange={setMatchVoDuration} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Intro & outro</CardTitle>
              <Switch checked={useIntroOutro} onCheckedChange={setUseIntroOutro} />
            </CardHeader>
            {useIntroOutro && (
              <CardContent>
                <IntroOutroCard
                  intro={intro}
                  outro={outro}
                  onIntro={setIntro}
                  onOutro={setOutro}
                  ratio={dims.w / dims.h}
                />
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
