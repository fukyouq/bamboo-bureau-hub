import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/useStaff";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Password | Bamboo Company Staff" },
      { name: "description", content: "Change your Bamboo Company staff portal password." },
      { property: "og:title", content: "Password | Bamboo Company Staff" },
      { property: "og:description", content: "Change your staff portal password." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { data: profile } = useMyProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error && profile) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", profile.id);
    }
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    toast.success("Password updated");
    navigate({ to: "/hierarchy" });
  }

  return (
    <div className="max-w-lg rounded-xl border border-border bg-card p-6 shadow-elegant">
      <h2 className="font-display text-2xl">Change password</h2>
      {profile?.must_change_password && (
        <p className="mt-2 rounded-md bg-accent/20 px-3 py-2 text-sm text-foreground">
          Your password must be changed before you continue using the portal.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={72}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
