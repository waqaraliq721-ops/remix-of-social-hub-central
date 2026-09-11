import { createFileRoute } from "@tanstack/react-router";
import { getAuthorizationUrl, getWorkspaceId, exchangeAndSave, signedState, verifyState, workspaceCookieHeader, type SocialPlatform } from "@/lib/social-oauth.server";

const platforms = new Set<SocialPlatform>(["facebook", "instagram", "tiktok", "youtube", "twitter"]);

export const Route = createFileRoute("/api/social/oauth/$platform")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const platform = params.platform as SocialPlatform;
        if (!platforms.has(platform)) return new Response("Unsupported social platform", { status: 404 });
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const stateValue = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (!code && !stateValue) {
          try {
            const workspaceId = getWorkspaceId(request);
            const location = getAuthorizationUrl(platform, workspaceId);
            return new Response(null, { status: 302, headers: { Location: location, "Set-Cookie": workspaceCookieHeader(workspaceId) } });
          } catch (err) {
            return Response.json({ error: err instanceof Error ? err.message : "OAuth is not configured" }, { status: 503 });
          }
        }

        if (error) {
          return new Response(null, { status: 302, headers: { Location: `/accounts?oauth_error=${encodeURIComponent(error)}` } });
        }

        if (!stateValue || !code) return new Response("Missing OAuth response", { status: 400 });

        try {
          const state = verifyState(stateValue);
          if (state.platform !== platform) throw new Error("OAuth platform mismatch");
          await exchangeAndSave(platform, state, code);
          return new Response(null, { status: 302, headers: { Location: "/accounts?connected=1", "Set-Cookie": workspaceCookieHeader(state.workspaceId) } });
        } catch (err) {
          return new Response(null, { status: 302, headers: { Location: `/accounts?oauth_error=${encodeURIComponent(err instanceof Error ? err.message : "Connection failed")}` } });
        }
      },
    },
  },
});
