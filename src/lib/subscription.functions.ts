import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Tier = "free" | "basic" | "ultimate";

export type AccountInfo = {
  tier: Tier;
  email: string;
  /** Exports already used in the current window. */
  used: number;
  /** -1 means unlimited. */
  limit: number;
  /** "month" | "week" | "none" */
  period: string;
  allowed: boolean;
  watermark: boolean;
  voiceover: boolean;
};

const FALLBACK: AccountInfo = {
  tier: "free",
  email: "",
  used: 0,
  limit: 5,
  period: "month",
  allowed: true,
  watermark: true,
  voiceover: false,
};

/**
 * Reads the caller's plan and remaining export quota. Also sends the welcome
 * email on first load and the congratulations email after an admin tier change
 * (both no-op when email credentials aren't configured).
 */
export const getAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountInfo> => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email ?? "";

    const { data, error } = await supabase.rpc("export_quota" as never);
    if (error) console.error("export_quota failed", error.message);

    const quota = (data ?? {}) as Partial<AccountInfo> & { tier?: Tier };
    const info: AccountInfo = {
      ...FALLBACK,
      ...quota,
      email: email || quota.email || "",
      tier: (quota.tier ?? "free") as Tier,
    };

    // Notifications are best-effort and must never block the app.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { sendEmail, welcomeEmail, tierUpgradeEmail, emailConfigured } = await import("@/lib/email.server");
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("welcome_email_sent, notified_tier, tier, email")
        .eq("user_id", userId)
        .maybeSingle();

      if (sub && email && sub.email !== email) {
        await supabaseAdmin.from("subscriptions").update({ email }).eq("user_id", userId);
      }
      if (!emailConfigured() || !email || !sub) return info;

      if (!sub.welcome_email_sent) {
        const msg = welcomeEmail(email);
        if (await sendEmail({ to: email, ...msg })) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ welcome_email_sent: true, notified_tier: sub.tier })
            .eq("user_id", userId);
        }
      } else if (sub.notified_tier !== sub.tier) {
        const msg = tierUpgradeEmail(email, sub.tier);
        if (await sendEmail({ to: email, ...msg })) {
          await supabaseAdmin.from("subscriptions").update({ notified_tier: sub.tier }).eq("user_id", userId);
        }
      }
    } catch (e) {
      console.error("subscription notification error", e);
    }

    return info;
  });

/** Records one completed export so usage stays accurate for quota checks. */
export const recordExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; watermarked: boolean }) => ({
    kind: String(input?.kind ?? "video").slice(0, 60),
    watermarked: !!input?.watermarked,
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("export_events").insert({
      user_id: context.userId,
      kind: data.kind,
      watermarked: data.watermarked,
    });
    if (error) console.error("recordExport failed", error.message);
    return { ok: !error };
  });
