import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditEvent = {
  action: string;
  entity_type: "document" | "user" | "role" | "sector";
  entity_id?: string | null;
  entity_label?: string | null;
  actor_id?: string | null;
  details?: Record<string, unknown>;
};

type AuthedClient = {
  from: (table: "profiles") => {
    select: (cols: string) => {
      eq: (col: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: unknown }>;
      };
    };
  };
};

/** Records one audit entry. Never throws: auditing must not break the action itself. */
export async function logAudit(event: AuditEvent, actor?: { name?: string | null; role?: string | null }) {
  try {
    await supabaseAdmin.from("audit_events").insert({
      action: event.action,
      entity_type: event.entity_type,
      entity_id: event.entity_id ?? null,
      entity_label: event.entity_label ?? null,
      actor_id: event.actor_id ?? null,
      actor_name: actor?.name ?? null,
      actor_role: actor?.role ?? null,
      details: (event.details ?? {}) as never,
    });
  } catch (error) {
    console.error("[audit] could not record event", error);
  }
}

/** Reads the acting user's display name and role for the audit entry. */
export async function resolveActor(supabase: unknown, userId: string) {
  try {
    const client = supabase as AuthedClient;
    const { data } = await client
      .from("profiles")
      .select("full_name, role:roles(name)")
      .eq("id", userId)
      .maybeSingle();
    const row = data as { full_name?: string; role?: { name?: string } | null } | null;
    return { name: row?.full_name ?? null, role: row?.role?.name ?? null };
  } catch {
    return { name: null, role: null };
  }
}
