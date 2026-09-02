// Shared helpers for the TikTok Videos studios (Would You Rather, Ranking,
// Facts). Locks every studio to 9:16 · 1080x1920 · 60fps and centralises the
// bits that don't need to be duplicated per-template: image loading, cached
// cover-fit blitting, a simple per-text-block style control, and the
// OfflineAudioContext mix used at export time (voiceover + synthesized SFX +
// background music, all rendered offline into a single AudioBuffer).

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import {
  renderKidSfxBuffer,
  renderKidMusicBuffer,
  type KidAudioSettings,
  type KidAudioCue,
} from "@/lib/kid-audio";

export const TIKTOK_W = 1080;
export const TIKTOK_H = 1920;

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function loadImageFromFile(
  file: File,
  onLoad: (img: HTMLImageElement, url: string) => void,
) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => onLoad(img, url);
  img.src = url;
}

/** Static "9:16 · 1080p · 60fps" badge — every TikTok studio is locked to this. */
export function TikTokFormatBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5" />
      9:16 · 1080×1920 · 60fps
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cached "cover" image blitting so hot render loops don't re-decode bitmaps.
// ---------------------------------------------------------------------------

export function getCachedCover(
  cache: Map<string, HTMLCanvasElement>,
  img: HTMLImageElement,
  w: number,
  h: number,
): HTMLCanvasElement {
  const dw = Math.max(1, Math.round(w));
  const dh = Math.max(1, Math.round(h));
  const key = `${img.src}|${dw}x${dh}`;
  let cached = cache.get(key);
  if (!cached) {
    cached = document.createElement("canvas");
    cached.width = dw;
    cached.height = dh;
    const cctx = cached.getContext("2d");
    if (cctx && img.naturalWidth && img.naturalHeight) {
      const ratio = Math.max(dw / img.naturalWidth, dh / img.naturalHeight);
      const iw = img.naturalWidth * ratio;
      const ih = img.naturalHeight * ratio;
      cctx.drawImage(img, (dw - iw) / 2, (dh - ih) / 2, iw, ih);
    }
    cache.set(key, cached);
    if (cache.size > 80) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
  }
  return cached;
}

export function drawCoverCached(
  ctx: CanvasRenderingContext2D,
  cache: Map<string, HTMLCanvasElement>,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const cached = getCachedCover(cache, img, w, h);
  ctx.drawImage(cached, x, y, w, h);
}

// ---------------------------------------------------------------------------
// Simple per-text-block style (font size, position, colour) — used for fully
// editable text everywhere without the heavier per-element animation system.
// ---------------------------------------------------------------------------

export type TextBlockStyle = {
  size: number; // percent of canvas height, base font size
  dx: number; // horizontal offset in % of width
  dy: number; // vertical offset in % of height
  color: string;
};

export function defaultTextStyle(partial?: Partial<TextBlockStyle>): TextBlockStyle {
  return { size: 5, dx: 0, dy: 0, color: "#ffffff", ...partial };
}

export function TextBlockControls({
  label,
  value,
  onChange,
  minSize = 1.5,
  maxSize = 14,
}: {
  label: string;
  value: TextBlockStyle;
  onChange: (next: TextBlockStyle) => void;
  minSize?: number;
  maxSize?: number;
}) {
  const set = (patch: Partial<TextBlockStyle>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            aria-label={`${label} colour`}
            value={value.color}
            onChange={(e) => set({ color: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0.5"
          />
        </div>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Font size · {value.size.toFixed(1)}%</Label>
        <Slider value={[value.size]} min={minSize} max={maxSize} step={0.1} onValueChange={([v]) => set({ size: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">X · {value.dx.toFixed(0)}%</Label>
          <Slider value={[value.dx]} min={-45} max={45} step={1} onValueChange={([v]) => set({ dx: v })} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Y · {value.dy.toFixed(0)}%</Label>
          <Slider value={[value.dy]} min={-45} max={45} step={1} onValueChange={([v]) => set({ dy: v })} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Offline audio mix for export: voiceover(s) + synthesized SFX + music, all
// rendered through a single OfflineAudioContext into one AudioBuffer.
// ---------------------------------------------------------------------------

export type OfflineVoiceoverCue = {
  blob: Blob | null;
  at: number;
  volume?: number;
};

export async function composeOfflineAudio(opts: {
  totalDuration: number;
  voiceovers?: OfflineVoiceoverCue[];
  audio: KidAudioSettings;
  cues?: KidAudioCue[];
}): Promise<AudioBuffer | null> {
  const { totalDuration, voiceovers = [], audio, cues = [] } = opts;
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) return null;

  const ctx = new OfflineAudioContext(2, Math.ceil(totalDuration * 48000), 48000);
  let any = false;

  for (const v of voiceovers) {
    if (!v.blob) continue;
    try {
      const arr = await v.blob.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = Math.max(0, v.volume ?? 1);
      src.connect(g);
      g.connect(ctx.destination);
      src.start(Math.max(0, v.at));
      any = true;
    } catch {
      // ignore a single bad voiceover clip rather than failing the export
    }
  }

  const [sfxBuf, musicBuf] = await Promise.all([
    renderKidSfxBuffer(audio, cues, totalDuration),
    renderKidMusicBuffer(audio, totalDuration),
  ]);
  for (const buf of [sfxBuf, musicBuf]) {
    if (!buf) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    any = true;
  }

  if (!any) return null;
  return ctx.startRendering();
}

/**
 * Calls recordKidCanvas with an offline-rendered AudioBuffer. `recordKidCanvas`
 * is being upgraded elsewhere to accept `audioBuffer` directly, so we pass it
 * through loosely typed until that lands.
 */
export async function recordWithOfflineAudio(
  recordKidCanvas: (opts: any) => Promise<{ blob: Blob; extension: "mp4" | "webm" }>,
  opts: {
    canvas: HTMLCanvasElement;
    duration: number;
    drawFrame: (ctx: CanvasRenderingContext2D, time: number) => void;
    audioBuffer: AudioBuffer | null;
    onProgress?: (value: number) => void;
  },
) {
  return recordKidCanvas({
    canvas: opts.canvas,
    duration: opts.duration,
    drawFrame: opts.drawFrame,
    fps: 60,
    onProgress: opts.onProgress,
    ...(opts.audioBuffer ? { audioBuffer: opts.audioBuffer } : {}),
  });
}
