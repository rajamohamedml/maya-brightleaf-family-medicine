import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { ComingSoon } from "@/components/maya/ComingSoon";

export const Route = createFileRoute("/intake/$token")({
  head: () => ({
    meta: [
      { title: "Check-in form — Brightleaf Family Medicine" },
      { name: "description", content: "Fill in your short check-in form before your visit." },
      { property: "og:title", content: "Check-in form — Brightleaf Family Medicine" },
      { property: "og:description", content: "Fill in your short check-in form before your visit." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PageShell title="Check-in form">
      <ComingSoon icon={ClipboardList} title="The check-in form is coming soon" />
    </PageShell>
  ),
});
