import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const platformSchema = z.enum(["facebook", "instagram", "tiktok", "youtube", "twitter"]);

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("social_accounts")
      .select("*")
      .order("platform");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { platform: string; handle: string; display_name?: string; followers?: number; connected?: boolean }) =>
    z
      .object({
        platform: platformSchema,
        handle: z.string().trim().min(1).max(120),
        display_name: z.string().trim().max(120).optional(),
        followers: z.number().int().min(0).optional(),
        connected: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("social_accounts").upsert(
      {
        user_id: context.userId,
        platform: data.platform,
        handle: data.handle,
        display_name: data.display_name ?? data.handle,
        followers: data.followers ?? 0,
        connected: data.connected ?? true,
      },
      { onConflict: "user_id,platform,handle" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("social_accounts")
      .update({ connected: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { caption: string; platforms: string[]; scheduled_at?: string | null; status: "draft" | "scheduled" }) =>
    z
      .object({
        caption: z.string().trim().max(2200),
        platforms: z.array(platformSchema).min(1).max(5),
        scheduled_at: z.string().datetime().nullable().optional(),
        status: z.enum(["draft", "scheduled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("posts").insert({
      user_id: context.userId,
      caption: data.caption,
      platforms: data.platforms,
      scheduled_at: data.scheduled_at ?? null,
      status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("messages")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("messages")
      .update({ read: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("analytics_snapshots")
      .select("*")
      .order("snapshot_date");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
