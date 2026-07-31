import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, Trophy, Newspaper, Laugh } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gaming-videos/")({
  head: () => ({
    meta: [
      { title: "Gaming Videos — Orbit" },
      { name: "description", content: "Create gaming content — rankings, news and memes for every platform." },
    ],
  }),
  component: GamingVideosPage,
});

const sections = [
  { icon: Trophy, title: "Ranking", desc: "Build animated tier-list and top-N ranking videos with drag-in entries, reveal counters and podium finishes.", to: "/gaming-videos/ranking" as const },
  { icon: Newspaper, title: "News", desc: "Broadcast-style news recap videos with anchor-desk layouts, lower-third headlines and ticker updates.", to: "/gaming-videos/news" as const },
  { icon: Laugh, title: "Memes", desc: "Auto-timed meme compilation reels stitching clips, captions and stinger transitions with a beat-synced soundtrack.", to: "/gaming-videos/memes" as const },
];

function GamingVideosPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-violet-600/15 via-fuchsia-500/10 to-orange-400/10 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg">
            <Gamepad2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              New section
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Gaming videos, built for social.
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              A dedicated studio inside Orbit for creating gaming content — rankings, news and memes.
              Pick the flow you want us to build first — we'll wire it up next.
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
          <Card key={s.title} className="transition hover:border-violet-500/40 hover:shadow-md">
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
