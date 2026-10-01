// Browser-native voice mode for Maya: Web Speech API in, speechSynthesis out. Nothing leaves the browser except the final transcript.
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMERGENCY_MESSAGE } from "@/lib/booking-rules";
import { pickVoice, toSpeech, waitForVoices } from "./speech-text";

type VState = "idle" | "listening" | "thinking" | "speaking";
const CONSENT_KEY = "maya-voice-consent";
const SILENCE_MS = 1500;
export const VOICE_GREETING =
  "Welcome to Brightleaf Family Medicine. I'm Maya, your anytime front desk assistant. How can I help you today?";
const BOOKING_CLOSING = "At Brightleaf Family Medicine, your well-being is our sole purpose";

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecCtor(): (new () => Rec) | undefined {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function replyText(m: UIMessage): string {
  if (
    m.parts.some(
      (p) =>
        p.type === "data-emergency" ||
        (p.type === "tool-check_emergency" && (p as any).output?.emergency),
    )
  )
    return EMERGENCY_MESSAGE;
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ");
}

function hasBooking(m: UIMessage): boolean {
  return m.parts.some(
    (p) =>
      p.type === "tool-book_appointment" &&
      (p as { state?: string; output?: { ok?: boolean } }).state === "output-available" &&
      (p as { output?: { ok?: boolean } }).output?.ok === true,
  );
}

export function VoicePanel({
  messages,
  busy,
  onTranscript,
  onSend,
  onEnd,
  onSessionStart,
  startSignal = 0,
}: {
  messages: UIMessage[];
  busy: boolean;
  onTranscript: (t: string) => void;
  onSend: (t: string) => void;
  onEnd: () => void;
  onSessionStart?: () => void;
  startSignal?: number;
}) {
  const [supported, setSupported] = useState(true);
  const [denied, setDenied] = useState(false);
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<VState>("idle");
  const [handsFree, setHandsFree] = useState(true);
  const [showNotice, setShowNotice] = useState(false);
  const recRef = useRef<Rec | null>(null);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awaitingReply = useRef(false);
  const speakToken = useRef(0);
  const ended = useRef(false);
  const active = useRef(false); // mic toggled on by the user
  const greeted = useRef(false);
  const lastStartSignal = useRef(startSignal);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;

  useEffect(() => {
    ended.current = false;
    setSupported(!!getRecCtor());
    setConsented(localStorage.getItem(CONSENT_KEY) === "1");
    window.speechSynthesis?.getVoices();
    return () => {
      ended.current = true;
      recRef.current?.abort();
      window.speechSynthesis?.cancel();
      if (silence.current) clearTimeout(silence.current);
    };
  }, []);

  const listen = useCallback(() => {
    const Ctor = getRecCtor();
    if (!Ctor || ended.current) return;
    speakToken.current++;
    window.speechSynthesis?.cancel();
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = "";
    const arm = () => {
      if (silence.current) clearTimeout(silence.current);
      silence.current = setTimeout(() => rec.stop(), SILENCE_MS);
    };
    let heard = "";
    rec.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      heard = (finalText + interim).trim();
      onTranscript(heard);
      if (heard) arm(); // only stop after silence once something was said
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setDenied(true);
    };
    rec.onend = () => {
      if (silence.current) clearTimeout(silence.current);
      if (recRef.current !== rec) return;
      recRef.current = null;
      const text = (finalText || heard).trim();
      if (text && !ended.current) {
        awaitingReply.current = true;
        setState("thinking");
        onSend(text);
      } else if (active.current && !ended.current) {
        // Browser ended the session on its own — keep listening until the user taps off.
        window.setTimeout(() => active.current && listen(), 150);
      } else setState("idle");
    };
    recRef.current = rec;
    try {
      rec.start();
      setState("listening");
    } catch {
      setState("idle");
    }
  }, [onSend, onTranscript]);

  const stopListening = () => {
    active.current = false;
    recRef.current?.stop();
    greeted.current = false;
    onEnd();
  };

  const beginVoiceSession = useCallback(() => {
    if (ended.current) ended.current = false;
    active.current = true;
    onSessionStart?.();
    if (greeted.current) {
      listen();
      return;
    }

    greeted.current = true;
    const speech = window.speechSynthesis;
    if (!speech) {
      setState("idle");
      listen();
      return;
    }

    void waitForVoices().then(() => {
      const token = ++speakToken.current;
      const utterance = new SpeechSynthesisUtterance(VOICE_GREETING);
      utterance.lang = "en-US";
      utterance.rate = 0.97;
      utterance.pitch = 1.05;
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = utterance.onerror = () => {
        if (token !== speakToken.current || ended.current || !active.current) return;
        listen();
      };
      setState("speaking");
      speech.cancel();
      speech.speak(utterance);
    });
  }, [listen, onSessionStart]);

  const requestStart = useCallback(() => {
    if (!getRecCtor()) {
      onSessionStart?.();
      return;
    }
    if (!consented) {
      setShowNotice(true);
      return;
    }
    beginVoiceSession();
  }, [beginVoiceSession, consented, onSessionStart]);

  useEffect(() => {
    if (startSignal === lastStartSignal.current) return;
    lastStartSignal.current = startSignal;
    requestStart();
  }, [requestStart, startSignal]);

  // Speak Maya's reply once the voice turn finishes streaming.
  useEffect(() => {
    if (busy || !awaitingReply.current) return;
    awaitingReply.current = false;
    const last = messages.at(-1);
    const responseText = last?.role === "assistant" ? replyText(last) : "";
    const text = last?.role === "assistant"
      ? toSpeech(`${responseText}${hasBooking(last) ? `. ${BOOKING_CLOSING}` : ""}`)
      : "";
    if (!text) {
      setState("idle");
      return;
    }
    if (!("speechSynthesis" in window)) {
      setState("idle");
      if (handsFreeRef.current && active.current) listen();
      else active.current = false;
      return;
    }
    const token = ++speakToken.current;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.97;
    u.pitch = 1.05;
    const v = pickVoice();
    if (v) u.voice = v;
    u.onend = u.onerror = () => {
      if (token !== speakToken.current || ended.current) return;
      setState("idle");
      if (handsFreeRef.current && active.current) listen();
      else active.current = false;
    };
    setState("speaking");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [busy, messages, listen]);

  const onMic = () => {
    if (state === "listening") return stopListening();
    if (state === "thinking") return;
    if (state === "speaking") {
      active.current = true;
      listen(); // barge in while Maya is speaking, including during the greeting
      return;
    }
    requestStart();
  };

  const end = () => {
    ended.current = true;
    active.current = false;
    greeted.current = false;
    speakToken.current++;
    recRef.current?.abort();
    recRef.current = null;
    window.speechSynthesis?.cancel();
    setState("idle");
    onEnd();
  };

  if (!supported || denied)
    return (
      <span role="status" className="flex min-w-0 items-center gap-2 text-sm text-warning">
        <MicOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">
          {denied ? "Microphone blocked. " : ""}Voice works best in Chrome, Edge or Safari.
        </span>
      </span>
    );

  const label = {
    idle: "Tap the mic to talk",
    listening: "Listening…",
    thinking: "Maya is thinking…",
    speaking: "Maya is speaking — tap to interrupt",
  }[state];

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
      <span aria-live="polite" className="mr-auto truncate text-xs text-muted-foreground">
        {state === "idle" ? "" : label}
      </span>
      {(
        <label className="hidden min-h-11 cursor-pointer items-center gap-1.5 px-2 text-xs sm:flex">
          <input
            type="checkbox"
            checked={handsFree}
            onChange={(e) => setHandsFree(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Keep listening
        </label>
      )}
      {state !== "idle" && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={end}
          aria-label="End voice conversation"
          title="End voice conversation"
        >
          <PhoneOff className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
      <Button
        type="button"
        onClick={onMic}
        disabled={state === "thinking"}
        aria-label={
          state === "listening"
            ? "Stop listening"
            : state === "speaking"
              ? "Interrupt Maya and talk"
              : "Start talking"
        }
        title={label}
        size="icon"
        variant="ghost"
        className={`relative shrink-0 rounded-full ${state === "listening" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-primary"}`}
      >
        {state === "listening" && (
          <span
            className="absolute inset-0 animate-ping rounded-full ring-4 ring-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {state === "thinking" ? (
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="h-2 w-2 animate-bounce rounded-full bg-current motion-reduce:animate-none"
                style={{ animationDelay: `${d * 150}ms` }}
              />
            ))}
          </span>
        ) : state === "speaking" ? (
          <span className="flex h-7 items-end gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((d) => (
              <span
                key={d}
                className="w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
                style={{ height: `${[60, 100, 75, 45][d]}%`, animationDelay: `${d * 120}ms` }}
              />
            ))}
          </span>
        ) : (
          <Mic className="h-5 w-5" aria-hidden="true" />
        )}
      </Button>
      {showNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-notice-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border border-primary/40 bg-popover p-5 shadow-xl">
            <p id="voice-notice-title" className="font-semibold">
              Use voice with Maya
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Maya will use your microphone. Audio stays in your browser and isn't stored. Demo only
              - don't share real health information.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowNotice(false)}>
                Not now
              </Button>
              <Button
                type="button"
                variant="cta"
                onClick={() => {
                  localStorage.setItem(CONSENT_KEY, "1");
                  setConsented(true);
                  setShowNotice(false);
                  ended.current = false;
                   window.setTimeout(beginVoiceSession, 0);
                }}
              >
                <Mic className="h-4 w-4" aria-hidden="true" /> Start talking
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
