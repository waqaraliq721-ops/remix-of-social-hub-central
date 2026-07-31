// Shared multi-provider text-to-speech client.

export type TtsProvider = "lovable" | "elevenlabs" | "google";

export const TTS_PROVIDERS: { id: TtsProvider; name: string; note: string }[] = [
  { id: "elevenlabs", name: "ElevenLabs", note: "Most natural — no Lovable credits" },
  { id: "google", name: "Google AI Studio", note: "Gemini TTS — free tier friendly" },
  { id: "lovable", name: "Lovable AI", note: "OpenAI voices — uses Lovable credits" },
];

export const TTS_VOICES: Record<TtsProvider, { id: string; name: string }[]> = {
  lovable: [
    { id: "alloy", name: "Alloy · neutral" },
    { id: "echo", name: "Echo · warm male" },
    { id: "fable", name: "Fable · storyteller" },
    { id: "onyx", name: "Onyx · deep male" },
    { id: "nova", name: "Nova · bright female" },
    { id: "shimmer", name: "Shimmer · soft female" },
  ],
  elevenlabs: [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah · warm female" },
    { id: "JBFqnCBsd6RMkjVDRZzb", name: "George · narrator" },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel · news" },
    { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam · young male" },
    { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice · british female" },
    { id: "cjVigY5qzO86Huf0OWal", name: "Eric · confident" },
    { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily · soft female" },
    { id: "nPczCjzI2devNBz1zQrb", name: "Brian · deep male" },
  ],
  google: [
    { id: "Kore", name: "Kore · firm" },
    { id: "Puck", name: "Puck · upbeat" },
    { id: "Charon", name: "Charon · informative" },
    { id: "Fenrir", name: "Fenrir · excitable" },
    { id: "Aoede", name: "Aoede · breezy" },
    { id: "Leda", name: "Leda · youthful" },
    { id: "Orus", name: "Orus · firm male" },
    { id: "Zephyr", name: "Zephyr · bright" },
  ],
};

export type TtsOptions = {
  provider: TtsProvider;
  voice: string;
  styleDirection?: string;
};

/** Generates speech and returns a playable object URL plus the raw blob. */
export async function generateSpeech(
  text: string,
  opts: TtsOptions,
): Promise<{ url: string; blob: Blob }> {
  const endpoint =
    opts.provider === "elevenlabs"
      ? "/api/tts-elevenlabs"
      : opts.provider === "google"
        ? "/api/tts-google"
        : "/api/tts";

  const body =
    opts.provider === "elevenlabs"
      ? { text, voiceId: opts.voice }
      : opts.provider === "google"
        ? { text, voice: opts.voice, styleDirection: opts.styleDirection ?? "" }
        : { text, voice: opts.voice };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Voiceover failed (${res.status})`);
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), blob };
}

export async function blobDuration(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<number>((resolve) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => resolve(0);
      a.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
