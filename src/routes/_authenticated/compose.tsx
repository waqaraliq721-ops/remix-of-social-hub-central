import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPost } from "@/lib/social.functions";
import { PLATFORMS, type Platform } from "@/lib/platforms";
import { PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, Check, ChevronRight, ImagePlus, Send, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/compose")({ head: () => ({ meta: [{ title: "Compose — Orbit" }] }), component: Compose });

function Compose() {
  const nav = useNavigate();
  const create = useServerFn(createPost);
  const [caption, setCaption] = useState("");
  const [selected, setSelected] = useState<Platform[]>(["instagram", "twitter"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const toggle = (p: Platform) => setSelected((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]);

  async function save(status: "draft" | "scheduled") {
    if (!selected.length) return toast.error("Select at least one platform");
    if (status === "scheduled" && !scheduledAt) return toast.error("Pick a date & time");
    setSaving(true);
    try { await create({ data: { caption: caption.trim(), platforms: selected, status, scheduled_at: status === "scheduled" ? new Date(scheduledAt).toISOString() : null } }); toast.success(status === "draft" ? "Draft saved" : "Post scheduled"); nav({ to: "/dashboard" }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return <div className="page-shell mx-auto max-w-[1400px] p-6 lg:p-8">
    <div className="mb-7 flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => nav({ to: "/dashboard" })}><ArrowLeft className="h-4 w-4" /></Button><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><Sparkles className="h-3.5 w-3.5" /> Publishing</div><h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">Create a post</h1><p className="mt-1 text-sm text-muted-foreground">Build once, then schedule it across your selected channels.</p></div></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="border shadow-none"><CardContent className="p-6 lg:p-7">
        <div className="flex items-center gap-2 border-b pb-5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 text-primary"><Send className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold">Post details</h2><p className="text-xs text-muted-foreground">Choose where and what to publish.</p></div></div>
        <div className="mt-6 space-y-6">
          <div className="space-y-2"><Label>Publish to</Label><div className="grid gap-2 sm:grid-cols-2">{PLATFORMS.map((p) => { const active = selected.includes(p.id); return <button key={p.id} type="button" onClick={() => toggle(p.id)} className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${active ? "border-primary/50 bg-primary/5" : "hover:bg-muted/40"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-md ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}><PlatformIcon platform={p.id} className="h-4 w-4" /></span><span className="flex-1 text-sm font-medium">{p.name}</span>{active && <Check className="h-4 w-4 text-primary" />}</button>; })}</div></div>
          <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="caption">Caption</Label><span className="text-[11px] text-muted-foreground">{caption.length}/2200</span></div><Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write something worth sharing…" rows={10} maxLength={2200} className="resize-none text-[15px] leading-6" /></div>
          <button type="button" className="flex w-full items-center gap-3 rounded-lg border border-dashed p-4 text-left hover:bg-muted/30"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><ImagePlus className="h-4 w-4 text-muted-foreground" /></div><div><p className="text-sm font-medium">Add media</p><p className="text-xs text-muted-foreground">Attach an image or video to your post.</p></div><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></button>
          <div className="space-y-2"><Label htmlFor="when">Schedule</Label><div className="relative"><CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="pl-9" /></div><p className="text-xs text-muted-foreground">Leave the time empty if you only want to save a draft.</p></div>
        </div>
        <div className="mt-7 flex items-center justify-between border-t pt-5"><Button variant="outline" onClick={() => save("draft")} disabled={saving}>Save draft</Button><Button onClick={() => save("scheduled")} disabled={saving}>{saving ? "Saving…" : scheduledAt ? "Schedule post" : "Choose time to schedule"}<ChevronRight className="ml-1.5 h-4 w-4" /></Button></div>
      </CardContent></Card>

      <div className="space-y-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Live preview</h2><p className="text-xs text-muted-foreground">A quick look at your selected channels.</p></div><span className="text-xs text-muted-foreground">{selected.length} selected</span></div>{selected.length === 0 ? <Card className="border shadow-none"><CardContent className="flex min-h-56 items-center justify-center p-6 text-center text-sm text-muted-foreground">Select a platform to preview the post.</CardContent></Card> : selected.map((p) => <Card key={p} className="overflow-hidden border shadow-none"><div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-3"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-background border"><PlatformIcon platform={p} className="h-3.5 w-3.5" /></span><span className="text-xs font-semibold capitalize">{p}</span><span className="ml-auto text-[10px] text-muted-foreground">Preview</span></div><CardContent className="p-4"><div className="mb-3 h-28 rounded-lg bg-muted/50" /><p className="whitespace-pre-wrap text-sm leading-5">{caption || <span className="text-muted-foreground">Your caption will appear here…</span>}</p></CardContent></Card>)}</div>
    </div>
  </div>;
}
