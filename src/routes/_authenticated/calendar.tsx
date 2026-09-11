import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listPosts, deletePost } from "@/lib/social.functions";
import { PlatformBadge } from "@/components/platform-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2, Plus, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({ head: () => ({ meta: [{ title: "Calendar — Orbit" }] }), component: CalendarPage });

function CalendarPage() {
  const postsFn = useServerFn(listPosts); const delFn = useServerFn(deletePost);
  const posts = useQuery({ queryKey: ["posts"], queryFn: () => postsFn() });
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const days = useMemo(() => { const first = new Date(month); const start = first.getDay(); const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); const cells: (Date | null)[] = Array(start).fill(null); for (let d=1; d<=count; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d)); while (cells.length % 7) cells.push(null); return cells; }, [month]);
  const byDay = useMemo(() => { const m = new Map<string, typeof posts.data>(); (posts.data ?? []).forEach(p => { if (!p.scheduled_at) return; const key = new Date(p.scheduled_at).toDateString(); const arr = m.get(key) ?? []; arr.push(p); m.set(key, arr); }); return m; }, [posts.data]);
  const scheduled = (posts.data ?? []).filter(p => p.status === "scheduled");
  async function remove(id: string) { await delFn({ data: { id } }); toast.success("Post removed"); posts.refetch(); }
  const today = new Date();

  return <div className="page-shell mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><CalendarDays className="h-3.5 w-3.5" /> Content planning</div><h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">Calendar</h1><p className="mt-1 text-sm text-muted-foreground">Plan and review everything scheduled to go live.</p></div><Button asChild><Link to="/compose"><Plus className="mr-1.5 h-4 w-4" /> New post</Link></Button></header>
    <Card className="border shadow-none"><CardContent className="p-4 lg:p-6"><div className="flex items-center justify-between border-b pb-4"><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}><ChevronRight className="h-4 w-4" /></Button><h2 className="ml-2 text-sm font-semibold">{month.toLocaleString(undefined,{month:"long",year:"numeric"})}</h2></div><span className="text-xs text-muted-foreground">{scheduled.length} scheduled</span></div>
      <div className="mt-4 grid grid-cols-7 border-l border-t">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="border-b border-r bg-muted/30 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>)}{days.map((d,i)=><div key={i} className={`min-h-28 border-b border-r p-2 ${d ? "bg-card" : "bg-muted/10"}`}>{d && <><div className={`mb-2 flex h-6 w-6 items-center justify-center rounded-full text-xs ${d.toDateString()===today.toDateString()?"bg-primary font-semibold text-primary-foreground":"text-muted-foreground"}`}>{d.getDate()}</div><div className="space-y-1">{(byDay.get(d.toDateString())??[]).slice(0,3).map(p=><div key={p.id} className="truncate rounded-md border bg-muted/30 px-2 py-1.5 text-[11px] font-medium" title={p.caption}>{p.caption?.slice(0,28)||"Untitled post"}</div>)}{(byDay.get(d.toDateString())??[]).length>3&&<p className="text-[10px] text-muted-foreground">+{(byDay.get(d.toDateString())??[]).length-3} more</p>}</div></>}</div>)}</div>
    </CardContent></Card>
    <Card className="border shadow-none"><CardContent className="p-6"><div className="mb-4"><h2 className="font-semibold">Upcoming posts</h2><p className="mt-1 text-xs text-muted-foreground">Your next scheduled publishing slots.</p></div>{scheduled.length===0?<div className="rounded-lg border border-dashed py-10 text-center"><p className="text-sm font-medium">Your queue is empty</p><p className="mt-1 text-xs text-muted-foreground">Create a post and choose a publishing time.</p><Button variant="link" asChild><Link to="/compose">Create a scheduled post</Link></Button></div>:<ul className="divide-y">{scheduled.map(p=><li key={p.id} className="flex items-center gap-4 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.caption||"Empty caption"}</p><div className="mt-2 flex flex-wrap gap-1.5">{p.platforms.map(pl=><PlatformBadge key={pl} platform={pl}/>)}</div><p className="mt-2 text-xs text-muted-foreground">{p.scheduled_at&&new Date(p.scheduled_at).toLocaleString()}</p></div><Button variant="ghost" size="icon" onClick={()=>remove(p.id)} title="Remove"><Trash2 className="h-4 w-4 text-muted-foreground"/></Button></li>)}</ul>}</CardContent></Card>
  </div>;
}
