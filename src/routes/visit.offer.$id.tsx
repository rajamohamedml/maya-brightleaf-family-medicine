import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { ComingSoon } from "@/components/maya/ComingSoon";

export const Route = createFileRoute("/visit/offer/$id")({
  head: () => ({
    meta: [
      { title: "A spot opened up — Brightleaf Family Medicine" },
      { name: "description", content: "A visit time opened up for you on the waitlist." },
      { property: "og:title", content: "A spot opened up — Brightleaf Family Medicine" },
      { property: "og:description", content: "A visit time opened up for you on the waitlist." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PageShell title="A spot opened up">
      <ComingSoon icon={Sparkles} title="Waitlist offers are coming soon" />
    </PageShell>
  ),
});
