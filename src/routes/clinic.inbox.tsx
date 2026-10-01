import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { ComingSoon } from "@/components/maya/ComingSoon";

export const Route = createFileRoute("/clinic/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Brightleaf staff" },
      { name: "description", content: "Tasks, waitlist and leads to handle." },
      { property: "og:title", content: "Inbox — Brightleaf staff" },
      { property: "og:description", content: "Tasks, waitlist and leads to handle." },
    ],
  }),
  component: () => (
    <div>
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <div className="mt-4">
        <ComingSoon icon={Inbox} title="Inbox is coming soon" />
      </div>
    </div>
  ),
});
