// Shared element-level layout controls, animated backgrounds, timers and time
// bars for the kid-video studios (Would You Rather, Guess the Emoji, Math Quiz,
// Guess The Logo). Canvas-only rendering helpers + small React control panels.

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import {
  EASING_FNS,
  type EasingId,
  type ElementAnimSpec,
  defaultAnim,
  computeAnim,
  applyAnim,
  AnimControls,
  EASINGS,
} from "@/lib/kid-anim";

// ---------------------------------------------------------------------------
// Per-element transform (position / scale / rotation / opacity)
// ---------------------------------------------------------------------------

export type ElementStyleSpec = {
  /** Horizontal offset in percent of canvas width (-50..50). */
  dx: number;
  /** Vertical offset in percent of canvas height (-50..50). */
  dy: number;
  /** Uniform scale multiplier. */
  scale: number;
  /** Rotation in degrees. */
  rotate: number;
  /** 0..1 opacity multiplier. */
  opacity: number;
  /** Whether the element is drawn at all. */
  visible: boolean;
  /** Visual style variant (1..5) for the element's plate/chrome. */
  variant: number;
};

export const ELEMENT_VARIANTS: { id: number; name: string }[] = [
  { id: 1, name: "Style 1 · Glass" },
  { id: 2, name: "Style 2 · Solid card" },
  { id: 3, name: "Style 3 · Outline" },
  { id: 4, name: "Style 4 · Gradient" },
  { id: 5, name: "Style 5 · Sticker" },
];

export function defaultStyle(partial?: Partial<ElementStyleSpec>): ElementStyleSpec {
  return { dx: 0, dy: 0, scale: 1, rotate: 0, opacity: 1, visible: true, variant: 1, ...partial };
}

export const IDENTITY_STYLE = defaultStyle();

/**
 * Paints one of five element plate styles behind content. Colours come from the
 * active palette so every variant stays on-theme.
 */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  variant: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  colors: { primary: string; accent: string; text: string },
  tone: string = colors.primary,
) {
  const v = Math.max(1, Math.min(5, Math.round(variant || 1)));
  ctx.save();
  const path = (rr: number, ox = 0, oy = 0) => {
    ctx.beginPath();
    ctx.roundRect(x + ox, y + oy, w, h, rr);
  };
  switch (v) {
    case 1: {
      path(r);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fill();
      ctx.strokeStyle = hexToRgba(colors.text, 0.25);
      ctx.lineWidth = Math.max(2, h * 0.02);
      ctx.stroke();
      break;
    }
    case 2: {
      path(r);
      ctx.fillStyle = hexToRgba(tone, 0.92);
      ctx.fill();
      break;
    }
    case 3: {
      path(r);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();
      ctx.strokeStyle = tone;
      ctx.lineWidth = Math.max(3, h * 0.045);
      ctx.stroke();
      break;
    }
    case 4: {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, hexToRgba(tone, 0.95));
      g.addColorStop(1, hexToRgba(colors.accent, 0.9));
      path(r);
      ctx.fillStyle = g;
      ctx.fill();
      break;
    }
    default: {
      path(r, h * 0.06, h * 0.08);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fill();
      path(r);
      ctx.fillStyle = hexToRgba(tone, 0.95);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(colors.text, 0.9);
      ctx.lineWidth = Math.max(3, h * 0.04);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}


/**
 * Applies an element style around a centre point. Caller must ctx.save()/restore().
 * `w`/`h` are canvas dimensions used to resolve percentage offsets.
 */
export function applyStyle(
  ctx: CanvasRenderingContext2D,
  s: ElementStyleSpec | undefined,
  cx: number,
  cy: number,
  w: number,
  h: number,
) {
  const st = s ?? IDENTITY_STYLE;
  ctx.globalAlpha *= Math.max(0, Math.min(1, st.opacity));
  ctx.translate(cx + (st.dx / 100) * w, cy + (st.dy / 100) * h);
  ctx.rotate((st.rotate * Math.PI) / 180);
  ctx.scale(st.scale, st.scale);
  ctx.translate(-cx, -cy);
}

export function ElementStyleControls({
  value,
  onChange,
}: {
  value: ElementStyleSpec;
  onChange: (next: ElementStyleSpec) => void;
}) {
  const set = (patch: Partial<ElementStyleSpec>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Layout</Label>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onChange(defaultStyle())}>
          <RotateCcw className="mr-1 h-3 w-3" /> Reset
        </Button>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Element style</Label>
        <Select
          value={String(value.variant ?? 1)}
          onValueChange={(v) => set({ variant: Number(v) })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ELEMENT_VARIANTS.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">X · {value.dx.toFixed(0)}%</Label>
        <Slider value={[value.dx]} min={-50} max={50} step={1} onValueChange={([v]) => set({ dx: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Y · {value.dy.toFixed(0)}%</Label>
        <Slider value={[value.dy]} min={-50} max={50} step={1} onValueChange={([v]) => set({ dy: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Scale · {value.scale.toFixed(2)}x</Label>
        <Slider value={[value.scale]} min={0.2} max={2.5} step={0.05} onValueChange={([v]) => set({ scale: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Rotation · {value.rotate.toFixed(0)}°</Label>
        <Slider value={[value.rotate]} min={-45} max={45} step={1} onValueChange={([v]) => set({ rotate: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Opacity · {Math.round(value.opacity * 100)}%</Label>
        <Slider value={[value.opacity]} min={0} max={1} step={0.05} onValueChange={([v]) => set({ opacity: v })} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated backgrounds
// ---------------------------------------------------------------------------

export type BackgroundId =
  | "gradient"
  | "gradient-shift"
  | "aurora"
  | "bubbles"
  | "confetti"
  | "rays"
  | "grid"
  | "waves"
  | "dots"
  | "stars"
  | "blobs"
  | "stripes"
  | "spotlight"
  | "hex"
  | "ripple"
  | "plasma"
  | "checker"
  | "bokeh"
  | "triangles"
  | "swirl"
  | "comets"
  | "curtain"
  | "pulse-rings"
  | "zigzag"
  | "solid"
  | "spiral-sunburst"
  | "sunburst-rays"
  | "question-field";

export const BACKGROUNDS: { id: BackgroundId; name: string }[] = [
  { id: "gradient", name: "Gradient" },
  { id: "gradient-shift", name: "Gradient shift" },
  { id: "aurora", name: "Aurora" },
  { id: "bubbles", name: "Bubbles" },
  { id: "confetti", name: "Confetti" },
  { id: "rays", name: "Light rays" },
  { id: "grid", name: "Moving grid" },
  { id: "waves", name: "Waves" },
  { id: "dots", name: "Dot field" },
  { id: "stars", name: "Starfield" },
  { id: "blobs", name: "Soft blobs" },
  { id: "stripes", name: "Diagonal stripes" },
  { id: "spotlight", name: "Spotlight" },
  { id: "hex", name: "Hex glow" },
  { id: "ripple", name: "Ripples" },
  { id: "plasma", name: "Plasma" },
  { id: "checker", name: "Checkerboard" },
  { id: "bokeh", name: "Bokeh lights" },
  { id: "triangles", name: "Triangles" },
  { id: "swirl", name: "Swirl" },
  { id: "comets", name: "Comets" },
  { id: "curtain", name: "Curtain" },
  { id: "pulse-rings", name: "Pulse rings" },
  { id: "zigzag", name: "Zigzag" },
  { id: "solid", name: "Solid" },
  { id: "spiral-sunburst", name: "Spiral sunburst" },
  { id: "sunburst-rays", name: "Sunburst rays" },
  { id: "question-field", name: "Question mark field" },
];


export type BgColors = {
  bg: [string, string];
  primary: string;
  accent: string;
};

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(s, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Deterministic pseudo-random so backgrounds render identically each frame. */
function rnd(i: number) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Paints a full-bleed animated background. `t` is seconds since start. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  id: BackgroundId,
  colors: BgColors,
  w: number,
  h: number,
  t: number,
  intensity = 1,
) {
  const [c0, c1] = colors.bg;
  ctx.save();

  // Base fill — always a full-bleed gradient so top/bottom read as one piece.
  if (id === "solid") {
    ctx.fillStyle = c0;
    ctx.fillRect(0, 0, w, h);
  } else if (id === "gradient-shift") {
    const a = (Math.sin(t * 0.25) + 1) / 2;
    const g = ctx.createLinearGradient(w * a, 0, w * (1 - a), h);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const I = intensity;
  switch (id) {
    case "aurora": {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 3; i++) {
        const cx = w * (0.3 + 0.2 * i) + Math.sin(t * 0.3 + i) * w * 0.18;
        const cy = h * (0.25 + 0.25 * i) + Math.cos(t * 0.22 + i) * h * 0.12;
        const r = Math.max(w, h) * (0.35 + 0.08 * i);
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, hexToRgba(i % 2 ? colors.accent : colors.primary, 0.35 * I));
        rg.addColorStop(1, hexToRgba(i % 2 ? colors.accent : colors.primary, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "bubbles": {
      for (let i = 0; i < 26; i++) {
        const speed = 0.15 + rnd(i) * 0.25;
        const x = w * rnd(i * 3.1) + Math.sin(t * 0.6 + i) * w * 0.02;
        const y = h - (((t * speed * h + rnd(i * 7.7) * h * 2) % (h * 1.4)) - h * 0.2);
        const r = (12 + rnd(i * 5.3) * 46) * I;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(i % 2 ? colors.primary : colors.accent, 0.12);
        ctx.fill();
      }
      break;
    }
    case "confetti": {
      for (let i = 0; i < 44; i++) {
        const x = ((rnd(i * 2.7) * w + t * (18 + rnd(i) * 30)) % (w + 80)) - 40;
        const y = ((rnd(i * 9.1) * h + t * (40 + rnd(i * 3) * 70)) % (h + 80)) - 40;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (1 + rnd(i)) + i);
        ctx.fillStyle = hexToRgba(i % 3 === 0 ? colors.accent : colors.primary, 0.35 * I);
        ctx.fillRect(-5, -9, 10, 18);
        ctx.restore();
      }
      break;
    }
    case "rays": {
      ctx.globalCompositeOperation = "screen";
      ctx.translate(w / 2, h * 0.1);
      ctx.rotate(Math.sin(t * 0.12) * 0.15);
      for (let i = 0; i < 14; i++) {
        ctx.save();
        ctx.rotate((i / 14) * Math.PI * 2 + t * 0.05);
        const grd = ctx.createLinearGradient(0, 0, 0, Math.max(w, h));
        grd.addColorStop(0, hexToRgba(colors.accent, 0.16 * I));
        grd.addColorStop(1, hexToRgba(colors.accent, 0));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-w * 0.06, Math.max(w, h));
        ctx.lineTo(w * 0.06, Math.max(w, h));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "grid": {
      const step = 96;
      const off = (t * 26) % step;
      ctx.strokeStyle = hexToRgba(colors.primary, 0.14 * I);
      ctx.lineWidth = 2;
      for (let x = -step + off; x < w + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = -step + off; y < h + step; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      break;
    }
    case "waves": {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const base = h * (0.55 + i * 0.12);
        ctx.moveTo(0, base);
        for (let x = 0; x <= w; x += 20) {
          const y = base + Math.sin(x / (180 + i * 40) + t * (0.8 + i * 0.2)) * 26 * I;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(i % 2 ? colors.accent : colors.primary, 0.09);
        ctx.fill();
      }
      break;
    }
    case "dots": {
      const step = 64;
      for (let x = 0; x < w + step; x += step) {
        for (let y = 0; y < h + step; y += step) {
          const p = Math.sin(t * 1.6 + (x + y) / 160) * 0.5 + 0.5;
          ctx.beginPath();
          ctx.arc(x, y, 3 + p * 4 * I, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(colors.primary, 0.1 + p * 0.14);
          ctx.fill();
        }
      }
      break;
    }
    case "stars": {
      for (let i = 0; i < 110; i++) {
        const x = rnd(i * 1.7) * w;
        const y = rnd(i * 4.3) * h;
        const tw = 0.4 + 0.6 * (Math.sin(t * 2 + i) * 0.5 + 0.5);
        ctx.beginPath();
        ctx.arc(x, y, 1 + rnd(i * 8) * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(colors.accent, tw * 0.6 * I);
        ctx.fill();
      }
      break;
    }
    case "blobs": {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 5; i++) {
        const cx = w * (0.15 + 0.18 * i) + Math.sin(t * 0.35 + i * 1.7) * w * 0.12;
        const cy = h * (0.2 + 0.15 * (i % 4)) + Math.cos(t * 0.28 + i) * h * 0.14;
        const r = Math.min(w, h) * (0.18 + rnd(i) * 0.14);
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, hexToRgba(i % 2 ? colors.accent : colors.primary, 0.28 * I));
        rg.addColorStop(1, hexToRgba(i % 2 ? colors.accent : colors.primary, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "stripes": {
      const step = 120;
      const off = (t * 34) % (step * 2);
      ctx.save();
      ctx.translate(-off, 0);
      ctx.rotate(-0.5);
      for (let x = -h; x < w + h * 2; x += step * 2) {
        ctx.fillStyle = hexToRgba(colors.primary, 0.07 * I);
        ctx.fillRect(x, -h, step, h * 3);
      }
      ctx.restore();
      break;
    }
    case "spotlight": {
      const cx = w / 2 + Math.sin(t * 0.4) * w * 0.1;
      const cy = h * 0.42 + Math.cos(t * 0.3) * h * 0.05;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      rg.addColorStop(0, hexToRgba(colors.accent, 0.22 * I));
      rg.addColorStop(0.55, hexToRgba(colors.primary, 0.06 * I));
      rg.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "hex": {
      const R = 58;
      const dx = R * 1.5;
      const dy = R * Math.sqrt(3);
      let row = 0;
      for (let y = -dy; y < h + dy; y += dy / 2) {
        row++;
        for (let x = (row % 2 ? 0 : dx / 2) - dx; x < w + dx; x += dx) {
          const p = Math.sin(t * 1.2 + (x + y) / 220) * 0.5 + 0.5;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k;
            const px = x + Math.cos(a) * R * 0.5;
            const py = y + Math.sin(a) * R * 0.5;
            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.strokeStyle = hexToRgba(colors.accent, (0.05 + p * 0.1) * I);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      break;
    }
    case "ripple": {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 6; i++) {
        const phase = (t * 0.35 + i / 6) % 1;
        const r = Math.max(w, h) * 0.75 * phase;
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.5, r, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(i % 2 ? colors.accent : colors.primary, (1 - phase) * 0.25 * I);
        ctx.lineWidth = 6 + (1 - phase) * 14;
        ctx.stroke();
      }
      break;
    }
    case "plasma": {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 7; i++) {
        const cx = w * (0.5 + Math.sin(t * 0.3 + i * 1.1) * 0.38);
        const cy = h * (0.5 + Math.cos(t * 0.24 + i * 0.8) * 0.4);
        const r = Math.min(w, h) * (0.22 + rnd(i) * 0.2);
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, hexToRgba(i % 2 ? colors.accent : colors.primary, 0.3 * I));
        rg.addColorStop(1, hexToRgba(i % 2 ? colors.accent : colors.primary, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "checker": {
      const s = 110;
      const off = (t * 22) % (s * 2);
      for (let y = -s; y < h + s; y += s) {
        for (let x = -s * 2; x < w + s; x += s) {
          const on = (Math.round((x + off) / s) + Math.round(y / s)) % 2 === 0;
          if (!on) continue;
          ctx.fillStyle = hexToRgba(colors.primary, 0.07 * I);
          ctx.fillRect(x + off, y, s, s);
        }
      }
      break;
    }
    case "bokeh": {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 24; i++) {
        const x = ((rnd(i * 3.3) * w + t * (6 + rnd(i) * 14)) % (w + 200)) - 100;
        const y = h * rnd(i * 6.1) + Math.sin(t * 0.4 + i) * 24;
        const r = (30 + rnd(i * 2.2) * 90) * I;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, hexToRgba(i % 3 ? colors.primary : colors.accent, 0.22));
        rg.addColorStop(1, hexToRgba(i % 3 ? colors.primary : colors.accent, 0));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "triangles": {
      const s = 150;
      for (let y = -s, row = 0; y < h + s; y += s, row++) {
        for (let x = -s; x < w + s; x += s) {
          const p = Math.sin(t * 1.1 + (x + y) / 260 + row) * 0.5 + 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y + s);
          ctx.lineTo(x + s / 2, y);
          ctx.lineTo(x + s, y + s);
          ctx.closePath();
          ctx.fillStyle = hexToRgba((row + x / s) % 2 ? colors.accent : colors.primary, (0.03 + p * 0.07) * I);
          ctx.fill();
        }
      }
      break;
    }
    case "swirl": {
      ctx.globalCompositeOperation = "screen";
      ctx.translate(w / 2, h / 2);
      ctx.rotate(t * 0.12 * I);
      for (let i = 0; i < 18; i++) {
        ctx.save();
        ctx.rotate((i / 18) * Math.PI * 2);
        const g = ctx.createLinearGradient(0, 0, Math.max(w, h) * 0.7, 0);
        g.addColorStop(0, hexToRgba(i % 2 ? colors.accent : colors.primary, 0.16 * I));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, Math.max(w, h) * 0.75, 0, 0.14);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "comets": {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 14; i++) {
        const prog = (t * (0.12 + rnd(i) * 0.2) + rnd(i * 4.4)) % 1;
        const x = -w * 0.2 + prog * w * 1.4;
        const y = h * rnd(i * 2.9) + prog * h * 0.2;
        const len = 120 + rnd(i * 5) * 220;
        const g = ctx.createLinearGradient(x - len, y - len * 0.2, x, y);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, hexToRgba(i % 2 ? colors.accent : colors.primary, 0.5 * I));
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - len, y - len * 0.2);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      break;
    }
    case "curtain": {
      const n = 16;
      const cw = w / n;
      for (let i = 0; i < n; i++) {
        const amp = (Math.sin(t * 1.1 + i * 0.7) * 0.5 + 0.5) * 0.12 * I;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, hexToRgba(i % 2 ? colors.accent : colors.primary, amp));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(i * cw, 0, cw, h);
      }
      break;
    }
    case "pulse-rings": {
      for (let i = 0; i < 5; i++) {
        const phase = (t * 0.5 + i / 5) % 1;
        const r = Math.min(w, h) * (0.1 + phase * 0.55);
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(colors.accent, (1 - phase) * 0.3 * I);
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      break;
    }
    case "zigzag": {
      const step = 70;
      ctx.lineWidth = 4;
      for (let row = 0, y = -step; y < h + step; y += step, row++) {
        ctx.beginPath();
        const off = Math.sin(t * 0.9 + row * 0.4) * step * 0.5 * I;
        for (let x = -step; x < w + step; x += step) {
          const yy = y + ((x / step) % 2 === 0 ? -step * 0.3 : step * 0.3) + off;
          x === -step ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        }
        ctx.strokeStyle = hexToRgba(row % 2 ? colors.accent : colors.primary, 0.09 * I);
        ctx.stroke();
      }
      break;
    }
    case "spiral-sunburst": {
      // Rotating swirl of alternating rays, hatched stripes on the darker rays.
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(w, h) * 0.75;
      const rays = 18;
      const rot = t * 0.18 * I;
      ctx.save();
      ctx.translate(cx, cy);
      for (let i = 0; i < rays; i++) {
        const a0 = (i / rays) * Math.PI * 2 + rot;
        const a1 = ((i + 1) / rays) * Math.PI * 2 + rot;
        const bend = 0.55;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let s2 = 0; s2 <= 1; s2 += 0.1) {
          const a = a0 + (a1 - a0) * s2 + s2 * bend;
          ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        }
        for (let s2 = 1; s2 >= 0; s2 -= 0.1) {
          const a = a0 + (a1 - a0) * s2 + s2 * bend;
          ctx.lineTo(Math.cos(a) * R * 1.001, Math.sin(a) * R * 1.001);
        }
        ctx.closePath();
        const dark = i % 2 === 0;
        ctx.fillStyle = dark ? hexToRgba(colors.primary, 0.9) : hexToRgba(colors.accent, 0.9);
        ctx.fill();
        if (dark) {
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = hexToRgba("#000000", 0.12);
          ctx.lineWidth = 6;
          for (let hx = -R; hx < R; hx += 22) {
            ctx.beginPath();
            ctx.moveTo(hx, -R);
            ctx.lineTo(hx + R, R);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      ctx.restore();
      break;
    }
    case "sunburst-rays": {
      // Classic slow-rotating radial sunburst rays, no swirl bend.
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(w, h) * 0.75;
      const rays = 20;
      const rot = t * 0.08 * I;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      for (let i = 0; i < rays; i++) {
        const a0 = (i / rays) * Math.PI * 2;
        const a1 = ((i + 1) / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
        ctx.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? hexToRgba(colors.primary, 0.85) : hexToRgba(colors.accent, 0.85);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "question-field": {
      // Purple gradient field with tiled scrolling "?" marks and a centre glow.
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, colors.primary);
      g.addColorStop(1, colors.accent);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.55);
      glow.addColorStop(0, hexToRgba("#ffffff", 0.18));
      glow.addColorStop(1, hexToRgba("#ffffff", 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      const step = 130;
      const off = (t * 14 * I) % step;
      ctx.font = `700 ${step * 0.55}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      for (let y = -step + off; y < h + step; y += step) {
        for (let x = -step; x < w + step; x += step) {
          ctx.fillText("?", x, y);
        }
      }
      break;
    }
    default:
      break;
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Timers
// ---------------------------------------------------------------------------

export type TimerStyleId =
  | "ring"
  | "ring-thick"
  | "pill"
  | "digital"
  | "plain"
  | "square"
  | "dots"
  | "hourglass"
  | "neon-ring"
  | "flip-card"
  | "bubble"
  | "shield"
  | "arc"
  | "bars"
  | "none";

export const TIMER_STYLES: { id: TimerStyleId; name: string }[] = [
  { id: "ring", name: "Ring" },
  { id: "ring-thick", name: "Thick ring" },
  { id: "pill", name: "Pill badge" },
  { id: "digital", name: "Digital" },
  { id: "square", name: "Square frame" },
  { id: "dots", name: "Dot countdown" },
  { id: "hourglass", name: "Hourglass" },
  { id: "neon-ring", name: "Neon ring" },
  { id: "flip-card", name: "Flip card" },
  { id: "bubble", name: "Bubble" },
  { id: "shield", name: "Shield" },
  { id: "arc", name: "Half arc" },
  { id: "bars", name: "Bar stack" },
  { id: "plain", name: "Plain number" },
  { id: "none", name: "Hidden" },
];

/**
 * Draws a countdown timer centred at (cx, cy).
 * `remaining` in seconds, `total` the full round length, `r` the base radius.
 */
export function drawTimer(
  ctx: CanvasRenderingContext2D,
  id: TimerStyleId,
  cx: number,
  cy: number,
  r: number,
  remaining: number,
  total: number,
  colors: { primary: string; accent: string; text: string },
  t = 0,
) {
  if (id === "none") return;
  const p = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const label = String(Math.max(0, Math.ceil(remaining)));
  const urgent = remaining <= 3;
  const pulse = urgent ? 1 + Math.sin(t * 10) * 0.05 : 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stroke = urgent ? colors.accent : colors.primary;

  switch (id) {
    case "ring":
    case "ring-thick": {
      const lw = id === "ring-thick" ? r * 0.3 : r * 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(colors.text, 0.18);
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.strokeStyle = stroke;
      ctx.lineCap = "round";
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.font = `700 ${r * 0.95}px system-ui, sans-serif`;
      ctx.fillText(label, 0, r * 0.04);
      break;
    }
    case "pill": {
      const wpx = r * 2.4;
      const hpx = r * 1.1;
      ctx.beginPath();
      ctx.roundRect(-wpx / 2, -hpx / 2, wpx, hpx, hpx / 2);
      ctx.fillStyle = hexToRgba(stroke, 0.9);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = `800 ${hpx * 0.6}px system-ui, sans-serif`;
      ctx.fillText(label, 0, hpx * 0.02);
      break;
    }
    case "digital": {
      const wpx = r * 2.1;
      const hpx = r * 1.3;
      ctx.beginPath();
      ctx.roundRect(-wpx / 2, -hpx / 2, wpx, hpx, r * 0.2);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
      ctx.strokeStyle = hexToRgba(stroke, 0.8);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = stroke;
      ctx.font = `700 ${hpx * 0.62}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillText(`0:${label.padStart(2, "0")}`, 0, hpx * 0.02);
      break;
    }
    case "square": {
      const s = r * 1.9;
      ctx.strokeStyle = hexToRgba(colors.text, 0.18);
      ctx.lineWidth = r * 0.16;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      // progress along the perimeter
      const per = s * 4;
      let left = per * p;
      const pts: [number, number][] = [
        [-s / 2, -s / 2],
        [s / 2, -s / 2],
        [s / 2, s / 2],
        [-s / 2, s / 2],
        [-s / 2, -s / 2],
      ];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length && left > 0; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const seg = Math.hypot(x1 - x0, y1 - y0);
        const k = Math.min(1, left / seg);
        ctx.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
        left -= seg;
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = r * 0.16;
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.font = `800 ${r * 0.9}px system-ui, sans-serif`;
      ctx.fillText(label, 0, r * 0.04);
      break;
    }
    case "dots": {
      const n = Math.max(1, Math.round(total));
      const left = Math.ceil(remaining);
      const gap = r * 0.62;
      const start = -((n - 1) * gap) / 2;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(start + i * gap, 0, r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = i < left ? stroke : hexToRgba(colors.text, 0.2);
        ctx.fill();
      }
      break;
    }
    case "hourglass": {
      const s = r * 1.5;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(-s / 2, -s);
      ctx.lineTo(s / 2, -s);
      ctx.lineTo(-s / 2, s);
      ctx.lineTo(s / 2, s);
      ctx.closePath();
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-s / 2, -s);
      ctx.lineTo(s / 2, -s);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = hexToRgba(stroke, 0.8);
      ctx.fillRect(-s, -s, s * 2, s * p);
      ctx.restore();
      ctx.fillStyle = colors.text;
      ctx.font = `700 ${r * 0.6}px system-ui, sans-serif`;
      ctx.fillText(label, 0, s * 1.5);
      break;
    }
    case "neon-ring": {
      ctx.shadowColor = stroke;
      ctx.shadowBlur = r * 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.strokeStyle = stroke;
      ctx.lineCap = "round";
      ctx.lineWidth = r * 0.16;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = colors.text;
      ctx.font = `800 ${r * 0.95}px system-ui, sans-serif`;
      ctx.fillText(label, 0, r * 0.04);
      break;
    }
    case "flip-card": {
      const wpx = r * 1.7;
      const hpx = r * 2;
      ctx.beginPath();
      ctx.roundRect(-wpx / 2, -hpx / 2, wpx, hpx, r * 0.22);
      ctx.fillStyle = "rgba(12,12,16,0.92)";
      ctx.fill();
      ctx.strokeStyle = hexToRgba(stroke, 0.9);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-wpx / 2, 0);
      ctx.lineTo(wpx / 2, 0);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.font = `800 ${hpx * 0.6}px system-ui, sans-serif`;
      ctx.fillText(label, 0, hpx * 0.02);
      break;
    }
    case "bubble": {
      const rr = r * (1 + (1 - p) * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(stroke, 0.85);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-rr * 0.3, -rr * 0.35, rr * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = `800 ${r * 0.9}px system-ui, sans-serif`;
      ctx.fillText(label, 0, r * 0.04);
      break;
    }
    case "shield": {
      const s = r * 1.25;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.2);
      ctx.lineTo(s, -s * 0.6);
      ctx.lineTo(s * 0.75, s);
      ctx.lineTo(0, s * 1.35);
      ctx.lineTo(-s * 0.75, s);
      ctx.lineTo(-s, -s * 0.6);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(stroke, 0.25);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = r * 0.12;
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.font = `800 ${r * 0.95}px system-ui, sans-serif`;
      ctx.fillText(label, 0, r * 0.06);
      break;
    }
    case "arc": {
      ctx.beginPath();
      ctx.arc(0, r * 0.4, r * 1.1, Math.PI, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(colors.text, 0.18);
      ctx.lineWidth = r * 0.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.4, r * 1.1, Math.PI, Math.PI + Math.PI * p);
      ctx.strokeStyle = stroke;
      ctx.lineCap = "round";
      ctx.lineWidth = r * 0.2;
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.font = `800 ${r * 0.85}px system-ui, sans-serif`;
      ctx.fillText(label, 0, r * 0.05);
      break;
    }
    case "bars": {
      const n = 5;
      const bw = r * 0.32;
      const gap = r * 0.16;
      const start = -((n * bw + (n - 1) * gap) / 2);
      for (let i = 0; i < n; i++) {
        const on = p > i / n;
        const bh = r * (0.5 + i * 0.28);
        ctx.beginPath();
        ctx.roundRect(start + i * (bw + gap), r * 0.9 - bh, bw, bh, bw * 0.3);
        ctx.fillStyle = on ? stroke : hexToRgba(colors.text, 0.18);
        ctx.fill();
      }
      ctx.fillStyle = colors.text;
      ctx.font = `800 ${r * 0.7}px system-ui, sans-serif`;
      ctx.fillText(label, 0, -r * 0.9);
      break;
    }
    default: {
      ctx.fillStyle = urgent ? colors.accent : colors.text;
      ctx.font = `800 ${r * 1.6}px system-ui, sans-serif`;
      ctx.fillText(label, 0, 0);
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Time bars
// ---------------------------------------------------------------------------

export type TimeBarStyleId =
  | "bar"
  | "rounded"
  | "segmented"
  | "gradient"
  | "glow"
  | "ticks"
  | "dual"
  | "thin"
  | "candy"
  | "chevrons"
  | "beads"
  | "wave-bar"
  | "neon-outline"
  | "step-blocks"
  | "chunk-glow"
  | "dotted-countdown"
  | "liquid-wave"
  | "candy-march"
  | "battery"
  | "ring-dots"
  | "rainbow-sweep"
  | "shrinking-pill"
  | "mascot-capsule"
  | "chevron-mascot"
  | "diagonal-thinker"
  | "none";

export const TIMEBAR_STYLES: { id: TimeBarStyleId; name: string }[] = [
  { id: "bar", name: "Solid bar" },
  { id: "rounded", name: "Rounded" },
  { id: "segmented", name: "Segmented" },
  { id: "gradient", name: "Gradient" },
  { id: "glow", name: "Glow" },
  { id: "ticks", name: "Ticks" },
  { id: "dual", name: "Dual (centre out)" },
  { id: "thin", name: "Thin line" },
  { id: "candy", name: "Candy stripes" },
  { id: "chevrons", name: "Chevrons" },
  { id: "beads", name: "Beads" },
  { id: "wave-bar", name: "Wave bar" },
  { id: "neon-outline", name: "Neon outline" },
  { id: "step-blocks", name: "Step blocks" },
  { id: "chunk-glow", name: "Chunk glow" },
  { id: "dotted-countdown", name: "Dotted countdown" },
  { id: "liquid-wave", name: "Liquid wave" },
  { id: "candy-march", name: "Candy march" },
  { id: "battery", name: "Battery" },
  { id: "ring-dots", name: "Ring of dots" },
  { id: "rainbow-sweep", name: "Rainbow sweep" },
  { id: "shrinking-pill", name: "Shrinking pill" },
  { id: "mascot-capsule", name: "Mascot capsule" },
  { id: "chevron-mascot", name: "Chevron mascot" },
  { id: "diagonal-thinker", name: "Diagonal thinker" },
  { id: "none", name: "Hidden" },
];

/** Draws a horizontal progress/time bar. `p` is 1 → 0 remaining fraction. */
export type TimeBarOptions = {
  /** Rider/marker emoji shown at the leading edge of the fill (mascot styles). */
  emoji?: string;
  /** Overrides the fill colour (defaults to the palette-driven colour). */
  fillColor?: string;
  /** Overrides the track/background colour. */
  trackColor?: string;
  /** Overrides the outline colour. */
  outlineColor?: string;
};

export function drawTimeBar(
  ctx: CanvasRenderingContext2D,
  id: TimeBarStyleId,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  colors: { primary: string; accent: string; text: string },
  t = 0,
  opts: TimeBarOptions = {},
) {
  if (id === "none") return;
  const k = Math.max(0, Math.min(1, p));
  const col = opts.fillColor ?? (k < 0.25 ? colors.accent : colors.primary);
  ctx.save();

  const track = () => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fillStyle = hexToRgba(colors.text, 0.15);
    ctx.fill();
  };

  switch (id) {
    case "bar":
      ctx.fillStyle = hexToRgba(colors.text, 0.15);
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w * k, h);
      break;
    case "rounded":
      track();
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2);
      ctx.fillStyle = col;
      ctx.fill();
      break;
    case "segmented": {
      const n = 20;
      const gap = h * 0.35;
      const sw = (w - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.roundRect(x + i * (sw + gap), y, sw, h, h * 0.25);
        ctx.fillStyle = i / n < k ? col : hexToRgba(colors.text, 0.15);
        ctx.fill();
      }
      break;
    }
    case "gradient": {
      track();
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, colors.primary);
      g.addColorStop(1, colors.accent);
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2);
      ctx.fillStyle = g;
      ctx.fill();
      break;
    }
    case "glow": {
      track();
      ctx.shadowColor = col;
      ctx.shadowBlur = h * 1.6;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case "ticks": {
      track();
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = hexToRgba(colors.text, 0.35);
      ctx.lineWidth = 2;
      for (let i = 1; i < 10; i++) {
        const tx = x + (w / 10) * i;
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.lineTo(tx, y + h);
        ctx.stroke();
      }
      break;
    }
    case "dual": {
      track();
      const half = (w * k) / 2;
      ctx.beginPath();
      ctx.roundRect(x + w / 2 - half, y, half * 2, h, h / 2);
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case "thin": {
      const th = Math.max(3, h * 0.28);
      const ty = y + (h - th) / 2;
      ctx.fillStyle = hexToRgba(colors.text, 0.15);
      ctx.fillRect(x, ty, w, th);
      ctx.fillStyle = col;
      ctx.fillRect(x, ty, w * k, th);
      // running head
      ctx.beginPath();
      ctx.arc(x + w * k, ty + th / 2, th * 1.5 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case "candy": {
      track();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2);
      ctx.clip();
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
      const off = (t * 40) % (h * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = h * 0.45;
      for (let sx = x - h * 2 + off; sx < x + w + h * 2; sx += h * 2) {
        ctx.beginPath();
        ctx.moveTo(sx, y + h);
        ctx.lineTo(sx + h, y);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "chevrons": {
      track();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2);
      ctx.clip();
      ctx.fillStyle = hexToRgba(col, 0.35);
      ctx.fillRect(x, y, w, h);
      const step = h * 1.4;
      const off = (t * 60) % step;
      ctx.fillStyle = col;
      for (let sx = x - step + off; sx < x + w + step; sx += step) {
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.lineTo(sx + h * 0.6, y + h / 2);
        ctx.lineTo(sx, y + h);
        ctx.lineTo(sx + h * 0.3, y + h);
        ctx.lineTo(sx + h * 0.9, y + h / 2);
        ctx.lineTo(sx + h * 0.3, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "beads": {
      const n = 14;
      const gap = (w - h * n) / Math.max(1, n - 1);
      for (let i = 0; i < n; i++) {
        const cx = x + i * (h + gap) + h / 2;
        const on = i / n < k;
        ctx.beginPath();
        ctx.arc(cx, y + h / 2, (h / 2) * (on ? 1 : 0.7), 0, Math.PI * 2);
        ctx.fillStyle = on ? col : hexToRgba(colors.text, 0.18);
        ctx.fill();
      }
      break;
    }
    case "wave-bar": {
      track();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      for (let sx = x; sx <= x + w; sx += 8) {
        ctx.lineTo(sx, y + h * 0.5 + Math.sin(sx / 28 + t * 5) * h * 0.35);
      }
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "neon-outline": {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.strokeStyle = hexToRgba(colors.text, 0.25);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowColor = col;
      ctx.shadowBlur = h * 1.4;
      ctx.beginPath();
      ctx.roundRect(x + h * 0.18, y + h * 0.22, Math.max(h * 0.4, (w - h * 0.36) * k), h * 0.56, h * 0.28);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case "step-blocks": {
      const n = 10;
      const gap = h * 0.4;
      const bw = (w - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const on = i / n < k;
        const bh = h * (0.5 + (i / (n - 1)) * 0.5);
        ctx.beginPath();
        ctx.roundRect(x + i * (bw + gap), y + h - bh, bw, bh, bw * 0.2);
        ctx.fillStyle = on ? col : hexToRgba(colors.text, 0.16);
        ctx.fill();
      }
      break;
    }
    case "chunk-glow": {
      const n = 12;
      const gap = h * 0.22;
      const bw = (w - gap * (n - 1)) / n;
      const filled = k * n;
      for (let i = 0; i < n; i++) {
        const on = i < filled;
        const isEdge = on && i >= filled - 1;
        ctx.save();
        if (isEdge) {
          ctx.shadowColor = col;
          ctx.shadowBlur = h * 1.4 + Math.sin(t * 10) * h * 0.3;
        }
        ctx.beginPath();
        ctx.roundRect(x + i * (bw + gap), y, bw, h, h * 0.25);
        ctx.fillStyle = on ? col : hexToRgba(colors.text, 0.15);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "dotted-countdown": {
      const n = 18;
      const gap = (w - h * n) / Math.max(1, n - 1);
      const filled = Math.round(k * n);
      for (let i = 0; i < n; i++) {
        const idx = n - 1 - i;
        const cx = x + i * (h + gap) + h / 2;
        const on = idx < filled;
        const pulse = on && idx === filled - 1 ? 1 + Math.sin(t * 8) * 0.25 : 1;
        ctx.beginPath();
        ctx.arc(cx, y + h / 2, (h / 2) * 0.85 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = on ? col : hexToRgba(colors.text, 0.15);
        ctx.fill();
      }
      break;
    }
    case "liquid-wave": {
      track();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.clip();
      const fillW = w * k;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      for (let sx = x; sx <= x + fillW + 10; sx += 6) {
        ctx.lineTo(sx, y + h * 0.25 + Math.sin(sx / 18 + t * 6) * h * 0.18);
      }
      ctx.lineTo(x + fillW, y + h);
      ctx.closePath();
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, hexToRgba(col, 0.85));
      g.addColorStop(1, col);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "candy-march": {
      track();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2);
      ctx.clip();
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
      const step = h * 1.1;
      const off = (t * -50) % (step * 2);
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      for (let sx = x - step * 2 + off; sx < x + w + step * 2; sx += step * 2) {
        ctx.save();
        ctx.translate(sx, y);
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(step, 0);
        ctx.lineTo(step * 1.6, 0);
        ctx.lineTo(step * 0.6, h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      break;
    }
    case "battery": {
      const capW = h * 0.32;
      const bodyW = w - capW;
      ctx.beginPath();
      ctx.roundRect(x, y, bodyW, h, h * 0.18);
      ctx.strokeStyle = hexToRgba(colors.text, 0.4);
      ctx.lineWidth = Math.max(2, h * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(x + bodyW + h * 0.06, y + h * 0.28, capW - h * 0.1, h * 0.44, h * 0.08);
      ctx.fillStyle = hexToRgba(colors.text, 0.4);
      ctx.fill();
      const pad = h * 0.16;
      const innerW = Math.max(0, bodyW - pad * 2) * k;
      const battCol = k < 0.25 ? colors.accent : k < 0.5 ? "#f5c542" : col;
      ctx.beginPath();
      ctx.roundRect(x + pad, y + pad, innerW, h - pad * 2, h * 0.1);
      ctx.fillStyle = battCol;
      ctx.fill();
      break;
    }
    case "ring-dots": {
      const n = 24;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rad = Math.max(w, h * 3) / 2 - h;
      const filled = Math.round(k * n);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const px = cx + Math.cos(a) * rad;
        const py = cy + Math.sin(a) * rad * 0.4;
        ctx.beginPath();
        ctx.arc(px, py, h * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = i < filled ? col : hexToRgba(colors.text, 0.15);
        ctx.fill();
      }
      break;
    }
    case "rainbow-sweep": {
      track();
      const rainbow = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"];
      const g = ctx.createLinearGradient(x - (t * 80) % (w * 2), 0, x - (t * 80) % (w * 2) + w * 2, 0);
      rainbow.forEach((c, i) => g.addColorStop(i / (rainbow.length - 1), c));
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2);
      ctx.fillStyle = g;
      ctx.fill();
      break;
    }
    case "shrinking-pill": {
      const fullW = w * k;
      const pulse = 1 + Math.sin(t * 5) * 0.03;
      ctx.beginPath();
      ctx.roundRect(x + w - fullW, y - (h * (pulse - 1)) / 2, fullW * pulse, h * pulse, (h * pulse) / 2);
      ctx.fillStyle = hexToRgba(colors.text, 0.12);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + w - fullW, y, fullW, h, h / 2);
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case "mascot-capsule": {
      // Rounded capsule, purple → gold gradient fill, thick white outline, sparkles, mascot rider.
      const trackCol = opts.trackColor ?? hexToRgba(colors.text, 0.18);
      const outline = opts.outlineColor ?? "#ffffff";
      const fillW = Math.max(h, w * k);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fillStyle = trackCol;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.clip();
      const g = ctx.createLinearGradient(x, 0, x + fillW, 0);
      g.addColorStop(0, opts.fillColor ?? colors.primary);
      g.addColorStop(1, opts.fillColor ?? colors.accent);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, fillW, h);
      // sparkles
      for (let i = 0; i < 6; i++) {
        const sx = x + ((i * 53 + t * 30) % Math.max(1, fillW - h * 0.4)) + h * 0.2;
        const sy = y + h * (0.3 + 0.4 * rnd(i * 3.1));
        const sp = 0.5 + 0.5 * Math.sin(t * 4 + i);
        ctx.beginPath();
        ctx.arc(sx, sy, h * 0.06 * sp + h * 0.03, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(3, h * 0.16);
      ctx.stroke();
      // mascot rider on the fill head
      const headX = Math.min(x + w - h * 0.4, x + fillW);
      ctx.save();
      ctx.font = `${h * 1.7}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(headX, y - h * 0.05 + Math.sin(t * 5) * h * 0.06);
      ctx.fillText(opts.emoji ?? "🦖", 0, 0);
      ctx.restore();
      break;
    }
    case "chevron-mascot": {
      // Green chevron-pattern fill, glossy white outline, propeller emoji head.
      const trackCol = opts.trackColor ?? "#fff7cf";
      const outline = opts.outlineColor ?? "#ffffff";
      const fillW = Math.max(h, w * k);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fillStyle = trackCol;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.clip();
      const fillCol = opts.fillColor ?? "#22c55e";
      ctx.fillStyle = fillCol;
      ctx.fillRect(x, y, fillW, h);
      const step = h * 1.3;
      const off = (t * 55) % step;
      ctx.fillStyle = hexToRgba("#ffffff", 0.35);
      for (let sx = x - step + off; sx < x + fillW + step; sx += step) {
        ctx.beginPath();
        ctx.moveTo(sx, y + h * 0.15);
        ctx.lineTo(sx + h * 0.55, y + h / 2);
        ctx.lineTo(sx, y + h * 0.85);
        ctx.lineTo(sx + h * 0.25, y + h * 0.85);
        ctx.lineTo(sx + h * 0.8, y + h / 2);
        ctx.lineTo(sx + h * 0.25, y + h * 0.15);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(3, h * 0.14);
      ctx.stroke();
      const headX = Math.min(x + w - h * 0.4, x + fillW);
      ctx.save();
      ctx.translate(headX, y + h / 2);
      // spinning propeller behind the emoji
      ctx.save();
      ctx.rotate(t * 14);
      ctx.strokeStyle = "rgba(120,120,120,0.9)";
      ctx.lineWidth = Math.max(2, h * 0.08);
      ctx.beginPath();
      ctx.moveTo(-h * 0.55, -h * 0.7);
      ctx.lineTo(h * 0.55, -h * 0.7);
      ctx.stroke();
      ctx.restore();
      ctx.font = `${h * 1.5}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.emoji ?? "😲", 0, 0);
      ctx.restore();
      break;
    }
    case "diagonal-thinker": {
      // Green diagonal-stripe fill with a thinking-face emoji marker on the head.
      const trackCol = opts.trackColor ?? "#e5e7eb";
      const outline = opts.outlineColor ?? "#ffffff";
      const fillW = Math.max(h, w * k);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fillStyle = trackCol;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.clip();
      const fillCol = opts.fillColor ?? "#22c55e";
      ctx.fillStyle = fillCol;
      ctx.fillRect(x, y, fillW, h);
      const step = h * 0.9;
      const off = (t * 40) % (step * 2);
      ctx.strokeStyle = hexToRgba("#ffffff", 0.25);
      ctx.lineWidth = h * 0.32;
      for (let sx = x - h * 2 + off; sx < x + fillW + h * 2; sx += step * 2) {
        ctx.beginPath();
        ctx.moveTo(sx, y + h);
        ctx.lineTo(sx + h, y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(3, h * 0.14);
      ctx.stroke();
      const headX = Math.min(x + w - h * 0.4, x + fillW);
      ctx.save();
      ctx.font = `${h * 1.5}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(headX, y + h / 2);
      ctx.fillText(opts.emoji ?? "🤔", 0, 0);
      ctx.restore();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Small pickers
// ---------------------------------------------------------------------------

function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; name: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BackgroundPicker({
  value,
  onChange,
  intensity,
  onIntensityChange,
}: {
  value: BackgroundId;
  onChange: (v: BackgroundId) => void;
  intensity?: number;
  onIntensityChange?: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Picker label="Animated background" value={value} options={BACKGROUNDS} onChange={onChange} />
      {onIntensityChange && (
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Motion intensity · {(intensity ?? 1).toFixed(2)}x
          </Label>
          <Slider
            value={[intensity ?? 1]}
            min={0}
            max={2}
            step={0.05}
            onValueChange={([v]) => onIntensityChange(v)}
          />
        </div>
      )}
    </div>
  );
}

export function TimerStylePicker({
  value,
  onChange,
}: {
  value: TimerStyleId;
  onChange: (v: TimerStyleId) => void;
}) {
  return <Picker label="Timer style" value={value} options={TIMER_STYLES} onChange={onChange} />;
}

export function TimeBarStylePicker({
  value,
  onChange,
}: {
  value: TimeBarStyleId;
  onChange: (v: TimeBarStyleId) => void;
}) {
  return <Picker label="Time bar style" value={value} options={TIMEBAR_STYLES} onChange={onChange} />;
}

/** Collapsible-free grouped layout controls for a set of named elements. */
export function ElementStyleGroup({
  items,
  values,
  onChange,
}: {
  items: { key: string; label: string }[];
  values: Record<string, ElementStyleSpec>;
  onChange: (key: string, spec: ElementStyleSpec) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.key} className="rounded-lg border p-3">
          <div className="mb-2 text-xs font-medium">{it.label}</div>
          <ElementStyleControls
            value={values[it.key] ?? defaultStyle()}
            onChange={(s) => onChange(it.key, s)}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channel logo
// ---------------------------------------------------------------------------

export type ChannelLogoCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";

export type ChannelLogoShape = "square" | "rounded" | "circle";

export type ChannelLogoSpec = {
  visible: boolean;
  corner: ChannelLogoCorner;
  /** Extra horizontal offset in percent of canvas width. */
  dx: number;
  /** Extra vertical offset in percent of canvas height. */
  dy: number;
  scale: number;
  rotate: number;
  opacity: number;
  shape: ChannelLogoShape;
  ring: boolean;
  ringColor?: string;
  anim: ElementAnimSpec;
};

export function defaultChannelLogo(partial?: Partial<ChannelLogoSpec>): ChannelLogoSpec {
  return {
    visible: true,
    corner: "top-right",
    dx: 0,
    dy: 0,
    scale: 1,
    rotate: 0,
    opacity: 1,
    shape: "circle",
    ring: true,
    anim: defaultAnim({ preset: "pop", loop: "none" }),
    ...partial,
  };
}

export const CHANNEL_LOGO_CORNERS: { id: ChannelLogoCorner; name: string }[] = [
  { id: "top-left", name: "Top left" },
  { id: "top-center", name: "Top center" },
  { id: "top-right", name: "Top right" },
  { id: "bottom-left", name: "Bottom left" },
  { id: "bottom-center", name: "Bottom center" },
  { id: "bottom-right", name: "Bottom right" },
];

export const CHANNEL_LOGO_SHAPES: { id: ChannelLogoShape; name: string }[] = [
  { id: "square", name: "Square" },
  { id: "rounded", name: "Rounded square" },
  { id: "circle", name: "Circle" },
];

function channelLogoAnchor(corner: ChannelLogoCorner, w: number, h: number, size: number) {
  const pad = size * 0.9;
  switch (corner) {
    case "top-left":
      return { x: pad, y: pad };
    case "top-center":
      return { x: w / 2, y: pad };
    case "top-right":
      return { x: w - pad, y: pad };
    case "bottom-left":
      return { x: pad, y: h - pad };
    case "bottom-center":
      return { x: w / 2, y: h - pad };
    case "bottom-right":
    default:
      return { x: w - pad, y: h - pad };
  }
}

/** Draws a circular/rounded/square channel logo badge anchored to a corner. */
export function drawChannelLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null | undefined,
  spec: ChannelLogoSpec,
  w: number,
  h: number,
  tSinceStart = 0,
) {
  if (!spec.visible) return;
  const base = Math.min(w, h) * 0.11 * spec.scale;
  const { x: ax, y: ay } = channelLogoAnchor(spec.corner, w, h, base);
  const anim = computeAnim(spec.anim, tSinceStart);

  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, spec.opacity));
  applyAnim(ctx, anim, ax, ay);
  ctx.translate(ax + (spec.dx / 100) * w, ay + (spec.dy / 100) * h);
  ctx.rotate((spec.rotate * Math.PI) / 180);

  const size = base * 2;
  const r = spec.shape === "circle" ? size / 2 : spec.shape === "rounded" ? size * 0.22 : 0;

  ctx.save();
  ctx.beginPath();
  if (spec.shape === "circle") {
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  } else {
    ctx.roundRect(-size / 2, -size / 2, size, size, r);
  }
  ctx.closePath();
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = size * 0.18;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();
  ctx.restore();
  ctx.clip();
  if (img) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }
  ctx.restore();

  if (spec.ring) {
    ctx.beginPath();
    if (spec.shape === "circle") {
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    } else {
      ctx.roundRect(-size / 2, -size / 2, size, size, r);
    }
    ctx.strokeStyle = spec.ringColor ?? "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.stroke();
  }

  ctx.restore();
}

export function ChannelLogoControls({
  value,
  onChange,
}: {
  value: ChannelLogoSpec;
  onChange: (next: ChannelLogoSpec) => void;
}) {
  const set = (patch: Partial<ChannelLogoSpec>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Channel logo</Label>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onChange(defaultChannelLogo())}>
          <RotateCcw className="mr-1 h-3 w-3" /> Reset
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Picker label="Corner" value={value.corner} options={CHANNEL_LOGO_CORNERS} onChange={(v) => set({ corner: v })} />
        <Picker label="Shape" value={value.shape} options={CHANNEL_LOGO_SHAPES} onChange={(v) => set({ shape: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">X offset · {value.dx.toFixed(0)}%</Label>
        <Slider value={[value.dx]} min={-20} max={20} step={1} onValueChange={([v]) => set({ dx: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Y offset · {value.dy.toFixed(0)}%</Label>
        <Slider value={[value.dy]} min={-20} max={20} step={1} onValueChange={([v]) => set({ dy: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Scale · {value.scale.toFixed(2)}x</Label>
        <Slider value={[value.scale]} min={0.4} max={2} step={0.05} onValueChange={([v]) => set({ scale: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Rotation · {value.rotate.toFixed(0)}°</Label>
        <Slider value={[value.rotate]} min={-45} max={45} step={1} onValueChange={([v]) => set({ rotate: v })} />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Opacity · {Math.round(value.opacity * 100)}%</Label>
        <Slider value={[value.opacity]} min={0} max={1} step={0.05} onValueChange={([v]) => set({ opacity: v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Ring outline</Label>
        <Button
          variant={value.ring ? "default" : "outline"}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => set({ ring: !value.ring })}
        >
          {value.ring ? "On" : "Off"}
        </Button>
      </div>
      <div>
        <Label className="mb-1 block text-[11px] text-muted-foreground">Entrance / loop</Label>
        <AnimControls value={value.anim} onChange={(anim) => set({ anim })} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Round number badges
// ---------------------------------------------------------------------------

export type RoundBadgeId =
  | "pill"
  | "hexagon"
  | "ribbon"
  | "circle-stroke"
  | "tab"
  | "ticket-stub"
  | "banner"
  | "stamp"
  | "chevron"
  | "notebook-tab"
  | "neon-outline"
  | "block-3d"
  | "bubble"
  | "star-burst"
  | "arcade-counter"
  | "dot-matrix"
  | "underline-only"
  | "brush-stroke"
  | "shield"
  | "tape-strip"
  | "diamond"
  | "flag"
  | "sunburst"
  | "speech-bubble";

export const ROUND_BADGES: { id: RoundBadgeId; name: string }[] = [
  { id: "pill", name: "Pill" },
  { id: "hexagon", name: "Hexagon" },
  { id: "ribbon", name: "Ribbon" },
  { id: "circle-stroke", name: "Circle stroke" },
  { id: "tab", name: "Tab" },
  { id: "ticket-stub", name: "Ticket stub" },
  { id: "banner", name: "Banner" },
  { id: "stamp", name: "Stamp" },
  { id: "chevron", name: "Chevron" },
  { id: "notebook-tab", name: "Notebook tab" },
  { id: "neon-outline", name: "Neon outline" },
  { id: "block-3d", name: "3D block" },
  { id: "bubble", name: "Bubble" },
  { id: "star-burst", name: "Star burst" },
  { id: "arcade-counter", name: "Arcade counter" },
  { id: "dot-matrix", name: "Dot matrix" },
  { id: "underline-only", name: "Underline only" },
  { id: "brush-stroke", name: "Brush stroke" },
  { id: "shield", name: "Shield" },
  { id: "tape-strip", name: "Tape strip" },
  { id: "diamond", name: "Diamond" },
  { id: "flag", name: "Flag" },
  { id: "sunburst", name: "Sunburst" },
  { id: "speech-bubble", name: "Speech bubble" },
];

export type RoundBadgeColors = { primary: string; accent: string; text: string };

export type RoundBadgeOpts = { t?: number; rotate?: number };

/**
 * Draws a round-number badge (e.g. "Round 3") centred at (x, y). `size` sets
 * the overall scale — roughly the badge's half-height in px.
 */
export function drawRoundBadge(
  ctx: CanvasRenderingContext2D,
  id: RoundBadgeId,
  label: string,
  x: number,
  y: number,
  size: number,
  colors: RoundBadgeColors,
  opts: RoundBadgeOpts = {},
) {
  const t = opts.t ?? 0;
  ctx.save();
  ctx.translate(x, y);
  if (opts.rotate) ctx.rotate(opts.rotate);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const font = (px: number, weight = 800) => `${weight} ${px}px system-ui, sans-serif`;
  const textW = ctx.measureText(label).width;

  switch (id) {
    case "pill": {
      const w = Math.max(size * 3.2, textW + size * 1.6);
      const h = size * 1.5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.85);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "hexagon": {
      const w = Math.max(size * 3.4, textW + size * 1.8);
      const h = size * 1.5;
      ctx.beginPath();
      const cut = h * 0.4;
      ctx.moveTo(-w / 2 + cut, -h / 2);
      ctx.lineTo(w / 2 - cut, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w / 2 - cut, h / 2);
      ctx.lineTo(-w / 2 + cut, h / 2);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colors.accent, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.8);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "ribbon": {
      const w = Math.max(size * 3.6, textW + size * 2);
      const h = size * 1.3;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, -h / 2);
      ctx.lineTo(w / 2 - h * 0.35, 0);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.lineTo(-w / 2 + h * 0.35, 0);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.8);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "circle-stroke": {
      const r = size;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = size * 0.14;
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.9);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "tab": {
      const w = Math.max(size * 3.2, textW + size * 1.6);
      const h = size * 1.4;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, [0, 0, h * 0.5, h * 0.5]);
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.8);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "ticket-stub": {
      const w = Math.max(size * 3.6, textW + size * 2);
      const h = size * 1.4;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, size * 0.2);
      ctx.fillStyle = hexToRgba(colors.accent, 0.95);
      ctx.fill();
      ctx.save();
      ctx.setLineDash([size * 0.16, size * 0.14]);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w * 0.15, -h / 2);
      ctx.lineTo(-w * 0.15, h / 2);
      ctx.stroke();
      ctx.restore();
      for (const sx of [-w / 2, w / 2]) {
        ctx.beginPath();
        ctx.arc(sx, 0, size * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.001)";
        ctx.globalCompositeOperation = "destination-out";
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.75);
      ctx.fillText(label, w * 0.08, size * 0.04);
      break;
    }
    case "banner": {
      const w = Math.max(size * 3.8, textW + size * 2.2);
      const h = size * 1.3;
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(-w / 2 - h * 0.4, 0);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w / 2, -h / 2);
      ctx.lineTo(w / 2 + h * 0.4, 0);
      ctx.lineTo(w / 2, h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.78);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "stamp": {
      const r = size * 1.05;
      ctx.save();
      ctx.rotate(-0.06);
      ctx.beginPath();
      const teeth = 18;
      for (let i = 0; i < teeth; i++) {
        const a0 = (i / teeth) * Math.PI * 2;
        const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
        ctx.arc(0, 0, r, a0, a1);
        ctx.lineTo(Math.cos(a1) * r * 0.86, Math.sin(a1) * r * 0.86);
        const a2 = ((i + 1) / teeth) * Math.PI * 2;
        ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
      }
      ctx.closePath();
      ctx.fillStyle = "transparent";
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = size * 0.1;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.85);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "chevron": {
      const w = Math.max(size * 3.4, textW + size * 1.8);
      const h = size * 1.4;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2 - h * 0.4, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w / 2 - h * 0.4, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.lineTo(-w / 2 + h * 0.4, 0);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.75);
      ctx.fillText(label, -h * 0.1, size * 0.04);
      break;
    }
    case "notebook-tab": {
      const w = Math.max(size * 3, textW + size * 1.6);
      const h = size * 1.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, -h / 2);
      ctx.lineTo(w / 2, h / 2 - h * 0.2);
      ctx.lineTo(w / 2 - h * 0.2, h / 2);
      ctx.lineTo(-w / 2 + h * 0.2, h / 2);
      ctx.lineTo(-w / 2, h / 2 - h * 0.2);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colors.accent, 0.95);
      ctx.fill();
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * (w / 3.2), -h / 2, size * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();
      }
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.75);
      ctx.fillText(label, 0, size * 0.1);
      break;
    }
    case "neon-outline": {
      const w = Math.max(size * 3.2, textW + size * 1.6);
      const h = size * 1.5;
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = size * 0.6;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = size * 0.12;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.82);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "block-3d": {
      const w = Math.max(size * 3.2, textW + size * 1.6);
      const h = size * 1.5;
      const depth = size * 0.22;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + depth, -h / 2 + depth, w, h, h * 0.2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.2);
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.85);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "bubble": {
      const r = size * 1.05;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.35, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.85);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "star-burst": {
      const spikes = 10;
      const rOuter = size * 1.25;
      const rInner = size * 0.85;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? rOuter : rInner;
        const a = (i / (spikes * 2)) * Math.PI * 2 + t * 0.15;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colors.accent, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.8);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "arcade-counter": {
      const w = Math.max(size * 3, textW + size * 1.4);
      const h = size * 1.5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, size * 0.16);
      ctx.fillStyle = "rgba(10,10,14,0.95)";
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = size * 0.1;
      ctx.stroke();
      ctx.fillStyle = colors.accent;
      ctx.font = `700 ${size * 0.8}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "dot-matrix": {
      const w = Math.max(size * 3.4, textW + size * 1.8);
      const h = size * 1.5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, size * 0.2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();
      const cols = 18;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < 4; j++) {
          const px = -w / 2 + (i + 0.5) * (w / cols);
          const py = -h / 2 + (j + 0.5) * (h / 4);
          ctx.beginPath();
          ctx.arc(px, py, size * 0.03, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(colors.accent, 0.25);
          ctx.fill();
        }
      }
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.78);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "underline-only": {
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 1.1);
      ctx.fillText(label, 0, 0);
      ctx.beginPath();
      ctx.roundRect(-textW / 2 - size * 0.2, size * 0.55, textW + size * 0.4, size * 0.16, size * 0.08);
      ctx.fillStyle = colors.accent;
      ctx.fill();
      break;
    }
    case "brush-stroke": {
      const w = Math.max(size * 3.4, textW + size * 1.8);
      const h = size * 1.4;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h * 0.3);
      ctx.quadraticCurveTo(-w * 0.2, -h * 0.65, w / 2, -h * 0.35);
      ctx.quadraticCurveTo(w * 0.55, 0, w / 2, h * 0.35);
      ctx.quadraticCurveTo(0, h * 0.65, -w / 2, h * 0.3);
      ctx.quadraticCurveTo(-w * 0.58, 0, -w / 2, -h * 0.3);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colors.primary, 0.92);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.8);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "shield": {
      const s = size * 1.1;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.15);
      ctx.lineTo(s * 0.9, -s * 0.55);
      ctx.lineTo(s * 0.7, s * 0.9);
      ctx.lineTo(0, s * 1.3);
      ctx.lineTo(-s * 0.7, s * 0.9);
      ctx.lineTo(-s * 0.9, -s * 0.55);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = size * 0.1;
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.75);
      ctx.fillText(label, 0, size * 0.06);
      break;
    }
    case "tape-strip": {
      const w = Math.max(size * 3.4, textW + size * 1.8);
      const h = size * 1.1;
      ctx.save();
      ctx.rotate(-0.05);
      ctx.fillStyle = hexToRgba(colors.accent, 0.85);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.75);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "diamond": {
      const s = size * 1.3;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.7);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "flag": {
      const w = Math.max(size * 3, textW + size * 1.6);
      const h = size * 1.4;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, -h / 2);
      ctx.lineTo(w / 2 - h * 0.3, 0);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colors.accent, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.75);
      ctx.fillText(label, -h * 0.1, size * 0.04);
      break;
    }
    case "sunburst": {
      const rays = 16;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + t * 0.1;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = hexToRgba(colors.accent, 0.5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size * 0.1, -size * 1.6);
        ctx.lineTo(size * 0.1, -size * 1.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.8);
      ctx.fillText(label, 0, size * 0.04);
      break;
    }
    case "speech-bubble": {
      const w = Math.max(size * 3.2, textW + size * 1.6);
      const h = size * 1.5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.4);
      ctx.moveTo(-w * 0.1, h / 2);
      ctx.lineTo(-w * 0.02, h / 2 + size * 0.35);
      ctx.lineTo(w * 0.12, h / 2);
      ctx.fillStyle = hexToRgba(colors.primary, 0.95);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = font(size * 0.8);
      ctx.fillText(label, 0, size * 0.02);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function RoundBadgePicker({
  value,
  onChange,
}: {
  value: RoundBadgeId;
  onChange: (v: RoundBadgeId) => void;
}) {
  return <Picker label="Round badge style" value={value} options={ROUND_BADGES} onChange={onChange} />;
}

// ---------------------------------------------------------------------------
// Round transitions
// ---------------------------------------------------------------------------

export type RoundTransitionId =
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "wipe-tl"
  | "wipe-tr"
  | "wipe-bl"
  | "wipe-br"
  | "bars-horizontal"
  | "bars-vertical"
  | "blinds-horizontal"
  | "blinds-vertical"
  | "circle-expand"
  | "iris"
  | "diamond-expand"
  | "shatter"
  | "pixelate"
  | "brush-strokes"
  | "paint-splat"
  | "ink-drop"
  | "curtains"
  | "zoom-blur-flash"
  | "colour-flash"
  | "checkerboard"
  | "spiral"
  | "clock-wipe"
  | "ripple"
  | "page-turn"
  | "film-burn"
  | "zigzag"
  | "star-wipe"
  | "confetti-burst"
  | "slide-push-left"
  | "slide-push-right"
  | "slide-push-up"
  | "slide-push-down"
  | "cross-fade"
  | "split-horizontal"
  | "split-vertical"
  | "heart-wipe"
  | "triangle-wipe"
  | "hex-wipe"
  | "vortex"
  | "confetti-fade"
  | "double-wipe"
  | "venetian"
  | "ripple-rings"
  | "shockwave"
  | "glitch"
  | "sparkle-burst"
  | "rain-wipe"
  | "petal-wipe"
  | "kaleidoscope";

export const ROUND_TRANSITIONS: { id: RoundTransitionId; name: string }[] = [
  { id: "wipe-left", name: "Wipe left" },
  { id: "wipe-right", name: "Wipe right" },
  { id: "wipe-up", name: "Wipe up" },
  { id: "wipe-down", name: "Wipe down" },
  { id: "wipe-tl", name: "Wipe diagonal (TL)" },
  { id: "wipe-tr", name: "Wipe diagonal (TR)" },
  { id: "wipe-bl", name: "Wipe diagonal (BL)" },
  { id: "wipe-br", name: "Wipe diagonal (BR)" },
  { id: "bars-horizontal", name: "Bars (horizontal)" },
  { id: "bars-vertical", name: "Bars (vertical)" },
  { id: "blinds-horizontal", name: "Blinds (horizontal)" },
  { id: "blinds-vertical", name: "Blinds (vertical)" },
  { id: "circle-expand", name: "Circle expand" },
  { id: "iris", name: "Iris" },
  { id: "diamond-expand", name: "Diamond expand" },
  { id: "shatter", name: "Shatter" },
  { id: "pixelate", name: "Pixelate" },
  { id: "brush-strokes", name: "Brush strokes" },
  { id: "paint-splat", name: "Paint splat" },
  { id: "ink-drop", name: "Ink drop" },
  { id: "curtains", name: "Curtains" },
  { id: "zoom-blur-flash", name: "Zoom blur flash" },
  { id: "colour-flash", name: "Colour flash" },
  { id: "checkerboard", name: "Checkerboard" },
  { id: "spiral", name: "Spiral" },
  { id: "clock-wipe", name: "Clock wipe" },
  { id: "ripple", name: "Ripple" },
  { id: "page-turn", name: "Page turn" },
  { id: "film-burn", name: "Film burn" },
  { id: "zigzag", name: "Zigzag" },
  { id: "star-wipe", name: "Star wipe" },
  { id: "confetti-burst", name: "Confetti burst" },
  { id: "slide-push-left", name: "Slide push left" },
  { id: "slide-push-right", name: "Slide push right" },
  { id: "slide-push-up", name: "Slide push up" },
  { id: "slide-push-down", name: "Slide push down" },
  { id: "cross-fade", name: "Cross fade" },
  { id: "split-horizontal", name: "Split (horizontal)" },
  { id: "split-vertical", name: "Split (vertical)" },
  { id: "heart-wipe", name: "Heart wipe" },
  { id: "triangle-wipe", name: "Triangle wipe" },
  { id: "hex-wipe", name: "Hex wipe" },
  { id: "vortex", name: "Vortex" },
  { id: "confetti-fade", name: "Confetti fade" },
  { id: "double-wipe", name: "Double wipe" },
  { id: "venetian", name: "Venetian blinds" },
  { id: "ripple-rings", name: "Ripple rings" },
  { id: "shockwave", name: "Shockwave" },
  { id: "glitch", name: "Glitch" },
  { id: "sparkle-burst", name: "Sparkle burst" },
  { id: "rain-wipe", name: "Rain wipe" },
  { id: "petal-wipe", name: "Petal wipe" },
  { id: "kaleidoscope", name: "Kaleidoscope" },
];

export type RoundTransitionSpec = {
  id: RoundTransitionId;
  /** Total transition duration in seconds (cover + uncover). */
  duration: number;
  color: string;
  easing: EasingId;
};

export function defaultRoundTransition(partial?: Partial<RoundTransitionSpec>): RoundTransitionSpec {
  return { id: "wipe-left", duration: 0.8, color: "#7c3aed", easing: "ease-in-out", ...partial };
}

/**
 * Returns 0..1 "coverage" of the frame at a given progress (0..1 across the
 * whole transition). Coverage rises to 1 at the midpoint then falls back to 0
 * — callers should swap round content once coverage crosses ~0.5 upward and
 * stays swapped until it falls back through 0.5.
 */
export function roundTransitionCoverage(spec: RoundTransitionSpec, progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  // Triangular envelope: ramps up over first half, back down over second half.
  return p < 0.5 ? p * 2 : (1 - p) * 2;
}

/**
 * Paints the transition overlay for the given progress (0..1 across the whole
 * transition, symmetric cover/uncover). Deterministic given (spec, progress).
 */
export function drawRoundTransition(
  ctx: CanvasRenderingContext2D,
  spec: RoundTransitionSpec,
  progress: number,
  w: number,
  h: number,
) {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0 || p >= 1) return;
  const ease = EASING_FNS[spec.easing] ?? EASING_FNS["ease-in-out"];
  const cov = roundTransitionCoverage(spec, p);
  const k = Math.max(0, Math.min(1, ease(cov))); // 0..1..0 shaped coverage, eased
  if (k <= 0) return;
  const col = spec.color;
  const diag = Math.hypot(w, h);

  ctx.save();

  const fillAll = () => {
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, w, h);
  };

  switch (spec.id) {
    case "wipe-left":
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, w * k, h);
      break;
    case "wipe-right":
      ctx.fillStyle = col;
      ctx.fillRect(w - w * k, 0, w * k, h);
      break;
    case "wipe-up":
      ctx.fillStyle = col;
      ctx.fillRect(0, h - h * k, w, h * k);
      break;
    case "wipe-down":
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, w, h * k);
      break;
    case "wipe-tl":
    case "wipe-tr":
    case "wipe-bl":
    case "wipe-br": {
      ctx.save();
      const cx = spec.id.includes("l") && !spec.id.includes("r") ? 0 : w;
      const cx2 = spec.id === "wipe-tl" || spec.id === "wipe-bl" ? 0 : w;
      const cy = spec.id === "wipe-tl" || spec.id === "wipe-tr" ? 0 : h;
      ctx.beginPath();
      ctx.arc(cx2, cy, diag * k, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "bars-horizontal": {
      const n = 6;
      const bh = h / n;
      for (let i = 0; i < n; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const bw = w * k;
        ctx.fillStyle = col;
        ctx.fillRect(dir > 0 ? 0 : w - bw, i * bh, bw, bh);
      }
      break;
    }
    case "bars-vertical": {
      const n = 8;
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const bh = h * k;
        ctx.fillStyle = col;
        ctx.fillRect(i * bw, dir > 0 ? 0 : h - bh, bw, bh);
      }
      break;
    }
    case "blinds-horizontal":
    case "venetian": {
      const n = 10;
      const bh = h / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = col;
        ctx.fillRect(0, i * bh, w, bh * k);
      }
      break;
    }
    case "blinds-vertical": {
      const n = 12;
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = col;
        ctx.fillRect(i * bw, 0, bw * k, h);
      }
      break;
    }
    case "circle-expand":
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, diag * 0.6 * k, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      break;
    case "iris": {
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(w / 2, h / 2, diag * 0.55 * (1 - k), 0, Math.PI * 2, true);
      ctx.fillStyle = col;
      ctx.fill("evenodd");
      break;
    }
    case "diamond-expand": {
      const s = diag * 0.7 * k;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = col;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      break;
    }
    case "shatter": {
      const cols = 8;
      const rows = 5;
      const cw = w / cols;
      const ch = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seed = r * cols + c;
          const delay = rnd(seed) * 0.4;
          const local = Math.max(0, Math.min(1, (k - delay) / (1 - delay)));
          if (local <= 0) continue;
          const cx = c * cw + cw / 2;
          const cy = r * ch + ch / 2;
          ctx.save();
          ctx.globalAlpha = local;
          ctx.translate(cx, cy);
          ctx.scale(local, local);
          ctx.fillStyle = col;
          ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
          ctx.restore();
        }
      }
      break;
    }
    case "pixelate": {
      const maxCell = 64;
      const cell = Math.max(4, maxCell * (k < 0.5 ? k * 2 : (1 - k) * 2) + 4);
      ctx.globalAlpha = k;
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          const shade = rnd((x * 7 + y * 13) * 0.01) * 0.3;
          ctx.fillStyle = col;
          ctx.globalAlpha = k * (0.7 + shade);
          ctx.fillRect(x, y, cell, cell);
        }
      }
      break;
    }
    case "brush-strokes": {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const y0 = (i / n) * h;
        const delay = i * 0.05;
        const local = Math.max(0, Math.min(1, (k - delay) / (1 - delay)));
        ctx.fillStyle = col;
        ctx.fillRect(0, y0, w * local, h / n + 2);
      }
      break;
    }
    case "paint-splat": {
      const cx = w / 2;
      const cy = h / 2;
      const blobs = 14;
      ctx.fillStyle = col;
      for (let i = 0; i < blobs; i++) {
        const a = (i / blobs) * Math.PI * 2;
        const dist = diag * 0.6 * k * (0.5 + rnd(i) * 0.6);
        const r = diag * 0.14 * k * (0.5 + rnd(i * 3) * 0.8) + 4;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, diag * 0.3 * k, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "ink-drop": {
      const cx = w / 2;
      const cy = h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, diag * 0.62 * k, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const len = diag * 0.62 * k * (0.9 + rnd(i) * 0.4);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * len, cy + Math.sin(a) * len, diag * 0.02, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "curtains": {
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, (w / 2) * k, h);
      ctx.fillRect(w - (w / 2) * k, 0, (w / 2) * k, h);
      break;
    }
    case "zoom-blur-flash": {
      ctx.globalAlpha = k;
      const rg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, diag * 0.7);
      rg.addColorStop(0, col);
      rg.addColorStop(1, hexToRgba(col, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = k * 0.6;
      fillAll();
      break;
    }
    case "colour-flash":
      ctx.globalAlpha = k;
      fillAll();
      break;
    case "checkerboard": {
      const cols = 10;
      const rows = 6;
      const cw = w / cols;
      const ch = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seed = (r + c) / (rows + cols);
          const delay = seed * 0.5;
          const local = Math.max(0, Math.min(1, (k - delay) / (1 - delay)));
          if (local <= 0) continue;
          ctx.globalAlpha = local;
          ctx.fillStyle = col;
          ctx.fillRect(c * cw, r * ch, cw + 1, ch + 1);
        }
      }
      break;
    }
    case "spiral": {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(k * Math.PI * 3);
      ctx.beginPath();
      ctx.arc(0, 0, diag * 0.6 * k, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "clock-wipe": {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, diag, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "ripple":
    case "ripple-rings": {
      ctx.globalCompositeOperation = "source-over";
      const rings = 5;
      for (let i = 0; i < rings; i++) {
        const rp = Math.max(0, Math.min(1, k * 1.4 - i * 0.1));
        if (rp <= 0) continue;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, diag * 0.6 * rp, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = diag * 0.05 * (1 - rp) + 4;
        ctx.stroke();
      }
      if (k > 0.5) {
        ctx.globalAlpha = (k - 0.5) * 2;
        fillAll();
      }
      break;
    }
    case "page-turn": {
      const shear = (1 - k) * w * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * k, 0);
      ctx.lineTo(w * k - shear * 0.2, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "film-burn": {
      ctx.globalAlpha = k;
      const rg = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, diag * 0.7 * (0.3 + k));
      rg.addColorStop(0, "#fff7e0");
      rg.addColorStop(0.4, col);
      rg.addColorStop(1, hexToRgba(col, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "zigzag": {
      const step = h / 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let y = 0, row = 0; y <= h; y += step, row++) {
        const x = w * k + (row % 2 === 0 ? -1 : 1) * step * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case "star-wipe": {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const spikes = 8;
      const rOuter = diag * 0.75 * k;
      const rInner = rOuter * 0.5;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? rOuter : rInner;
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "confetti-burst":
    case "confetti-fade": {
      ctx.globalAlpha = k;
      fillAll();
      ctx.globalAlpha = 1;
      const n = 60;
      for (let i = 0; i < n; i++) {
        const a = rnd(i) * Math.PI * 2;
        const dist = diag * 0.7 * k * (0.3 + rnd(i * 2) * 0.7);
        const x = w / 2 + Math.cos(a) * dist;
        const y = h / 2 + Math.sin(a) * dist;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a * 3);
        ctx.fillStyle = i % 2 ? "#fff" : hexToRgba(col, 0.7);
        ctx.fillRect(-5, -9, 10, 18);
        ctx.restore();
      }
      break;
    }
    case "slide-push-left":
      ctx.fillStyle = col;
      ctx.fillRect(w - w * k, 0, w * k, h);
      break;
    case "slide-push-right":
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, w * k, h);
      break;
    case "slide-push-up":
      ctx.fillStyle = col;
      ctx.fillRect(0, h - h * k, w, h * k);
      break;
    case "slide-push-down":
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, w, h * k);
      break;
    case "cross-fade":
      ctx.globalAlpha = k;
      fillAll();
      break;
    case "split-horizontal":
      ctx.fillStyle = col;
      ctx.fillRect(0, h / 2 - (h / 2) * k, w, h * k);
      break;
    case "split-vertical":
      ctx.fillStyle = col;
      ctx.fillRect(w / 2 - (w / 2) * k, 0, w * k, h);
      break;
    case "heart-wipe": {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const s = diag * 0.045 * k;
      ctx.beginPath();
      ctx.moveTo(0, s * 3);
      ctx.bezierCurveTo(-s * 5, -s, -s * 2, -s * 5, 0, -s * 1.5);
      ctx.bezierCurveTo(s * 2, -s * 5, s * 5, -s, 0, s * 3);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "triangle-wipe": {
      const s = diag * 0.9 * k;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.6);
      ctx.lineTo(s * 0.55, s * 0.4);
      ctx.lineTo(-s * 0.55, s * 0.4);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "hex-wipe": {
      const r = diag * 0.55 * k;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      break;
    }
    case "vortex": {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const arms = 6;
      for (let i = 0; i < arms; i++) {
        ctx.save();
        ctx.rotate((i / arms) * Math.PI * 2 + k * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, diag * 0.7 * k, 0, Math.PI / arms);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      break;
    }
    case "double-wipe": {
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, (w / 2) * k, h);
      ctx.fillRect(w, 0, -(w / 2) * k, h);
      break;
    }
    case "shockwave": {
      const rp = k;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, diag * 0.65 * rp, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = diag * 0.08 * (1 - rp) + 6;
      ctx.stroke();
      if (rp > 0.6) {
        ctx.globalAlpha = (rp - 0.6) / 0.4;
        fillAll();
      }
      break;
    }
    case "glitch": {
      const rows = 16;
      const rh = h / rows;
      for (let i = 0; i < rows; i++) {
        const off = (rnd(i * 3.1 + Math.floor(p * 20)) - 0.5) * w * (1 - k) * 0.4;
        ctx.globalAlpha = k;
        ctx.fillStyle = col;
        ctx.fillRect(off, i * rh, w, rh);
      }
      break;
    }
    case "sparkle-burst": {
      ctx.globalAlpha = k;
      fillAll();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 30; i++) {
        const a = rnd(i * 5) * Math.PI * 2;
        const dist = diag * 0.5 * k;
        const x = w / 2 + Math.cos(a) * dist;
        const y = h / 2 + Math.sin(a) * dist;
        ctx.beginPath();
        ctx.arc(x, y, 3 + rnd(i) * 5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
      break;
    }
    case "rain-wipe": {
      const cols = 24;
      const cw = w / cols;
      for (let i = 0; i < cols; i++) {
        const delay = rnd(i) * 0.3;
        const local = Math.max(0, Math.min(1, (k - delay) / (1 - delay)));
        ctx.fillStyle = col;
        ctx.fillRect(i * cw, 0, cw + 1, h * local);
      }
      break;
    }
    case "petal-wipe": {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const petals = 6;
      for (let i = 0; i < petals; i++) {
        ctx.save();
        ctx.rotate((i / petals) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -diag * 0.3 * k, diag * 0.16 * k, diag * 0.32 * k, 0, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      break;
    }
    case "kaleidoscope": {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const segs = 8;
      for (let i = 0; i < segs; i++) {
        ctx.save();
        ctx.rotate((i / segs) * Math.PI * 2 + k * 1.2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, diag * 0.7 * k, 0, Math.PI / segs);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(col, 0.85);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      break;
    }
    default:
      ctx.globalAlpha = k;
      fillAll();
      break;
  }

  ctx.restore();
}

export function RoundTransitionControls({
  value,
  onChange,
}: {
  value: RoundTransitionSpec;
  onChange: (next: RoundTransitionSpec) => void;
}) {
  const set = (patch: Partial<RoundTransitionSpec>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2">
      <Picker label="Transition" value={value.id} options={ROUND_TRANSITIONS} onChange={(v) => set({ id: v })} />
      <div>
        <Label className="text-[11px] text-muted-foreground">Duration · {value.duration.toFixed(2)}s</Label>
        <Slider value={[value.duration]} min={0.2} max={2} step={0.05} onValueChange={([v]) => set({ duration: v })} />
      </div>
      <Picker label="Easing" value={value.easing} options={EASINGS} onChange={(v) => set({ easing: v })} />
      <div className="flex items-center gap-2">
        <Label className="text-[11px] text-muted-foreground">Colour</Label>
        <input
          type="color"
          value={value.color}
          onChange={(e) => set({ color: e.target.value })}
          className="h-8 w-14 cursor-pointer rounded border bg-transparent"
        />
      </div>
    </div>
  );
}
