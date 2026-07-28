import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listPosts, deletePost } from "@/lib/social.functions";
import { PlatformBadge } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Orbit" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const postsFn = useServerFn(listPosts);
  const delFn = useServerFn(deletePost);
  const posts = useQuery({ queryKey: ["posts"], queryFn: () => postsFn() });
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const days = useMemo(() => {
    const first = new Date(month);
    const startDay = first.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    return cells;
  }, [month]);

  const byDay = useMemo(() => {
    const m = new Map<string, typeof posts.data>();
    (posts.data ?? []).forEach((p) => {
      if (!p.scheduled_at) return;
      const key = new Date(p.scheduled_at).toDateString();
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    });
    return m;
  }, [posts.data]);

  const scheduled = (posts.data ?? []).filter((p) => p.status === "scheduled");

  async function remove(id: string) {
    await delFn({ data: { id } });
    toast.success("Post removed");
    posts.refetch();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">All scheduled posts at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-40 text-center text-sm font-medium">
            {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-2">
            {days.map((d, i) => (
              <div key={i} className={`min-h-24 rounded-lg border p-2 ${d ? "bg-card" : "bg-transparent border-transparent"}`}>
                {d && (
                  <>
                    <div className="mb-1 text-xs text-muted-foreground">{d.getDate()}</div>
                    <div className="space-y-1">
                      {(byDay.get(d.toDateString()) ?? []).map((p) => (
                        <div key={p.id} className="truncate rounded bg-violet-500/10 px-1.5 py-0.5 text-xs">
                          {p.caption.slice(0, 24) || "Post"}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming scheduled</CardTitle>
        </CardHeader>
        <CardContent>
          {scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
          ) : (
            <ul className="divide-y">
              {scheduled.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.caption || "Empty caption"}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {p.platforms.map((pl) => <PlatformBadge key={pl} platform={pl} />)}
                    </div>
                    {p.scheduled_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(p.scheduled_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
