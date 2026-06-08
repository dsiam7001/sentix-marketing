import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Lightbulb,
  FileText,
  Hash,
  CalendarDays,
  TrendingUp,
  Eye,
  Settings,
  LogOut,
  Sparkles,
  Activity,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/control", label: "Mission Control", icon: Activity },
  { to: "/ideas", label: "Idea Lab", icon: Lightbulb },
  { to: "/scripts", label: "Script Studio", icon: FileText },
  { to: "/hooks", label: "Hook Library", icon: Hash },
  { to: "/references", label: "References", icon: ImageIcon },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/performance", label: "Performance", icon: TrendingUp },
  { to: "/inspiration", label: "Inspiration", icon: Eye },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-6 py-5 flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-sidebar-foreground">Sentix AI</div>
            <div className="text-xs text-muted-foreground">Content Intelligence</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border border-primary/30"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden border-b border-border px-4 py-3 flex items-center justify-between bg-sidebar">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-gradient-primary" />
            <span className="font-bold">Sentix AI</span>
          </div>
          <Button size="sm" variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="md:hidden overflow-x-auto border-b border-border bg-sidebar/50">
          <div className="flex gap-1 px-2 py-2 min-w-max">
            {nav.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                    active ? "bg-primary/20 text-primary" : "text-foreground/70",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
