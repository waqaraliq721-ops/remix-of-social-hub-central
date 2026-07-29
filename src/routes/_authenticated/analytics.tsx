import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts, listAnalytics, listPostTargets } from "@/lib/social.functions";
import { PLATFORMS, PLATFORM_MAP, type Platform } from "@/lib/platforms";
import { PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useMemo, useState } from "react";
import { DeliveryStatusBadge } from "@/components/delivery-status";

type Metric = "followers" | "impressions" | "engagement";
const METRIC_LABEL: Record<Metric, string> = {
  followers: "Follower changes",
  impressions: "Reach (impressions)",
  engagement: "Engagement",
};

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Orbit" }] }),
  component: Analytics,
});

function Analytics() {
  const accountsFn = useServerFn(listAccounts);
  const analyticsFn = useServerFn(listAnalytics);
  const targetsFn = useServerFn(listPostTargets);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountsFn() });
  const snapshots = useQuery({ queryKey: ["analytics"], queryFn: () => analyticsFn() });
  const targets = useQuery({ queryKey: ["post-targets"], queryFn: () => targetsFn() });

  const [metric, setMetric] = useState<Metric>("followers");
  const [active, setActive] = useState<Set<Platform>>(() => new Set(PLATFORMS.map((p) => p.id)));

  function toggle(p: Platform) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  const chartData = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    (snapshots.data ?? []).forEach((s) => {
      const row = map.get(s.snapshot_date) ?? { date: s.snapshot_date };
      row[s.platform] = (s as Record<string, unknown>)[metric] as number;
      map.set(s.snapshot_date, row);
    });
    return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [snapshots.data, metric]);

  const followerDelta = useMemo(() => {
    // per-platform: latest - earliest (in current window)
    const byP = new Map<Platform, { first: number; last: number }>();
    const sorted = [...(snapshots.data ?? [])].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    sorted.forEach((s) => {
      const cur = byP.get(s.platform);
      if (!cur) byP.set(s.platform, { first: s.followers, last: s.followers });
      else byP.set(s.platform, { first: cur.first, last: s.followers });
    });
    return PLATFORMS.map((p) => {
      const v = byP.get(p.id);
      return { platform: p.id, delta: v ? v.last - v.first : 0 };
    });
  }, [snapshots.data]);

  const deliveryCounts = useMemo(() => {
    const counts = { queued: 0, sent: 0, failed: 0 };
    (targets.data ?? []).forEach((t) => {
      if (t.status === "pending" || t.status === "publishing") counts.queued++;
      else if (t.status === "published") counts.sent++;
      else if (t.status === "failed") counts.failed++;
    });
    return counts;
  }, [targets.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Followers, reach and engagement per platform, over time.</p>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{METRIC_LABEL[metric]}</CardTitle>
            <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <TabsList>
                <TabsTrigger value="followers">Followers</TabsTrigger>
                <TabsTrigger value="impressions">Reach</TabsTrigger>
                <TabsTrigger value="engagement">Engagement</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const on = active.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
                  style={{
                    borderColor: on ? p.color : "hsl(var(--border))",
                    backgroundColor: on ? `${p.color}18` : "transparent",
                    color: on ? p.color : "hsl(var(--muted-foreground))",
                  }}
                >
                  <PlatformIcon platform={p.id} className="h-3 w-3" />
                  {p.name}
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="h-80">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No analytics snapshots yet. Once connected, daily snapshots will appear here.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  {PLATFORMS.map((p) => (
                    <linearGradient key={p.id} id={`g-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={p.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={p.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                {PLATFORMS.filter((p) => active.has(p.id)).map((p) => (
                  <Area
                    key={p.id}
                    type="monotone"
                    dataKey={p.id}
                    name={p.name}
                    stroke={p.color}
                    fill={`url(#g-${p.id})`}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Follower change per platform</CardTitle>
            <CardDescription>Net change across the current window.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={followerDelta}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="platform" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="delta" radius={[6, 6, 0, 0]}>
                  {followerDelta.map((d) => (
                    <Cell key={d.platform} fill={PLATFORM_MAP[d.platform as Platform].color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery status</CardTitle>
            <CardDescription>Per-post delivery across connected platforms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatMini label="Queued" value={deliveryCounts.queued} tone="amber" />
              <StatMini label="Sent" value={deliveryCounts.sent} tone="emerald" />
              <StatMini label="Failed" value={deliveryCounts.failed} tone="rose" />
            </div>
            {(targets.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No deliveries yet. Schedule a post to see it here.</p>
            ) : (
              <ul className="divide-y">
                {(targets.data ?? []).slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <PlatformIcon platform={t.platform} />
                      <span className="truncate text-sm">
                        {(t as unknown as { posts?: { caption?: string } }).posts?.caption?.slice(0, 60) || "Post"}
                      </span>
                    </div>
                    <DeliveryStatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(accounts.data ?? []).map((a) => (
          <Card key={a.id}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2">
                <PlatformIcon platform={a.platform} />
                <span className="text-sm font-medium">{a.display_name ?? a.handle}</span>
              </div>
              <p className="text-3xl font-semibold">{a.followers.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">followers</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatMini({ label, value, tone }: { label: string; value: number; tone: "amber" | "emerald" | "rose" }) {
  const cls = {
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    rose: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  }[tone];
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
