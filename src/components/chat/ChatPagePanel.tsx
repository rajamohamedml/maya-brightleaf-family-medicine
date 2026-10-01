import { createContext, useContext } from "react";
import { ArrowLeft } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export type ChatPage = { kind: "visit" | "intake"; token: string };

/** Lets chat cards open visit/intake pages over the chat instead of leaving it. */
export const OpenChatPage = createContext<((p: ChatPage) => void) | null>(null);
export const useOpenChatPage = () => useContext(OpenChatPage);

export function ChatPagePanel({ page, onClose }: { page: ChatPage | null; onClose: () => void }) {
  const title = page?.kind === "intake" ? "Complete intake" : "Manage visit";
  const src = page ? `/${page.kind}/${encodeURIComponent(page.token)}` : "";
  return (
    <Sheet open={!!page} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-none flex-col gap-0 p-0 sm:max-w-xl [&>button]:hidden"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to chat
          </button>
          <SheetTitle className="ml-auto pr-2 text-base">{title}</SheetTitle>
          <SheetDescription className="sr-only">Your chat with Maya stays open underneath.</SheetDescription>
        </div>
        {page && <iframe title={title} src={src} className="w-full flex-1 border-0 bg-background" />}
      </SheetContent>
    </Sheet>
  );
}
