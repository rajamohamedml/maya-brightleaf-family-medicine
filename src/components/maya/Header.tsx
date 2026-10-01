import { Link } from "@tanstack/react-router";
import { Mic } from "lucide-react";
import { LeafMark } from "./Logo";
import { VOICE_ENABLED } from "@/lib/clinic-info";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-4">
        <Link to="/" className="flex min-h-11 items-center gap-2 rounded-lg font-semibold text-foreground">
          <LeafMark />
          <span>Brightleaf Family Medicine</span>
        </Link>
        <div className="flex items-center gap-1">
        {VOICE_ENABLED && (
          <Link to="/chat" search={{ voice: 1 }} className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-accent">
            <Mic className="h-4 w-4" aria-hidden="true" /> Talk to Maya
          </Link>
        )}
        <Link to="/clinic" className="hidden min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground sm:flex">
          Staff
        </Link>
        </div>
      </div>
    </header>
  );
}
