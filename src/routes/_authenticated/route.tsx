import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Command, Sparkles, Circle, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({ component: Layout });

function Layout() {
  const isNavigating = useRouterState({ select: (state) => state.status === "pending" });

  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-card/95 px-3 backdrop-blur sm:h-15 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <SidebarTrigger className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" />
              <div className="hidden h-5 w-px bg-border sm:block" />
              <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">Social workspace</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="hidden h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground shadow-sm hover:border-primary/25 hover:bg-muted/40 hover:text-foreground md:flex">
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
              </button>
              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 shadow-sm sm:px-3">
                <Circle className="h-2 w-2 shrink-0 fill-emerald-500 text-emerald-500" />
                <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Systems ready</span>
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
