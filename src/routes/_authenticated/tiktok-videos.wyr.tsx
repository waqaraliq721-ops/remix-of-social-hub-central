import { createFileRoute } from "@tanstack/react-router";
import { TikTokStudio } from "@/components/tiktok-studio";

export const Route = createFileRoute("/_authenticated/tiktok-videos/wyr")({
  head: () => ({
    meta: [
      { title: "TikTok Would You Rather — Orbit" },
      { name: "description", content: "Build 9:16 would-you-rather TikToks with countdowns, percentage reveals, voiceover and music — always 1080x1920 at 60fps." },
      { property: "og:title", content: "TikTok Would You Rather — Orbit" },
      { property: "og:description", content: "Build 9:16 would-you-rather TikToks with countdowns, percentage reveals, voiceover and music — always 1080x1920 at 60fps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <TikTokStudio kind="wyr" />,
});
