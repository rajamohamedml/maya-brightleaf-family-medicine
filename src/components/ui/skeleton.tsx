import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-tile animate-pulse rounded-md border border-border", className)} {...props} />;
}

export { Skeleton };
