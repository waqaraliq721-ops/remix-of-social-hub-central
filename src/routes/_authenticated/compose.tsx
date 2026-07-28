import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPost } from "@/lib/social.functions";
import { PLATFORMS, type Platform } from "@/lib/platforms";
import { PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compose")({
  head: () => ({ meta: [{ title: "Compose — Orbit" }] }),
  component: Compose,
});

function Compose() {
  const nav = useNavigate();
  const create = useServerFn(createPost);
  const [caption, setCaption] = useState("");
  const [selected, setSelected] = useState<Platform[]>(["instagram", "twitter"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(p: Platform) {
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  }

  async function save(status: "draft" | "scheduled") {
    if (selected.length === 0) return toast.error("Select at least one platform");
    if (status === "scheduled" && !scheduledAt) return toast.error("Pick a date & time");
    setSaving(true);
    try {
      await create({
        data: {
          caption: caption.trim(),
          platforms: selected,
          status,
          scheduled_at: status === "scheduled" ? new Date(scheduledAt).toISOString() : null,
        },
      });
      toast.success(status === "draft" ? "Draft saved" : "Post scheduled");
      nav({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compose</h1>
          <p className="text-sm text-muted-foreground">Write once, publish across every selected channel.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Post content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's on your mind?"
                rows={8}
                maxLength={2200}
              />
              <p className="text-right text-xs text-muted-foreground">{caption.length}/2200</p>
            </div>
            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const active = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                        active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                      }`}
                    >
                      <PlatformIcon platform={p.id} className={active ? "text-primary-foreground" : ""} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="when">Schedule for (optional)</Label>
              <Input id="when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => save("draft")} disabled={saving}>
                Save as draft
              </Button>
              <Button onClick={() => save("scheduled")} disabled={saving}>
                {saving ? "Saving…" : scheduledAt ? "Schedule post" : "Schedule (pick a time)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Previews</h2>
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">Select a platform to see the preview.</p>
        ) : (
          selected.map((p) => (
            <Card key={p}>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <PlatformIcon platform={p} />
                <CardTitle className="text-sm">{p}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">
                  {caption || <span className="text-muted-foreground">Your post will appear here…</span>}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
