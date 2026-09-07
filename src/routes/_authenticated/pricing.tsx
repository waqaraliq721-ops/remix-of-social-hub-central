import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown } from "lucide-react";
import { TIERS, usePlan } from "@/lib/plan";

export const Route = createFileRoute("/_authenticated/pricing")({
  head: () => ({
    meta: [
      { title: "Plans & Pricing — Orbit" },
      {
        name: "description",
        content:
          "Choose an Orbit plan: Free with 5 watermarked exports a month, Basic at 999 PKR for 3 clean exports a week, or Ultimate at 2499 PKR for unlimited exports.",
      },
      { property: "og:title", content: "Plans & Pricing — Orbit" },
      { property: "og:description", content: "Free, Basic and Ultimate plans for Orbit video studios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { data: account } = usePlan();
  const current = account?.tier ?? "free";

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="rounded-3xl border bg-gradient-to-br from-violet-600/15 via-fuchsia-500/10 to-amber-400/10 p-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
          <Crown className="h-3.5 w-3.5" /> Your plan: {current}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Plans &amp; pricing</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Pick the plan that matches how much you export. Upgrades are confirmed manually after payment — usually
          within a few hours.
        </p>
        {account && (
          <p className="mt-3 text-sm text-muted-foreground">
            {account.limit < 0
              ? "Unlimited exports remaining."
              : `${account.used} of ${account.limit} exports used this ${account.period}.`}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((tier) => {
          const isCurrent = tier.id === current;
          return (
            <Card
              key={tier.id}
              className={tier.id === "ultimate" ? "border-fuchsia-500/50 shadow-lg" : undefined}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  {isCurrent && <Badge variant="secondary">Current</Badge>}
                </div>
                <CardDescription>{tier.tagline}</CardDescription>
                <div className="pt-2 text-3xl font-semibold tracking-tight">{tier.price}</div>
                {tier.id !== "free" && <div className="text-xs text-muted-foreground">per month</div>}
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                {tier.id === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    {isCurrent ? "Your plan" : "Included"}
                  </Button>
                ) : (
                  <Button asChild className="w-full" disabled={isCurrent}>
                    <Link to="/upgrade" search={{ tier: tier.id }}>
                      {isCurrent ? "Your plan" : "Buy now"}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
