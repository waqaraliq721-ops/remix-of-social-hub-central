import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts-elevenlabs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return new Response("ElevenLabs is not connected", { status: 500 });

        const { text, voiceId = "EXAVITQu4vr4xnSDxMaL", modelId = "eleven_multilingual_v2" } =
          (await request.json()) as { text: string; voiceId?: string; modelId?: string };

        if (!text || !text.trim()) return new Response("Empty text", { status: 400 });

        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text,
              model_id: modelId,
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.3,
                use_speaker_boost: true,
              },
            }),
          },
        );

        if (!upstream.ok) {
          const body = await upstream.text();
          return new Response(body, { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
