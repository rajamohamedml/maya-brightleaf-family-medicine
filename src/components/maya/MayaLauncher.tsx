import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { LoadingSkeleton } from "./LoadingSkeleton";

const MayaChat = lazy(() => import("@/components/chat/MayaChat").then((module) => ({ default: module.MayaChat })));

export function MayaLauncher() {
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  useEffect(() => setReady(window.self === window.top), []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setUnread(false);
  }, []);

  const handleAssistantMessage = useCallback(() => {
    if (!open) setUnread(true);
  }, [open]);

  if (!ready || pathname === "/chat" || pathname.startsWith("/clinic")) return null;

  return (
    <>
      <Button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label="Chat with Maya"
        className="maya-launcher fixed right-4 z-40 h-14 w-14 rounded-full px-0 text-chat-launcher-foreground sm:right-6 sm:w-auto sm:px-5"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
        <span className="hidden sm:inline">Chat with Maya</span>
        {unread && <span className="maya-launcher-unread" aria-label="New message from Maya" />}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          forceMount
          side="right"
          className="flex h-full w-full max-w-none flex-col gap-0 border-0 bg-background/95 p-2 shadow-2xl backdrop-blur-md data-[state=closed]:invisible data-[state=closed]:pointer-events-none sm:w-[min(92vw,540px)] sm:max-w-[540px] sm:p-3 [&>button]:right-5 [&>button]:top-5 [&>button]:z-20 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-background/80"
        >
          <SheetTitle className="sr-only">Chat with Maya</SheetTitle>
          <SheetDescription className="sr-only">Maya can help book a visit or answer clinic questions.</SheetDescription>
          <Suspense fallback={<div className="p-4"><LoadingSkeleton rows={8} /></div>}>
            <MayaChat embedded onAssistantMessage={handleAssistantMessage} />
          </Suspense>
        </SheetContent>
      </Sheet>
    </>
  );
}