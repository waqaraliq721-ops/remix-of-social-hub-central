import { createFileRoute } from "@tanstack/react-router";
import { disconnectWorkspaceAccount, getWorkspaceId, listWorkspaceAccounts, workspaceCookieHeader } from "@/lib/social-oauth.server";

export const Route = createFileRoute("/api/social/accounts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const workspaceId = getWorkspaceId(request);
          const accounts = await listWorkspaceAccounts(workspaceId);
          return Response.json(accounts, { headers: { "Set-Cookie": workspaceCookieHeader(workspaceId) } });
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : "Unable to load accounts" }, { status: 500 });
        }
      },
      DELETE: async ({ request }) => {
        try {
          const workspaceId = getWorkspaceId(request);
          const body = await request.json() as { id?: string };
          if (!body.id) return Response.json({ error: "Account id is required" }, { status: 400 });
          await disconnectWorkspaceAccount(workspaceId, body.id);
          return Response.json({ ok: true });
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : "Unable to disconnect account" }, { status: 500 });
        }
      },
    },
  },
});
