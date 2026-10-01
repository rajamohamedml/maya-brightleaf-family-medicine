import { Link } from "@tanstack/react-router";
import { Eye, Info, LifeBuoy, MessageSquareHeart } from "lucide-react";

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const links = [
  { to: "/clinic", label: "Watch", icon: Eye },
  { to: "/guide", label: "Guide", icon: LifeBuoy },
  { to: "/feedback", label: "Feedback", icon: MessageSquareHeart },
] as const;

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Demo with fictional data - do not enter real health information.</p>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary ${focus}`}
            >
              <l.icon className="h-4 w-4" aria-hidden="true" />
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
