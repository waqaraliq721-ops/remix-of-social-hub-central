import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, PenSquare, CalendarDays, BarChart3, Inbox, PlugZap,
  Sparkles, Video, Music4, Quote, Scissors, LayoutTemplate, Gamepad2, Baby,
  Film, ListOrdered, CreditCard, ChevronRight,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Compose", url: "/compose", icon: PenSquare },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Inbox", url: "/inbox", icon: Inbox },
  { title: "Accounts", url: "/accounts", icon: PlugZap },
];

const studioItems = [
  { title: "Videos", url: "/videos", icon: Video },
  { title: "Images to Video", url: "/images-to-video", icon: Video },
  { title: "Documentary Style", url: "/documentary-videos", icon: Film },
  { title: "Lyrical Videos", url: "/lyrical-videos", icon: Music4 },
  { title: "Motivational Videos", url: "/motivational-videos", icon: Quote },
  { title: "Gaming Videos", url: "/gaming-videos", icon: Gamepad2 },
  { title: "Tier List Videos", url: "/tier-list-videos", icon: ListOrdered },
  { title: "Kid Videos", url: "/kid-videos", icon: Baby },
  { title: "TikTok Videos", url: "/tiktok-videos", icon: Music4 },
  { title: "Repurpose Long-form", url: "/repurpose", icon: Scissors },
  { title: "Templates & Presets", url: "/presets", icon: LayoutTemplate },
];

function NavSection({ label, items, collapsed, path }: { label: string; items: typeof mainItems; collapsed: boolean; path: string }) {
  return (
    <SidebarGroup className="px-2 py-2.5">
      {!collapsed && (
        <SidebarGroupLabel className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/30">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const active = path === item.url || path.startsWith(item.url + "/");
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={collapsed ? item.title : undefined}
                  className="group nav-link-motion relative h-9 rounded-md px-3 text-sidebar-foreground/55 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-[inset_2px_0_0_theme(colors.blue.400)]"
                >
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="icon-motion h-4 w-4 shrink-0" strokeWidth={1.9} />
                    {!collapsed && <span className="truncate text-[12.5px] font-medium">{item.title}</span>}
                    {!collapsed && active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/80 transition-transform duration-200 group-hover:translate-x-0.5" />}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border/70 px-3 pb-4 pt-4">
        <div className="flex items-center gap-3 px-2">
          <div className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_4px_14px_rgba(96,165,250,0.18)] transition-transform duration-300 hover:scale-105">
            <Sparkles className="icon-motion h-[15px] w-[15px]" strokeWidth={2.2} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[14px] font-semibold tracking-[-0.02em] text-sidebar-foreground">Orbit</div>
              <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/30">Social workspace</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavSection label="Workspace" items={mainItems} collapsed={collapsed} path={path} />
        <NavSection label="Creator tools" items={studioItems} collapsed={collapsed} path={path} />

        <SidebarGroup className="mt-auto px-2 py-2.5">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={path.startsWith("/pricing")}
                tooltip={collapsed ? "Plans & Pricing" : undefined}
                className="nav-link-motion h-9 rounded-md px-3 text-sidebar-foreground/50 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent"
              >
                <Link to="/pricing" className="flex items-center gap-3">
                  <CreditCard className="icon-motion h-4 w-4" strokeWidth={1.9} />
                  {!collapsed && <span className="text-[12.5px] font-medium">Plans & Pricing</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed ? (
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/35 px-3 py-2.5 transition-colors duration-200 hover:bg-sidebar-accent/60">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.35)]" />
              <span className="text-[10.5px] font-semibold text-sidebar-foreground/75">Workspace active</span>
            </div>
            <p className="mt-1 text-[9.5px] leading-relaxed text-sidebar-foreground/30">All connected channels are ready.</p>
          </div>
        ) : (
          <div className="mx-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.35)]" />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
