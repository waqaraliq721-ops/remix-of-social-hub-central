import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FX_PALETTES,
  INTRO_ANIMATIONS,
  OUTRO_ANIMATIONS,
  FX_FONT,
  hexA,
  roundRect,
  ease,
} from "@/lib/video-fx";

export const Route = createFileRoute("/_authenticated/presets")({
  head: () => ({
    meta: [
      { title: "Templates & Presets — Orbit" },
      {
        name: "description",
        content:
          "20 branded intro animations, 20 outro cards and 20 motion presets you can preview live and drop into any Orbit video studio.",
      },
      { property: "og:title", content: "Templates & Presets — Orbit" },
      {
        property: "og:description",
        content: "Branded intros, outros and motion presets with live canvas previews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PresetsPage,
});

// -------------------- motion presets --------------------

type MotionPreset = {
  id: string;
  name: string;
  desc: string;
  /** returns transform for a 0..1 progress */
  at: (p: number) => { scale: number; x: number; y: number; rot: number; alpha: number };
};

const MOTION_PRESETS: MotionPreset[] = [
  { id: "kenburns-in", name: "Ken Burns In", desc: "Slow push in", at: (p) => ({ scale: 1 + p * 0.14, x: 0, y: 0, rot: 0, alpha: 1 }) },
  { id: "kenburns-out", name: "Ken Burns Out", desc: "Slow pull back", at: (p) => ({ scale: 1.16 - p * 0.14, x: 0, y: 0, rot: 0, alpha: 1 }) },
  { id: "pan-left", name: "Pan Left", desc: "Drift left", at: (p) => ({ scale: 1.12, x: -p * 0.06, y: 0, rot: 0, alpha: 1 }) },
  { id: "pan-right", name: "Pan Right", desc: "Drift right", at: (p) => ({ scale: 1.12, x: p * 0.06, y: 0, rot: 0, alpha: 1 }) },
  { id: "pan-up", name: "Pan Up", desc: "Rise", at: (p) => ({ scale: 1.12, x: 0, y: -p * 0.06, rot: 0, alpha: 1 }) },
  { id: "pan-down", name: "Pan Down", desc: "Descend", at: (p) => ({ scale: 1.12, x: 0, y: p * 0.06, rot: 0, alpha: 1 }) },
  { id: "diag-tl", name: "Diagonal TL", desc: "Push toward top-left", at: (p) => ({ scale: 1 + p * 0.12, x: -p * 0.05, y: -p * 0.05, rot: 0, alpha: 1 }) },
  { id: "diag-br", name: "Diagonal BR", desc: "Push toward bottom-right", at: (p) => ({ scale: 1 + p * 0.12, x: p * 0.05, y: p * 0.05, rot: 0, alpha: 1 }) },
  { id: "rotate-cw", name: "Rotate CW", desc: "Gentle clockwise drift", at: (p) => ({ scale: 1.14, x: 0, y: 0, rot: p * 0.05, alpha: 1 }) },
  { id: "rotate-ccw", name: "Rotate CCW", desc: "Gentle counter drift", at: (p) => ({ scale: 1.14, x: 0, y: 0, rot: -p * 0.05, alpha: 1 }) },
  { id: "pulse", name: "Heartbeat", desc: "Rhythmic pulse", at: (p) => ({ scale: 1.06 + Math.sin(p * Math.PI * 6) * 0.02, x: 0, y: 0, rot: 0, alpha: 1 }) },
  { id: "breathe", name: "Breathe", desc: "Slow in-out", at: (p) => ({ scale: 1.05 + Math.sin(p * Math.PI * 2) * 0.04, x: 0, y: 0, rot: 0, alpha: 1 }) },
  { id: "shake", name: "Handheld", desc: "Subtle handheld shake", at: (p) => ({ scale: 1.08, x: Math.sin(p * 40) * 0.004, y: Math.cos(p * 33) * 0.004, rot: Math.sin(p * 25) * 0.004, alpha: 1 }) },
  { id: "snap-zoom", name: "Snap Zoom", desc: "Punch in on the beat", at: (p) => ({ scale: 1 + (p % 0.25 < 0.06 ? 0.1 : 0.02), x: 0, y: 0, rot: 0, alpha: 1 }) },
  { id: "parallax", name: "Parallax Tilt", desc: "Tilting depth", at: (p) => ({ scale: 1.1, x: Math.sin(p * Math.PI * 2) * 0.02, y: 0, rot: Math.sin(p * Math.PI * 2) * 0.015, alpha: 1 }) },
  { id: "drift-float", name: "Float", desc: "Weightless drift", at: (p) => ({ scale: 1.08, x: Math.sin(p * Math.PI * 2) * 0.015, y: Math.cos(p * Math.PI * 2) * 0.015, rot: 0, alpha: 1 }) },
  { id: "fade-push", name: "Fade Push", desc: "Fade up while pushing", at: (p) => ({ scale: 1 + p * 0.1, x: 0, y: 0, rot: 0, alpha: ease.out(Math.min(1, p * 3)) }) },
  { id: "swing", name: "Swing", desc: "Pendulum sway", at: (p) => ({ scale: 1.12, x: Math.sin(p * Math.PI * 2) * 0.03, y: 0, rot: Math.sin(p * Math.PI * 2) * 0.03, alpha: 1 }) },
  { id: "zoom-bounce", name: "Zoom Bounce", desc: "Elastic settle", at: (p) => ({ scale: 1 + ease.elastic(Math.min(1, p * 2)) * 0.1, x: 0, y: 0, rot: 0, alpha: 1 }) },
  { id: "orbit", name: "Orbit", desc: "Circular camera move", at: (p) => ({ scale: 1.14, x: Math.cos(p * Math.PI * 2) * 0.025, y: Math.sin(p * Math.PI * 2) * 0.025, rot: 0, alpha: 1 }) },
  { id: "static", name: "Locked Off", desc: "No movement", at: () => ({ scale: 1, x: 0, y: 0, rot: 0, alpha: 1 }) },
];

// -------------------- preview tiles --------------------

/** Only animate tiles that are actually on screen — 60 canvases at once locks the tab up. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return visible;
}

function FxTile({
  kind,
  id,
  paletteId,
  title,
  subtitle,
  seconds,
}: {
  kind: "intro" | "outro";
  id: string;
  paletteId: string;
  title: string;
  subtitle: string;
  seconds: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const visible = useOnScreen(ref);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const list = kind === "intro" ? INTRO_ANIMATIONS : OUTRO_ANIMATIONS;
    const def = list.find((d) => d.id === id);
    const palette = FX_PALETTES.find((p) => p.id === paletteId) ?? FX_PALETTES[0];
    const draw = (p: number) => {
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      def?.draw({ ctx, w: canvas.width, h: canvas.height, p, palette, title, subtitle, logo: null });
    };
    if (!visible) {
      draw(0.62);
      return;
    }
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 40) return; // ~25fps is plenty for a thumbnail
      last = now;
      draw((((now - t0) / 1000) % seconds) / seconds);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [kind, id, paletteId, title, subtitle, seconds, visible]);
  return <canvas ref={ref} width={252} height={448} className="w-full rounded-lg border bg-black" />;
}


function MotionTile({ preset, paletteId }: { preset: MotionPreset; paletteId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const visible = useOnScreen(ref);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const palette = FX_PALETTES.find((p) => p.id === paletteId) ?? FX_PALETTES[0];
    const draw = (p: number) => {
      const { scale, x, y, rot, alpha } = preset.at(p);
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2 + x * w, h / 2 + y * h);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, palette.bg[1]);
      g.addColorStop(1, palette.primary);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // faux subject grid so movement reads clearly
      ctx.strokeStyle = hexA("#000000", 0.25);
      ctx.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo((w / 6) * i, 0);
        ctx.lineTo((w / 6) * i, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, (h / 6) * i);
        ctx.lineTo(w, (h / 6) * i);
        ctx.stroke();
      }
      ctx.fillStyle = hexA("#000000", 0.55);
      roundRect(ctx, w * 0.22, h * 0.38, w * 0.56, h * 0.24, w * 0.06);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `700 ${Math.round(h * 0.06)}px ${FX_FONT}`;
      ctx.fillText(preset.name, w / 2, h * 0.92);
    };
    if (!visible) {
      draw(0.35);
      return;
    }
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 40) return;
      last = now;
      draw((((now - t0) / 1000) % 4) / 4);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [preset, paletteId, visible]);
  return <canvas ref={ref} width={240} height={240} className="w-full rounded-lg border bg-black" />;
}

// -------------------- page --------------------

function PresetsPage() {
  const [tab, setTab] = useState<"intros" | "outros" | "motion">("intros");
  const [paletteId, setPaletteId] = useState(FX_PALETTES[0].id);
  const [title, setTitle] = useState("Orbit Studio");
  const [subtitle, setSubtitle] = useState("@yourhandle");

  const intros = INTRO_ANIMATIONS.filter((a) => a.id !== "none");
  const outros = OUTRO_ANIMATIONS.filter((a) => a.id !== "none");

  const copy = (name: string) => {
    void navigator.clipboard.writeText(name);
    toast.success(`“${name}” copied — pick it in any studio's Intro & outro panel.`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="h-6 w-6" /> Templates & presets
        </h1>
        <p className="text-sm text-muted-foreground">
          {intros.length} branded intros, {outros.length} outro cards and {MOTION_PRESETS.length}{" "}
          motion presets. Everything here is available inside every video studio.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand it</CardTitle>
          <CardDescription>Previews update live as you type.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Subtitle / handle</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Palette</Label>
            <Select value={paletteId} onValueChange={setPaletteId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FX_PALETTES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="intros">Intros ({intros.length})</TabsTrigger>
          <TabsTrigger value="outros">Outros ({outros.length})</TabsTrigger>
          <TabsTrigger value="motion">Motion ({MOTION_PRESETS.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "motion" ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {MOTION_PRESETS.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <MotionTile preset={m} paletteId={paletteId} />
              <CardContent className="space-y-1 p-3">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
                <button
                  type="button"
                  onClick={() => copy(m.name)}
                  className="inline-flex items-center gap-1 text-xs text-primary"
                >
                  <Copy className="h-3 w-3" /> Copy name
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(tab === "intros" ? intros : outros).map((a) => (
            <Card key={a.id} className="overflow-hidden">
              <FxTile
                kind={tab === "intros" ? "intro" : "outro"}
                id={a.id}
                paletteId={paletteId}
                title={title}
                subtitle={subtitle}
                seconds={tab === "intros" ? 2.4 : 3}
              />
              <CardContent className="space-y-1 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{a.name}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {tab === "intros" ? "Intro" : "Outro"}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => copy(a.name)}
                  className="inline-flex items-center gap-1 text-xs text-primary"
                >
                  <Copy className="h-3 w-3" /> Copy name
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
