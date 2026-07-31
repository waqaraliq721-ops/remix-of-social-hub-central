import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  INTRO_ANIMATIONS,
  OUTRO_ANIMATIONS,
  FX_PALETTES,
  type FxPalette,
} from "@/lib/video-fx";

export type CardConfig = {
  id: string;
  title: string;
  subtitle: string;
  seconds: number;
  paletteId: string;
};

export const defaultIntro: CardConfig = {
  id: "none",
  title: "Your Brand",
  subtitle: "Presents",
  seconds: 2,
  paletteId: "gold",
};
export const defaultOutro: CardConfig = {
  id: "none",
  title: "Follow for more",
  subtitle: "@yourhandle",
  seconds: 2.5,
  paletteId: "gold",
};

export function paletteOf(id: string): FxPalette {
  return FX_PALETTES.find((p) => p.id === id) ?? FX_PALETTES[0];
}

function MiniPreview({
  kind,
  cfg,
  ratio,
}: {
  kind: "intro" | "outro";
  cfg: CardConfig;
  ratio: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    const list = kind === "intro" ? INTRO_ANIMATIONS : OUTRO_ANIMATIONS;
    const def = list.find((d) => d.id === cfg.id);
    const loop = () => {
      const p = (((performance.now() - start) / 1000) % Math.max(0.5, cfg.seconds)) / Math.max(0.5, cfg.seconds);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      def?.draw({
        ctx,
        w: canvas.width,
        h: canvas.height,
        p,
        palette: paletteOf(cfg.paletteId),
        title: cfg.title,
        subtitle: cfg.subtitle,
        logo: null,
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [kind, cfg, ratio]);

  const w = 260;
  return (
    <canvas
      ref={ref}
      width={w}
      height={Math.round(w / ratio)}
      className="w-full rounded-lg border bg-black"
    />
  );
}

export function IntroOutroCard({
  intro,
  outro,
  onIntro,
  onOutro,
  ratio = 9 / 16,
}: {
  intro: CardConfig;
  outro: CardConfig;
  onIntro: (c: CardConfig) => void;
  onOutro: (c: CardConfig) => void;
  ratio?: number;
}) {
  const section = (
    kind: "intro" | "outro",
    cfg: CardConfig,
    set: (c: CardConfig) => void,
  ) => {
    const list = kind === "intro" ? INTRO_ANIMATIONS : OUTRO_ANIMATIONS;
    return (
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {kind === "intro" ? "Intro animation" : "Outro card"}
        </Label>
        <Select value={cfg.id} onValueChange={(v) => set({ ...cfg, id: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {list.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cfg.id !== "none" && (
          <>
            <MiniPreview kind={kind} cfg={cfg} ratio={ratio} />
            <Input
              value={cfg.title}
              onChange={(e) => set({ ...cfg, title: e.target.value })}
              placeholder="Title"
            />
            <Input
              value={cfg.subtitle}
              onChange={(e) => set({ ...cfg, subtitle: e.target.value })}
              placeholder="Subtitle / handle"
            />
            <Select value={cfg.paletteId} onValueChange={(v) => set({ ...cfg, paletteId: v })}>
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
            <div>
              <Label className="text-xs text-muted-foreground">
                Duration · {cfg.seconds.toFixed(1)}s
              </Label>
              <Slider
                value={[cfg.seconds]}
                min={0.5}
                max={6}
                step={0.1}
                onValueChange={([v]) => set({ ...cfg, seconds: v })}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Intro & outro</CardTitle>
        <CardDescription>
          20 intro animations and 20 outro cards — optional, rendered into the export.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {section("intro", intro, onIntro)}
        {section("outro", outro, onOutro)}
      </CardContent>
    </Card>
  );
}
