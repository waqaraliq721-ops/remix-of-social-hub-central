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

export async function transcribeFile(
  file: File | Blob,
  opts: { language?: string; filename?: string; provider?: SttProvider } = {},
): Promise<{ text: string; words: TranscriptWord[]; provider: string }> {
  const fd = new FormData();
  const name = opts.filename ?? (file instanceof File ? file.name : "audio.wav");
  fd.append("file", file, name);
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
