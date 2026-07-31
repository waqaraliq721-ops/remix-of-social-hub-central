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

/** Model ids are rolled/retired often — try newest first, fall back on 404. */
const GOOGLE_STT_MODELS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

/** Resumable upload to the Gemini Files API — required for audio above ~18MB. */
async function uploadToGoogleFiles(file: File, mime: string, key: string): Promise<string> {
  const start = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(file.size),
        "X-Goog-Upload-Header-Content-Type": mime,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: file.name || "audio" } }),
    },
  );
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) {
    throw new Error(`Google upload init [${start.status}]: ${await start.text()}`);
  }
  const put = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(file.size),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: file,
  });
  if (!put.ok) throw new Error(`Google upload [${put.status}]: ${await put.text()}`);
  const info = (await put.json()) as { file?: { uri?: string; name?: string; state?: string } };
  const uri = info.file?.uri;
  const name = info.file?.name;
  if (!uri) throw new Error("Google upload returned no file URI");

  // Wait for the file to finish processing before referencing it.
  for (let i = 0; i < 60 && name; i++) {
    const st = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${name}?key=${encodeURIComponent(key)}`,
    );
    const j = (await st.json().catch(() => ({}))) as { state?: string };
    if (j.state === "ACTIVE") break;
    if (j.state === "FAILED") throw new Error("Google failed to process the uploaded audio");
    await new Promise((r) => setTimeout(r, 1500));
  }
  return uri;
}


/** Google AI Studio (Gemini) — returns word-level timings via structured output. */
async function viaGoogle(file: File, languageCode: string, key: string) {
  const mime = file.type && file.type.startsWith("audio") ? file.type : "audio/mpeg";
  const INLINE_LIMIT = 18 * 1024 * 1024;

  // Big files can't be inlined — push them through the Files API first.
  let filePart: Record<string, unknown>;
  if (file.size > INLINE_LIMIT) {
    filePart = { fileData: { mimeType: mime, fileUri: await uploadToGoogleFiles(file, mime, key) } };
  } else {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) {
      bin += String.fromCharCode(...buf.subarray(i, i + CH));
    }
    filePart = { inlineData: { mimeType: mime, data: btoa(bin) } };
  }

  const body = JSON.stringify({
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
          filePart,
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });

  let res: Response | null = null;
  let lastErr = "";
  for (const model of GOOGLE_STT_MODELS) {
    const attempt = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
    );
    if (attempt.ok) {
      res = attempt;
      break;
    }
    lastErr = `Google ${model} [${attempt.status}]: ${await attempt.text()}`;
    // Only keep trying when the model itself is unavailable to this key.
    if (attempt.status !== 404 && attempt.status !== 403 && attempt.status !== 400) break;
  }
  if (!res) throw new Error(lastErr || "Google request failed");

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
