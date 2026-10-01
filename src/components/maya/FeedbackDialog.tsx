import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { feedbackSchema, listFeedback, submitFeedback } from "@/lib/feedback.functions";
import { Bug, CheckCircle2, Lightbulb, MessageSquareHeart, Star } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StarRating, StarsDisplay, ratingLabels } from "./StarRating";

const kinds = [
  { id: "bug", label: "Complaints", icon: Bug },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "general", label: "General", icon: Star },
] as const;
type Kind = (typeof kinds)[number]["id"];

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function FeedbackDialog({ triggerClassName }: { triggerClassName: string }) {
  const [tab, setTab] = useState<"send" | "see">("send");
  const [kind, setKind] = useState<Kind>("general");
  const [name, setName] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const send = useServerFn(submitFeedback);
  const fetchNotes = useServerFn(listFeedback);
  const notesQ = useQuery({ queryKey: ["feedback"], queryFn: () => fetchNotes(), enabled: tab === "see" });
  const notes = notesQ.data ?? [];

  const rated = notes.filter((n) => n.rating != null);
  const avg = rated.length ? rated.reduce((s, n) => s + (n.rating ?? 0), 0) / rated.length : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = feedbackSchema.safeParse({ kind, name, rating, text });
    if (!r.success) return setError(r.error.issues[0]?.message ?? "Please check the form.");
    setError("");
    setSaving(true);
    try {
      await send({ data: { kind, name, rating, text } });
    } catch {
      setSaving(false);
      return setError("We couldn't send your feedback. Please try again.");
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["feedback"] });
    setText("");
    setName("");
    setRating(null);
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
                <p id="fb-rating" className="text-sm font-semibold">Rating (optional)</p>
                <StarRating value={rating} onChange={setRating} />
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
                <Button type="submit" disabled={!text.trim() || saving} className="feedback-submit min-h-11 flex-1 font-semibold">
                  Send Feedback
                </Button>
              </div>
            </form>
          )
        ) : notesQ.isLoading ? (
          <p className="py-6 text-center text-muted-foreground" role="status">Loading feedback…</p>
        ) : notesQ.isError ? (
          <div className="py-6 text-center">
            <p className="text-muted-foreground">We couldn't load feedback.</p>
            <Button variant="outline" className="mt-2 min-h-11" onClick={() => notesQ.refetch()}>Try again</Button>
          </div>
        ) : notes.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No feedback yet.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              {rated.length ? (
                <>
                  {avg.toFixed(1)} <span className="text-primary" aria-hidden="true">★</span>
                  <span className="sr-only">stars</span> from {rated.length} rating{rated.length > 1 ? "s" : ""}
                </>
              ) : (
                <span className="text-muted-foreground">No ratings yet</span>
              )}
            </p>
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-primary">
                    <span className="capitalize">{n.kind}</span> · {n.name ?? "Anonymous"}{" "}
                    <span className="font-normal text-muted-foreground">· {new Date(n.created_at).toLocaleString()}</span>
                  </p>
                  {n.rating != null && (
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <StarsDisplay value={n.rating} /> {ratingLabels[n.rating]}
                    </p>
                  )}
                  <p className="mt-1 [overflow-wrap:anywhere]">{n.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
