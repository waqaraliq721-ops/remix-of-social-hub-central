import { createFileRoute } from "@tanstack/react-router";
import { TikTokStudio } from "@/components/tiktok-studio";

export const Route = createFileRoute("/_authenticated/tiktok-videos/facts")({
  head: () => ({
    meta: [
      { title: "TikTok Fact Videos — Orbit" },
      { name: "description", content: "Make punchy vertical fact videos with hooks, reveals and AI voiceover — locked to 1080x1920 at 60fps." },
      { property: "og:title", content: "TikTok Fact Videos — Orbit" },
      { property: "og:description", content: "Make punchy vertical fact videos with hooks, reveals and AI voiceover — locked to 1080x1920 at 60fps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <TikTokStudio kind="facts" />,
});
