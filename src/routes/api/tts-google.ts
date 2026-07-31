import { createFileRoute } from "@tanstack/react-router";

// Wrap raw PCM (signed 16-bit little-endian mono) in a WAV container so browsers can play it.
function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

export const Route = createFileRoute("/api/tts-google")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.GEMINI_API_KEY;
        if (!key) return new Response("Missing GEMINI_API_KEY", { status: 500 });

        const {
          text,
          voice = "Kore",
          model = "gemini-2.5-flash-preview-tts",
          styleDirection = "",
        } = (await request.json()) as {
          text: string;
          voice?: string;
          model?: string;
          styleDirection?: string;
        };

        if (!text || !text.trim()) return new Response("Empty text", { status: 400 });

        const prompt = styleDirection ? `${styleDirection}: ${text}` : text;

        const body = JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
          },
        });

        // Model ids get retired — fall back to other TTS models if one is gone.
        const candidates = [
          model,
          "gemini-2.5-flash-preview-tts",
          "gemini-2.5-pro-preview-tts",
          "gemini-3.1-flash-tts-preview",
        ].filter((m, i, a) => a.indexOf(m) === i);

        let upstream: Response | null = null;
        let lastBody = "";
        let lastStatus = 502;
        for (const m of candidates) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body },
          );
          if (res.ok) {
            upstream = res;
            break;
          }
          lastStatus = res.status;
          lastBody = await res.text();
          if (res.status !== 404 && res.status !== 403 && res.status !== 400) break;
        }

        if (!upstream) {
          return new Response(lastBody || "Google TTS failed", { status: lastStatus });
        }

        const json = (await upstream.json()) as {
          candidates?: {
            content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
          }[];
        };
        const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        const b64 = part?.inlineData?.data;
        const mime = part?.inlineData?.mimeType ?? "audio/L16;rate=24000";
        if (!b64) {
          return new Response(JSON.stringify(json), { status: 502 });
        }

        // Extract sample rate from mime like "audio/L16;codec=pcm;rate=24000"
        const rateMatch = /rate=(\d+)/.exec(mime);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

        const pcm = Uint8Array.from(Buffer.from(b64, "base64"));
        const wav = pcmToWav(pcm, sampleRate);

        return new Response(new Blob([wav as BlobPart], { type: "audio/wav" }), {
          headers: {
            "Content-Type": "audio/wav",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
