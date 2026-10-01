// Scheduled entry point for the follow-through engine. Caller must present the cron secret.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/hooks/run-automations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const body = z.object({ now: z.string().datetime({ offset: true }).optional() }).safeParse(await request.json().catch(() => ({})));
        if (!body.success) return Response.json({ error: "invalid_input" }, { status: 400 });
        const { getNow } = await import("@/lib/scheduling.server");
        const { runAutomations, summaryText } = await import("@/lib/automations.server");
        const now = body.data.now ? new Date(body.data.now) : await getNow();
        const summary = await runAutomations(now, new URL(request.url).origin);
        return Response.json({ ok: true, now: now.toISOString(), summary, text: summaryText(summary) });
      },
    },
  },
});
