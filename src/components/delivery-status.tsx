import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export type TargetStatus = Database["public"]["Enums"]["target_status"];

export function deliveryLabel(status: TargetStatus): "queued" | "sending" | "sent" | "failed" {
  if (status === "pending") return "queued";
  if (status === "publishing") return "sending";
  if (status === "published") return "sent";
  return "failed";
}

export function DeliveryStatusBadge({ status }: { status: TargetStatus }) {
  const label = deliveryLabel(status);
  const map = {
    queued: { icon: Clock, cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    sending: { icon: Loader2, cls: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
    sent: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    failed: { icon: XCircle, cls: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
  } as const;
  const { icon: Icon, cls } = map[label];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      <Icon className={`h-3 w-3 ${label === "sending" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
