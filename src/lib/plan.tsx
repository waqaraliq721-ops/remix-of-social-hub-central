// Client-side plan/quota helpers plus the global "upgrade required" dialog.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Crown } from "lucide-react";
import { getAccount, recordExport, type AccountInfo, type Tier } from "@/lib/subscription.functions";

export type { AccountInfo, Tier };

export const TIERS: {
  id: Tier;
  name: string;
  price: string;
  tagline: string;
  perks: string[];
}[] = [
  {
    id: "free",
    name: "Free",
    price: "0 PKR",
    tagline: "Try every studio",
    perks: [
      "5 video exports per month",
      "Orbit watermark on every export",
      "AI voiceover not included",
      "All templates available to preview",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: "999 PKR",
    tagline: "For steady creators",
    perks: [
      "3 video exports per week",
      "No watermark",
      "AI voiceover included",
      "All studios and templates",
    ],
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: "2499 PKR",
    tagline: "Everything, unlimited",
    perks: [
      "Unlimited video exports",
      "No watermark, no restrictions",
      "AI voiceover and transcription",
      "Every current and future feature",
    ],
  },
];

export const JAZZCASH_NUMBER = "03095723155";

export class ExportLimitError extends Error {
  constructor(message = "Export limit reached for your plan.") {
    super(message);
    this.name = "ExportLimitError";
  }
}

export function usePlan() {
  return useQuery({
    queryKey: ["plan-account"],
    queryFn: () => getAccount(),
    staleTime: 30_000,
  });
}

/** Fires the global dialog that tells the user to upgrade. */
export function promptUpgrade(detail?: { used?: number; limit?: number; tier?: Tier }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("orbit:upgrade-required", { detail }));
}

/**
 * Called right before an export starts. Throws ExportLimitError (after opening
 * the upgrade dialog) when the plan's quota is used up. Falls back to allowing
 * the export if the check itself fails, so a network hiccup never blocks work.
 */
export async function checkExportAllowed(): Promise<AccountInfo | null> {
  try {
    const info = await getAccount();
    if (!info.allowed) {
      promptUpgrade({ used: info.used, limit: info.limit, tier: info.tier });
      throw new ExportLimitError(
        info.limit >= 0
          ? `You've used all ${info.limit} exports on the ${info.tier} plan.`
          : "Export limit reached.",
      );
    }
    return info;
  } catch (error) {
    if (error instanceof ExportLimitError) throw error;
    console.error("quota check failed", error);
    return null;
  }
}

export async function reportExport(kind: string, watermarked: boolean) {
  try {
    await recordExport({ data: { kind, watermarked } });
  } catch (error) {
    console.error("usage report failed", error);
  }
}

export function UpgradeGate() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<{ used?: number; limit?: number; tier?: Tier }>({});

  useEffect(() => {
    const handler = (event: Event) => {
      setInfo((event as CustomEvent).detail ?? {});
      setOpen(true);
    };
    window.addEventListener("orbit:upgrade-required", handler);
    return () => window.removeEventListener("orbit:upgrade-required", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-pink-500 text-white">
            <Crown className="h-5 w-5" />
          </div>
          <DialogTitle>You've hit your export limit</DialogTitle>
          <DialogDescription>
            {info.limit && info.limit > 0
              ? `Your ${info.tier ?? "current"} plan allows ${info.limit} exports (${info.used ?? info.limit} used).`
              : "Your current plan doesn't allow any more exports right now."}{" "}
            Upgrade to keep exporting — Basic gives you 3 exports a week without a watermark, and Ultimate is
            unlimited.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button asChild onClick={() => setOpen(false)}>
            <Link to="/pricing">See plans</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
