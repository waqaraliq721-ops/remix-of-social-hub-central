// Shared per-element animation system for the kid-video studios (Would You
// Rather + Guess the Emoji). Framework-clean: only depends on React for the
// small control components, no server imports.

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react";

export type EntrancePreset =
  | "none"
  | "fade"
  | "pop"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "flip"
  | "bounce-in"
  | "rotate-in"
  | "blur-in"
  | "spring-drop"
  | "swing-in"
  | "drop-bounce"
  | "slide-blur"
  | "unfold"
  | "pop-rotate"
  | "streak-in"
  | "typewriter-scale"
  | "elastic-side";

export type LoopPreset =
  | "none"
  | "float"
  | "pulse"
  | "wobble"
  | "sway"
  | "spin"
  | "shimmer"
  | "breathe"
  | "bob"
  | "tilt"
  | "heartbeat"
  | "drift"
  | "jitter";

export type EasingId =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "back-out"
  | "elastic"
  | "bounce";

export const ENTRANCE_PRESETS: { id: EntrancePreset; name: string }[] = [
  { id: "none", name: "None" },
  { id: "fade", name: "Fade" },
  { id: "pop", name: "Pop" },
  { id: "slide-up", name: "Slide up" },
  { id: "slide-down", name: "Slide down" },
  { id: "slide-left", name: "Slide left" },
  { id: "slide-right", name: "Slide right" },
  { id: "zoom-in", name: "Zoom in" },
  { id: "zoom-out", name: "Zoom out" },
  { id: "flip", name: "Flip" },
  { id: "bounce-in", name: "Bounce in" },
  { id: "rotate-in", name: "Rotate in" },
  { id: "blur-in", name: "Blur in (fade)" },
  { id: "spring-drop", name: "Spring drop" },
  { id: "swing-in", name: "Swing in" },
  { id: "drop-bounce", name: "Drop bounce" },
  { id: "slide-blur", name: "Slide blur" },
  { id: "unfold", name: "Unfold" },
  { id: "pop-rotate", name: "Pop rotate" },
  { id: "streak-in", name: "Streak in" },
  { id: "typewriter-scale", name: "Typewriter scale" },
  { id: "elastic-side", name: "Elastic side" },
];

export const LOOP_PRESETS: { id: LoopPreset; name: string }[] = [
  { id: "none", name: "None" },
  { id: "float", name: "Float" },
  { id: "pulse", name: "Pulse" },
  { id: "wobble", name: "Wobble" },
  { id: "sway", name: "Sway" },
  { id: "spin", name: "Spin" },
  { id: "shimmer", name: "Shimmer" },
  { id: "breathe", name: "Breathe" },
  { id: "bob", name: "Bob" },
  { id: "tilt", name: "Tilt" },
  { id: "heartbeat", name: "Heartbeat" },
  { id: "drift", name: "Drift" },
  { id: "jitter", name: "Jitter" },
];

export const EASINGS: { id: EasingId; name: string }[] = [
  { id: "linear", name: "Linear" },
  { id: "ease-in", name: "Ease in" },
  { id: "ease-out", name: "Ease out" },
  { id: "ease-in-out", name: "Ease in-out" },
  { id: "back-out", name: "Back out" },
  { id: "elastic", name: "Elastic" },
  { id: "bounce", name: "Bounce" },
];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export const EASING_FNS: Record<EasingId, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  "back-out": (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    let x = t;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  },
};

export type ElementAnimSpec = {
  preset: EntrancePreset;
  duration: number;
  delay: number;
  intensity: number;
  loop: LoopPreset;
  easing: EasingId;
};

export function defaultAnim(partial?: Partial<ElementAnimSpec>): ElementAnimSpec {
  return {
    preset: "fade",
    duration: 0.5,
    delay: 0,
    intensity: 1,
    loop: "none",
    easing: "ease-out",
    ...partial,
  };
}

export type AnimResult = {
  opacity: number;
  scale: number;
  dx: number;
  dy: number;
  rotate: number;
};

const IDENTITY: AnimResult = { opacity: 1, scale: 1, dx: 0, dy: 0, rotate: 0 };

/**
 * Computes an entrance + looping transform for an element given the time
 * elapsed since the containing scene/round started. Consumers apply the
 * result via ctx.translate/scale/rotate/globalAlpha in that order around the
 * element's own centre point.
 */
export function computeAnim(
  spec: ElementAnimSpec,
  tSinceStart: number,
  easings: Record<EasingId, (t: number) => number> = EASING_FNS,
): AnimResult {
  const ease = easings[spec.easing] ?? EASING_FNS["ease-out"];
  const local = tSinceStart - spec.delay;
  const dur = Math.max(0.001, spec.duration);
  const p = clamp01(local / dur);
  const k = ease(p);
  const inProgress = local < 0;

  let res: AnimResult = { ...IDENTITY };
  const I = spec.intensity;

  if (!inProgress && spec.preset !== "none") {
    switch (spec.preset) {
      case "fade":
        res.opacity = k;
        break;
      case "blur-in":
        res.opacity = k;
        break;
      case "pop":
        res.opacity = k;
        res.scale = 0.5 + 0.5 * k;
        break;
      case "zoom-in":
        res.opacity = k;
        res.scale = 1.4 - 0.4 * k * I + (1 - I) * 0;
        res.scale = 1 + (1 - k) * 0.4 * I;
        break;
      case "zoom-out":
        res.opacity = k;
        res.scale = 1 - (1 - k) * 0.4 * I;
        break;
      case "slide-up":
        res.opacity = k;
        res.dy = (1 - k) * 60 * I;
        break;
      case "slide-down":
        res.opacity = k;
        res.dy = -(1 - k) * 60 * I;
        break;
      case "slide-left":
        res.opacity = k;
        res.dx = (1 - k) * 80 * I;
        break;
      case "slide-right":
        res.opacity = k;
        res.dx = -(1 - k) * 80 * I;
        break;
      case "flip":
        res.opacity = k;
        res.scale = Math.max(0.02, Math.abs(Math.cos((1 - k) * Math.PI)));
        break;
      case "bounce-in": {
        const b = EASING_FNS.bounce(p);
        res.opacity = clamp01(p * 2);
        res.scale = 0.6 + 0.4 * b;
        break;
      }
      case "rotate-in":
        res.opacity = k;
        res.rotate = (1 - k) * 0.6 * I;
        res.scale = 0.85 + 0.15 * k;
        break;
      case "spring-drop": {
        const e = EASING_FNS.elastic(p);
        res.opacity = clamp01(p * 3);
        res.dy = (1 - e) * -50 * I;
        break;
      }
      case "swing-in":
        res.opacity = k;
        res.rotate = Math.sin((1 - k) * Math.PI * 2) * 0.5 * I * (1 - k);
        break;
      case "drop-bounce": {
        const b = EASING_FNS.bounce(p);
        res.opacity = clamp01(p * 2);
        res.dy = (1 - b) * -120 * I;
        break;
      }
      case "slide-blur":
        res.opacity = k;
        res.dy = (1 - k) * 40 * I;
        break;
      case "unfold":
        res.opacity = k;
        res.scale = 0.05 + 0.95 * k;
        break;
      case "pop-rotate":
        res.opacity = k;
        res.scale = 0.4 + 0.6 * k;
        res.rotate = (1 - k) * Math.PI * 0.5 * I;
        break;
      case "streak-in":
        res.opacity = k;
        res.dx = -(1 - k) * 160 * I;
        break;
      case "typewriter-scale":
        res.opacity = p > 0.05 ? 1 : 0;
        res.scale = 0.85 + 0.15 * k;
        break;
      case "elastic-side": {
        const e = EASING_FNS.elastic(p);
        res.opacity = clamp01(p * 3);
        res.dx = (1 - e) * 80 * I;
        break;
      }
      default:
        break;
    }
  } else if (inProgress) {
    res.opacity = 0;
  }

  if (spec.loop !== "none" && !inProgress) {
    const lt = Math.max(0, tSinceStart);
    const amp = 0.5 * I;
    switch (spec.loop) {
      case "float":
        res.dy += Math.sin(lt * 1.6) * 8 * amp;
        break;
      case "pulse":
        res.scale *= 1 + Math.sin(lt * 3) * 0.04 * amp;
        break;
      case "wobble":
        res.rotate += Math.sin(lt * 4) * 0.05 * amp;
        break;
      case "sway":
        res.dx += Math.sin(lt * 1.3) * 10 * amp;
        break;
      case "spin":
        res.rotate += lt * 0.6 * amp;
        break;
      case "shimmer":
        res.opacity *= 0.85 + Math.sin(lt * 5) * 0.15 * amp;
        break;
      case "breathe":
        res.scale *= 1 + Math.sin(lt * 1.1) * 0.03 * amp;
        break;
      case "bob":
        res.dy += Math.sin(lt * 2.4) * 6 * amp;
        break;
      case "tilt":
        res.rotate += Math.sin(lt * 2) * 0.08 * amp;
        break;
      case "heartbeat":
        res.scale *= 1 + Math.max(0, Math.sin(lt * 4)) * Math.max(0, Math.sin(lt * 4 + 0.3)) * 0.08 * amp;
        break;
      case "drift":
        res.dx += Math.sin(lt * 0.7) * 12 * amp;
        res.dy += Math.cos(lt * 0.5) * 8 * amp;
        break;
      case "jitter":
        res.dx += Math.sin(lt * 23) * 2 * amp;
        res.dy += Math.cos(lt * 29) * 2 * amp;
        break;
      default:
        break;
    }
  }

  return res;
}

/** Applies an AnimResult around a given centre point; caller must ctx.save()/restore(). */
export function applyAnim(
  ctx: CanvasRenderingContext2D,
  anim: AnimResult,
  cx: number,
  cy: number,
) {
  ctx.globalAlpha *= Math.max(0, Math.min(1, anim.opacity));
  ctx.translate(cx + anim.dx, cy + anim.dy);
  ctx.rotate(anim.rotate);
  ctx.scale(anim.scale, anim.scale);
  ctx.translate(-cx, -cy);
}

// ---------------------------------------------------------------------------
// React controls
// ---------------------------------------------------------------------------

export function AnimControls({
  value,
  onChange,
}: {
  value: ElementAnimSpec;
  onChange: (spec: ElementAnimSpec) => void;
}) {
  const set = (patch: Partial<ElementAnimSpec>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Entrance</Label>
          <Select value={value.preset} onValueChange={(v) => set({ preset: v as EntrancePreset })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTRANCE_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Loop</Label>
          <Select value={value.loop} onValueChange={(v) => set({ loop: v as LoopPreset })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOOP_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Easing</Label>
        <Select value={value.easing} onValueChange={(v) => set({ easing: v as EasingId })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EASINGS.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">
          Duration · {value.duration.toFixed(2)}s
        </Label>
        <Slider
          value={[value.duration]}
          min={0.1}
          max={2}
          step={0.05}
          onValueChange={([v]) => set({ duration: v })}
        />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Delay · {value.delay.toFixed(2)}s</Label>
        <Slider value={[value.delay]} min={0} max={2} step={0.05} onValueChange={([v]) => set({ delay: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">
          Intensity · {value.intensity.toFixed(2)}x
        </Label>
        <Slider
          value={[value.intensity]}
          min={0}
          max={2}
          step={0.05}
          onValueChange={([v]) => set({ intensity: v })}
        />
      </div>
    </div>
  );
}

export function AnimControlGroup({
  items,
  values,
  onChange,
}: {
  items: { key: string; label: string }[];
  values: Record<string, ElementAnimSpec>;
  onChange: (key: string, spec: ElementAnimSpec) => void;
}) {
  const [open, setOpen] = useState<string | null>(items[0]?.key ?? null);
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const spec = values[item.key] ?? defaultAnim();
        const isOpen = open === item.key;
        return (
          <div key={item.key} className="rounded-lg border">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : item.key)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
            >
              <span>{item.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div className="border-t p-3">
                <AnimControls value={spec} onChange={(s) => onChange(item.key, s)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
