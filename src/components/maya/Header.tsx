import { Link, useLocation } from "@tanstack/react-router";
import { Mic, Stethoscope, Users, ExternalLink, Lock, Eye } from "lucide-react";
import { LeafMark } from "./Logo";
import { VOICE_ENABLED } from "@/lib/clinic-info";

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function SideSwitch({ inClinic }: { inClinic: boolean }) {
  const item = (active: boolean) =>
    `flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm transition-colors duration-150 md:px-3 ${focus} ${
      active ? "font-semibold text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;
  return (
    <div className="flex items-center gap-1.5">
      <nav aria-label="Switch view" className="flex items-center">
        <Link to="/" className={item(!inClinic)} aria-current={!inClinic ? "page" : undefined} aria-label="Patient site">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">Patient site</span>
        </Link>
        <Link to="/clinic" className={item(inClinic)} aria-current={inClinic ? "page" : undefined} aria-label={inClinic ? "Clinic dashboard" : "Watch the clinic dashboard"}>
          {inClinic ? (
            <Stethoscope className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden md:inline">{inClinic ? "Clinic dashboard" : "Watch"}</span>
        </Link>
      </nav>
    </div>
  );
}

export function Header() {
  const location = useLocation();
  const inClinic = location.pathname.startsWith("/clinic");
  const link = `flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground ${focus}`;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-[1100px] items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className={`flex min-h-11 items-center gap-2 rounded-lg font-semibold text-foreground ${focus}`}>
            <LeafMark />
            <span>Brightleaf Family Medicine</span>
          </Link>
          {inClinic && <span className="hidden text-sm font-semibold text-primary sm:inline">Clinic dashboard</span>}
        </div>
        <div className="flex items-center gap-1">
          <SideSwitch inClinic={inClinic} />
          {VOICE_ENABLED && !inClinic && (
            <Link to="/chat" search={{ voice: 1 }} className={`${link} font-semibold text-primary`}>
              <Mic className="h-4 w-4" aria-hidden="true" /> Talk to Maya
            </Link>
          )}
          {inClinic ? (
            <Link to="/" className={`${link} hidden sm:flex`}>
              View patient site <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <Link to="/clinic" className={`${link} hidden sm:flex`}>
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Clinic login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
