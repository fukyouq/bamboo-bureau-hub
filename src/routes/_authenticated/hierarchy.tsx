import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useRoles, useSectors } from "@/hooks/useStaff";

export const Route = createFileRoute("/_authenticated/hierarchy")({
  head: () => ({
    meta: [
      { title: "Hierarchy | Bamboo Company Staff" },
      { name: "description", content: "The full chain of command of Bamboo Company and its sectors." },
      { property: "og:title", content: "Hierarchy | Bamboo Company Staff" },
      { property: "og:description", content: "Chain of command and sector structure of Bamboo Company." },
    ],
  }),
  component: HierarchyPage,
});

function HierarchyPage() {
  const { data: profile } = useMyProfile();
  const { data: roles = [] } = useRoles();
  const { data: sectors = [] } = useSectors();
  const queryClient = useQueryClient();
  const [sectorName, setSectorName] = useState("");

  const isHeadOffice = (profile?.role?.rank ?? 99) <= 3;

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-by-role"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role_id, sector_id")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const addSector = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("sectors").insert({ name, created_by: profile?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      setSectorName("");
      toast.success("Sector added");
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSector = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sectors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sector removed");
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orgRoles = roles.filter((r) => r.category === "organisation");
  const sectorRoles = roles.filter((r) => r.category === "sector");

  const indented = new Set([
    "Assistant of the Head Office",
    "Assistant of Director's Office",
    "Assistant of Sector's Office",
  ]);

  function holders(roleId: number) {
    return staff.filter((s) => s.role_id === roleId).map((s) => s.full_name);
  }

  function RoleRow({ role }: { role: { id: number; name: string; rank: number } }) {
    const names = holders(role.id);
    return (
      <li
        className={`flex flex-wrap items-center justify-between gap-2 border-l-2 py-2 pl-4 ${
          indented.has(role.name) ? "ml-8 border-gold/60" : "border-primary/40"
        }`}
      >
        <span className="text-sm font-medium text-foreground">
          <span className="mr-2 text-xs text-muted-foreground">#{role.rank}</span>
          {role.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {names.length ? names.join(", ") : "vacant"}
        </span>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <h2 className="font-display text-2xl">Company hierarchy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ordered from the highest authority downwards. Rank #1 outranks all others.
        </p>
        <ul className="mt-5 space-y-1">
          {orgRoles.map((role) => (
            <RoleRow key={role.id} role={role} />
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Sectors</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isHeadOffice
                ? "The Head Office can create and remove sectors."
                : "Only the Head Office can create or remove sectors."}
            </p>
          </div>
          {isHeadOffice && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = sectorName.trim();
                if (!name) return;
                addSector.mutate(name);
              }}
            >
              <Input
                value={sectorName}
                maxLength={80}
                placeholder="New sector name"
                onChange={(e) => setSectorName(e.target.value)}
                className="w-56"
              />
              <Button type="submit" disabled={addSector.isPending}>
                <Plus className="size-4" /> Add
              </Button>
            </form>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {sectors.length === 0 && <p className="text-sm text-muted-foreground">No sectors yet.</p>}
          {sectors.map((sector) => (
            <div
              key={sector.id}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-4 py-3"
            >
              <div>
                <p className="font-medium">{sector.name}</p>
                <p className="text-xs text-muted-foreground">
                  {staff.filter((s) => s.sector_id === sector.id).length} member(s)
                </p>
              </div>
              {isHeadOffice && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${sector.name}`}
                  onClick={() => removeSector.mutate(sector.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <h3 className="mt-8 font-display text-xl">Roles inside a sector</h3>
        <ul className="mt-3 space-y-1">
          {sectorRoles.map((role) => (
            <RoleRow key={role.id} role={role} />
          ))}
        </ul>
      </section>
    </div>
  );
}
