import type { LucideIcon } from "lucide-react";
import { EmptyState } from "./EmptyState";

export function ComingSoon({ icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <EmptyState icon={icon} title={title}>
      This part of Maya is being built next.
    </EmptyState>
  );
}
