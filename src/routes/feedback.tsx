import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback - Brightleaf Family Medicine" },
      { name: "description", content: "Tell the Brightleaf Family Medicine team how we can improve. Demo site with fictional data." },
      { property: "og:title", content: "Feedback - Brightleaf Family Medicine" },
      { property: "og:description", content: "Tell us how we can improve your experience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

export default function FeedbackPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 lg:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Feedback</h1>
      <p className="mt-2 text-muted-foreground">
        Tell us what worked and what didn't. Dr. Rahman reads every note.
      </p>

      {sent ? (
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-card p-5" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="font-semibold">Thank you - your feedback is noted.</p>
            <p className="mt-1 text-muted-foreground">This demo doesn't send anything anywhere, but we appreciate you trying it.</p>
          </div>
        </div>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div>
            <label htmlFor="fb-name" className="mb-1 block text-sm font-medium">Your name (optional)</label>
            <input
              id="fb-name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Jordan Smith"
              className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="fb-message" className="mb-1 block text-sm font-medium">Your feedback</label>
            <textarea
              id="fb-message"
              required
              rows={5}
              placeholder="What can we do better?"
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <Button type="submit" className="min-h-11 w-full bg-cta text-cta-foreground hover:bg-cta/90">
            <MessageSquareHeart className="h-4 w-4" aria-hidden="true" /> Send feedback
          </Button>
          <p className="text-sm text-muted-foreground">Demo with fictional data - do not enter real health information.</p>
        </form>
      )}
    </div>
  );
}
