import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FolderTree, Files, Users, LogOut, KeyRound } from "lucide-react";
import { StaffHeader } from "./StaffHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/useStaff";

const nav = [
  { to: "/hierarchy", label: "Hierarchy", icon: FolderTree },
  { to: "/documents", label: "Document Registry", icon: Files },
  { to: "/users", label: "Users", icon: Users },
] as const;

export function StaffShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader
        right={
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{profile?.full_name}</p>
              <p className="text-xs text-header-foreground/70">{profile?.role?.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-header-foreground hover:bg-white/10">
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        }
      />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 md:flex-row">
        <aside className="md:w-60 md:shrink-0">
          <nav className="rounded-lg bg-sidebar p-2 text-sidebar-foreground shadow-elegant">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-accent font-medium text-gold" }}
              >
                <Icon className="size-4" /> {label}
              </Link>
            ))}
            <Link
              to="/account"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent font-medium text-gold" }}
            >
              <KeyRound className="size-4" /> Password
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
