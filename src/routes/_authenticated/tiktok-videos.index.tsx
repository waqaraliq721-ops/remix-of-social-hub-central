import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music2, HelpCircle, ListOrdered, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tiktok-videos/")({
  head: () => ({
    meta: [
      { title: "TikTok Videos — Orbit" },
      {
        name: "description",
        content:
          "Build TikTok-ready vertical videos — Would You Rather, Ranking countdowns and Fact videos — locked to 9:16, 1080x1920, 60fps, with AI voiceover and music.",
      },
      { property: "og:title", content: "TikTok Videos — Orbit" },
      {
        property: "og:description",
        content: "A dedicated studio for 9:16 TikTok content: WYR, rankings and fact videos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TikTokVideosPage,
});

const sections = [
  {
    icon: HelpCircle,
    title: "Would You Rather",
    desc: "Vertical split-screen would-you-rather rounds with AI voiceover and countdowns, built for TikTok.",
    to: "/tiktok-videos/wyr" as const,
  },
  {
    icon: ListOrdered,
    title: "Ranking Videos",
    desc: "Top-5 style countdown reveals with images, scores and animated rank cards.",
    to: "/tiktok-videos/ranking" as const,
  },
  {
    icon: Lightbulb,
    title: "Fact Videos",
    desc: "Hook, body and punchline fact cards with animated reveals — perfect for TikTok fact pages.",
    to: "/tiktok-videos/facts" as const,
  },
];

function TikTokVideosPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-pink-600/15 via-fuchsia-500/10 to-cyan-400/10 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-cyan-500 text-white shadow-lg">
            <Music2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
              New section
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              TikTok videos, locked to 9:16.
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              A dedicated studio for vertical TikTok content — always 1080×1920 at 60fps, no other
              aspect ratios. Pick a template to open its studio.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {sections.map((s) => (
                <Button key={s.title} asChild variant="secondary">
                  <Link to={s.to}>
                    <s.icon className="mr-1 h-4 w-4" /> {s.title}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Card key={s.title} className="transition hover:border-pink-500/40 hover:shadow-md">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <s.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">{s.title}</CardTitle>
              <CardDescription>{s.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline">
                <Link to={s.to}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
