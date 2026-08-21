import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useRoles, useSectors } from "@/hooks/useStaff";

export const Route = createFileRoute("/_authenticated/interviews")({
  head: () => ({
    meta: [
      { title: "Interviews | Bamboo Company Staff" },
      {
        name: "description",
        content: "Record candidate interviews for Bamboo Company and mark each one as passed or failed.",
      },
      { property: "og:title", content: "Interviews | Bamboo Company Staff" },
      {
        property: "og:description",
        content: "Candidate interview register with pass and fail outcomes for Bamboo Company staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InterviewsPage,
});

type InterviewRow = {
  id: string;
  candidate_name: string;
  date_of_birth: string | null;
  position_role_id: number;
  sector_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  decided_at: string | null;
};

const statusStyles: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  passed: "bg-primary/15 text-primary",
  failed: "bg-destructive/15 text-destructive",
};

function InterviewsPage() {
  const { data: profile } = useMyProfile();
  const { data: roles = [] } = useRoles();
  const { data: sectors = [] } = useSectors();
  const queryClient = useQueryClient();

  const myRank = profile?.role?.rank ?? 99;
  const canManage = myRank <= 22;

  const [candidateName, setCandidateName] = useState("");
  const [dob, setDob] = useState("");
  const [positionRoleId, setPositionRoleId] = useState<string>("");
  const [sectorId, setSectorId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSector, setFilterSector] = useState<string>("all");

  const { data: interviews = [] } = useQuery({
    queryKey: ["interviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interviews")
        .select(
          "id, candidate_name, date_of_birth, position_role_id, sector_id, status, notes, created_at, decided_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InterviewRow[];
    },
  });

  const addInterview = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Not signed in");
      const roleId = Number(positionRoleId);
      if (!candidateName.trim() || !roleId) throw new Error("Candidate name and position are required");
      const { error } = await supabase.from("interviews").insert({
        candidate_name: candidateName.trim(),
        date_of_birth: dob || null,
        position_role_id: roleId,
        sector_id: sectorId === "none" ? null : sectorId,
        notes: notes.trim() || null,
        created_by: profile.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCandidateName("");
      setDob("");
      setPositionRoleId("");
      setSectorId("none");
      setNotes("");
      toast.success("Interview added as pending");
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "passed" | "failed" }) => {
      const { error } = await supabase
        .from("interviews")
        .update({ status, decided_by: profile?.id ?? null, decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Outcome recorded");
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeInterview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("interviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Interview removed");
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleName = (id: number) => roles.find((r) => r.id === id)?.name ?? "Unknown position";
  const sectorName = (id: string | null) =>
    id ? (sectors.find((s) => s.id === id)?.name ?? "Unknown sector") : "No sector";

  const visible = interviews.filter(
    (i) =>
      (filterStatus === "all" || i.status === filterStatus) &&
      (filterSector === "all" ||
        (filterSector === "none" ? i.sector_id === null : i.sector_id === filterSector)),
  );

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <h1 className="font-display text-2xl">Interviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canManage
            ? "Manager level and above may add candidates and record a Pass or Fail outcome."
            : "Only Manager level and above may add candidates or record an outcome."}
        </p>

        {canManage && (
          <form
            className="mt-5 grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              addInterview.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="candidate">Candidate name</Label>
              <Input
                id="candidate"
                value={candidateName}
                maxLength={120}
                onChange={(e) => setCandidateName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Applying for position</Label>
              <Select value={positionRoleId} onValueChange={setPositionRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a position" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      #{r.rank} {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sector</Label>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sector" />
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                maxLength={1000}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={addInterview.isPending}>
                <Plus className="size-4" /> Add interview
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Interview register</h2>
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sectors</SelectItem>
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

        <ul className="mt-5 space-y-3">
          {visible.length === 0 && <p className="text-sm text-muted-foreground">No interviews recorded.</p>}
          {visible.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {i.candidate_name}
                  <span
                    className={`ml-3 rounded-full px-2 py-0.5 text-xs capitalize ${statusStyles[i.status] ?? ""}`}
                  >
                    {i.status}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {roleName(i.position_role_id)} · {sectorName(i.sector_id)}
                  {i.date_of_birth ? ` · born ${i.date_of_birth}` : ""} · added{" "}
                  {new Date(i.created_at).toLocaleString()}
                </p>
                {i.notes && <p className="mt-2 text-sm text-foreground/80">{i.notes}</p>}
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  {i.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => decide.mutate({ id: i.id, status: "passed" })}
                        disabled={decide.isPending}
                      >
                        <CheckCircle2 className="size-4" /> Pass
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => decide.mutate({ id: i.id, status: "failed" })}
                        disabled={decide.isPending}
                      >
                        <XCircle className="size-4" /> Fail
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove interview for ${i.candidate_name}`}
                    onClick={() => removeInterview.mutate(i.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
