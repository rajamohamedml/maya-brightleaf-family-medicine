import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChatActivity = "idle" | "thinking" | "listening" | "speaking" | "ended";

export function ActiveChatFrame({
  state,
  className,
  children,
}: {
  state: ChatActivity;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("chat-active-frame", className)} data-chat-state={state}>
      <div className="chat-active-frame-inner">{children}</div>
    </div>
  );
}