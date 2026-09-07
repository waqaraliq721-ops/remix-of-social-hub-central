import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Copy, MessageCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { JAZZCASH_NUMBER, TIERS, usePlan, type Tier } from "@/lib/plan";

type UpgradeSearch = { tier: Tier };

export const Route = createFileRoute("/_authenticated/upgrade")({
  validateSearch: (search: Record<string, unknown>): UpgradeSearch => ({
    tier: search["tier"] === "ultimate" ? "ultimate" : "basic",
  }),
  head: () => ({
    meta: [
      { title: "Upgrade your plan — Orbit" },
      {
        name: "description",
        content: "Payment instructions for upgrading your Orbit plan via JazzCash, plus how to send your receipt.",
      },
      { property: "og:title", content: "Upgrade your plan — Orbit" },
      { property: "og:description", content: "JazzCash payment instructions for Orbit Basic and Ultimate plans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UpgradePage,
});

function UpgradePage() {
  const { tier } = Route.useSearch();
  const { data: account } = usePlan();
  const plan = TIERS.find((t) => t.id === tier) ?? TIERS[1];

  const copy = async () => {
    await navigator.clipboard.writeText(JAZZCASH_NUMBER);
    toast.success("Account number copied");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/pricing">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to plans
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Upgrade to {plan.name} — {plan.price}
          </CardTitle>
          <CardDescription>Follow these three steps and your plan will be upgraded after confirmation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="space-y-5">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                1
              </span>
              <div className="space-y-2">
                <p className="font-medium">
                  Send {plan.price} to this JazzCash account
                </p>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-lg tracking-wide">{JAZZCASH_NUMBER}</span>
                  <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={copy}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pay exactly {plan.price} so the payment can be matched to your account.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                2
              </span>
              <div className="space-y-2">
                <p className="font-medium">Send the payment screenshot on WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  WhatsApp your payment proof to <span className="font-mono">{JAZZCASH_NUMBER}</span> and include the
                  email address you signed up with
                  {account?.email ? (
                    <>
                      {" "}
                      (<span className="font-mono">{account.email}</span>)
                    </>
                  ) : null}
                  .
                </p>
                <Button asChild size="sm" variant="secondary">
                  <a
                    href={`https://wa.me/92${JAZZCASH_NUMBER.slice(1)}?text=${encodeURIComponent(
                      `Hi, I've paid ${plan.price} for the Orbit ${plan.name} plan. My account email is ${account?.email ?? ""}.`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-1 h-4 w-4" /> Open WhatsApp
                  </a>
                </Button>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                3
              </span>
              <div className="space-y-2">
                <p className="font-medium">Email the same screenshot</p>
                <p className="text-sm text-muted-foreground">
                  Also email the receipt from your account email address so it can be verified quickly. Once the
                  payment is confirmed your plan is switched over and you'll get a confirmation email.
                </p>
              </div>
            </li>
          </ol>

          <Separator />

          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">What you get on {plan.name}</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
              {plan.perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
