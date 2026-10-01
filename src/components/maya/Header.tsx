import { Link } from "@tanstack/react-router";
import { LeafMark } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-4">
        <Link to="/" className="flex min-h-11 items-center gap-2 rounded-lg font-semibold text-foreground">
          <LeafMark />
          <span>Brightleaf Family Medicine</span>
        </Link>
        <Link to="/clinic" className="hidden min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground sm:flex">
          Staff
        </Link>
      </div>
    </header>
  );
}
