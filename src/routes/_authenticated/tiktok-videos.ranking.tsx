import { createFileRoute } from "@tanstack/react-router";
import { TikTokStudio } from "@/components/tiktok-studio";

export const Route = createFileRoute("/_authenticated/tiktok-videos/ranking")({
  head: () => ({
    meta: [
      { title: "TikTok Ranking Videos — Orbit" },
      { name: "description", content: "Create vertical ranking countdowns with images, scores and animated rank cards — locked to 1080x1920 at 60fps." },
      { property: "og:title", content: "TikTok Ranking Videos — Orbit" },
      { property: "og:description", content: "Create vertical ranking countdowns with images, scores and animated rank cards — locked to 1080x1920 at 60fps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <TikTokStudio kind="ranking" />,
});
