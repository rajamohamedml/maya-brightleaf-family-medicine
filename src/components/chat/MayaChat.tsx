import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, CheckCircle2, ClipboardCheck, ClipboardList, Leaf, Loader2, Phone } from "lucide-react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/booking/Field";
import { addVisitToCalendar } from "@/components/booking/VisitCard";
import { createTask } from "@/lib/booking.functions";
import { EMERGENCY_MESSAGE } from "@/lib/booking-rules";
import { fmtLongDay, fmtTime } from "@/lib/tz";
import { VoicePanel } from "./VoicePanel";

const STARTERS = ["I'm new and need a physical", "I'm sick today", "Reschedule my visit", "Request a refill", "Do you take Aetna?"];

type Slot = { start_at: string; end_at: string; label: string };
type Booked = {
  ok: true;
  visit: { name: string; start_at: string; end_at: string; mode: "in_person" | "telehealth" };
  manage_url: string;
  intake_url: string;
};

function MayaAvatar() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
      <Leaf className="h-5 w-5" />
    </span>
  );
}

function EmergencyCard() {
  return (
    <div role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-4">
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" /> Emergency
      </p>
      <p className="mt-2 text-lg font-semibold">{EMERGENCY_MESSAGE}</p>
      <a href="tel:911" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-destructive px-4 font-semibold text-destructive-foreground">
        <Phone className="h-4 w-4" aria-hidden="true" /> Call 911
      </a>
    </div>
  );
}

function BookedCard({ b }: { b: Booked }) {
  return (
    <div className="rounded-xl border border-success/50 bg-success/10 p-4">
      <p className="flex items-center gap-2 font-semibold text-success">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Confirmed
      </p>
      <p className="mt-2 font-semibold">{b.visit.name}</p>
      <p className="text-muted-foreground">
        {fmtLongDay(b.visit.start_at)} · {fmtTime(b.visit.start_at)} Central Time
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/visit/$token" params={{ token: b.manage_url.split("/").pop() ?? "" }} className="inline-flex min-h-11 items-center rounded-xl bg-cta px-4 font-semibold text-cta-foreground hover:bg-cta/90">Manage visit</Link>
        <Link to="/intake/$token" params={{ token: b.intake_url.split("/").pop() ?? "" }} className="inline-flex min-h-11 items-center rounded-xl border border-input px-4 font-semibold hover:bg-accent">Complete intake</Link>
        <button type="button" onClick={() => addVisitToCalendar(b.visit)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold text-primary hover:bg-accent">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
        </button>
      </div>
    </div>
  );
}

function TaskCard({ kind }: { kind: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 p-4">
      <ClipboardCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
      <div>
        <p className="font-semibold">Request sent ({kind})</p>
        <p className="text-muted-foreground">The team will reply within 1 business day.</p>
      </div>
    </div>
  );
}

function Parts({ m, onPick }: { m: UIMessage; onPick: (s: Slot) => void }) {
  return (
    <>
      {m.parts.map((p, i) => {
        if (p.type === "text") return m.role === "user" ? <p key={i}>{p.text}</p> : <MessageResponse key={i}>{p.text}</MessageResponse>;
        if (p.type === "data-emergency") return <EmergencyCard key={i} />;
        if (!p.type.startsWith("tool-")) return null;
        const t = p as { type: string; state: string; output?: any };
        if (t.state !== "output-available") {
          return t.state === "output-error" ? null : (
            <p key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Checking…
            </p>
          );
        }
        const o = t.output;
        if (t.type === "tool-check_emergency" && o?.emergency) return <EmergencyCard key={i} />;
        if (t.type === "tool-get_availability" && Array.isArray(o?.slots) && o.slots.length)
          return (
            <div key={i} className="flex flex-wrap gap-2" role="group" aria-label="Open times">
              {(o.slots as Slot[]).map((s, j) => (
                <button
                  key={s.start_at}
                  type="button"
                  onClick={() => onPick(s)}
                  className={`min-h-12 rounded-xl border px-4 font-semibold transition-colors duration-150 ${j === 0 ? "border-primary bg-primary/15" : "border-border bg-card hover:border-surface-hover"}`}
                >
                  {s.label}
                  {j === 0 && <span className="sr-only"> (first available)</span>}
                </button>
              ))}
            </div>
          );
        if (t.type === "tool-book_appointment" && o?.ok) return <BookedCard key={i} b={o as Booked} />;
        if (t.type === "tool-create_task" && o?.ok) return <TaskCard key={i} kind={o.kind} />;
        return null;
      })}
    </>
  );
}

function CallbackForm({ onDone }: { onDone: () => void }) {
  const send = useServerFn(createTask);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (name.trim().length < 2) er["name"] = "Enter your name";
    if (phone.replace(/\D/g, "").length < 10) er["phone"] = "Enter a 10-digit phone number";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await send({ data: { name, phone, kind: "callback", details: "Requested from Maya chat" } });
      toast.success("Thanks! We'll call you within 1 business day.");
      onDone();
    } catch {
      toast.error("Couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="surface-tile mt-3 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field id="cb-name" label="Your name" value={name} onChange={(e) => setName(e.target.value)} error={errors["name"]} autoComplete="name" />
      <Field id="cb-phone" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors["phone"]} type="tel" autoComplete="tel" />
      <Button type="submit" disabled={busy} className="min-h-11 bg-cta text-cta-foreground hover:bg-cta/90">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Request callback
      </Button>
    </form>
  );
}

export function MayaChat({ voice = false, embedded = false }: { voice?: boolean; embedded?: boolean }) {
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/maya-chat" }),
  });
  const [input, setInput] = useState("");
  const [callback, setCallback] = useState(false);
  const busy = status === "submitted" || status === "streaming";
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (voice) wrap.current?.querySelector<HTMLButtonElement>('button[aria-label="Start talking"]')?.click();
  }, [voice]);

  const sendVoice = useCallback((text: string) => {
    sendMessage({ text }, { body: { channel: "voice" } });
    setInput("");
  }, [sendMessage]);

  const focus = () => wrap.current?.querySelector("textarea")?.focus();
  useEffect(() => {
    if (!busy) focus();
  }, [busy]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  };

  const last = messages.at(-1);
  const waiting = status === "submitted" || (status === "streaming" && last?.role === "assistant" && !last.parts.some((p) => p.type === "text" && p.text));

  return (
    <div ref={wrap} className={`surface-tile flex flex-col overflow-hidden rounded-xl border border-border ${embedded ? "h-[min(72vh,680px)] min-h-[560px]" : "h-[min(75vh,720px)]"}`}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <MayaAvatar />
        <div>
          <p className="font-semibold">Maya</p>
          <p className="text-sm text-muted-foreground">Front desk · Brightleaf Family Medicine</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-2 text-sm text-success"><span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />Available</span>
      </div>

      <Conversation className="flex-1">
        <ConversationContent aria-live="polite" className="gap-5 text-base">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <MayaAvatar />
                <p className="pt-1.5">Hi, I'm Maya. I can book a visit, answer questions about the clinic, or pass a message to the team. How can I help?</p>
              </div>
              <div className="flex flex-wrap gap-2 pl-12">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="min-h-11 rounded-full border border-border bg-card px-4 text-sm transition-colors duration-150 hover:border-surface-hover">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "assistant" ? "flex gap-3" : ""}>
              {m.role === "assistant" && <MayaAvatar />}
              <Message from={m.role}>
                <MessageContent className="text-base group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                  <Parts m={m} onPick={(s) => send(`Book the ${s.label} slot`)} />
                </MessageContent>
              </Message>
            </div>
          ))}
          {waiting && (
            <div className="flex items-center gap-3" aria-label="Maya is typing">
              <MayaAvatar />
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none" style={{ animationDelay: `${d * 150}ms` }} />
                ))}
              </span>
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-warning/50 bg-warning/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" aria-hidden="true" />
              <p>
                Maya is busy — use the{" "}
                <Link to="/book" className="font-semibold text-primary underline">
                  quick booking form
                </Link>
                .
              </p>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <PromptInput onSubmit={(msg) => (busy ? stop() : send(msg.text))}>
          <PromptInputTextarea
            aria-label="Message Maya"
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            className="text-base"
          />
          <PromptInputFooter className="items-center gap-1">
            <VoicePanel messages={messages} busy={busy} onTranscript={setInput} onSend={sendVoice} onEnd={focus} />
            <PromptInputSubmit status={status} disabled={!busy && !input.trim()} className="h-11 w-11 shrink-0 rounded-full bg-cta text-cta-foreground hover:bg-cta/90" />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-sm text-muted-foreground">Demo with fictional data - do not enter real health information.</p>
      </div>

      <div className="border-t border-border px-4 py-3">
        <button type="button" onClick={() => setCallback((v) => !v)} aria-expanded={callback} className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary">
          <ClipboardList className="h-4 w-4" aria-hidden="true" /> Prefer a person? Request a callback
        </button>
        {callback && <CallbackForm onDone={() => setCallback(false)} />}
      </div>
    </div>
  );
}
