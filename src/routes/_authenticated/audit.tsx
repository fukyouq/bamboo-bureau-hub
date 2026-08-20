import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/useStaff";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail | Bamboo Company Staff" },
      {
        name: "description",
        content:
          "Timestamped record of Bamboo Company document uploads, downloads and staff role changes with the responsible actor.",
      },
      { property: "og:title", content: "Audit Trail | Bamboo Company Staff" },
      {
        property: "og:description",
        content: "Who did what and when across documents and staff accounts at Bamboo Company.",
      },
    ],
  }),
  component: AuditPage,
});

const ACTION_LABELS: Record<string, string> = {
  "document.uploaded": "Document uploaded",
  "document.downloaded": "Document downloaded",
  "document.previewed": "Document previewed",
  "document.deleted": "Document deleted",
  "user.created": "Staff account created",
  "user.role_changed": "Role changed",
};

function AuditPage() {
  const { data: profile } = useMyProfile();
  const canView = (profile?.role?.rank ?? 99) <= 6;
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["audit-events"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_events")
        .select("id, action, entity_type, entity_label, actor_name, actor_role, details, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const query = search.trim().toLowerCase();
  const visible = events.filter((e) => {
    const kindOk =
      kind === "all" ||
      (kind === "documents" ? e.entity_type === "document" : e.entity_type !== "document");
    const haystack = `${ACTION_LABELS[e.action] ?? e.action} ${e.entity_label ?? ""} ${e.actor_name ?? ""} ${
      e.actor_role ?? ""
    }`.toLowerCase();
    return kindOk && (query === "" || haystack.includes(query));
  });

  if (!canView) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <h1 className="font-display text-2xl">Audit Trail</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The audit trail is available to the Director&apos;s Office and above.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <ShieldCheck className="size-5 text-gold" /> Audit Trail
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every document upload, preview, download and deletion, plus staff account and role changes —
          with the exact time and the person responsible.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_14rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              aria-label="Search the audit trail"
              placeholder="Search by action, document, staff member or actor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-kind" className="sr-only">
              Event kind
            </Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="audit-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activity</SelectItem>
                <SelectItem value="documents">Documents</SelectItem>
                <SelectItem value="people">People &amp; roles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <div className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading activity…</p>}
          {!isLoading && visible.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
          {visible.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {ACTION_LABELS[e.action] ?? e.action}
                  {e.entity_label ? <span className="text-muted-foreground"> — {e.entity_label}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.actor_name ?? "Unknown actor"}
                  {e.actor_role ? ` · ${e.actor_role}` : ""}
                </p>
              </div>
              <time className="text-xs text-muted-foreground" dateTime={e.created_at}>
                {new Date(e.created_at).toLocaleString()}
              </time>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
