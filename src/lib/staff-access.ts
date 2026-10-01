import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffAccess = { status: "allowed" | "denied" | "signed_out"; email: string };

/** One cached staff check per session; cleared on sign-out (queryClient.clear). */
export const staffAccessQuery = queryOptions({
  queryKey: ["staff-access"],
  queryFn: async (): Promise<StaffAccess> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { status: "signed_out", email: "" };
    const { data: ok, error: roleErr } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "staff" });
    if (roleErr) throw roleErr;
    return { status: ok ? "allowed" : "denied", email: data.user.email ?? "" };
  },
  staleTime: Infinity,
  gcTime: Infinity,
  retry: 2,
});

/** checking | allowed | denied | signed_out — "denied" only once the role check has fully resolved. */
export function useStaffAccess(enabled = true) {
  const q = useQuery({ ...staffAccessQuery, enabled });
  if (!q.data || (q.isFetching && q.data.status !== "allowed")) return { state: "checking" as const, email: "" };
  return { state: q.data.status, email: q.data.email };
}
