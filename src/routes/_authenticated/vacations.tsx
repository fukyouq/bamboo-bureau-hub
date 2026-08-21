import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, Trash2, X } from "lucide-react";
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
import { useMyProfile, useSectors } from "@/hooks/useStaff";

export const Route = createFileRoute("/_authenticated/vacations")({
  head: () => ({
    meta: [
      { title: "Vacation Days | Bamboo Company Staff" },
      {
        name: "description",
        content:
          "Request Bamboo Company vacation days per sector, for medical or non-medical purposes, with tiered approval.",
      },
      { property: "og:title", content: "Vacation Days | Bamboo Company Staff" },
      {
        property: "og:description",
        content: "Sector vacation requests with medical purpose tracking and tiered approval limits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VacationsPage,
});

type VacationRow = {
  id: string;
  requester_id: string;
  sector_id: string | null;
  start_date: string;
  end_date: string;
  days: number;
  is_medical: boolean;
  reason: string | null;
  status: string;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

const statusStyles: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  approved: "bg-primary/15 text-primary",
  denied: "bg-destructive/15 text-destructive",
};

function dayCount(start: string, end: string) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.round(ms / 86400000) + 1;
}

function VacationsPage() {
  const { data: profile } = useMyProfile();
  const { data: sectors = [] } = useSectors();
  const queryClient = useQueryClient();

  const myRank = profile?.role?.rank ?? 99;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [purpose, setPurpose] = useState<"medical" | "non_medical">("non_medical");
  const [reason, setReason] = useState("");
  const [sectorId, setSectorId] = useState<string>("mine");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSector, setFilterSector] = useState<string>("all");

  const days = dayCount(startDate, endDate);

  const { data: requests = [] } = useQuery({
    queryKey: ["vacation-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select(
          "id, requester_id, sector_id, start_date, end_date, days, is_medical, reason, status, decision_note, decided_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VacationRow[];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role:roles(name, rank)")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string; role: { name: string; rank: number } | null }[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Not signed in");
      if (days <= 0) throw new Error("Pick a valid start and end date");
      const { error } = await supabase.from("vacation_requests").insert({
        requester_id: profile.id,
        sector_id: sectorId === "mine" ? profile.sector_id : sectorId === "none" ? null : sectorId,
        start_date: startDate,
        end_date: endDate,
        days,
        is_medical: purpose === "medical",
        reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setStartDate("");
      setEndDate("");
      setReason("");
      setPurpose("non_medical");
      toast.success("Vacation request submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["vacation-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "denied" }) => {
      const { error } = await supabase
        .from("vacation_requests")
        .update({ status, decided_by: profile?.id ?? null, decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      queryClient.invalidateQueries({ queryKey: ["vacation-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vacation_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request withdrawn");
      queryClient.invalidateQueries({ queryKey: ["vacation-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function canDecide(row: VacationRow) {
    if (row.status !== "pending") return false;
    if (row.requester_id === profile?.id) return false;
    return row.days > 20 ? myRank <= 9 : myRank <= 22;
  }

  const staffName = (id: string) => staff.find((s) => s.id === id)?.full_name ?? "Unknown staff";
  const staffRole = (id: string) => staff.find((s) => s.id === id)?.role?.name ?? "";
  const sectorName = (id: string | null) =>
    id ? (sectors.find((s) => s.id === id)?.name ?? "Unknown sector") : "No sector";

  const visible = requests.filter(
    (r) =>
      (filterStatus === "all" || r.status === filterStatus) &&
      (filterSector === "all" ||
        (filterSector === "none" ? r.sector_id === null : r.sector_id === filterSector)),
  );

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <h1 className="font-display text-2xl">Vacation days</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Any member of staff may request vacation days for their sector. Requests of 20 days or fewer are
          handled from Director of Sector down to Manager; anything longer than 20 days must be approved by the
          Sector&apos;s Office or above.
        </p>

        <form
          className="mt-5 grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="start">First day</Label>
            <Input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">Last day</Label>
            <Input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v as "medical" | "non_medical")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medical">Medical purposes</SelectItem>
                <SelectItem value="non_medical">Non-medical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sector</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">My sector</SelectItem>
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
            <Label htmlFor="reason">Reason / details</Label>
            <Textarea
              id="reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 md:col-span-2">
            <Button type="submit" disabled={submit.isPending || days <= 0}>
              <CalendarPlus className="size-4" /> Request vacation
            </Button>
            <p className="text-sm text-muted-foreground">
              {days > 0
                ? `${days} day(s) — needs ${days > 20 ? "Sector's Office or above" : "Director of Sector to Manager"} approval`
                : "Select dates to see the number of days."}
            </p>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Requests</h2>
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
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
          {visible.length === 0 && <p className="text-sm text-muted-foreground">No vacation requests.</p>}
          {visible.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {staffName(r.requester_id)}
                  <span
                    className={`ml-3 rounded-full px-2 py-0.5 text-xs capitalize ${statusStyles[r.status] ?? ""}`}
                  >
                    {r.status}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {staffRole(r.requester_id)} · {sectorName(r.sector_id)} · {r.start_date} → {r.end_date} ·{" "}
                  {r.days} day(s) · {r.is_medical ? "medical" : "non-medical"}
                </p>
                {r.reason && <p className="mt-2 text-sm text-foreground/80">{r.reason}</p>}
              </div>
              <div className="flex items-center gap-2">
                {canDecide(r) && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => decide.mutate({ id: r.id, status: "approved" })}
                      disabled={decide.isPending}
                    >
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide.mutate({ id: r.id, status: "denied" })}
                      disabled={decide.isPending}
                    >
                      <X className="size-4" /> Deny
                    </Button>
                  </>
                )}
                {r.requester_id === profile?.id && r.status === "pending" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Withdraw request"
                    onClick={() => withdraw.mutate(r.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
