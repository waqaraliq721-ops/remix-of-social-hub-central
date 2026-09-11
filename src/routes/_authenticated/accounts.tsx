import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { PLATFORMS, type Platform } from "@/lib/platforms";
import { PlatformIcon } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Unplug } from "lucide-react";

type SocialAccount = {
  id: string;
  platform: Platform;
  handle: string;
  display_name: string;
  followers: number;
  connected: boolean;
  avatar_url?: string | null;
};

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts — Orbit" }] }),
  component: Accounts,
});

function Accounts() {
  const accounts = useQuery<SocialAccount[]>({
    queryKey: ["social-accounts"],
    queryFn: async () => {
      const response = await fetch("/api/social/accounts");
      if (!response.ok) throw new Error((await response.json()).error || "Unable to load accounts");
      return response.json();
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) toast.success("Social account connected successfully");
    const error = params.get("oauth_error");
    if (error) toast.error(error);
    if (params.has("connected") || params.has("oauth_error")) window.history.replaceState({}, "", "/accounts");
  }, []);

  const connect = (platform: Platform) => {
    window.location.assign(`/api/social/oauth/${platform}`);
  };

  const disconnect = async (id: string) => {
    const response = await fetch("/api/social/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      toast.error((await response.json()).error || "Unable to disconnect account");
      return;
    }
    toast.success("Account disconnected");
    await accounts.refetch();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Social accounts</h1>
        <p className="text-sm text-muted-foreground">Connect your real social accounts and manage them from one place.</p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <ExternalLink className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">Secure account connection</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clicking Connect takes you to the platform itself. You authorize Orbit there, then return here with the account name, profile and available connection permissions automatically loaded.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const connected = (accounts.data ?? []).filter((account) => account.platform === platform.id);
          return (
            <Card key={platform.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PlatformIcon platform={platform.id} className="h-5 w-5" />
                    {platform.name}
                  </CardTitle>
                  <Button size="sm" variant={connected.length ? "outline" : "default"} onClick={() => connect(platform.id)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    {connected.length ? "Connect another" : "Connect"}
                  </Button>
                </div>
                <CardDescription>{platform.connectionLabel}. No username or follower count needs to be entered manually.</CardDescription>
              </CardHeader>
              <CardContent>
                {connected.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                    No {platform.name} account connected yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {connected.map((account) => (
                      <li key={account.id} className="flex items-center gap-3 rounded-lg border p-3">
                        {account.avatar_url ? (
                          <img src={account.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                            <PlatformIcon platform={platform.id} className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{account.display_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {account.handle}{account.followers ? ` · ${account.followers.toLocaleString()} followers` : ""}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                        </span>
                        <Button size="icon" variant="ghost" title="Disconnect" onClick={() => disconnect(account.id)}>
                          <Unplug className="h-4 w-4" />
                        </Button>
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
