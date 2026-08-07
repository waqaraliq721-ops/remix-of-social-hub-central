// Reusable background-music + synthesized sound-effects system for the kid
// video studios (Would You Rather, Guess the Emoji, Math Quiz, Guess the
// Logo). All SFX are synthesized with the Web Audio API — no asset files.

import { useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KidSfxKind = "start" | "timer" | "transition" | "reveal";

export type KidMusic = {
  src: string;
  name: string;
  enabled: boolean;
  volume: number;
  startAt: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
};

export type KidSfxSlot = {
  id: string;
  enabled: boolean;
  volume: number;
  offset: number;
  duration: number;
};

export type KidAudioSettings = {
  music: KidMusic;
  sfx: Record<KidSfxKind, KidSfxSlot>;
};

// ---------------------------------------------------------------------------
// SFX catalogue — at least 6 distinct synth designs per kind
// ---------------------------------------------------------------------------

export const SFX_OPTIONS: Record<KidSfxKind, { id: string; name: string }[]> = {
  start: [
    { id: "start-pop", name: "Pop" },
    { id: "start-blip", name: "Blip" },
    { id: "start-chime", name: "Chime" },
    { id: "start-swoosh-up", name: "Swoosh up" },
    { id: "start-double-pop", name: "Double pop" },
    { id: "start-marimba", name: "Marimba hit" },
  ],
  timer: [
    { id: "timer-tick", name: "Tick" },
    { id: "timer-beep", name: "Beep" },
    { id: "timer-heartbeat", name: "Heartbeat" },
    { id: "timer-clock", name: "Clock tick-tock" },
    { id: "timer-pulse", name: "Soft pulse" },
    { id: "timer-alarm", name: "Alarm blip" },
  ],
  transition: [
    { id: "transition-whoosh", name: "Whoosh" },
    { id: "transition-swipe", name: "Swipe" },
    { id: "transition-riser", name: "Riser" },
    { id: "transition-swoop", name: "Swoop down" },
    { id: "transition-wind", name: "Wind gust" },
    { id: "transition-zap", name: "Zap" },
  ],
  reveal: [
    { id: "reveal-ding", name: "Ding" },
    { id: "reveal-fanfare", name: "Fanfare" },
    { id: "reveal-sparkle", name: "Sparkle" },
    { id: "reveal-chord", name: "Success chord" },
    { id: "reveal-drum", name: "Drum hit" },
    { id: "reveal-applause", name: "Applause burst" },
  ],
};

export function defaultKidAudio(): KidAudioSettings {
  return {
    music: {
      src: "",
      name: "",
      enabled: false,
      volume: 0.35,
      startAt: 0,
      fadeIn: 1.5,
      fadeOut: 2,
      loop: true,
    },
    sfx: {
      start: { id: "start-pop", enabled: true, volume: 0.8, offset: 0, duration: 0.4 },
      timer: { id: "timer-tick", enabled: true, volume: 0.6, offset: 0, duration: 0.2 },
      transition: { id: "transition-whoosh", enabled: true, volume: 0.7, offset: 0, duration: 0.5 },
      reveal: { id: "reveal-ding", enabled: true, volume: 0.85, offset: 0, duration: 0.8 },
    },
  };
}

// ---------------------------------------------------------------------------
// Synthesis — works identically on live AudioContext and OfflineAudioContext
// ---------------------------------------------------------------------------

type AnyCtx = AudioContext | OfflineAudioContext;

function noiseBuffer(ctx: AnyCtx, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.round(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(
  ctx: AnyCtx,
  dest: AudioNode,
  when: number,
  points: [number, number][],
): GainNode {
  const g = ctx.createGain();
  g.connect(dest);
  g.gain.setValueAtTime(0, when);
  for (const [t, v] of points) {
    g.gain.linearRampToValueAtTime(v, when + t);
  }
  return g;
}

function tone(
  ctx: AnyCtx,
  dest: AudioNode,
  when: number,
  opts: {
    type?: OscillatorType;
    freq: number;
    freqEnd?: number;
    dur: number;
    gain?: number;
    attack?: number;
    release?: number;
  },
) {
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, when);
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), when + opts.dur);
  }
  const peak = opts.gain ?? 0.5;
  const attack = opts.attack ?? 0.01;
  const release = opts.release ?? opts.dur * 0.6;
  const g = envGain(ctx, dest, when, [
    [attack, peak],
    [attack + release, 0.0001],
  ]);
  osc.connect(g);
  osc.start(when);
  osc.stop(when + opts.dur + 0.05);
}

function filteredNoise(
  ctx: AnyCtx,
  dest: AudioNode,
  when: number,
  opts: {
    dur: number;
    type?: BiquadFilterType;
    freq: number;
    freqEnd?: number;
    q?: number;
    gain?: number;
    attack?: number;
  },
) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, opts.dur + 0.1);
  const filt = ctx.createBiquadFilter();
  filt.type = opts.type ?? "bandpass";
  filt.Q.value = opts.q ?? 1;
  filt.frequency.setValueAtTime(opts.freq, when);
  if (opts.freqEnd !== undefined) {
    filt.frequency.exponentialRampToValueAtTime(Math.max(10, opts.freqEnd), when + opts.dur);
  }
  const peak = opts.gain ?? 0.5;
  const attack = opts.attack ?? 0.01;
  const g = envGain(ctx, dest, when, [
    [attack, peak],
    [opts.dur, 0.0001],
  ]);
  src.connect(filt);
  filt.connect(g);
  src.start(when);
  src.stop(when + opts.dur + 0.1);
}

/** Synthesizes one named SFX at `when` (seconds, ctx timeline) into `dest`. */
function synthSfx(ctx: AnyCtx, id: string, when: number, dest: AudioNode, gainMul: number) {
  const g = ctx.createGain();
  g.gain.value = gainMul;
  g.connect(dest);

  switch (id) {
    // ---- start ----
    case "start-pop":
      tone(ctx, g, when, { type: "sine", freq: 260, freqEnd: 700, dur: 0.16, gain: 0.9, attack: 0.005 });
      break;
    case "start-blip":
      tone(ctx, g, when, { type: "square", freq: 520, freqEnd: 900, dur: 0.1, gain: 0.5, attack: 0.002 });
      break;
    case "start-chime":
      tone(ctx, g, when, { type: "sine", freq: 880, dur: 0.5, gain: 0.6, attack: 0.005, release: 0.45 });
      tone(ctx, g, when + 0.06, { type: "sine", freq: 1318.5, dur: 0.45, gain: 0.4, attack: 0.005, release: 0.4 });
      break;
    case "start-swoosh-up":
      filteredNoise(ctx, g, when, { dur: 0.35, type: "bandpass", freq: 400, freqEnd: 4000, q: 0.8, gain: 0.35 });
      tone(ctx, g, when, { type: "sine", freq: 200, freqEnd: 900, dur: 0.32, gain: 0.4 });
      break;
    case "start-double-pop":
      tone(ctx, g, when, { type: "sine", freq: 300, freqEnd: 650, dur: 0.1, gain: 0.7, attack: 0.004 });
      tone(ctx, g, when + 0.12, { type: "sine", freq: 380, freqEnd: 820, dur: 0.12, gain: 0.8, attack: 0.004 });
      break;
    case "start-marimba":
      tone(ctx, g, when, { type: "triangle", freq: 523.25, dur: 0.3, gain: 0.7, attack: 0.004, release: 0.25 });
      tone(ctx, g, when, { type: "sine", freq: 1046.5, dur: 0.15, gain: 0.25, attack: 0.002, release: 0.12 });
      break;

    // ---- timer ----
    case "timer-tick":
      filteredNoise(ctx, g, when, { dur: 0.05, type: "highpass", freq: 3500, gain: 0.5, attack: 0.001 });
      break;
    case "timer-beep":
      tone(ctx, g, when, { type: "square", freq: 1000, dur: 0.08, gain: 0.35, attack: 0.002, release: 0.06 });
      break;
    case "timer-heartbeat":
      tone(ctx, g, when, { type: "sine", freq: 90, freqEnd: 55, dur: 0.14, gain: 0.8, attack: 0.002, release: 0.12 });
      tone(ctx, g, when + 0.18, { type: "sine", freq: 80, freqEnd: 45, dur: 0.12, gain: 0.6, attack: 0.002, release: 0.1 });
      break;
    case "timer-clock":
      filteredNoise(ctx, g, when, { dur: 0.04, type: "bandpass", freq: 2200, q: 4, gain: 0.5 });
      filteredNoise(ctx, g, when + 0.5, { dur: 0.04, type: "bandpass", freq: 1800, q: 4, gain: 0.45 });
      break;
    case "timer-pulse":
      tone(ctx, g, when, { type: "sine", freq: 440, dur: 0.2, gain: 0.3, attack: 0.03, release: 0.15 });
      break;
    case "timer-alarm":
      tone(ctx, g, when, { type: "square", freq: 1200, dur: 0.06, gain: 0.3, attack: 0.001, release: 0.04 });
      tone(ctx, g, when + 0.08, { type: "square", freq: 1200, dur: 0.06, gain: 0.3, attack: 0.001, release: 0.04 });
      break;

    // ---- transition ----
    case "transition-whoosh":
      filteredNoise(ctx, g, when, { dur: 0.5, type: "bandpass", freq: 200, freqEnd: 3500, q: 0.6, gain: 0.5, attack: 0.02 });
      break;
    case "transition-swipe":
      filteredNoise(ctx, g, when, { dur: 0.28, type: "highpass", freq: 1200, freqEnd: 6000, q: 0.5, gain: 0.4 });
      break;
    case "transition-riser":
      tone(ctx, g, when, { type: "sawtooth", freq: 120, freqEnd: 1200, dur: 0.6, gain: 0.3, attack: 0.05, release: 0.1 });
      break;
    case "transition-swoop":
      tone(ctx, g, when, { type: "sine", freq: 1400, freqEnd: 150, dur: 0.4, gain: 0.5, attack: 0.01 });
      filteredNoise(ctx, g, when, { dur: 0.4, type: "lowpass", freq: 4000, freqEnd: 400, gain: 0.25 });
      break;
    case "transition-wind":
      filteredNoise(ctx, g, when, { dur: 0.7, type: "bandpass", freq: 600, freqEnd: 900, q: 0.4, gain: 0.35, attack: 0.15 });
      break;
    case "transition-zap":
      tone(ctx, g, when, { type: "sawtooth", freq: 1800, freqEnd: 80, dur: 0.16, gain: 0.4, attack: 0.001 });
      break;

    // ---- reveal ----
    case "reveal-ding":
      tone(ctx, g, when, { type: "sine", freq: 1568, dur: 0.5, gain: 0.6, attack: 0.004, release: 0.46 });
      tone(ctx, g, when, { type: "sine", freq: 3136, dur: 0.3, gain: 0.2, attack: 0.004, release: 0.26 });
      break;
    case "reveal-fanfare":
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(ctx, g, when + i * 0.09, { type: "triangle", freq: f, dur: 0.3, gain: 0.5, attack: 0.005, release: 0.24 }),
      );
      break;
    case "reveal-sparkle":
      for (let i = 0; i < 8; i++) {
        tone(ctx, g, when + i * 0.045, {
          type: "sine",
          freq: 1400 + Math.random() * 1800,
          dur: 0.18,
          gain: 0.22,
          attack: 0.002,
          release: 0.15,
        });
      }
      break;
    case "reveal-chord":
      [523.25, 659.25, 783.99].forEach((f) =>
        tone(ctx, g, when, { type: "sine", freq: f, dur: 0.7, gain: 0.32, attack: 0.02, release: 0.6 }),
      );
      break;
    case "reveal-drum":
      tone(ctx, g, when, { type: "sine", freq: 180, freqEnd: 50, dur: 0.25, gain: 0.9, attack: 0.002, release: 0.2 });
      filteredNoise(ctx, g, when, { dur: 0.1, type: "lowpass", freq: 1200, gain: 0.3 });
      break;
    case "reveal-applause":
      filteredNoise(ctx, g, when, { dur: 0.9, type: "bandpass", freq: 2500, q: 0.5, gain: 0.35, attack: 0.05 });
      filteredNoise(ctx, g, when, { dur: 0.9, type: "highpass", freq: 4000, gain: 0.2, attack: 0.08 });
      break;
    default:
      tone(ctx, g, when, { type: "sine", freq: 660, dur: 0.2, gain: 0.4 });
      break;
  }
}

// ---------------------------------------------------------------------------
// Music decode cache
// ---------------------------------------------------------------------------

const musicBufferCache = new Map<string, Promise<AudioBuffer | null>>();

async function fetchAndDecode(src: string, ctx: AnyCtx): Promise<AudioBuffer | null> {
  if (!src) return null;
  const cacheKey = src;
  let pending = musicBufferCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) return null;
        const arr = await res.arrayBuffer();
        // Decode with a throwaway context so we cache a plain AudioBuffer,
        // not one tied to a single (possibly offline) context.
        const decodeCtx: AnyCtx =
          typeof AudioContext !== "undefined" ? new AudioContext() : ctx;
        try {
          const buf = await decodeCtx.decodeAudioData(arr.slice(0));
          return buf;
        } finally {
          if (decodeCtx !== ctx && "close" in decodeCtx) {
            void (decodeCtx as AudioContext).close().catch(() => {});
          }
        }
      } catch {
        return null;
      }
    })();
    musicBufferCache.set(cacheKey, pending);
  }
  try {
    return await pending;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Offline rendering (used for export)
// ---------------------------------------------------------------------------

const KIND_ORDER: KidSfxKind[] = ["start", "timer", "transition", "reveal"];

export type KidAudioCue = { kind: KidSfxKind; time: number };

export async function renderKidSfxBuffer(
  settings: KidAudioSettings,
  cues: KidAudioCue[],
  totalDuration: number,
): Promise<AudioBuffer | null> {
  if (!cues.length || totalDuration <= 0) return null;
  const active = cues.filter((c) => settings.sfx[c.kind]?.enabled);
  if (!active.length) return null;
  try {
    const ctx = new OfflineAudioContext(2, Math.ceil(totalDuration * 48000), 48000);
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    for (const cue of active) {
      const slot = settings.sfx[cue.kind];
      if (!slot?.enabled) continue;
      const when = Math.max(0, cue.time);
      if (when >= totalDuration) continue;
      synthSfx(ctx, slot.id, when, master, Math.max(0, Math.min(1.5, slot.volume)));
    }
    return await ctx.startRendering();
  } catch {
    return null;
  }
}

export async function renderKidMusicBuffer(
  settings: KidAudioSettings,
  totalDuration: number,
): Promise<AudioBuffer | null> {
  const m = settings.music;
  if (!m.enabled || !m.src || totalDuration <= 0) return null;
  try {
    const ctx = new OfflineAudioContext(2, Math.ceil(totalDuration * 48000), 48000);
    const source = await fetchAndDecode(m.src, ctx);
    if (!source) return null;

    const node = ctx.createBufferSource();
    node.buffer = source;
    node.loop = m.loop;
    if (m.loop) {
      node.loopStart = Math.min(m.startAt, source.duration);
      node.loopEnd = source.duration;
    }

    const gain = ctx.createGain();
    node.connect(gain);
    gain.connect(ctx.destination);

    const vol = Math.max(0, Math.min(1, m.volume));
    const fadeIn = Math.max(0, m.fadeIn);
    const fadeOut = Math.max(0, m.fadeOut);
    const start = 0;
    const end = totalDuration;

    gain.gain.setValueAtTime(0, start);
    if (fadeIn > 0) {
      gain.gain.linearRampToValueAtTime(vol, Math.min(end, start + fadeIn));
    } else {
      gain.gain.setValueAtTime(vol, start);
    }
    if (fadeOut > 0 && end - fadeOut > start) {
      gain.gain.setValueAtTime(vol, Math.max(start, end - fadeOut));
      gain.gain.linearRampToValueAtTime(0.0001, end);
    }

    const offset = Math.min(Math.max(0, m.startAt), Math.max(0, source.duration - 0.01));
    node.start(0, offset);
    node.stop(end);

    return await ctx.startRendering();
  } catch {
    return null;
  }
}

/** Routes a rendered AudioBuffer through a live AudioContext into a MediaStream (for muxing with video export). */
export function audioBufferToStream(buffer: AudioBuffer, ctx: AudioContext): MediaStreamAudioDestinationNode {
  const dest = ctx.createMediaStreamDestination();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(dest);
  src.start();
  return dest;
}

// ---------------------------------------------------------------------------
// Live preview engine
// ---------------------------------------------------------------------------

export function useKidAudioEngine(settings: KidAudioSettings) {
  const ctxRef = useRef<AudioContext | null>(null);
  const musicNodesRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const playSfx = useCallback(
    (kind: KidSfxKind) => {
      const s = settingsRef.current;
      const slot = s.sfx[kind];
      if (!slot?.enabled) return;
      const ctx = ensureCtx();
      try {
        synthSfx(ctx, slot.id, ctx.currentTime, ctx.destination, Math.max(0, Math.min(1.5, slot.volume)));
      } catch {
        // ignore playback errors in preview
      }
    },
    [ensureCtx],
  );

  const stopMusic = useCallback(() => {
    const nodes = musicNodesRef.current;
    if (nodes) {
      try {
        nodes.src.stop();
      } catch {
        // already stopped
      }
      musicNodesRef.current = null;
    }
  }, []);

  const startMusic = useCallback(
    (atSeconds = 0) => {
      const s = settingsRef.current;
      const m = s.music;
      stopMusic();
      if (!m.enabled || !m.src) return;
      const ctx = ensureCtx();
      void fetchAndDecode(m.src, ctx).then((buffer) => {
        if (!buffer || musicNodesRef.current) return;
        const currentM = settingsRef.current.music;
        if (!currentM.enabled) return;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = currentM.loop;
        if (currentM.loop) {
          src.loopStart = Math.min(currentM.startAt, buffer.duration);
          src.loopEnd = buffer.duration;
        }
        const gain = ctx.createGain();
        src.connect(gain);
        gain.connect(ctx.destination);
        const vol = Math.max(0, Math.min(1, currentM.volume));
        const fadeIn = Math.max(0, currentM.fadeIn);
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        if (fadeIn > 0) gain.gain.linearRampToValueAtTime(vol, now + fadeIn);
        else gain.gain.setValueAtTime(vol, now);
        const offset = Math.min(Math.max(0, currentM.startAt + atSeconds), Math.max(0, buffer.duration - 0.01));
        src.start(0, offset);
        musicNodesRef.current = { src, gain };
      });
    },
    [ensureCtx, stopMusic],
  );

  useEffect(() => () => {
    stopMusic();
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
  }, [stopMusic]);

  return { playSfx, startMusic, stopMusic };
}

// ---------------------------------------------------------------------------
// Settings card (UI)
// ---------------------------------------------------------------------------

const KIND_LABELS: Record<KidSfxKind, string> = {
  start: "Round start",
  timer: "Timer tick",
  transition: "Transition",
  reveal: "Answer reveal",
};

function SfxRow({
  kind,
  slot,
  onChange,
}: {
  kind: KidSfxKind;
  slot: KidSfxSlot;
  onChange: (next: KidSfxSlot) => void;
}) {
  const set = (patch: Partial<KidSfxSlot>) => onChange({ ...slot, ...patch });
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{KIND_LABELS[kind]}</Label>
        <Switch checked={slot.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-[11px] text-muted-foreground">Sound</Label>
          <Select value={slot.id} onValueChange={(v) => set({ id: v })} disabled={!slot.enabled}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SFX_OPTIONS[kind].map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Volume · {Math.round(slot.volume * 100)}%</Label>
          <Slider
            value={[slot.volume]}
            min={0}
            max={1.5}
            step={0.05}
            onValueChange={([v]) => set({ volume: v })}
            disabled={!slot.enabled}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Offset · {slot.offset.toFixed(2)}s</Label>
          <Slider
            value={[slot.offset]}
            min={-1}
            max={2}
            step={0.05}
            onValueChange={([v]) => set({ offset: v })}
            disabled={!slot.enabled}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Duration · {slot.duration.toFixed(2)}s</Label>
          <Slider
            value={[slot.duration]}
            min={0.1}
            max={2}
            step={0.05}
            onValueChange={([v]) => set({ duration: v })}
            disabled={!slot.enabled}
          />
        </div>
      </div>
    </div>
  );
}

export function KidAudioCard({
  value,
  onChange,
}: {
  value: KidAudioSettings;
  onChange: (v: KidAudioSettings) => void;
}) {
  const urlInputRef = useRef<HTMLInputElement>(null);

  const setMusic = (patch: Partial<KidMusic>) => onChange({ ...value, music: { ...value.music, ...patch } });
  const setSfx = (kind: KidSfxKind, slot: KidSfxSlot) =>
    onChange({ ...value, sfx: { ...value.sfx, [kind]: slot } });

  const onFile = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMusic({ src: url, name: file.name, enabled: true });
  };

  const onLoadUrl = () => {
    const url = urlInputRef.current?.value?.trim();
    if (!url) return;
    setMusic({ src: url, name: url.split("/").pop() || url, enabled: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Music & sound effects</CardTitle>
        <CardDescription>Background music plus synthesized sound effects for key moments.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Background music</Label>
            <Switch checked={value.music.enabled} onCheckedChange={(v) => setMusic({ enabled: v })} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Upload file</Label>
              <Input
                type="file"
                accept="audio/*"
                className="h-8 text-xs"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Or load from URL</Label>
              <div className="flex gap-2">
                <Input ref={urlInputRef} placeholder="https://…mp3" className="h-8 text-xs" />
                <Button type="button" size="sm" className="h-8" onClick={onLoadUrl}>
                  Load
                </Button>
              </div>
            </div>
          </div>
          {value.music.name && (
            <p className="truncate text-[11px] text-muted-foreground">Selected: {value.music.name}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Volume · {Math.round(value.music.volume * 100)}%
              </Label>
              <Slider
                value={[value.music.volume]}
                min={0}
                max={1}
                step={0.02}
                onValueChange={([v]) => setMusic({ volume: v })}
                disabled={!value.music.enabled}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Start at · {value.music.startAt.toFixed(1)}s</Label>
              <Slider
                value={[value.music.startAt]}
                min={0}
                max={120}
                step={0.5}
                onValueChange={([v]) => setMusic({ startAt: v })}
                disabled={!value.music.enabled}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Fade in · {value.music.fadeIn.toFixed(1)}s</Label>
              <Slider
                value={[value.music.fadeIn]}
                min={0}
                max={10}
                step={0.5}
                onValueChange={([v]) => setMusic({ fadeIn: v })}
                disabled={!value.music.enabled}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Fade out · {value.music.fadeOut.toFixed(1)}s</Label>
              <Slider
                value={[value.music.fadeOut]}
                min={0}
                max={10}
                step={0.5}
                onValueChange={([v]) => setMusic({ fadeOut: v })}
                disabled={!value.music.enabled}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Loop</Label>
            <Switch checked={value.music.loop} onCheckedChange={(v) => setMusic({ loop: v })} disabled={!value.music.enabled} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Sound effects</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {KIND_ORDER.map((kind) => (
              <SfxRow key={kind} kind={kind} slot={value.sfx[kind]} onChange={(next) => setSfx(kind, next)} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Voiceover timing mode
// ---------------------------------------------------------------------------

/**
 * How narration interacts with the round countdown.
 *  · "overlap" — narration plays while the countdown runs (fast-paced edits).
 *  · "hold"    — the countdown (and therefore the result reveal) only starts
 *                once the narration has finished.
 */
export type VoTimingMode = "overlap" | "hold";

export function VoTimingControls({
  mode,
  onModeChange,
  resultSecs,
  onResultSecsChange,
}: {
  mode: VoTimingMode;
  onModeChange: (v: VoTimingMode) => void;
  resultSecs: number;
  onResultSecsChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-xs font-medium">Voiceover timing</Label>
      <Select value={mode} onValueChange={(v) => onModeChange(v as VoTimingMode)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="overlap">Play over the running timer</SelectItem>
          <SelectItem value="hold">Pause the timer until narration ends</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        {mode === "hold"
          ? "Each round runs: narration → countdown → result. Round length grows with the narration."
          : "Narration plays on top of the countdown, so rounds stay tight and predictable."}
      </p>
      <div>
        <Label className="text-[11px] text-muted-foreground">
          Result hold · {resultSecs.toFixed(1)}s
        </Label>
        <Slider
          value={[resultSecs]}
          min={0.6}
          max={6}
          step={0.1}
          onValueChange={([v]) => onResultSecsChange(v)}
        />
      </div>
    </div>
  );
}
