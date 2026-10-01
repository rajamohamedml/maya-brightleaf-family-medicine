import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/maya/ComingSoon";

export const Route = createFileRoute("/clinic/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — Brightleaf staff" },
      { name: "description", content: "The clinic's week at a glance." },
      { property: "og:title", content: "Schedule — Brightleaf staff" },
      { property: "og:description", content: "The clinic's week at a glance." },
    ],
  }),
  component: () => (
    <div>
      <h1 className="text-2xl font-semibold">Schedule</h1>
      <div className="mt-4">
        <ComingSoon icon={CalendarDays} title="Schedule is coming soon" />
      </div>
    </div>
  ),
});
