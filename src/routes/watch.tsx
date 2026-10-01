import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Home, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/watch")({
  head: () => ({
    meta: [
      { title: "Watch the demo - Brightleaf Family Medicine" },
      { name: "description", content: "A short video tour of how to use Maya and the Brightleaf clinic dashboard." },
      { property: "og:title", content: "Watch the demo - Brightleaf Family Medicine" },
      { property: "og:description", content: "Video tour of Maya, the AI front desk for Brightleaf Family Medicine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchPage,
});

function WatchPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Watch the demo</h1>
      <p className="mt-2 text-muted-foreground">A quick tour of booking a visit and using the clinic dashboard.</p>
      <div className="mt-8 flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card text-center">
        <PlayCircle className="h-16 w-16 text-primary" aria-hidden="true" />
        <p className="font-semibold">Demo video coming soon</p>
        <p className="text-sm text-muted-foreground">Check back shortly for the walkthrough.</p>
      </div>
    </div>
  );
}
