import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Baby, HelpCircle, Smile, Calculator, Shapes, Flag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kid-videos/")({
  head: () => ({
    meta: [
      { title: "Kid Videos — Orbit" },
      { name: "description", content: "Create fun, family-friendly videos — Would You Rather and Guess the Emoji." },
    ],
  }),
  component: KidVideosPage,
});

const sections = [
  { icon: HelpCircle, title: "Would You Rather", desc: "Split-screen would-you-rather videos with AI voiceover and countdown timers.", to: "/kid-videos/wyr" as const },
  { icon: Smile, title: "Guess the Emoji", desc: "Fun emoji-guessing game videos for kids and families.", to: "/kid-videos/emoji" as const },
  { icon: Calculator, title: "Math Quiz", desc: "Fast-paced math problem videos with countdown timers and animated reveals.", to: "/kid-videos/math" as const },
  { icon: Shapes, title: "Guess The Logo", desc: "Blurred-logo guessing game videos with reveal animations for brand trivia fun.", to: "/kid-videos/logo" as const },
  { icon: Flag, title: "Guess The Country By The Flag", desc: "Flag guessing game videos with difficulty levels, hints and animated reveals.", to: "/kid-videos/flag" as const },
];

function KidVideosPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-violet-600/15 via-fuchsia-500/10 to-orange-400/10 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg">
            <Baby className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              New section
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Kid videos, built for social.
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              A dedicated studio inside Orbit for creating fun, family-friendly video games and content.
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
