import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts, listAnalytics } from "@/lib/social.functions";
import { PLATFORM_MAP, type Platform } from "@/lib/platforms";
import { PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Orbit" }] }),
  component: Analytics,
});

function Analytics() {
  const accountsFn = useServerFn(listAccounts);
  const analyticsFn = useServerFn(listAnalytics);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountsFn() });
  const snapshots = useQuery({ queryKey: ["analytics"], queryFn: () => analyticsFn() });

  const chartData = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    (snapshots.data ?? []).forEach((s) => {
      const row = map.get(s.snapshot_date) ?? { date: s.snapshot_date };
      row[s.platform] = s.followers;
      map.set(s.snapshot_date, row);
    });
    return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [snapshots.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Followers, reach and engagement, side by side.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Followers over time</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No analytics snapshots yet. Once connected, daily snapshots will appear here.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                {(Object.keys(PLATFORM_MAP) as Platform[]).map((p) => (
                  <Line key={p} type="monotone" dataKey={p} stroke={PLATFORM_MAP[p].color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

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
