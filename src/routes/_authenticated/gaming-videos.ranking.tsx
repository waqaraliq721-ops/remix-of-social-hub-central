import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gaming-videos/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — Gaming Videos — Orbit" },
      { name: "description", content: "Build tier list and ranking videos for games, characters and loadouts." },
    ],
  }),
  component: RankingPage,
});

function RankingPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-violet-600/15 via-fuchsia-500/10 to-orange-400/10 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg">
            <Trophy className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Gaming Videos
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Ranking</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Build tier list and ranking videos for games, characters and loadouts.</p>
            <div className="mt-5">
              <Button asChild variant="secondary">
                <Link to="/gaming-videos">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back to Gaming Videos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-2 p-6">
          <p className="text-sm font-medium">Coming soon</p>
          <p className="text-sm text-muted-foreground">
            We're building the Ranking studio next. Let us know what you want to see first.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
