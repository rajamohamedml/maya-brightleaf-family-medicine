import { useState } from "react";
import { z } from "zod";
import { Bug, CheckCircle2, Lightbulb, MessageSquareHeart, Star } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const kinds = [
  { id: "bug", label: "Complaints", icon: Bug },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "general", label: "General", icon: Star },
] as const;
type Kind = (typeof kinds)[number]["id"];
type Note = { kind: Kind; name: string | null; text: string; at: string };

const feedbackSchema = z.object({
  kind: z.enum(["bug", "idea", "general"]),
  name: z
    .string()
    .trim()
    .max(60, "Please keep your name under 60 characters.")
    .transform((v) => (v ? v : null)),
  text: z.string().trim().min(1, "Please write your feedback.").max(1000, "Please keep it under 1,000 characters."),
});

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function FeedbackDialog({ triggerClassName }: { triggerClassName: string }) {
  const [tab, setTab] = useState<"send" | "see">("send");
  const [kind, setKind] = useState<Kind>("general");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = feedbackSchema.safeParse({ kind, name, text });
    if (!r.success) return setError(r.error.issues[0]?.message ?? "Please check the form.");
    setError("");
    setNotes((n) => [{ ...r.data, at: new Date().toLocaleString() }, ...n]);
    setText("");
    setName("");
    setSent(true);
  };

  const tabCls = (on: boolean) =>
    `min-h-11 border-b-2 px-1 text-sm font-semibold transition-colors ${focus} ${
      on ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"
    }`;

  return (
    <Dialog onOpenChange={(o) => !o && setSent(false)}>
      <DialogTrigger className={triggerClassName}>
        <MessageSquareHeart className="h-4 w-4" aria-hidden="true" />
        Feedback
      </DialogTrigger>
      <DialogContent className="feedback-panel max-w-md">
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
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">Thanks — your feedback was sent.</p>
                <button className={`mt-2 min-h-11 text-sm text-primary hover:underline ${focus}`} onClick={() => setSent(false)}>
                  Send more
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
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
                        on ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:text-primary"
                      }`}
                    >
                      <k.icon className="h-4 w-4" aria-hidden="true" />
                      {k.label}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="fb-name" className="text-sm font-semibold">Your name (optional)</label>
                <input
                  id="fb-name"
                  type="text"
                  maxLength={60}
                  autoComplete="given-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sam"
                  className="feedback-input min-h-11 w-full rounded-lg px-3"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="fb-text" className="text-sm font-semibold">Your feedback</label>
                <textarea
                  id="fb-text"
                  rows={4}
                  maxLength={1000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What worked well, or what felt confusing?"
                  aria-invalid={!!error}
                  aria-describedby={error ? "fb-error" : undefined}
                  className="feedback-input w-full rounded-lg px-3 py-2.5"
                />
              </div>
              {error && (
                <p id="fb-error" role="alert" className="text-sm text-muted-foreground">{error}</p>
              )}
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="min-h-11 flex-1 border-border bg-transparent text-foreground hover:bg-accent">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={!text.trim()} className="feedback-submit min-h-11 flex-1 font-semibold">
                  Send Feedback
                </Button>
              </div>
            </form>
          )
        ) : notes.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No feedback yet.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {notes.map((n, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold text-primary">
                  <span className="capitalize">{n.kind}</span> · {n.name ?? "Anonymous"}{" "}
                  <span className="font-normal text-muted-foreground">· {n.at}</span>
                </p>
                <p className="mt-1">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
