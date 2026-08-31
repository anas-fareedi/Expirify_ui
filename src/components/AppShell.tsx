import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ScanLine, LogOut, Box } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scan", label: "Scan", icon: ScanLine },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <span className="aurora-blob animate-breathe left-[-10%] top-[-8%] h-72 w-72 bg-primary/25" />
        <span
          className="aurora-blob animate-breathe right-[-8%] top-1/3 h-80 w-80 bg-[oklch(0.78_0.14_168_/_0.22)]"
          style={{ animationDelay: "1.4s" }}
        />
      </div>

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/dashboard" className="group flex items-center gap-2">
            <span className="glow-ring animate-pulse-ring grid h-9 w-9 place-items-center rounded-lg bg-primary/15 transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-110">
              <Box className="h-4 w-4 text-primary" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Expirify</span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-300",
                  pathname === item.to
                    ? "flow-border bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:-translate-y-0.5 hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-transform duration-300 group-hover:scale-110",
                    pathname === item.to && "text-primary",
                  )}
                />
                {item.label}
              </Link>
            ))}
          </nav>

          <Button variant="secondary" size="sm" className="hover-scale" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main key={pathname} className="page-in mx-auto max-w-6xl px-4 pb-24 pt-6 sm:pb-10">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border/70 bg-background/95 backdrop-blur sm:hidden">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-all duration-300",
              pathname === item.to
                ? "-translate-y-0.5 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon
              className={cn("h-5 w-5 transition-transform duration-300", pathname === item.to && "scale-110")}
            />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
