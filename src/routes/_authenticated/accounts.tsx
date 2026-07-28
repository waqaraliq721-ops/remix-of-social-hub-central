import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAccounts, upsertAccount, disconnectAccount } from "@/lib/social.functions";
import { PLATFORMS, type Platform } from "@/lib/platforms";
import { PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, Plug, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts — Orbit" }] }),
  component: Accounts,
});

function Accounts() {
  const listFn = useServerFn(listAccounts);
  const upsertFn = useServerFn(upsertAccount);
  const disconnectFn = useServerFn(disconnectAccount);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => listFn() });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Connect the channels you want to manage from Orbit.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <div className="flex gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600" />
          <div>
            <p className="font-medium">Real posting requires platform developer apps.</p>
            <p className="text-muted-foreground">
              Facebook, Instagram, YouTube and TikTok require developer accounts and OAuth review before publishing.
              You can add and manage accounts now — real API connections will plug in later.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORMS.map((p) => {
          const platformAccounts = (accounts.data ?? []).filter((a) => a.platform === p.id);
          return (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PlatformIcon platform={p.id} className="h-5 w-5" /> {p.name}
                  </CardTitle>
                  <ConnectDialog
                    platform={p.id}
                    onSave={async (values) => {
                      await upsertFn({ data: { platform: p.id, ...values } });
                      toast.success(`${p.name} account added`);
                      accounts.refetch();
                    }}
                  />
                </div>
                <CardDescription>{p.hasConnector ? "OAuth-ready via Orbit gateway." : "Custom developer app required for live posting."}</CardDescription>
              </CardHeader>
              <CardContent>
                {platformAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No accounts connected.</p>
                ) : (
                  <ul className="space-y-2">
                    {platformAccounts.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-lg border p-2.5">
                        <div>
                          <p className="text-sm font-medium">{a.display_name ?? a.handle}</p>
                          <p className="text-xs text-muted-foreground">{a.handle} · {a.followers.toLocaleString()} followers</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.connected ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Disconnected</span>
                          )}
                          {a.connected && (
                            <Button size="sm" variant="ghost" onClick={async () => {
                              await disconnectFn({ data: { id: a.id } });
                              accounts.refetch();
                            }}>Disconnect</Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ConnectDialog({ platform, onSave }: { platform: Platform; onSave: (v: { handle: string; display_name: string; followers: number }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [followers, setFollowers] = useState("0");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plug className="mr-1 h-3.5 w-3.5" /> Add</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {platform} account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Handle / Username</Label>
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourbrand" />
          </div>
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your Brand" />
          </div>
          <div className="space-y-1.5">
            <Label>Followers</Label>
            <Input type="number" min={0} value={followers} onChange={(e) => setFollowers(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            if (!handle.trim()) return toast.error("Handle required");
            await onSave({ handle: handle.trim(), display_name: displayName.trim() || handle.trim(), followers: Number(followers) || 0 });
            setOpen(false); setHandle(""); setDisplayName(""); setFollowers("0");
          }}>Add account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
