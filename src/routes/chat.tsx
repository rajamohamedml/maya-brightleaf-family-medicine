import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { z } from "zod";
import { PageShell } from "@/components/maya/PageShell";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";

const MayaChat = lazy(() => import("@/components/chat/MayaChat").then((m) => ({ default: m.MayaChat })));

export const Route = createFileRoute("/chat")({
  validateSearch: z.object({ voice: z.coerce.number().optional() }),
  head: () => ({
    meta: [
      { title: "Chat with Maya — Brightleaf Family Medicine" },
      { name: "description", content: "Chat with Maya, the clinic's AI front desk. Book a visit, ask about insurance or request a refill." },
      { property: "og:title", content: "Chat with Maya — Brightleaf Family Medicine" },
      { property: "og:description", content: "Chat with Maya, the clinic's AI front desk. Fictional demo clinic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <PageShell title="Chat with Maya" intro="Book a visit, ask a question, or send a message to the team.">
      <Suspense fallback={<LoadingSkeleton rows={6} />}>
        <MayaChat />
      </Suspense>
    </PageShell>
  );
}
