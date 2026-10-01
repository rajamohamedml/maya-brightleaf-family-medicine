import { Link } from "@tanstack/react-router";
import { LeafMark } from "./Logo";

export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-4">
        <Link to="/" className="flex min-h-11 items-center gap-2 rounded-lg font-semibold text-foreground">
          <LeafMark />
          <span>Brightleaf Family Medicine</span>
        </Link>
        <Link to="/clinic" className="hidden min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground sm:flex">
          Staff
        </Link>
      </div>
    </header>
  );
}
