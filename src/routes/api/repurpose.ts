import { createFileRoute } from "@tanstack/react-router";

type Clip = {
  title: string;
  hook: string;
  start: number;
  end: number;
  summary: string;
  score: number;
  keywords: string[];
};

const SCHEMA_HINT = `Return ONLY JSON of the shape:
{"clips":[{"title":"short punchy title","hook":"first line that hooks in <12 words","start":12.5,"end":58.2,"summary":"what this clip covers","score":83,"keywords":["a","b"]}]}`;

const SYSTEM = `You are a world-class short-form video editor. You turn long-form content into
standalone short clips (20-90 seconds) for TikTok, Reels and Shorts.

Rules:
- Every clip MUST be self-contained: it starts at a natural sentence boundary, sets up its
  own context, delivers one complete idea, and ends on a satisfying beat or punchline.
- Never cut mid-sentence. Prefer starting on a hook, question, or bold claim.
- Produce as MANY complete clips as the material genuinely supports (aim 5-15), ordered by
  virality score (0-100) descending. Do not invent content that is not in the source.
- Timestamps are seconds from the start of the source, with one decimal.`;

const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];

async function callGemini(key: string, parts: unknown[]) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
  });
  let lastErr = "";
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
    );
    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    }
    lastErr = `Gemini ${model} [${res.status}]: ${await res.text()}`;
    if (res.status !== 404 && res.status !== 403 && res.status !== 400) break;
  }
  throw new Error(lastErr || "Gemini request failed");
}

async function callLovable(key: string, prompt: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Lovable AI [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseClips(raw: string): Clip[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let parsed: { clips?: Partial<Clip>[] } = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        return [];
      }
    }
  }
  return (parsed.clips ?? [])
    .map((c) => ({
      title: String(c.title ?? "Untitled clip"),
      hook: String(c.hook ?? ""),
      start: Math.max(0, Number(c.start) || 0),
      end: Math.max(0, Number(c.end) || 0),
      summary: String(c.summary ?? ""),
      score: Math.max(0, Math.min(100, Math.round(Number(c.score) || 50))),
      keywords: Array.isArray(c.keywords) ? c.keywords.map(String).slice(0, 6) : [],
    }))
    .filter((c) => c.end > c.start + 3)
    .sort((a, b) => b.score - a.score);
}

export const Route = createFileRoute("/api/repurpose")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          youtubeUrl?: string;
          transcript?: string;
          minLen?: number;
          maxLen?: number;
          notes?: string;
          provider?: "google" | "lovable";
        };
        const minLen = body.minLen ?? 20;
        const maxLen = body.maxLen ?? 90;
        const brief =
          `Target clip length: ${minLen}-${maxLen} seconds. ` +
          (body.notes ? `Creator notes: ${body.notes}. ` : "") +
          SCHEMA_HINT;

        const googleKey = process.env.GEMINI_API_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        const prefersGoogle = body.provider !== "lovable";

        try {
          if (body.youtubeUrl) {
            if (!googleKey) {
              return Response.json(
                {
                  error:
                    "Analyzing a YouTube link needs the Google AI Studio key. Upload the video file instead, or add GEMINI_API_KEY.",
                },
                { status: 400 },
              );
            }
            const raw = await callGemini(googleKey, [
              { fileData: { fileUri: body.youtubeUrl } },
              {
                text:
                  "Watch this full video, build a mental transcript with timings, then cut it into complete short clips. " +
                  brief,
              },
            ]);
            return Response.json({ provider: "google", clips: parseClips(raw) });
          }

          const transcript = (body.transcript ?? "").trim();
          if (!transcript) {
            return Response.json({ error: "Provide a YouTube link or a transcript" }, { status: 400 });
          }
          const prompt = `Here is a timestamped transcript of a long-form video. Cut it into complete short clips.\n\n${brief}\n\nTRANSCRIPT:\n${transcript.slice(0, 120000)}`;

          if (prefersGoogle && googleKey) {
            const raw = await callGemini(googleKey, [{ text: prompt }]);
            return Response.json({ provider: "google", clips: parseClips(raw) });
          }
          if (lovableKey) {
            const raw = await callLovable(lovableKey, prompt);
            return Response.json({ provider: "lovable", clips: parseClips(raw) });
          }
          if (googleKey) {
            const raw = await callGemini(googleKey, [{ text: prompt }]);
            return Response.json({ provider: "google", clips: parseClips(raw) });
          }
          return Response.json({ error: "No AI provider configured" }, { status: 500 });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`Repurpose failed: ${msg}`);
          return Response.json({ error: msg }, { status: 502 });
        }
      },
    },
  },
});
