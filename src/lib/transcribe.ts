// Client helpers for word-accurate transcription via /api/transcribe.

export type TranscriptWord = { text: string; start: number; end: number };
export type TimedLine = { time: number; end: number; text: string; words: TranscriptWord[] };

export type SttProvider = "auto" | "elevenlabs" | "google" | "lovable";

export const STT_PROVIDERS: { id: SttProvider; name: string; note: string }[] = [
  { id: "auto", name: "Auto (best available)", note: "Tries ElevenLabs → Google → Lovable AI" },
  { id: "elevenlabs", name: "ElevenLabs Scribe", note: "Most accurate word timings" },
  { id: "google", name: "Google AI Studio", note: "Gemini — free tier friendly" },
  { id: "lovable", name: "Lovable AI", note: "Uses Lovable credits" },
];

/**
 * Decode any audio file and re-encode it as 16 kHz mono WAV.
 * Speech models only need 16 kHz mono, and this turns a 60 MB song into a
 * few MB — which is the difference between a transcription that returns in
 * seconds and one that appears to hang while the original file uploads.
 */
export async function compressForStt(file: File | Blob): Promise<Blob> {
  try {
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tmp = new AC();
    const decoded = await tmp.decodeAudioData(await file.arrayBuffer());
    await tmp.close().catch(() => {});
    const rate = 16000;
    const frames = Math.ceil(decoded.duration * rate);
    const off = new OfflineAudioContext(1, frames, rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    const pcm = rendered.getChannelData(0);

    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buf);
    const str = (o: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
    };
    str(0, "RIFF");
    view.setUint32(4, 36 + pcm.length * 2, true);
    str(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    str(36, "data");
    view.setUint32(40, pcm.length * 2, true);
    let o = 44;
    for (let i = 0; i < pcm.length; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buf], { type: "audio/wav" });
  } catch {
    // Undecodable container — fall back to the original bytes.
    return file;
  }
}

export async function transcribeFile(
  file: File | Blob,
  opts: {
    language?: string;
    filename?: string;
    provider?: SttProvider;
    /** Skip the 16 kHz mono downmix (already-small clips). */
    raw?: boolean;
  } = {},
): Promise<{ text: string; words: TranscriptWord[]; provider: string }> {
  const payload = opts.raw ? file : await compressForStt(file);
  const fd = new FormData();
  const base = opts.filename ?? (file instanceof File ? file.name : "audio");
  const name = payload.type === "audio/wav" ? base.replace(/\.[^.]+$/, "") + ".wav" : base;
  fd.append("file", payload, name);
  if (opts.language) fd.append("language_code", opts.language);
  fd.append("provider", opts.provider ?? "auto");
  const res = await fetch("/api/transcribe", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as {
    text?: string;
    words?: TranscriptWord[];
    provider?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || `Transcription failed (${res.status})`);
  return { text: data.text ?? "", words: data.words ?? [], provider: data.provider ?? "unknown" };
}


/**
 * Group word timings into readable lines. Breaks on long pauses, sentence
 * punctuation, or when the line gets too long.
 */
export function wordsToLines(
  words: TranscriptWord[],
  opts: { maxWords?: number; maxChars?: number; gap?: number } = {},
): TimedLine[] {
  const maxWords = opts.maxWords ?? 7;
  const maxChars = opts.maxChars ?? 42;
  const gap = opts.gap ?? 0.62;
  const lines: TimedLine[] = [];
  let cur: TranscriptWord[] = [];

  const flush = () => {
    if (!cur.length) return;
    lines.push({
      time: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.text).join(" ").replace(/\s+([,.!?])/g, "$1"),
      words: cur,
    });
    cur = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    cur.push(w);
    const next = words[i + 1];
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0);
    const endsSentence = /[.!?]$/.test(w.text);
    const pause = next ? next.start - w.end : Infinity;
    if (
      endsSentence ||
      pause >= gap ||
      cur.length >= maxWords ||
      chars >= maxChars ||
      !next
    ) {
      flush();
    }
  }
  flush();
  return lines;
}

export function linesToLrc(lines: TimedLine[]): string {
  return lines
    .map((l) => {
      const m = Math.floor(l.time / 60);
      const s = l.time - m * 60;
      return `[${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}] ${l.text}`;
    })
    .join("\n");
}
