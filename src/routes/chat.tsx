import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Mic } from "lucide-react";
import { z } from "zod";
import { PageShell } from "@/components/maya/PageShell";
import { ComingSoon } from "@/components/maya/ComingSoon";

export const Route = createFileRoute("/chat")({
  validateSearch: z.object({ voice: z.coerce.number().optional() }),
  head: () => ({
    meta: [
      { title: "Chat with Maya — Brightleaf Family Medicine" },
      { name: "description", content: "Chat or talk with Maya, the clinic's AI front desk." },
      { property: "og:title", content: "Chat with Maya — Brightleaf Family Medicine" },
      { property: "og:description", content: "Chat or talk with Maya, the clinic's AI front desk." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { voice } = Route.useSearch();
  return (
    <PageShell title={voice ? "Talk to Maya" : "Chat with Maya"}>
      <ComingSoon icon={voice ? Mic : MessageCircle} title="Maya is getting ready" />
    </PageShell>
  );
}
