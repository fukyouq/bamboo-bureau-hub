import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const newUserSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  date_of_birth: z.string().max(20).optional().nullable(),
  nationality: z.string().trim().max(80).optional().nullable(),
  country_of_birth: z.string().trim().max(80).optional().nullable(),
  race: z.string().trim().max(80).optional().nullable(),
  role_id: z.number().int().min(1).max(28),
  sector_id: z.string().uuid().optional().nullable(),
  must_change_password: z.boolean(),
});

async function requireRank(
  supabase: { rpc: (fn: "has_min_rank", args: { _rank: number }) => PromiseLike<{ data: unknown }> },
  rank: number,
) {
  const { data } = await supabase.rpc("has_min_rank", { _rank: rank });
  if (data !== true) throw new Error("Forbidden: your role cannot perform this action");
}

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => newUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireRank(context.supabase, 6);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account");

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      full_name: data.full_name,
      email: data.email,
      date_of_birth: data.date_of_birth || null,
      nationality: data.nationality || null,
      country_of_birth: data.country_of_birth || null,
      race: data.race || null,
      role_id: data.role_id,
      sector_id: data.sector_id || null,
      must_change_password: data.must_change_password,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }

    const { logAudit, resolveActor } = await import("./audit.server");
    await logAudit(
      {
        action: "user.created",
        entity_type: "user",
        entity_id: created.user.id,
        entity_label: data.full_name,
        actor_id: context.userId,
        details: {
          email: data.email,
          role_id: data.role_id,
          sector_id: data.sector_id ?? null,
          must_change_password: data.must_change_password,
        },
      },
      await resolveActor(context.supabase, context.userId),
    );
    return { ok: true as const, id: created.user.id };
  });

export const recordDocumentUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        document_id: z.string().uuid(),
        title: z.string().max(200),
        file_type: z.string().max(20),
        sector_id: z.string().uuid().nullable().optional(),
        role_ids: z.array(z.number().int()).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { logAudit, resolveActor } = await import("./audit.server");
    await logAudit(
      {
        action: "document.uploaded",
        entity_type: "document",
        entity_id: data.document_id,
        entity_label: data.title,
        actor_id: context.userId,
        details: {
          file_type: data.file_type,
          sector_id: data.sector_id ?? null,
          shared_role_ids: data.role_ids,
        },
      },
      await resolveActor(context.supabase, context.userId),
    );
    return { ok: true as const };
  });

export const recordRoleChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        user_name: z.string().max(200),
        from_role: z.string().max(120).nullable(),
        to_role: z.string().max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { logAudit, resolveActor } = await import("./audit.server");
    await logAudit(
      {
        action: "user.role_changed",
        entity_type: "role",
        entity_id: data.user_id,
        entity_label: data.user_name,
        actor_id: context.userId,
        details: { from_role: data.from_role, to_role: data.to_role },
      },
      await resolveActor(context.supabase, context.userId),
    );
    return { ok: true as const };
  });
