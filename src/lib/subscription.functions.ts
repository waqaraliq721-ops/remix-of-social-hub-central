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

function startOfWeek() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Monday-based
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Pulls the tier from the Google Sheet (the manual upgrade control), applies it
 * to the database when it changed, mirrors usage back into the sheet, and sends
 * the welcome / upgrade emails. Best-effort: never blocks the app.
 */
async function syncWithSheet(userId: string, email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sheets = await import("@/lib/sheets.server");
  const { sendEmail, welcomeEmail, tierUpgradeEmail, emailConfigured } = await import("@/lib/email.server");

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("tier, email, notified_tier, welcome_email_sent, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub) return null;

  if (email && sub.email !== email) {
    await supabaseAdmin.from("subscriptions").update({ email }).eq("user_id", userId);
  }

  // Usage counters straight from the export log.
  const counts = async (since: Date | null) => {
    let q = supabaseAdmin.from("export_events").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (since) q = q.gte("created_at", since.toISOString());
    const { count } = await q;
    return count ?? 0;
  };
  const [week, month, total] = await Promise.all([counts(startOfWeek()), counts(startOfMonth()), counts(null)]);
  const { data: lastExport } = await supabaseAdmin
    .from("export_events")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let tier = (sub.tier ?? "free") as Tier;
  let row: Awaited<ReturnType<typeof sheets.findRow>> = null;

  if (sheets.sheetsConfigured()) {
    row = await sheets.findRow(userId);
    // The sheet is the source of truth for the plan.
    if (row && row.tier !== tier) {
      tier = row.tier;
      await supabaseAdmin
        .from("subscriptions")
        .update({ tier, tier_changed_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    await sheets.upsertUserRow({
      userId,
      email: email || sub.email || "",
      tier,
      week,
      month,
      total,
      lastExportAt: lastExport?.created_at ?? "",
      watermark: tier === "free",
      voiceover: tier !== "free",
      welcomeSent: !!sub.welcome_email_sent,
      signupDate: sub.created_at ?? undefined,
    });
  }

  // Emails
  if (emailConfigured() && email) {
    if (!sub.welcome_email_sent) {
      const msg = welcomeEmail(email);
      if (await sendEmail({ to: email, ...msg })) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ welcome_email_sent: true, notified_tier: tier })
          .eq("user_id", userId);
      }
    } else if (sub.notified_tier !== tier) {
      const msg = tierUpgradeEmail(email, tier);
      if (await sendEmail({ to: email, ...msg })) {
        await supabaseAdmin.from("subscriptions").update({ notified_tier: tier }).eq("user_id", userId);
      }
    }
  }

  return { tier, week, month, total };
}

/** Reads the caller's plan and remaining export quota. */
export const getAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountInfo> => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email ?? "";

    let synced: { tier: Tier; week: number; month: number; total: number } | null = null;
    try {
      synced = await syncWithSheet(userId, email);
    } catch (e) {
      console.error("sheet sync error", e);
    }

    const { data, error } = await supabase.rpc("export_quota" as never);
    if (error) console.error("export_quota failed", error.message);

    const quota = (data ?? {}) as Partial<AccountInfo> & { tier?: Tier };
    const tier = (synced?.tier ?? quota.tier ?? "free") as Tier;

    const info: AccountInfo = {
      ...FALLBACK,
      ...quota,
      tier,
      email: email || quota.email || "",
    };

    // Keep the numbers consistent with the tier we just applied from the sheet.
    if (synced) {
      if (tier === "ultimate") {
        Object.assign(info, { used: 0, limit: -1, period: "none", allowed: true, watermark: false, voiceover: true });
      } else if (tier === "basic") {
        Object.assign(info, {
          used: synced.week,
          limit: 3,
          period: "week",
          allowed: synced.week < 3,
          watermark: false,
          voiceover: true,
        });
      } else {
        Object.assign(info, {
          used: synced.month,
          limit: 5,
          period: "month",
          allowed: synced.month < 5,
          watermark: true,
          voiceover: false,
        });
      }
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

    // Push fresh usage numbers into the sheet right away.
    try {
      const sheets = await import("@/lib/sheets.server");
      if (sheets.sheetsConfigured()) {
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("tier, email, welcome_email_sent, created_at")
          .eq("user_id", context.userId)
          .maybeSingle();
        const counts = async (since: Date | null) => {
          let q = supabaseAdmin
            .from("export_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", context.userId);
          if (since) q = q.gte("created_at", since.toISOString());
          const { count } = await q;
          return count ?? 0;
        };
        const [week, month, total] = await Promise.all([
          counts(startOfWeek()),
          counts(startOfMonth()),
          counts(null),
        ]);
        const tier = ((sub?.tier ?? "free") as Tier);
        await sheets.upsertUserRow({
          userId: context.userId,
          email: sub?.email ?? "",
          tier,
          week,
          month,
          total,
          lastExportAt: new Date().toISOString(),
          watermark: tier === "free",
          voiceover: tier !== "free",
          welcomeSent: !!sub?.welcome_email_sent,
          signupDate: sub?.created_at ?? undefined,
        });
      }
    } catch (e) {
      console.error("sheet usage update failed", e);
    }

    return { ok: !error };
  });
