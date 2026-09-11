import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Command, Sparkles, Circle } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({ component: Layout });

function Layout() {
  const isNavigating = useRouterState({ select: (state) => state.status === "pending" });

  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-3 sm:h-16 sm:px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <SidebarTrigger className="rounded-lg hover:bg-accent" />
              <div className="hidden h-6 w-px bg-border sm:block" />
              <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Social workspace</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button type="button" className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground md:flex">
                <Command className="h-3.5 w-3.5" />
                <span>Quick actions</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
              </button>
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 sm:gap-2 sm:px-3">
                <Circle className="h-2 w-2 shrink-0 fill-emerald-500 text-emerald-500" />
                <span className="hidden text-xs font-medium text-muted-foreground sm:inline">All systems ready</span>
              </div>
            </div>
          </header>
          <main className="page-shell relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
            {isNavigating && <div className="route-progress" aria-hidden="true" />}
            <Outlet />
          </main>
        </div>
        <Toaster richColors position="bottom-right" />
      </div>
    </SidebarProvider>
  );
}
