import { createFileRoute } from "@tanstack/react-router";
import { CalendarCog } from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { ComingSoon } from "@/components/maya/ComingSoon";

export const Route = createFileRoute("/visit/$token")({
  head: () => ({
    meta: [
      { title: "Your visit — Brightleaf Family Medicine" },
      { name: "description", content: "See, confirm, move or cancel your visit." },
      { property: "og:title", content: "Your visit — Brightleaf Family Medicine" },
      { property: "og:description", content: "See, confirm, move or cancel your visit." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PageShell title="Your visit">
      <ComingSoon icon={CalendarCog} title="Managing your visit is coming soon" />
    </PageShell>
  ),
});
