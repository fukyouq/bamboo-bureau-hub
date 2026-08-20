import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MyProfile = {
  id: string;
  full_name: string;
  email: string;
  must_change_password: boolean;
  sector_id: string | null;
  role: { id: number; name: string; rank: number; category: string } | null;
};

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async (): Promise<MyProfile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, must_change_password, sector_id, role:roles(id, name, rank, category)")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as MyProfile | null) ?? null;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, rank, category")
        .order("rank");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
