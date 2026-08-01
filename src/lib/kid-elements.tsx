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
  | "solid";

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
  { id: "none", name: "Hidden" },
];

/** Draws a horizontal progress/time bar. `p` is 1 → 0 remaining fraction. */
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
) {
  if (id === "none") return;
  const k = Math.max(0, Math.min(1, p));
  const col = k < 0.25 ? colors.accent : colors.primary;
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
