import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { ComingSoon } from "@/components/maya/ComingSoon";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a visit — Brightleaf Family Medicine" },
      { name: "description", content: "Book a visit with Dr. Rahman in about 2 minutes." },
      { property: "og:title", content: "Book a visit — Brightleaf Family Medicine" },
      { property: "og:description", content: "Book a visit with Dr. Rahman in about 2 minutes." },
    ],
  }),
  component: () => (
    <PageShell title="Book a visit" intro="We'll ask one question at a time.">
      <ComingSoon icon={CalendarCheck} title="Booking is coming soon" />
    </PageShell>
  ),
});
