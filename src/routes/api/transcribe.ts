import { createFileRoute } from "@tanstack/react-router";

export type TranscriptWord = { text: string; start: number; end: number };

type Provider = "auto" | "elevenlabs" | "google" | "lovable";

function spreadWords(text: string, duration: number): TranscriptWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const total = tokens.reduce((n, w) => n + Math.max(2, w.length), 0);
  const dur = duration > 0 ? duration : tokens.length * 0.38;
  let cursor = 0;
  return tokens.map((w) => {
    const span = (Math.max(2, w.length) / total) * dur;
    const start = cursor;
    cursor += span;
    return { text: w, start, end: cursor };
  });
}

async function viaElevenLabs(file: File, languageCode: string, key: string) {
  const up = new FormData();
  up.append("file", file, file.name || "audio.mp3");
  up.append("model_id", "scribe_v2");
  up.append("timestamps_granularity", "word");
  up.append("tag_audio_events", "false");
  if (languageCode) up.append("language_code", languageCode);

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: up,
  });
  if (!res.ok) throw new Error(`ElevenLabs [${res.status}]: ${await res.text()}`);
  const data = (await res.json()) as {
    text?: string;
    words?: { text: string; start: number; end: number; type?: string }[];
  };
  const words: TranscriptWord[] = (data.words ?? [])
    .filter((w) => (w.type ?? "word") === "word" && w.text.trim())
    .map((w) => ({ text: w.text.trim(), start: w.start, end: w.end }));
  return { provider: "elevenlabs", text: data.text ?? "", words };
}

/** Google AI Studio (Gemini) — returns word-level timings via structured output. */
async function viaGoogle(file: File, languageCode: string, key: string) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) {
    bin += String.fromCharCode(...buf.subarray(i, i + CH));
  }
  const b64 = btoa(bin);
  const mime = file.type && file.type.startsWith("audio") ? file.type : "audio/mpeg";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Transcribe this audio word by word with precise timings in seconds." +
                  (languageCode ? ` The language is ${languageCode}.` : "") +
                  " Return ONLY JSON: {\"words\":[{\"text\":\"...\",\"start\":0.0,\"end\":0.0}]}." +
                  " Include every spoken word in order. Do not include music or noise.",
              },
              { inlineData: { mimeType: mime, data: b64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Google [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let words: TranscriptWord[] = [];
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "")) as {
      words?: { text?: string; start?: number; end?: number }[];
    };
    words = (parsed.words ?? [])
      .filter((w) => w.text && w.text.trim())
      .map((w) => ({
        text: String(w.text).trim(),
        start: Number(w.start) || 0,
        end: Number(w.end) || Number(w.start) || 0,
      }));
  } catch {
    words = [];
  }
  const text = words.map((w) => w.text).join(" ");
  if (!words.length) throw new Error("Google returned no usable transcript");
  return { provider: "google", text, words };
}

async function viaLovable(file: File, key: string) {
  const up = new FormData();
  up.append("file", file, file.name || "audio.mp3");
  up.append("model", "openai/gpt-4o-mini-transcribe");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: up,
  });
  if (!res.ok) throw new Error(`Lovable AI [${res.status}]: ${await res.text()}`);
  const data = (await res.json()) as { text?: string };
  const text = data.text ?? "";
  return { provider: "lovable", text, words: spreadWords(text, 0) };
}

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const file = form.get("file");
        const languageCode = (form.get("language_code") as string) || "";
        const requested = ((form.get("provider") as string) || "auto") as Provider;
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "No audio file uploaded" }, { status: 400 });
        }
        if (file.size > 24 * 1024 * 1024) {
          return Response.json(
            { error: "File is larger than 24MB. Please upload a shorter or compressed track." },
            { status: 413 },
          );
        }

        const elevenKey = process.env.ELEVENLABS_API_KEY;
        const googleKey = process.env.GEMINI_API_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;

        const order: Provider[] =
          requested === "auto"
            ? ["elevenlabs", "google", "lovable"]
            : [requested];

        const errors: string[] = [];
        for (const p of order) {
          try {
            if (p === "elevenlabs") {
              if (!elevenKey) throw new Error("ElevenLabs is not connected");
              return Response.json(await viaElevenLabs(file, languageCode, elevenKey));
            }
            if (p === "google") {
              if (!googleKey) throw new Error("Google AI Studio key (GEMINI_API_KEY) is missing");
              return Response.json(await viaGoogle(file, languageCode, googleKey));
            }
            if (p === "lovable") {
              if (!lovableKey) throw new Error("Lovable AI is not configured");
              return Response.json(await viaLovable(file, lovableKey));
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`Transcription via ${p} failed: ${msg}`);
            errors.push(msg);
          }
        }

        return Response.json(
          { error: errors.join(" | ") || "No transcription provider available" },
          { status: 502 },
        );
      },
    },
  },
});
