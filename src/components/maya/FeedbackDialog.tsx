import { useState } from "react";
import { Bug, CheckCircle2, Lightbulb, MessageSquareHeart, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const kinds = [
  { id: "bug", label: "Complaints", icon: Bug },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "general", label: "General", icon: Star },
] as const;
type Kind = (typeof kinds)[number]["id"];
type Note = { kind: Kind; text: string; at: string };

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function FeedbackDialog({ triggerClassName }: { triggerClassName: string }) {
  const [tab, setTab] = useState<"send" | "see">("send");
  const [kind, setKind] = useState<Kind>("general");
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setNotes((n) => [{ kind, text: text.trim(), at: new Date().toLocaleString() }, ...n]);
    setText("");
    setSent(true);
  };

  const tabCls = (on: boolean) =>
    `min-h-11 border-b-2 px-1 text-sm font-semibold transition-colors ${focus} ${
      on ? "border-cta text-cta" : "border-transparent text-muted-foreground hover:text-primary"
    }`;

  return (
    <Dialog onOpenChange={(o) => !o && setSent(false)}>
      <DialogTrigger className={triggerClassName}>
        <MessageSquareHeart className="h-4 w-4" aria-hidden="true" />
        Feedback
      </DialogTrigger>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogTitle className="sr-only">Feedback</DialogTitle>
        <DialogDescription className="sr-only">Send feedback or see what you've sent.</DialogDescription>
        <div role="tablist" className="flex gap-6 border-b border-border pr-8">
          <button role="tab" aria-selected={tab === "send"} className={tabCls(tab === "send")} onClick={() => setTab("send")}>
            Send Feedback
          </button>
          <button role="tab" aria-selected={tab === "see"} className={tabCls(tab === "see")} onClick={() => setTab("see")}>
            See Feedback{notes.length ? ` (${notes.length})` : ""}
          </button>
        </div>

        {tab === "send" ? (
          sent ? (
            <div className="flex items-start gap-3 py-4" role="status" aria-live="polite">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="font-semibold">Thank you - your feedback is noted.</p>
                <button className={`mt-2 min-h-11 text-sm text-primary hover:underline ${focus}`} onClick={() => setSent(false)}>
                  Send more
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Feedback type">
                {kinds.map((k) => {
                  const on = kind === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setKind(k.id)}
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full border text-sm transition-colors ${focus} ${
                        on ? "border-cta bg-cta/15 text-cta" : "border-border text-foreground hover:text-primary"
                      }`}
                    >
                      <k.icon className="h-4 w-4" aria-hidden="true" />
                      {k.label}
                    </button>
                  );
                })}
              </div>
              <label htmlFor="fb-text" className="sr-only">Your feedback</label>
              <textarea
                id="fb-text"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What worked well, or what felt confusing?"
                className={`w-full rounded-lg border border-border bg-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground ${focus}`}
              />
              <Button type="submit" disabled={!text.trim()} className="min-h-11 w-full bg-cta text-cta-foreground hover:bg-cta/90">
                Send Feedback
              </Button>
            </form>
          )
        ) : notes.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No feedback yet.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {notes.map((n, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold capitalize text-primary">{n.kind} <span className="font-normal text-muted-foreground">· {n.at}</span></p>
                <p className="mt-1">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
