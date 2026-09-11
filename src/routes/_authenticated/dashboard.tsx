import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts, listPosts, listMessages, upsertAccount } from "@/lib/social.functions";
import { PLATFORMS } from "@/lib/platforms";
import { PlatformBadge, PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Send, Clock3, MessageSquare, Plus, ArrowUpRight, Sparkles, Activity } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Overview — Orbit" }] }),
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

  const stats = [
    { label: "Audience", value: totalFollowers.toLocaleString(), icon: Users, note: "across connected channels" },
    { label: "Published", value: String(published), icon: Send, note: "posts published" },
    { label: "Scheduled", value: String(scheduled), icon: Clock3, note: "posts in queue" },
    { label: "Inbox", value: String(unread), icon: MessageSquare, note: "unread messages" },
  ];

  return (
    <div className="page-shell mx-auto max-w-[1400px] space-y-7 p-6 lg:p-8">
      <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Social command center
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Overview</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">A clear view of what is happening across your social channels.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={seedDemo} className="hidden sm:flex">Add demo data</Button>
          <Button asChild className="shadow-sm"><Link to="/compose"><Plus className="mr-1.5 h-4 w-4" /> Create post</Link></Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, note }) => (
          <Card key={label} className="border bg-card shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/8 text-primary"><Icon className="h-[17px] w-[17px]" /></div>
                <Activity className="h-4 w-4 text-muted-foreground/30" />
              </div>
              <p className="mt-5 text-2xl font-semibold tracking-tight">{value}</p>
              <p className="mt-1 text-sm font-medium">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border bg-card shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div><h2 className="font-semibold">Connected accounts</h2><p className="mt-1 text-xs text-muted-foreground">Your audience footprint by channel.</p></div>
              <Button variant="ghost" size="sm" asChild><Link to="/accounts">Manage <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
            </div>
            {accounts.isLoading ? <p className="py-10 text-sm text-muted-foreground">Loading accounts…</p> : (accounts.data ?? []).length === 0 ? (
              <div className="py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted"><Users className="h-5 w-5 text-muted-foreground" /></div><p className="mt-3 text-sm font-medium">No accounts connected</p><p className="mt-1 text-xs text-muted-foreground">Connect a channel to start building your workspace.</p><Button variant="link" asChild className="mt-1"><Link to="/accounts">Connect an account</Link></Button></div>
            ) : (
              <div className="divide-y">{(accounts.data ?? []).map((a) => <div key={a.id} className="flex items-center gap-3 py-3.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted/30"><PlatformIcon platform={a.platform} className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.display_name ?? a.handle}</p><p className="text-xs text-muted-foreground">{a.handle}</p></div><div className="text-right"><p className="text-sm font-semibold">{a.followers.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">followers</p></div></div>)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between border-b pb-4"><div><h2 className="font-semibold">Recent posts</h2><p className="mt-1 text-xs text-muted-foreground">Latest publishing activity.</p></div><Button variant="ghost" size="sm" asChild><Link to="/calendar">Calendar <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button></div>
            {(posts.data ?? []).length === 0 ? <p className="py-10 text-sm text-muted-foreground">Nothing here yet. <Link to="/compose" className="font-medium text-foreground underline underline-offset-4">Create your first post</Link>.</p> : <ul className="divide-y">{(posts.data ?? []).slice(0, 6).map((p) => <li key={p.id} className="py-3.5"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm leading-5">{p.caption || <span className="italic text-muted-foreground">Empty caption</span>}</p><span className="shrink-0 rounded-md border bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{p.status}</span></div><div className="mt-2 flex flex-wrap gap-1.5">{p.platforms.map((pl) => <PlatformBadge key={pl} platform={pl} />)}</div></li>)}</ul>}
          </CardContent>
        </Card>
      </div>

      <Card className="border bg-card shadow-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold">Channel coverage</h2><p className="mt-1 text-xs text-muted-foreground">Platforms available in your workspace.</p></div><span className="text-xs text-muted-foreground">{PLATFORMS.length} channels</span></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{PLATFORMS.map((p) => <Link key={p.id} to="/accounts" className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"><PlatformIcon platform={p.id} className="h-4 w-4" /><span className="text-sm font-medium">{p.name}</span><ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" /></Link>)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
