import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/maya-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMayaChat } = await import("@/lib/maya-chat.server");
        return handleMayaChat(request);
      },
    },
  },
});
