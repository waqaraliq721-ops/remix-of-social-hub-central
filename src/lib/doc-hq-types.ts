// Shared types for the Documentary HQ multi-track timeline editor.

export const STAGE_W = 1920;
export const STAGE_H = 1080;

export type EasingKind = "linear" | "in" | "out" | "inOut" | "back" | "elastic";

export type FitMode = "cover" | "contain" | "fill";

export type ClipKind = "image" | "video" | "graphic" | "text" | "audio";

export type TrackKind = "visual" | "audio";

export type GradePreset = "none" | "cinematic" | "warm" | "cold" | "noir" | "sepia" | "teal-orange" | "bleach";

export type TextStyleKind = "title" | "subtitle" | "lower-third" | "caption";

export type GraphicShape = "rect" | "circle" | "triangle" | "star" | "line" | "hexagon" | "arrow" | "ring";

export type TransitionSettings = {
  kind: string;
  duration: number; // seconds
  color: string;
  easing: EasingKind;
};

export type ClipEffects = {
  grade: GradePreset;
  exposure: number;
  contrast: number;
  saturation: number;
  grain: number; // 0..1
  vignette: number; // 0..1
  blur: number; // px
  glow: number; // 0..1
  chroma: number; // 0..1 chromatic aberration amount
  letterbox: boolean;
};

export const DEFAULT_EFFECTS: ClipEffects = {
  grade: "none",
  exposure: 0,
  contrast: 0,
  saturation: 0,
  grain: 0,
  vignette: 0,
  blur: 0,
  glow: 0,
  chroma: 0,
  letterbox: false,
};

export type ClipTransform = {
  x: number; // 0..100 %
  y: number; // 0..100 %
  scale: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  fit: FitMode;
};

export const DEFAULT_TRANSFORM: ClipTransform = {
  x: 50,
  y: 50,
  scale: 1,
  rotation: 0,
  opacity: 1,
  fit: "cover",
};

export type MediaItem = {
  id: string;
  kind: "image" | "video" | "audio";
  url: string;
  name: string;
  el: HTMLImageElement | HTMLVideoElement | HTMLAudioElement;
  w: number;
  h: number;
  duration: number;
};

export type TextLayerData = {
  content: string;
  styleKind: TextStyleKind;
  fontSize: number;
  color: string;
};

export type GraphicData = {
  shape: GraphicShape;
  color: string;
  strokeColor: string;
  filled: boolean;
};

export type Clip = {
  id: string;
  trackId: string;
  kind: ClipKind;
  start: number; // seconds on the timeline
  duration: number; // seconds
  mediaId: string | null;
  text: TextLayerData | null;
  graphic: GraphicData | null;
  transform: ClipTransform;
  animation: string; // animation id from ANIMATIONS table
  transitionIn: TransitionSettings;
  transitionOut: TransitionSettings;
  effects: ClipEffects;
  volume: number; // for video/audio clips
  muted: boolean;
};

export type Track = {
  id: string;
  name: string;
  kind: TrackKind;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
  clips: Clip[];
};

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.floor((s * 1000) % 1000);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(Math.floor(ms / 100))}`;
}

export function newTransition(): TransitionSettings {
  return { kind: "cross-fade", duration: 0.6, color: "#000000", easing: "inOut" };
}

export function newClip(kind: ClipKind, trackId: string, start: number, mediaId: string | null = null): Clip {
  return {
    id: uid(),
    trackId,
    kind,
    start,
    duration: kind === "text" ? 3 : 4,
    mediaId,
    text:
      kind === "text"
        ? { content: "New title", styleKind: "title", fontSize: 64, color: "#ffffff" }
        : null,
    graphic: kind === "graphic" ? { shape: "rect", color: "#e6b566", strokeColor: "#ffffff", filled: true } : null,
    transform: { ...DEFAULT_TRANSFORM },
    animation: kind === "text" ? "typewriter" : "kenburns-in",
    transitionIn: newTransition(),
    transitionOut: { ...newTransition(), kind: "cut" },
    effects: { ...DEFAULT_EFFECTS },
    volume: 1,
    muted: false,
  };
}

export function newTrack(name: string, kind: TrackKind = "visual"): Track {
  return { id: uid(), name, kind, muted: false, locked: false, hidden: false, clips: [] };
}
