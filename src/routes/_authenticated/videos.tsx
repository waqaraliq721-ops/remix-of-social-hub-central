import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Wand2, Film, Mic, Sparkles, Upload, Clapperboard } from "lucide-react";


export const Route = createFileRoute("/_authenticated/videos")({
  head: () => ({
    meta: [
      { title: "Videos — Orbit" },
      { name: "description", content: "Create videos for every platform — AI generation, editing and repurposing coming soon." },
    ],
  }),
  component: VideosPage,
});

const ideas = [
  { icon: Wand2, title: "AI text-to-video", desc: "Turn a caption or script into a short video clip." },
  { icon: Film, title: "Reels & Shorts editor", desc: "Trim, caption and format for vertical feeds." },
  { icon: Mic, title: "Voiceover & subtitles", desc: "Auto-generate voiceovers and burned-in captions." },
  { icon: Clapperboard, title: "Repurpose long-form", desc: "Slice long videos into platform-ready highlights." },
  { icon: Upload, title: "Bulk upload & schedule", desc: "Queue videos across TikTok, YouTube, Reels and X." },
  { icon: Sparkles, title: "Templates & presets", desc: "Branded intros, outros and motion presets." },
];

function VideosPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-violet-600/15 via-fuchsia-500/10 to-orange-400/10 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg">
            <Video className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              New section
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Create videos, built for social.
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              A dedicated studio inside Orbit for creating, editing and publishing videos across every
              connected platform. Pick the flow you want us to build first — we'll wire it up next.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/images-to-video">
                  <Wand2 className="mr-1 h-4 w-4" /> Images to Video
                </Link>
              </Button>
              <Button variant="outline" disabled>
                <Upload className="mr-1 h-4 w-4" /> Upload footage
              </Button>

            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">What could live here</h2>
        <p className="text-sm text-muted-foreground">
          Sketches of the video tools we can build. Tell me which one to start with.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ideas.map((f) => (
          <Card key={f.title} className="transition hover:border-violet-500/40 hover:shadow-md">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <f.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">{f.title}</CardTitle>
              <CardDescription>{f.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                Coming soon
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-2 p-6">
          <p className="text-sm font-medium">Have a specific video workflow in mind?</p>
          <p className="text-sm text-muted-foreground">
            Let me know what type of video creation you want first — AI generation, uploads, editing,
            captions, repurposing — and I'll build it into this section.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
