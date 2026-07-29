import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { text, voice = "alloy", model = "openai/gpt-4o-mini-tts" } =
          (await request.json()) as { text: string; voice?: string; model?: string };

        if (!text || !text.trim()) return new Response("Empty text", { status: 400 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            input: text,
            voice,
            response_format: "mp3",
          }),
        });

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
