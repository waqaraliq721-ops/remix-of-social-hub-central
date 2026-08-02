// Shared transition table (20+) used between adjacent/overlapping clips.
// Each transition paints an overlay on top of the current frame; `amt` is
// the remaining strength of the effect (1 = fully covered, 0 = settled) and
// `direction` tells whether we are transitioning in (into the clip) or out.
import type { EasingKind } from "@/lib/doc-hq-types";
import { ease } from "@/lib/video-fx";

export type TransitionDef = { id: string; name: string };

export const TRANSITIONS: TransitionDef[] = [
  { id: "cut", name: "Cut" },
  { id: "cross-fade", name: "Cross-fade" },
  { id: "dip-color", name: "Dip to colour" },
  { id: "slide-l", name: "Slide left" },
  { id: "slide-r", name: "Slide right" },
  { id: "slide-u", name: "Slide up" },
  { id: "slide-d", name: "Slide down" },
  { id: "push-l", name: "Push left" },
  { id: "push-r", name: "Push right" },
  { id: "wipe-l", name: "Wipe left→right" },
  { id: "wipe-r", name: "Wipe right→left" },
  { id: "wipe-radial", name: "Radial wipe" },
  { id: "iris", name: "Iris" },
  { id: "clock-wipe", name: "Clock wipe" },
  { id: "blinds", name: "Blinds" },
  { id: "whip-pan", name: "Whip pan" },
  { id: "blur-dissolve", name: "Blur dissolve" },
  { id: "zoom-blur", name: "Zoom blur" },
  { id: "glitch", name: "Glitch" },
  { id: "film-burn", name: "Film burn" },
  { id: "ink-splat", name: "Ink splat" },
  { id: "curtain", name: "Curtain" },
  { id: "doorway", name: "Doorway open" },
];

export function drawTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: string,
  progress: number, // 0..1, 1 = fully settled into the clip
  direction: "in" | "out",
  easing: EasingKind,
  color: string,
) {
  const p = ease[easing](Math.max(0, Math.min(1, progress)));
  const amt = direction === "in" ? 1 - p : p; // remaining effect strength
  if (amt <= 0.001 || kind === "cut") return;
  ctx.save();
  switch (kind) {
    case "cross-fade":
    case "dip-color":
      ctx.fillStyle = color;
      ctx.globalAlpha = kind === "dip-color" ? Math.min(1, amt * 1.3) : amt;
      ctx.fillRect(0, 0, w, h);
      break;
    case "slide-l":
    case "push-l": {
      ctx.fillStyle = color;
      ctx.fillRect(direction === "in" ? -w * (1 - amt) : w * (1 - amt), 0, w, h);
      break;
    }
    case "slide-r":
    case "push-r": {
      ctx.fillStyle = color;
      ctx.fillRect(direction === "in" ? w * (1 - amt) : -w * (1 - amt), 0, w, h);
      break;
    }
    case "slide-u":
      ctx.fillStyle = color;
      ctx.fillRect(0, direction === "in" ? -h * (1 - amt) : h * (1 - amt), w, h);
      break;
    case "slide-d":
      ctx.fillStyle = color;
      ctx.fillRect(0, direction === "in" ? h * (1 - amt) : -h * (1 - amt), w, h);
      break;
    case "wipe-l":
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w * amt, h);
      break;
    case "wipe-r":
      ctx.fillStyle = color;
      ctx.fillRect(w * (1 - amt), 0, w * amt, h);
      break;
    case "wipe-radial":
    case "iris": {
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(w / 2, h / 2, Math.max(w, h) * amt * 0.75, 0, Math.PI * 2, true);
      ctx.fillStyle = color;
      ctx.fill("evenodd");
      break;
    }
    case "clock-wipe": {
      ctx.translate(w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, Math.max(w, h), -Math.PI / 2, -Math.PI / 2 + amt * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      break;
    }
    case "blinds": {
      ctx.fillStyle = color;
      const n = 10;
      const bw = w / n;
      for (let i = 0; i < n; i++) ctx.fillRect(i * bw, 0, bw * amt, h);
      break;
    }
    case "whip-pan":
      ctx.fillStyle = color;
      ctx.globalAlpha = amt * 0.6;
      ctx.fillRect(0, 0, w, h);
      break;
    case "blur-dissolve":
    case "zoom-blur":
      ctx.fillStyle = color;
      ctx.globalAlpha = amt * 0.75;
      ctx.fillRect(0, 0, w, h);
      break;
    case "glitch": {
      ctx.fillStyle = color;
      ctx.globalAlpha = amt * 0.5;
      for (let i = 0; i < 6; i++) {
        const y = (i / 6) * h;
        ctx.fillRect((Math.random() - 0.5) * 60 * amt, y, w, h / 6);
      }
      break;
    }
    case "film-burn": {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, `rgba(255,200,120,${amt})`);
      g.addColorStop(1, `rgba(20,5,0,${amt})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "ink-splat": {
      ctx.fillStyle = color;
      ctx.globalAlpha = amt;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.max(w, h) * (1 - amt) * 0.9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "curtain": {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, (w / 2) * amt, h);
      ctx.fillRect(w - (w / 2) * amt, 0, (w / 2) * amt, h);
      break;
    }
    case "doorway": {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, (w / 2) * amt, h);
      ctx.fillRect(w - (w / 2) * amt, 0, (w / 2) * amt, h);
      break;
    }
    default:
      ctx.fillStyle = color;
      ctx.globalAlpha = amt;
      ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
