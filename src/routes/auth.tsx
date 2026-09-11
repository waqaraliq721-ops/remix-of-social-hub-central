import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Orbit" }],
  }),
  component: AuthDisabled,
});

function AuthDisabled() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">No login required</h1>
        <p className="mt-2 text-muted-foreground">You can use Orbit without creating an account.</p>
        <Button asChild className="mt-6">
          <Link to="/dashboard">Open dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
