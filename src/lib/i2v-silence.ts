// Client-side silence trimming for the Images-to-Video voiceover track.
// Decodes an audio Blob, detects quiet stretches below a threshold, splices
// them out (keeping a small padding buffer around speech) and re-encodes
// the result as a WAV Blob so it can drop straight back into the studio.

export type SilenceOptions = {
  /** Loudness below this (dBFS) counts as silence. */
  thresholdDb: number;
  /** Minimum length of a quiet stretch (ms) before it's considered removable. */
  minSilenceMs: number;
  /** How much silence (ms) to keep on each side of a cut, for a natural breath. */
  paddingMs: number;
};

export type SilenceResult = {
  blob: Blob;
  originalDuration: number;
  newDuration: number;
  removedCount: number;
  removedSeconds: number;
};

function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}

/**
 * Analyse a decoded buffer and return [start, end] sample ranges (in frames)
 * that should be KEPT once silence has been trimmed out.
 */
function computeKeepRanges(
  buf: AudioBuffer,
  opts: SilenceOptions,
): { ranges: [number, number][]; removedFrames: number; cutCount: number } {
  const sr = buf.sampleRate;
  const numCh = buf.numberOfChannels;
  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(buf.getChannelData(c));
  const total = buf.length;

  const winSize = Math.max(1, Math.floor(sr * 0.01)); // 10ms windows
  const linThresh = Math.pow(10, opts.thresholdDb / 20);
  const minSilenceFrames = (opts.minSilenceMs / 1000) * sr;
  const paddingFrames = Math.max(0, Math.floor((opts.paddingMs / 1000) * sr));

  const isSilentWindow = (start: number, end: number) => {
    let sum = 0;
    let n = 0;
    for (let c = 0; c < numCh; c++) {
      const data = chans[c];
      for (let i = start; i < end; i++) {
        sum += data[i] * data[i];
        n++;
      }
    }
    const rms = n ? Math.sqrt(sum / n) : 0;
    return rms < linThresh;
  };

  // Silent runs, in frames.
  const silentRuns: [number, number][] = [];
  let runStart = -1;
  for (let i = 0; i < total; i += winSize) {
    const end = Math.min(total, i + winSize);
    const silent = isSilentWindow(i, end);
    if (silent) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      silentRuns.push([runStart, i]);
      runStart = -1;
    }
  }
  if (runStart >= 0) silentRuns.push([runStart, total]);

  // Cut regions: silent runs long enough, shrunk by padding on both sides.
  const cuts: [number, number][] = [];
  for (const [s, e] of silentRuns) {
    if (e - s < minSilenceFrames) continue;
    const cutStart = s + paddingFrames;
    const cutEnd = e - paddingFrames;
    if (cutEnd > cutStart) cuts.push([cutStart, cutEnd]);
  }

  if (!cuts.length) return { ranges: [[0, total]], removedFrames: 0, cutCount: 0 };

  const ranges: [number, number][] = [];
  let cursor = 0;
  let removedFrames = 0;
  for (const [cs, ce] of cuts) {
    if (cs > cursor) ranges.push([cursor, cs]);
    removedFrames += ce - cs;
    cursor = ce;
  }
  if (cursor < total) ranges.push([cursor, total]);

  return { ranges, removedFrames, cutCount: cuts.length };
}

/** Detect + splice out silence from an audio Blob, returning a trimmed WAV Blob. */
export async function removeSilences(input: Blob, opts: SilenceOptions): Promise<SilenceResult> {
  const AC: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(await input.arrayBuffer());
  } finally {
    ctx.close().catch(() => {});
  }

  const { ranges, removedFrames, cutCount } = computeKeepRanges(buf, opts);
  const sr = buf.sampleRate;
  const numCh = buf.numberOfChannels;
  const keptFrames = buf.length - removedFrames;

  if (!removedFrames || keptFrames <= 0) {
    return {
      blob: encodeWav(
        Array.from({ length: numCh }, (_, c) => buf.getChannelData(c)),
        sr,
      ),
      originalDuration: buf.duration,
      newDuration: buf.duration,
      removedCount: 0,
      removedSeconds: 0,
    };
  }

  const outChannels: Float32Array[] = Array.from({ length: numCh }, () => new Float32Array(keptFrames));
  let write = 0;
  for (const [s, e] of ranges) {
    const len = e - s;
    for (let c = 0; c < numCh; c++) {
      outChannels[c].set(buf.getChannelData(c).subarray(s, e), write);
    }
    write += len;
  }

  const blob = encodeWav(outChannels, sr);
  const newDuration = keptFrames / sr;
  return {
    blob,
    originalDuration: buf.duration,
    newDuration,
    removedCount: cutCount,
    removedSeconds: removedFrames / sr,
  };
}
