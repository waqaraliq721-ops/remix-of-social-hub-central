import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PenSquare,
  CalendarDays,
  BarChart3,
  Inbox,
  PlugZap,
  Sparkles,
  Video,
  Music4,
  Quote,
  Scissors,
  LayoutTemplate,
  Gamepad2,
  Baby,
  Film,
  ListOrdered,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
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

function NavSection({
  label,
  items,
  collapsed,
  path,
}: {
  label: string;
  items: typeof mainItems;
  collapsed: boolean;
  path: string;
}) {
  return (
    <SidebarGroup className="px-2 py-2">
      {!collapsed && <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const active = path === item.url || path.startsWith(item.url + "/");
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={collapsed ? item.title : undefined}
                  className="h-10 rounded-xl px-3 text-sidebar-foreground/65 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-[inset_3px_0_0_theme(colors.indigo.400)]"
                >
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="h-[17px] w-[17px] shrink-0" />
                    {!collapsed && <span className="truncate text-[13px] font-medium">{item.title}</span>}
                    {!collapsed && active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />}
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
    <Sidebar collapsible="icon" className="border-r-0 bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border/70 px-3 py-4">
        <div className="flex items-center gap-3 rounded-2xl px-2 py-1">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-950/30">
            <Sparkles className="h-[17px] w-[17px]" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-400" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">Orbit</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/40">Social suite</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <NavSection label="Workspace" items={mainItems} collapsed={collapsed} path={path} />
        <NavSection label="Creator studio" items={studioItems} collapsed={collapsed} path={path} />

        <SidebarGroup className="mt-auto px-2 py-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={path.startsWith("/pricing")}
                tooltip={collapsed ? "Plans & Pricing" : undefined}
                className="h-10 rounded-xl px-3 text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent"
              >
                <Link to="/pricing" className="flex items-center gap-3">
                  <CreditCard className="h-[17px] w-[17px]" />
                  {!collapsed && <span className="text-[13px] font-medium">Plans & Pricing</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-3">
        {!collapsed ? (
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_theme(colors.emerald.400)]" />
              <span className="text-xs font-semibold text-sidebar-foreground">Workspace active</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/45">Your social channels are ready to manage.</p>
          </div>
        ) : (
          <div className="mx-auto h-2 w-2 rounded-full bg-emerald-400" />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
