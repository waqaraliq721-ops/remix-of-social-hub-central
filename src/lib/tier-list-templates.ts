// Templates for the Tier List Videos studio — 6 animated background styles
// covering both 9:16 and 16:9 aspects.
import type { PaletteLike } from "@/components/color-customiser";

export type TierTemplateId =
  | "classic"
  | "neon"
  | "minimal"
  | "sports"
  | "glass"
  | "retro";

export type TierTemplate = {
  id: TierTemplateId;
  name: string;
  desc: string;
};

export const TIER_TEMPLATES: TierTemplate[] = [
  { id: "classic", name: "Classic Grid", desc: "Clean bright rows on a soft gradient — the familiar tier-list look." },
  { id: "neon", name: "Neon Arcade", desc: "Glowing neon rows with scanlines and pulsing highlights." },
  { id: "minimal", name: "Minimal Studio", desc: "Flat, quiet background so the items and labels stand out." },
  { id: "sports", name: "Bold Sports", desc: "Diagonal energy stripes and a bold, punchy palette." },
  { id: "glass", name: "Glass Dark", desc: "Frosted glass panels floating over a dark blurred backdrop." },
  { id: "retro", name: "Retro Poster", desc: "Halftone dots and warm sunset tones for a vintage poster feel." },
];

export type TierPalette = PaletteLike & { id: string; name: string };

export const TIER_PALETTES: TierPalette[] = [
  { id: "sunset", name: "Sunset Pop", bg: ["#1a0b12", "#4a1530"], primary: "#fb7185", accent: "#fbbf24", text: "#ffffff", muted: "#f5c9d6" },
  { id: "arcade", name: "Arcade Violet", bg: ["#07030f", "#25073f"], primary: "#a855f7", accent: "#22d3ee", text: "#ffffff", muted: "#cbb2f0" },
  { id: "studio", name: "Studio Grey", bg: ["#0c0d10", "#1c1e24"], primary: "#e5e7eb", accent: "#38bdf8", text: "#ffffff", muted: "#a1a1aa" },
  { id: "sports", name: "Championship Red", bg: ["#0d0303", "#3a0a0a"], primary: "#ef4444", accent: "#facc15", text: "#ffffff", muted: "#eab8b8" },
  { id: "glass", name: "Midnight Glass", bg: ["#020617", "#0f1e3d"], primary: "#60a5fa", accent: "#c4b5fd", text: "#f8fafc", muted: "#93a3c1" },
  { id: "retro", name: "Retro Sunset", bg: ["#1c0a02", "#4a230a"], primary: "#f97316", accent: "#fde047", text: "#fff7ed", muted: "#f0c99a" },
];

export type ItemTransitionId = "fly" | "slide" | "pop" | "fade" | "flip";
export const ITEM_TRANSITIONS: { id: ItemTransitionId; name: string }[] = [
  { id: "fly", name: "Fly in from tray" },
  { id: "slide", name: "Slide from edge" },
  { id: "pop", name: "Pop / scale in" },
  { id: "fade", name: "Simple fade" },
  { id: "flip", name: "Flip in" },
];

export const DEFAULT_TIER_COLORS: Record<string, string> = {
  S: "#f87171",
  A: "#fb923c",
  B: "#facc15",
  C: "#4ade80",
  D: "#60a5fa",
  F: "#a78bfa",
};
