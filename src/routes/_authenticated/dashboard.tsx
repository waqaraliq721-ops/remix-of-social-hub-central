import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts, listPosts, listMessages, upsertAccount } from "@/lib/social.functions";
import { PLATFORMS } from "@/lib/platforms";
import { PlatformBadge, PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Send, TrendingUp, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Orbit" }] }),
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const accountsFn = useServerFn(listAccounts);
  const postsFn = useServerFn(listPosts);
  const messagesFn = useServerFn(listMessages);
  const upsertFn = useServerFn(upsertAccount);

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountsFn() });
  const posts = useQuery({ queryKey: ["posts"], queryFn: () => postsFn() });
  const messages = useQuery({ queryKey: ["messages"], queryFn: () => messagesFn() });

  const totalFollowers = (accounts.data ?? []).reduce((s, a) => s + (a.followers ?? 0), 0);
  const scheduled = (posts.data ?? []).filter((p) => p.status === "scheduled").length;
  const published = (posts.data ?? []).filter((p) => p.status === "published").length;
  const unread = (messages.data ?? []).filter((m) => !m.read).length;

  async function seedDemo() {
    const demo = [
      { platform: "instagram", handle: "@your.brand", followers: 12400 },
      { platform: "tiktok", handle: "@yourbrand", followers: 8320 },
      { platform: "twitter", handle: "@yourbrand", followers: 4210 },
      { platform: "facebook", handle: "Your Brand", followers: 2130 },
      { platform: "youtube", handle: "Your Brand", followers: 970 },
    ] as const;
    for (const d of demo) await upsertFn({ data: d });
    toast.success("Demo accounts added");
    router.invalidate();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">A pulse check across every channel.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={seedDemo}>Add demo data</Button>
          <Button asChild>
            <Link to="/compose">
              <Plus className="mr-1 h-4 w-4" /> New post
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total followers" value={totalFollowers.toLocaleString()} icon={Users} accent="from-violet-500 to-fuchsia-500" />
        <StatCard label="Published" value={String(published)} icon={Send} accent="from-emerald-500 to-teal-500" />
        <StatCard label="Scheduled" value={String(scheduled)} icon={Clock} accent="from-amber-500 to-orange-500" />
        <StatCard label="Unread messages" value={String(unread)} icon={TrendingUp} accent="from-sky-500 to-indigo-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Connected accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (accounts.data ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">No accounts yet.</p>
                <Button variant="link" asChild><Link to="/accounts">Connect an account</Link></Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(accounts.data ?? []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border bg-card/40 p-3">
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={a.platform} className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">{a.display_name ?? a.handle}</p>
                        <p className="text-xs text-muted-foreground">{a.handle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{a.followers.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">followers</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platforms</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <PlatformBadge key={p.id} platform={p.id} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent posts</CardTitle>
        </CardHeader>
        <CardContent>
          {(posts.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet. <Link to="/compose" className="underline">Compose your first</Link>.</p>
          ) : (
            <ul className="divide-y">
              {(posts.data ?? []).slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.caption || <span className="text-muted-foreground italic">Empty caption</span>}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {p.platforms.map((pl) => <PlatformBadge key={pl} platform={pl} />)}
                    </div>
                  </div>
                  <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
