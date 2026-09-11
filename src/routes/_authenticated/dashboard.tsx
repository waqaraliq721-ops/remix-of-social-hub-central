import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts, listPosts, listMessages, upsertAccount } from "@/lib/social.functions";
import { PLATFORMS } from "@/lib/platforms";
import { PlatformBadge, PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Send, Clock3, MessageSquare, Plus, ArrowUpRight, Sparkles, Activity, PlugZap, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const QUERY_OPTIONS = { staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

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
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountsFn(), ...QUERY_OPTIONS });
  const posts = useQuery({ queryKey: ["posts"], queryFn: () => postsFn(), ...QUERY_OPTIONS });
  const messages = useQuery({ queryKey: ["messages"], queryFn: () => messagesFn(), ...QUERY_OPTIONS });

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
    <div className="page-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:space-y-7 sm:p-6 lg:p-8 xl:px-10">
      <header className="flex flex-col gap-5 border-b border-border/80 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Workspace overview
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.045em] sm:text-[32px]">Good to see you.</h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-muted-foreground sm:text-sm">Monitor your channels, publishing queue, and audience from one place.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button variant="outline" asChild className="flex-1 sm:flex-none"><Link to="/accounts"><PlugZap className="h-4 w-4" /> Connect channel</Link></Button>
          <Button asChild className="flex-1 sm:flex-none"><Link to="/compose"><Plus className="h-4 w-4" /> Create post</Link></Button>
        </div>
      </header>

      <section className="motion-stagger grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, note }) => (
          <Card key={label} className="premium-card overflow-hidden">
            <CardContent className="p-4.5 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/10 bg-primary/[0.07] text-primary"><Icon className="h-[17px] w-[17px]" /></div>
                <Activity className="h-4 w-4 text-muted-foreground/20" />
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[25px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{value}</p>
                  <p className="mt-2 text-[13px] font-semibold">{label}</p>
                </div>
                <span className="mb-0.5 text-right text-[10px] font-medium leading-4 text-muted-foreground">{note}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card className="premium-card overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
              <div className="min-w-0"><h2 className="text-[13px] font-semibold tracking-[-0.01em]">Connected accounts</h2><p className="mt-1 text-[11px] text-muted-foreground">Your audience footprint by channel.</p></div>
              <Button variant="ghost" size="sm" asChild><Link to="/accounts">Manage <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" /></Link></Button>
            </div>
            {accounts.isLoading ? <p className="px-5 py-12 text-sm text-muted-foreground sm:px-6">Loading accounts…</p> : (accounts.data ?? []).length === 0 ? (
              <div className="px-5 py-12 sm:px-6 sm:py-14">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/45"><Users className="h-4.5 w-4.5 text-muted-foreground" /></div>
                <p className="mt-4 text-sm font-semibold">No accounts connected</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Connect a channel to start building your workspace and tracking its audience.</p>
                <Button variant="outline" size="sm" asChild className="mt-4"><Link to="/accounts">Connect an account <ChevronRight className="ml-0.5 h-3.5 w-3.5" /></Link></Button>
              </div>
            ) : (
              <div className="divide-y divide-border/70">{(accounts.data ?? []).map((a) => <div key={a.id} className="premium-row flex min-w-0 items-center gap-3 px-5 py-3.5 sm:px-6"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/25"><PlatformIcon platform={a.platform} className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.display_name ?? a.handle}</p><p className="truncate text-[11px] text-muted-foreground">{a.handle}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold tabular-nums">{a.followers.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">followers</p></div></div>)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="premium-card overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
              <div className="min-w-0"><h2 className="text-[13px] font-semibold tracking-[-0.01em]">Recent posts</h2><p className="mt-1 text-[11px] text-muted-foreground">Latest publishing activity.</p></div>
              <Button variant="ghost" size="sm" asChild><Link to="/calendar">Calendar <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" /></Link></Button>
            </div>
            {(posts.data ?? []).length === 0 ? <div className="px-5 py-12 sm:px-6"><div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/45"><Send className="h-4 w-4 text-muted-foreground" /></div><p className="mt-4 text-sm font-semibold">Your publishing queue is clear</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Create a post and it will appear here with its publishing status.</p><Button variant="link" asChild className="mt-2 h-auto px-0"><Link to="/compose">Create your first post <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button></div> : <ul className="divide-y divide-border/70">{(posts.data ?? []).slice(0, 6).map((p) => <li key={p.id} className="premium-row px-5 py-3.5 sm:px-6"><div className="flex items-start justify-between gap-2.5"><p className="line-clamp-2 min-w-0 text-sm leading-5">{p.caption || <span className="italic text-muted-foreground">Empty caption</span>}</p><span className="shrink-0 rounded-md border bg-muted/35 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{p.status}</span></div><div className="mt-2 flex flex-wrap gap-1.5">{p.platforms.map((pl) => <PlatformBadge key={pl} platform={pl} />)}</div></li>)}</ul>}
          </CardContent>
        </Card>
      </div>

      <Card className="premium-card overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div><h2 className="text-[13px] font-semibold tracking-[-0.01em]">Channel coverage</h2><p className="mt-1 text-[11px] text-muted-foreground">Platforms available in your workspace.</p></div>
            <span className="shrink-0 rounded-full border border-border bg-muted/35 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{PLATFORMS.length} channels</span>
          </div>
          <div className="border-t border-border/70 p-3 sm:p-4"><div className="motion-stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{PLATFORMS.map((p) => <Link key={p.id} to="/accounts" className="group flex min-w-0 items-center gap-3 rounded-lg border border-border/80 bg-background/45 px-3 py-3 hover:border-primary/20 hover:bg-primary/[0.025]"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/55"><PlatformIcon platform={p.id} className="h-3.5 w-3.5" /></div><span className="truncate text-[12px] font-medium">{p.name}</span><ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/45 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" /></Link>)}</div></div>
        </CardContent>
      </Card>
    </div>
  );
}
