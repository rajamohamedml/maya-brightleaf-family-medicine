import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { ComingSoon } from "@/components/maya/ComingSoon";

export const Route = createFileRoute("/clinic/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Brightleaf staff" },
      { name: "description", content: "What Maya did and the time it saved." },
      { property: "og:title", content: "Activity — Brightleaf staff" },
      { property: "og:description", content: "What Maya did and the time it saved." },
    ],
  }),
  component: () => (
    <div>
      <h1 className="text-2xl font-semibold">Activity</h1>
      <div className="mt-4">
        <ComingSoon icon={Activity} title="Activity is coming soon" />
      </div>
    </div>
  ),
});
