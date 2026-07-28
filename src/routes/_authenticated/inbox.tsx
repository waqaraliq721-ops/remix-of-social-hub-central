import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMessages, markMessageRead } from "@/lib/social.functions";
import { PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — Orbit" }] }),
  component: InboxPage,
});

function InboxPage() {
  const listFn = useServerFn(listMessages);
  const readFn = useServerFn(markMessageRead);
  const messages = useQuery({ queryKey: ["messages"], queryFn: () => listFn() });

  async function markRead(id: string) {
    await readFn({ data: { id } });
    messages.refetch();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">Comments, mentions and DMs across every platform.</p>
      </div>
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
