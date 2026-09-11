import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, CalendarDays, BarChart3, Inbox, PenSquare, Facebook, Instagram, Youtube, Twitter, Music2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orbit — Manage every social channel in one place" },
      {
        name: "description",
        content:
          "Orbit is the calm control room for Facebook, Instagram, TikTok, YouTube and X — compose, schedule, analyze and reply across every platform from one workspace.",
      },
      { property: "og:title", content: "Orbit — Manage every social channel in one place" },
      { property: "og:description", content: "Orbit is the calm control room for Facebook, Instagram, TikTok, YouTube and X — compose, schedule, analyze and reply across every platform from one workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Orbit</span>
        </div>
        <Button asChild size="sm">
          <Link to="/dashboard">Open dashboard</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            One workspace, every platform
          </div>
          <h1 className="mx-auto max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
            The calm control room for your <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent">social channels</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Compose once, publish everywhere. Track what's working. Reply from a single inbox.
            Orbit brings Facebook, Instagram, TikTok, YouTube and X together — without the chaos.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <Button asChild size="lg">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          </div>
          <div className="mt-12 flex items-center justify-center gap-6 text-muted-foreground">
            <Facebook className="h-5 w-5" />
            <Instagram className="h-5 w-5" />
            <Music2 className="h-5 w-5" />
            <Youtube className="h-5 w-5" />
            <Twitter className="h-5 w-5" />
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: PenSquare, title: "Compose", desc: "Draft once, tailor per platform, preview before publish." },
            { icon: CalendarDays, title: "Schedule", desc: "See every planned post on one calendar." },
            { icon: BarChart3, title: "Analyze", desc: "Followers, reach and engagement side by side." },
            { icon: Inbox, title: "Unified inbox", desc: "Comments, mentions and DMs in one queue." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
