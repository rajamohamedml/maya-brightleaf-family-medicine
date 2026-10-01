import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CalendarDays, Inbox, LogOut, ShieldX, Sun, type LucideIcon } from "lucide-react";
import { Header } from "@/components/maya/Header";
import { Footer } from "@/components/maya/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getNavCounts } from "@/lib/staff.functions";

export const Route = createFileRoute("/clinic")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ location }) => {
    if (location.pathname.startsWith("/clinic/login")) return { isStaff: false };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/clinic/login" });
    const { data: ok } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "staff" });
    return { isStaff: !!ok, email: data.user.email ?? "" };
  },
  component: ClinicLayout,
});

type NavTo = "/clinic" | "/clinic/schedule" | "/clinic/inbox" | "/clinic/activity";
const NAV: { to: NavTo; label: string; icon: LucideIcon }[] = [
  { to: "/clinic", label: "Today", icon: Sun },
  { to: "/clinic/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/clinic/inbox", label: "Inbox", icon: Inbox },
  { to: "/clinic/activity", label: "Maya's Activity", icon: Activity },
];

function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/clinic/login", replace: true });
  };
}

function CountBadge({ n }: { n?: number | undefined }) {
  if (!n) return null;
  return (
    <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-cta px-1.5 text-sm font-semibold text-cta-foreground" aria-label={`${n} waiting`}>
      {n}
    </span>
  );
}

function ClinicLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ctx = Route.useRouteContext();
  const signOut = useSignOut();
  const isLogin = pathname.startsWith("/clinic/login");
  const counts = useServerFn(getNavCounts);
  const q = useQuery({ queryKey: ["staff", "nav"], queryFn: () => counts(), enabled: !isLogin && ctx.isStaff, staleTime: 30_000 });

  if (isLogin) return <Outlet />;
  if (!ctx.isStaff) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
          <ShieldX className="h-10 w-10 text-warning" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-semibold">You don't have access</h1>
          <p className="mt-2 text-muted-foreground">This account isn't set up as clinic staff. Ask Dr. Rahman to add you.</p>
          <Button variant="outline" className="mt-6 min-h-11" onClick={signOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </Button>
        </main>
        <Footer />
      </div>
    );
  }
  const inbox = q.data?.inbox;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header onSignOut={signOut} email={ctx.email} />
      <nav aria-label="Staff" className="border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full items-center gap-2 overflow-x-auto px-4 py-2 lg:px-6">
          <ul className="flex min-w-max items-center gap-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  activeOptions={{ exact: true }}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-transparent px-3 text-sm text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-accent-foreground"
                  activeProps={{ className: "border-border bg-accent font-semibold !text-primary" }}
                >
                  <n.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {n.label}
                  {n.to === "/clinic/inbox" && <CountBadge n={inbox} />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <div className="flex w-full flex-1 px-4 py-5 lg:px-6">
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
