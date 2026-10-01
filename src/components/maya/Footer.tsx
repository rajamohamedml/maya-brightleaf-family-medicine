import { Info } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1100px] items-start gap-2 px-4 py-6 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>Demo with fictional data - do not enter real health information.</p>
      </div>
    </footer>
  );
}
