import { createFileRoute } from "@tanstack/react-router";

export type TranscriptWord = { text: string; start: number; end: number };

// Word-accurate transcription. Primary: ElevenLabs scribe (word timestamps).
// Fallback: Lovable AI Gateway STT (no word timings -> evenly spread).
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const file = form.get("file");
        const languageCode = (form.get("language_code") as string) || "";
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
        if (elevenKey) {
          const up = new FormData();
          up.append("file", file, file.name || "audio.mp3");
          up.append("model_id", "scribe_v2");
          up.append("timestamps_granularity", "word");
          up.append("tag_audio_events", "false");
          if (languageCode) up.append("language_code", languageCode);

          const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": elevenKey },
            body: up,
          });

          if (res.ok) {
            const data = (await res.json()) as {
              text?: string;
              words?: { text: string; start: number; end: number; type?: string }[];
            };
            const words: TranscriptWord[] = (data.words ?? [])
              .filter((w) => (w.type ?? "word") === "word" && w.text.trim())
              .map((w) => ({ text: w.text.trim(), start: w.start, end: w.end }));
            return Response.json({ provider: "elevenlabs", text: data.text ?? "", words });
          }
          const errBody = await res.text();
          console.error(`ElevenLabs STT failed [${res.status}]: ${errBody}`);
          if (!process.env.LOVABLE_API_KEY) {
            return Response.json({ error: errBody }, { status: res.status });
          }
        }

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) {
          return Response.json({ error: "No transcription provider configured" }, { status: 500 });
        }
        const up = new FormData();
        up.append("file", file, file.name || "audio.mp3");
        up.append("model", "openai/gpt-4o-mini-transcribe");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}` },
          body: up,
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`Lovable STT failed [${res.status}]: ${errBody}`);
          return Response.json({ error: errBody }, { status: res.status });
        }
        const data = (await res.json()) as { text?: string };
        return Response.json({ provider: "lovable", text: data.text ?? "", words: [] });
      },
    },
  },
});
