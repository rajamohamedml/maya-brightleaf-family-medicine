import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { VIDEO_URL, videoEmbedUrl } from "@/lib/site";

export const Route = createFileRoute("/watch")({
  beforeLoad: () => {
    if (!VIDEO_URL || !videoEmbedUrl(VIDEO_URL)) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Watch the demo - Brightleaf Family Medicine" },
      { name: "description", content: "A 3-minute video tour of Maya and the Brightleaf clinic dashboard." },
      { property: "og:title", content: "Watch the demo - Brightleaf Family Medicine" },
      { property: "og:description", content: "Video tour of Maya, the AI front desk for Brightleaf Family Medicine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchPage,
});

function WatchPage() {
  const src = videoEmbedUrl(VIDEO_URL) ?? "";
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-10">
      <Link
        to="/"
        aria-label="Back to home"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Home className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-semibold">Home</span>
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Watch the 3-minute demo</h1>
      <div className="mt-8 aspect-video w-full overflow-hidden rounded-xl border border-border bg-card">
        <iframe
          src={src}
          title="Maya demo video"
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
