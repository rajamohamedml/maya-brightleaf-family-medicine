import { createFileRoute } from "@tanstack/react-router";
import { Sun } from "lucide-react";
import { ComingSoon } from "@/components/maya/ComingSoon";

export const Route = createFileRoute("/clinic/")({
  head: () => ({
    meta: [
      { title: "Today — Brightleaf staff" },
      { name: "description", content: "Today's visits and what needs attention." },
      { property: "og:title", content: "Today — Brightleaf staff" },
      { property: "og:description", content: "Today's visits and what needs attention." },
    ],
  }),
  component: () => (
    <div>
      <h1 className="text-2xl font-semibold">Today</h1>
      <div className="mt-4">
        <ComingSoon icon={Sun} title="Today is coming soon" />
      </div>
    </div>
  ),
});
