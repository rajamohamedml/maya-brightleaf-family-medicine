import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChatPagePanel, OpenChatPage, useOpenChatPage, type ChatPage } from "./ChatPagePanel";
import { clearChatSession, loadChatSession, saveChatSession, SESSION_IDLE_MS } from "./chat-session";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Leaf,
  Loader2,
  Phone,
  Send,
  Square,
  CalendarClock,
  XCircle,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/booking/Field";
import { addVisitToCalendar } from "@/components/booking/VisitCard";
import { createTask } from "@/lib/booking.functions";
import { EMERGENCY_MESSAGE } from "@/lib/booking-rules";
import { fmtLongDay, fmtTime } from "@/lib/tz";
import { IDLE_PROMPTS, VoicePanel, VOICE_FAREWELL, VOICE_GREETING } from "./VoicePanel";
import { upsertLead } from "@/lib/booking.functions";

const TEXT_IDLE_MS = [45_000, 30_000, 30_000];

/** The newest Maya message shows the 911/988 screen. */
function showsEmergency(messages: UIMessage[]) {
  const last = [...messages].reverse().find((m) => m.role === "assistant" && !m.id.startsWith("idle-"));
  return !!last?.parts.some((p) => {
    if (p.type === "data-emergency") return true;
    const t = p as { type: string; output?: { emergency?: boolean } };
    return t.type === "tool-check_emergency" && !!t.output?.emergency;
  });
}

/** Refresh the conversation's lead (from save_progress) so staff and the lead nudge can follow up. */
function saveLeadOnClose(messages: UIMessage[]) {
  for (const m of [...messages].reverse()) {
    for (const p of [...m.parts].reverse()) {
      const t = p as { type: string; input?: Record<string, string | null>; output?: { lead_id?: string } };
      if (t.type !== "tool-save_progress" || !t.input) continue;
      const { lead_id: _ignored, ...rest } = t.input;
      const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v)) as Record<string, string>;
      const id = t.output?.lead_id;
      void upsertLead({ data: { ...data, ...(id ? { id } : {}), step_reached: "patient", source: "chat" } }).catch(() => {});
      return;
    }
  }
}

function EndedCard({ onRestart }: { onRestart: () => void }) {
  return (
    <div role="status" className="popup-alert flex flex-col items-start gap-3 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <CheckCircle2 className="h-5 w-5 text-popup-accent" aria-hidden="true" /> Conversation ended
      </p>
      <p className="text-sm text-muted-foreground">Maya closed the chat after a quiet spell. You can pick up again any time.</p>
      <Button type="button" className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90" onClick={onRestart}>
        Start again
      </Button>
    </div>
  );
}

const STARTERS = [
  "I'm new and need a physical",
  "I'm sick today",
  "Reschedule my visit",
  "Cancel a visit",
  "Request a refill",
  "Do you take Aetna?",
];

type Slot = { start_at: string; end_at: string; label: string };
type Booked = {
  ok: true;
  visit: { name: string; start_at: string; end_at: string; mode: "in_person" | "telehealth" };
  manage_url: string;
  intake_url: string;
};

function MayaAvatar() {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
      aria-hidden="true"
    >
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
      <a
        href="tel:911"
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-destructive px-4 font-semibold text-destructive-foreground"
      >
        <Phone className="h-4 w-4" aria-hidden="true" /> Call 911
      </a>
    </div>
  );
}

function PageLink({ kind, token, className, children }: { kind: "visit" | "intake"; token: string; className: string; children: ReactNode }) {
  const open = useOpenChatPage();
  if (open)
    return (
      <button type="button" onClick={() => open({ kind, token })} className={className}>
        {children}
      </button>
    );
  return kind === "visit" ? (
    <Link to="/visit/$token" params={{ token }} className={className}>{children}</Link>
  ) : (
    <Link to="/intake/$token" params={{ token }} className={className}>{children}</Link>
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
        <PageLink
          kind="visit"
          token={b.manage_url.split("/").pop() ?? ""}
          className="inline-flex min-h-11 items-center rounded-xl bg-cta px-4 font-semibold text-cta-foreground hover:bg-cta/90"
        >
          Manage visit
        </PageLink>
        <PageLink
          kind="intake"
          token={b.intake_url.split("/").pop() ?? ""}
          className="inline-flex min-h-11 items-center rounded-xl border border-input px-4 font-semibold hover:bg-accent"
        >
          Complete intake
        </PageLink>
        <button
          type="button"
          onClick={() => addVisitToCalendar(b.visit)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold text-primary hover:bg-accent"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
        </button>
      </div>
      <p className="mt-3 text-sm italic text-primary">
        At Brightleaf Family Medicine, your well-being is our sole purpose
      </p>
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

type MyVisit = { id: string; visit_name: string; start_at: string; label: string; mode: string };

function MyVisitsCard({ visits, onSend }: { visits: MyVisit[]; onSend: (t: string) => void }) {
  if (!visits.length)
    return <p className="rounded-xl border border-border bg-card p-4 text-muted-foreground">No upcoming visits found.</p>;
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Your upcoming visits">
      {visits.map((v) => (
        <div key={v.id} className="rounded-xl border border-border bg-card p-4">
          <p className="font-semibold">{v.visit_name}</p>
          <p className="text-muted-foreground">
            {fmtLongDay(v.start_at)} · {fmtTime(v.start_at)} · {v.mode === "telehealth" ? "Video" : "In person"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onSend(`Reschedule my ${v.visit_name} on ${v.label}`)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90">
              <CalendarClock className="h-4 w-4" aria-hidden="true" /> Reschedule
            </button>
            <button type="button" onClick={() => onSend(`Cancel my ${v.visit_name} on ${v.label}`)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-input px-4 font-semibold hover:bg-accent">
              <XCircle className="h-4 w-4" aria-hidden="true" /> Cancel
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChangedCard({ o }: { o: any }) {
  if (o.action === "reschedule")
    return (
      <div className="rounded-xl border border-success/50 bg-success/10 p-4">
        <p className="flex items-center gap-2 font-semibold text-success">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Rescheduled
        </p>
        <p className="mt-2 font-semibold">{o.visit_name}</p>
        <p className="text-muted-foreground">
          {fmtLongDay(o.new_start_at)} · {fmtTime(o.new_start_at)} Central Time
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <PageLink kind="visit" token={o.manage_token}
            className="inline-flex min-h-11 items-center rounded-xl border border-input px-4 font-semibold hover:bg-accent">
            Manage visit
          </PageLink>
          <button type="button"
            onClick={() => addVisitToCalendar({ name: o.visit_name, start_at: o.new_start_at, end_at: o.new_end_at, mode: o.mode })}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold text-primary hover:bg-accent">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
          </button>
        </div>
      </div>
    );
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <p className="flex items-center gap-2 font-semibold text-muted-foreground">
        <XCircle className="h-5 w-5" aria-hidden="true" /> Cancelled
      </p>
      <p className="mt-2 font-semibold">{o.visit_name}</p>
      <p className="text-muted-foreground line-through">
        {fmtLongDay(o.old_start_at)} · {fmtTime(o.old_start_at)}
      </p>
      <Link to="/book" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90">
        Book again
      </Link>
    </div>
  );
}

function Parts({ m, onPick, onSend }: { m: UIMessage; onPick: (s: Slot) => void; onSend: (t: string) => void }) {
  return (
    <>
      {m.parts.map((p, i) => {
        if (p.type === "text")
          return m.role === "user" ? (
            <p key={i}>{p.text}</p>
          ) : (
            <MessageResponse key={i}>{p.text}</MessageResponse>
          );
        if (p.type === "data-emergency") return <EmergencyCard key={i} />;
        if (!p.type.startsWith("tool-")) return null;
        const t = p as { type: string; state: string; output?: any };
        if (t.state !== "output-available") {
          return t.state === "output-error" ? null : (
            <p key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />{" "}
              Checking…
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
        if (t.type === "tool-book_appointment" && o?.ok)
          return <BookedCard key={i} b={o as Booked} />;
        if (t.type === "tool-find_my_visits" && o?.found) return <MyVisitsCard key={i} visits={o.visits} onSend={onSend} />;
        if ((t.type === "tool-cancel_visit" || t.type === "tool-reschedule_visit") && o?.ok) return <ChangedCard key={i} o={o} />;
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
    <form
      onSubmit={submit}
      className="surface-tile mt-3 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <Field
        id="cb-name"
        label="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors["name"]}
        autoComplete="name"
      />
      <Field
        id="cb-phone"
        label="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errors["phone"]}
        type="tel"
        autoComplete="tel"
      />
      <Button
        type="submit"
        disabled={busy}
        className="min-h-11 bg-cta text-cta-foreground hover:bg-cta/90"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Request callback
      </Button>
    </form>
  );
}

export function MayaChat({
  voice = false,
  embedded = false,
}: {
  voice?: boolean;
  embedded?: boolean;
}) {
  const { messages, sendMessage, setMessages, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/maya-chat" }),
  });
  const [input, setInput] = useState("");
  const [callback, setCallback] = useState(false);
  const [voiceSession, setVoiceSession] = useState(false);
  const [voiceStartSignal, setVoiceStartSignal] = useState(0);
  const busy = status === "submitted" || status === "streaming";
  const wrap = useRef<HTMLDivElement>(null);
  const [ended, setEnded] = useState(false);
  const [idleStep, setIdleStep] = useState(0);
  const emergency = showsEmergency(messages);
  const addMaya = useCallback(
    (text: string) =>
      setMessages((current) => [...current, { id: `idle-${Date.now()}`, role: "assistant", parts: [{ type: "text", text }] }]),
    [setMessages],
  );
  const closeChat = useCallback(() => {
    setEnded(true);
    setIdleStep(0);
    setVoiceSession(false);
    setResumeVoice(false);
    saveLeadOnClose(messages);
  }, [messages]);
  const restart = () => {
    clearChatSession();
    setEnded(false);
    setIdleStep(0);
    setResumeVoice(false);
    setMessages([]);
    setInput("");
    setTimeout(focus, 0);
  };

  // Restore this tab's conversation (sessionStorage) once, then keep it saved.
  const [restored, setRestored] = useState(false);
  const [resumeVoice, setResumeVoice] = useState(false);
  const [page, setPage] = useState<ChatPage | null>(null);
  useEffect(() => {
    const s = loadChatSession();
    if (s) {
      setMessages(s.messages);
      setEnded(s.ended);
      setResumeVoice(s.voice && !s.ended && s.messages.length > 0);
    }
    setRestored(true);
  }, [setMessages]);
  useEffect(() => {
    if (!restored || busy) return;
    if (!ended && messages.length === 0) return clearChatSession();
    // After an inactivity close only the "Conversation ended" state is kept — no transcript.
    saveChatSession({ messages: ended ? [] : messages, voice: voiceSession || resumeVoice, ended });
  }, [restored, busy, messages, ended, voiceSession, resumeVoice]);
  // 30 minutes without activity: forget the stored conversation.
  useEffect(() => {
    if (!restored || messages.length === 0) return;
    const t = setTimeout(clearChatSession, SESSION_IDLE_MS);
    return () => clearTimeout(t);
  }, [restored, messages.length, input]);

  // Text-chat inactivity: only after Maya's reply, paused while busy or typing (keystrokes reset it).
  const lastRole = messages.at(-1)?.role;
  useEffect(() => {
    if (voiceSession || ended || busy || emergency || lastRole !== "assistant") return;
    const t = setTimeout(() => {
      const text = IDLE_PROMPTS[idleStep] ?? IDLE_PROMPTS[2];
      addMaya(text);
      if (idleStep >= 2) closeChat();
      else setIdleStep(idleStep + 1);
    }, TEXT_IDLE_MS[idleStep] ?? 30_000);
    return () => clearTimeout(t);
  }, [voiceSession, ended, busy, emergency, lastRole, idleStep, input, messages.length, addMaya, closeChat]);

  const sendVoice = useCallback(
    (text: string, interruption?: { sentence: string; unsaid: string[] }) => {
      setIdleStep(0);
      sendMessage({ text }, { body: { channel: "voice", ...(interruption ? { interruption } : {}) } });
      setInput("");
    },
    [sendMessage],
  );

  const focus = () => wrap.current?.querySelector("textarea")?.focus();
  useEffect(() => {
    if (!busy) focus();
  }, [busy]);

  const send = (text: string) => {
    if (!text.trim() || busy || ended) return;
    setIdleStep(0);
    sendMessage({ text });
    setInput("");
  };

  const last = messages.at(-1);
  const waiting =
    status === "submitted" ||
    (status === "streaming" &&
      last?.role === "assistant" &&
      !last.parts.some((p) => p.type === "text" && p.text));

  return (
    <OpenChatPage.Provider value={setPage}>
    <ChatPagePanel page={page} onClose={() => { setPage(null); setTimeout(focus, 0); }} />
    <div
      ref={wrap}
      className={`surface-tile flex flex-col overflow-hidden rounded-xl border border-border ${embedded ? "h-[min(88vh,940px)] min-h-[600px]" : "h-[min(75vh,720px)]"}`}
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <MayaAvatar />
        <div>
          <p className="text-base font-medium">
            Meet Maya — your anytime front desk
          </p>
          <p className="text-xs text-primary italic">Care that starts the moment you reach out</p>
        </div>
        <div className="ml-auto flex flex-col items-end">
          <span className="inline-flex items-center gap-2 text-sm text-success">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            Online
          </span>
          {(messages.length > 0 || ended) && (
            <button
              type="button"
              onClick={restart}
              disabled={busy || voiceSession}
              className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear conversation
            </button>
          )}
        </div>
      </div>

      <Conversation className="flex-1">
        <ConversationContent aria-live="polite" className="gap-5 text-base">
          {(voiceSession || resumeVoice) && (
            <div className="flex gap-3">
              <MayaAvatar />
              <p className="pt-1.5 text-[15px]">{VOICE_GREETING}</p>
            </div>
          )}
          {messages.length === 0 && !voiceSession && !ended && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <MayaAvatar />
                <p className="pt-1.5 text-[15px]">
                  Hi, I'm Maya. I can book a visit, answer questions about the clinic, or pass a message to the team. How can I help?
                </p>
              </div>
              {voice ? (
                <div className="pl-12">
                  <Button
                    type="button"
                    className="min-h-12 bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                    onClick={() => setVoiceStartSignal((value) => value + 1)}
                  >
                    Start talking to Maya
                  </Button>
                </div>
              ) : <div className="flex flex-wrap gap-2 pl-12">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="min-h-11 rounded-full border border-border bg-card px-4 text-sm transition-colors duration-150 hover:border-surface-hover"
                  >
                    {s}
                  </button>
                ))}
              </div>}
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "assistant" ? "flex gap-3" : ""}>
              {m.role === "assistant" && <MayaAvatar />}
              <Message from={m.role}>
                <MessageContent className="text-[15px] group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                  <Parts m={m} onPick={(s) => send(`Book the ${s.label} slot`)} onSend={send} />
                </MessageContent>
              </Message>
            </div>
          ))}
          {waiting && (
            <div className="flex items-center gap-3" aria-label="Maya is typing">
              <MayaAvatar />
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          )}
          {resumeVoice && !voiceSession && !ended && (
            <div className="pl-12">
              <Button
                type="button"
                className="min-h-12 bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                onClick={() => setVoiceStartSignal((value) => value + 1)}
              >
                Resume talking to Maya
              </Button>
            </div>
          )}
          {ended && <EndedCard onRestart={restart} />}
          {error && (
            <div
              role="alert"
              className="popup-alert flex items-start gap-2 p-4"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 text-popup-strong" aria-hidden="true" />
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
            disabled={ended}
            className="text-[15px]"
          />
          <PromptInputFooter className="items-center gap-1">
            <VoicePanel
              messages={messages}
              busy={busy}
              onTranscript={setInput}
              onSend={sendVoice}
              onEnd={() => {
                setVoiceSession(false);
                setResumeVoice(false);
                setMessages((current) => [
                  ...current,
                  {
                    id: `voice-farewell-${Date.now()}`,
                    role: "assistant",
                    parts: [{ type: "text", text: VOICE_FAREWELL }],
                  },
                ]);
                focus();
              }}
              onSessionStart={() => {
                setVoiceSession(true);
                setResumeVoice(false);
              }}
              startSignal={voiceStartSignal}
              skipGreeting={resumeVoice}
              emergency={emergency}
              onIdlePrompt={addMaya}
              onIdleClose={closeChat}
            />
            <PromptInputSubmit
              status={status}
              disabled={!busy && !input.trim()}
              className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {status === "submitted" ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : status === "streaming" ? (
                <Square className="size-4" aria-hidden="true" />
              ) : (
                <Send className="size-5" aria-hidden="true" />
              )}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-sm text-muted-foreground">
          Demo with fictional data - do not enter real health information.
        </p>
      </div>

      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => setCallback((v) => !v)}
          aria-expanded={callback}
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
        >
          <ClipboardList className="h-4 w-4" aria-hidden="true" /> Prefer a person? Request a
          callback
        </button>
        {callback && <CallbackForm onDone={() => setCallback(false)} />}
      </div>
    </div>
    </OpenChatPage.Provider>
  );
}
