import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Activity, CalendarDays, Inbox, Sun, type LucideIcon } from "lucide-react";
import { Header } from "@/components/maya/Header";
import { Footer } from "@/components/maya/Footer";

export const Route = createFileRoute("/clinic")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: ClinicLayout,
});

const NAV: { to: "/clinic" | "/clinic/schedule" | "/clinic/inbox" | "/clinic/activity"; label: string; icon: LucideIcon }[] = [
  { to: "/clinic", label: "Today", icon: Sun },
  { to: "/clinic/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/clinic/inbox", label: "Inbox", icon: Inbox },
  { to: "/clinic/activity", label: "Activity", icon: Activity },
];

function ClinicLayout() {
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
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <Footer />
      <nav aria-label="Staff" className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((n) => (
            <li key={n.to}>
              <Link
                to={n.to}
                activeOptions={{ exact: true }}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm text-muted-foreground"
                activeProps={{ className: "font-semibold !text-primary" }}
              >
                <n.icon className="h-5 w-5" aria-hidden="true" />
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
