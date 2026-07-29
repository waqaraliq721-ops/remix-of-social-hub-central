import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMessages, markMessageRead, listPostTargets } from "@/lib/social.functions";
import { PlatformIcon } from "@/components/platform-badge";
import { DeliveryStatusBadge } from "@/components/delivery-status";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — Orbit" }] }),
  component: InboxPage,
});

function InboxPage() {
  const listFn = useServerFn(listMessages);
  const readFn = useServerFn(markMessageRead);
  const targetsFn = useServerFn(listPostTargets);
  const messages = useQuery({ queryKey: ["messages"], queryFn: () => listFn() });
  const targets = useQuery({ queryKey: ["post-targets"], queryFn: () => targetsFn() });

  async function markRead(id: string) {
    await readFn({ data: { id } });
    messages.refetch();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">Comments, mentions, DMs and outbound delivery status.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery status</CardTitle>
          <CardDescription>Recent scheduled posts and their per-platform status.</CardDescription>
        </CardHeader>
        <CardContent>
          {(targets.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in the queue yet. Schedule a post to see delivery here.</p>
          ) : (
            <ul className="divide-y">
              {(targets.data ?? []).slice(0, 10).map((t) => {
                const caption = (t as unknown as { posts?: { caption?: string } }).posts?.caption;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <PlatformIcon platform={t.platform} />
                      <div className="min-w-0">
                        <p className="truncate text-sm">{caption || "Post"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleString()}
                          {t.error ? ` · ${t.error}` : ""}
                        </p>
                      </div>
                    </div>
                    <DeliveryStatusBadge status={t.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {(messages.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages yet. Once platforms are connected, incoming DMs, mentions and comments land here.
            </p>
          ) : (
            <ul className="divide-y">
              {(messages.data ?? []).map((m) => (
                <li key={m.id} className={`flex gap-3 py-3 ${m.read ? "opacity-70" : ""}`}>
                  <div className="pt-1"><PlatformIcon platform={m.platform} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{m.sender_name ?? m.sender_handle}</p>
                      <span className="text-xs text-muted-foreground">{m.sender_handle}</span>
                    </div>
                    <p className="text-sm">{m.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(m.received_at).toLocaleString()}</p>
                  </div>
                  {!m.read && (
                    <Button size="icon" variant="ghost" onClick={() => markRead(m.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

