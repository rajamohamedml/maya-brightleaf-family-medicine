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
  { to: "/clinic/activity", label: "Activity", icon: Activity },
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
      <Header />
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 gap-6 px-4 py-6 pb-24 md:pb-6">
        <nav aria-label="Staff" className="hidden w-48 shrink-0 md:block">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  activeOptions={{ exact: true }}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  activeProps={{ className: "bg-accent font-semibold !text-accent-foreground" }}
                >
                  <n.icon className="h-5 w-5" aria-hidden="true" />
                  {n.label}
                  {n.to === "/clinic/inbox" && <CountBadge n={inbox} />}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-border pt-4">
            <p className="truncate px-3 text-sm text-muted-foreground">{ctx.email}</p>
            <button onClick={signOut} className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <LogOut className="h-5 w-5" aria-hidden="true" /> Sign out
            </button>
          </div>
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
          <button onClick={signOut} className="mt-8 flex min-h-11 items-center gap-2 text-muted-foreground md:hidden">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </main>
      </div>
      <Footer />
      <nav aria-label="Staff" className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/90 backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((n) => (
            <li key={n.to}>
              <Link
                to={n.to}
                activeOptions={{ exact: true }}
                className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm text-muted-foreground"
                activeProps={{ className: "font-semibold !text-primary" }}
              >
                <n.icon className="h-5 w-5" aria-hidden="true" />
                {n.label}
                {n.to === "/clinic/inbox" && !!inbox && (
                  <span className="absolute right-[22%] top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-cta px-1 text-sm font-semibold leading-5 text-cta-foreground" aria-label={`${inbox} waiting`}>
                    {inbox}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
