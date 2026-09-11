import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "youtube" | "twitter";

type OAuthState = { workspaceId: string; platform: SocialPlatform; createdAt: number; verifier?: string };

const cookieName = "orbit_social_workspace";
const stateSecret = () => process.env.SOCIAL_OAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-only-change-me";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function workspaceCookieHeader(workspaceId: string) {
  return `${cookieName}=${encodeURIComponent(workspaceId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
}

export function getWorkspaceId(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : randomUUID();
}

export function signedState(state: OAuthState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(value: string): OAuthState {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Invalid OAuth state");
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !createHash("sha256").update(signature).digest().equals(createHash("sha256").update(expected).digest())) {
    throw new Error("Invalid OAuth state signature");
  }
  const state = JSON.parse(Buffer.from(payload, "base64url").toString()) as OAuthState;
  if (Date.now() - state.createdAt > 10 * 60 * 1000) throw new Error("OAuth state expired");
  return state;
}

function callbackUrl(platform: SocialPlatform) {
  const base = env("APP_URL").replace(/\/$/, "");
  return `${base}/api/social/oauth/${platform}`;
}

export function getAuthorizationUrl(platform: SocialPlatform, workspaceId: string) {
  const state: OAuthState = { workspaceId, platform, createdAt: Date.now() };
  const redirectUri = callbackUrl(platform);
  let url: URL;

  if (platform === "facebook" || platform === "instagram") {
    url = new URL(`https://www.facebook.com/${env("META_GRAPH_VERSION")}/dialog/oauth`);
    url.searchParams.set("client_id", env("META_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", signedState(state));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish");
  } else if (platform === "tiktok") {
    url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", env("TIKTOK_CLIENT_KEY"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "user.info.basic,video.publish");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", signedState(state));
  } else if (platform === "youtube") {
    url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env("GOOGLE_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload");
    url.searchParams.set("state", signedState(state));
  } else {
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const xState = signedState({ ...state, verifier });
    url = new URL("https://x.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", env("X_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "tweet.read tweet.write users.read offline.access");
    url.searchParams.set("state", xState);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

async function tokenRequest(url: string, body: URLSearchParams, headers: HeadersInit = {}) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error_description || json.error?.message || "OAuth token exchange failed");
  return json;
}

function encryptionKey() {
  return createHash("sha256").update(env("SOCIAL_TOKEN_ENCRYPTION_KEY")).digest();
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptToken(value: string) {
  const [iv, tag, ciphertext] = value.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function adminClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function getOrCreateWorkspaceUser(workspaceId: string) {
  const supabase = adminClient();
  const email = `workspace-${workspaceId}@orbit.invalid`;
  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = listed.data.users.find((user) => user.email === email);
  if (existing) return existing.id;
  const created = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { orbit_workspace: workspaceId } });
  if (created.error || !created.data.user) throw new Error(created.error?.message || "Unable to create workspace");
  return created.data.user.id;
}

export async function exchangeAndSave(platform: SocialPlatform, state: OAuthState, code: string) {
  const supabase = adminClient();
  const userId = await getOrCreateWorkspaceUser(state.workspaceId);
  const redirectUri = callbackUrl(platform);
  const records: Array<Record<string, unknown>> = [];

  if (platform === "facebook" || platform === "instagram") {
    const token = await tokenRequest(`https://graph.facebook.com/${env("META_GRAPH_VERSION")}/oauth/access_token`, new URLSearchParams({ client_id: env("META_CLIENT_ID"), client_secret: env("META_CLIENT_SECRET"), redirect_uri: redirectUri, code }));
    const pagesResponse = await fetch(`https://graph.facebook.com/${env("META_GRAPH_VERSION")}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${encodeURIComponent(token.access_token)}`);
    const pages = await pagesResponse.json();
    if (!pagesResponse.ok) throw new Error(pages.error?.message || "Unable to load Meta accounts");
    for (const page of pages.data ?? []) {
      if (platform === "facebook") {
        records.push({ user_id: userId, platform, provider_account_id: page.id, handle: page.name, display_name: page.name, followers: 0, connected: true, access_token_encrypted: encryptToken(page.access_token), scopes: "pages_show_list,pages_read_engagement,pages_manage_posts", metadata: { page_id: page.id } });
      } else if (page.instagram_business_account) {
        const ig = page.instagram_business_account;
        records.push({ user_id: userId, platform, provider_account_id: ig.id, handle: ig.username ? `@${ig.username}` : ig.id, display_name: ig.name || ig.username || "Instagram account", followers: ig.followers_count ?? 0, connected: true, access_token_encrypted: encryptToken(page.access_token), avatar_url: ig.profile_picture_url ?? null, scopes: "instagram_basic,instagram_content_publish", metadata: { page_id: page.id, instagram_business_account_id: ig.id } });
      }
    }
  } else if (platform === "tiktok") {
    const token = await tokenRequest("https://open.tiktokapis.com/v2/oauth/token/", new URLSearchParams({ client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"), code, grant_type: "authorization_code", redirect_uri: redirectUri }));
    const profileResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json();
    if (!profileResponse.ok) throw new Error(profile.error?.message || "Unable to load TikTok account");
    const user = profile.data.user;
    records.push({ user_id: userId, platform, provider_account_id: user.open_id, handle: user.display_name || user.open_id, display_name: user.display_name || "TikTok account", followers: 0, connected: true, access_token_encrypted: encryptToken(token.access_token), refresh_token_encrypted: token.refresh_token ? encryptToken(token.refresh_token) : null, token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null, avatar_url: user.avatar_url ?? null, scopes: token.scope ?? "user.info.basic,video.publish" });
  } else if (platform === "youtube") {
    const token = await tokenRequest("https://oauth2.googleapis.com/token", new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), code, grant_type: "authorization_code", redirect_uri: redirectUri }));
    const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const channel = await channelResponse.json();
    if (!channelResponse.ok || !channel.items?.[0]) throw new Error(channel.error?.message || "No YouTube channel was found");
    const item = channel.items[0];
    records.push({ user_id: userId, platform, provider_account_id: item.id, handle: item.snippet?.customUrl || item.id, display_name: item.snippet?.title || "YouTube channel", followers: Number(item.statistics?.subscriberCount || 0), connected: true, access_token_encrypted: encryptToken(token.access_token), refresh_token_encrypted: token.refresh_token ? encryptToken(token.refresh_token) : null, token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null, avatar_url: item.snippet?.thumbnails?.default?.url ?? null, scopes: "youtube.readonly,youtube.upload" });
  } else {
    if (!state.verifier) throw new Error("Missing X PKCE verifier");
    const token = await tokenRequest("https://api.x.com/2/oauth2/token", new URLSearchParams({ code, grant_type: "authorization_code", client_id: env("X_CLIENT_ID"), redirect_uri: redirectUri, code_verifier: state.verifier }));
    const meResponse = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url,public_metrics", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const me = await meResponse.json();
    if (!meResponse.ok) throw new Error(me.detail || "Unable to load X account");
    const user = me.data;
    records.push({ user_id: userId, platform, provider_account_id: user.id, handle: `@${user.username}`, display_name: user.name, followers: user.public_metrics?.followers_count ?? 0, connected: true, access_token_encrypted: encryptToken(token.access_token), refresh_token_encrypted: token.refresh_token ? encryptToken(token.refresh_token) : null, token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null, avatar_url: user.profile_image_url ?? null, scopes: token.scope ?? "tweet.read,tweet.write,users.read,offline.access" });
  }

  if (!records.length) throw new Error(`No ${platform} account available for this authorization`);
  for (const record of records) {
    const { error } = await supabase.from("social_accounts").upsert(record, { onConflict: "user_id,platform,provider_account_id" });
    if (error) throw new Error(error.message);
  }
  return { userId, count: records.length };
}

export async function listWorkspaceAccounts(workspaceId: string) {
  const userId = await getOrCreateWorkspaceUser(workspaceId);
  const { data, error } = await adminClient().from("social_accounts").select("id,platform,handle,display_name,followers,connected,avatar_url,provider_account_id,created_at,updated_at").eq("user_id", userId).eq("connected", true).order("platform");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function disconnectWorkspaceAccount(workspaceId: string, id: string) {
  const userId = await getOrCreateWorkspaceUser(workspaceId);
  const { error } = await adminClient().from("social_accounts").update({ connected: false }).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
