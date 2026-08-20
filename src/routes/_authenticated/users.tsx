import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useRoles, useSectors } from "@/hooks/useStaff";
import { createStaffUser } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users | Bamboo Company Staff" },
      { name: "description", content: "Bamboo Company staff directory and account creation for the Director's Office." },
      { property: "og:title", content: "Users | Bamboo Company Staff" },
      { property: "og:description", content: "Staff directory and account management for Bamboo Company." },
    ],
  }),
  component: UsersPage,
});

const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  date_of_birth: "",
  nationality: "",
  country_of_birth: "",
  race: "",
  role_id: "",
  sector_id: "none",
  must_change_password: true,
};

function UsersPage() {
  const { data: profile } = useMyProfile();
  const { data: roles = [] } = useRoles();
  const { data: sectors = [] } = useSectors();
  const queryClient = useQueryClient();
  const createUser = useServerFn(createStaffUser);
  const [form, setForm] = useState(emptyForm);

  const canManage = (profile?.role?.rank ?? 99) <= 6;

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, date_of_birth, nationality, country_of_birth, race, must_change_password, sector_id, role:roles(name, rank)",
        )
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () =>
      createUser({
        data: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          date_of_birth: form.date_of_birth || null,
          nationality: form.nationality.trim() || null,
          country_of_birth: form.country_of_birth.trim() || null,
          race: form.race.trim() || null,
          role_id: Number(form.role_id),
          sector_id: form.sector_id === "none" ? null : form.sector_id,
          must_change_password: form.must_change_password,
        },
      }),
    onSuccess: () => {
      setForm(emptyForm);
      toast.success("Staff member added");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-by-role"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-8">
      {canManage && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
          <h2 className="font-display text-2xl">Add a staff member</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Available to the Director&apos;s Office and above.
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.role_id) {
                toast.error("Select a role");
                return;
              }
              if (form.password.length < 8) {
                toast.error("Password must be at least 8 characters");
                return;
              }
              submit.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Names</Label>
                <Input
                  id="full_name"
                  required
                  maxLength={120}
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => set("date_of_birth", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  maxLength={80}
                  value={form.nationality}
                  onChange={(e) => set("nationality", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country_of_birth">Country of birth</Label>
                <Input
                  id="country_of_birth"
                  maxLength={80}
                  value={form.country_of_birth}
                  onChange={(e) => set("country_of_birth", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="race">Race</Label>
                <Input
                  id="race"
                  maxLength={80}
                  value={form.race}
                  onChange={(e) => set("race", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  maxLength={72}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={form.role_id} onValueChange={(v) => set("role_id", v)}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        #{r.rank} · {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector">Sector</Label>
                <Select value={form.sector_id} onValueChange={(v) => set("sector_id", v)}>
                  <SelectTrigger id="sector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No sector</SelectItem>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.must_change_password}
                onCheckedChange={(checked) => set("must_change_password", checked === true)}
              />
              Require a password change at first login
            </label>
            <Button type="submit" disabled={submit.isPending}>
              <UserPlus className="size-4" /> {submit.isPending ? "Creating…" : "Create account"}
            </Button>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <h2 className="font-display text-2xl">Staff directory</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Sector</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Born</th>
                <th className="py-2 pr-4">Nationality</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 pr-4 font-medium">{s.full_name}</td>
                  <td className="py-2 pr-4">{s.role?.name ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {sectors.find((sec) => sec.id === s.sector_id)?.name ?? "—"}
                  </td>
                  <td className="py-2 pr-4">{s.email}</td>
                  <td className="py-2 pr-4">{s.date_of_birth ?? "—"}</td>
                  <td className="py-2 pr-4">{s.nationality ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
