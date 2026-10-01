import { Link, useLocation } from "@tanstack/react-router";
import { Stethoscope, Users, LogOut, Lock } from "lucide-react";
import { LeafMark } from "./Logo";

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function SideSwitch({ inClinic, email }: { inClinic: boolean; email?: string }) {
  const item = (active: boolean) =>
    `flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm transition-colors duration-150 md:px-3 ${focus} ${
      active ? "font-semibold text-primary" : "text-muted-foreground hover:text-primary"
    }`;
  return (
    <div className="flex items-center gap-1.5">
      <nav aria-label="Switch view" className="flex items-center">
        {!inClinic ? (
          <Link to="/" className={item(true)} aria-label="Patient site">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Patient site</span>
          </Link>
        ) : (
          <span className="flex items-center">
            <Link to="/clinic" className={item(true)} aria-label="Clinic dashboard">
              <Stethoscope className="h-4 w-4" aria-hidden="true" />
              <span className="hidden md:inline">Clinic dashboard</span>
            </Link>
            {email && (
              <span className="hidden max-w-56 truncate pl-1 text-sm text-muted-foreground sm:inline">
                Signed in as: {email}
              </span>
            )}
          </span>
        )}
      </nav>
    </div>
  );
}

export function Header({ onSignOut, email }: { onSignOut?: () => void; email?: string }) {
  const location = useLocation();
  const inClinic = location.pathname.startsWith("/clinic");
  const link = `flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-primary ${focus}`;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-[1100px] items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className={`flex min-h-11 items-center gap-2 rounded-lg font-semibold text-foreground ${focus}`}
          >
            <LeafMark />
            <span>Brightleaf Family Medicine</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <SideSwitch inClinic={inClinic && !!onSignOut} email={email} />
          {inClinic && onSignOut && (
            <button type="button" onClick={onSignOut} className={`${link} hidden sm:flex`}>
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out
            </button>
          )}
          {!inClinic && (
            <Link to="/clinic" className={`${link} hidden sm:flex`}>
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Clinic login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
