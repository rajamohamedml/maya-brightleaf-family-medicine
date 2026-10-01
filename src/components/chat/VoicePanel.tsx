// Browser-native voice mode for Maya: Web Speech API in, speechSynthesis out. Nothing leaves the browser except the final transcript.
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMERGENCY_MESSAGE } from "@/lib/booking-rules";
import { pickVoice, toSpeech } from "./speech-text";

type VState = "idle" | "listening" | "thinking" | "speaking";
const CONSENT_KEY = "maya-voice-consent";
const SILENCE_MS = 1500;

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
  if (m.parts.some((p) => p.type === "data-emergency" || (p.type === "tool-check_emergency" && (p as any).output?.emergency)))
    return EMERGENCY_MESSAGE;
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ");
}

export function VoicePanel({
  messages,
  busy,
  onTranscript,
  onSend,
  onEnd,
}: {
  messages: UIMessage[];
  busy: boolean;
  onTranscript: (t: string) => void;
  onSend: (t: string) => void;
  onEnd: () => void;
}) {
  const [supported, setSupported] = useState(true);
  const [denied, setDenied] = useState(false);
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<VState>("idle");
  const [handsFree, setHandsFree] = useState(true);
  const recRef = useRef<Rec | null>(null);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awaitingReply = useRef(false);
  const speakToken = useRef(0);
  const ended = useRef(false);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;

  useEffect(() => {
    setSupported(!!getRecCtor() && "speechSynthesis" in window);
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
    window.speechSynthesis.cancel();
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
    rec.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onTranscript((finalText + interim).trim());
      arm();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setDenied(true);
    };
    rec.onend = () => {
      if (silence.current) clearTimeout(silence.current);
      if (recRef.current !== rec) return;
      recRef.current = null;
      const text = finalText.trim();
      if (text && !ended.current) {
        awaitingReply.current = true;
        setState("thinking");
        onSend(text);
      } else setState("idle");
    };
    recRef.current = rec;
    try {
      rec.start();
      setState("listening");
      arm();
    } catch {
      setState("idle");
    }
  }, [onSend, onTranscript]);

  const stopListening = () => recRef.current?.stop();

  // Speak Maya's reply once the voice turn finishes streaming.
  useEffect(() => {
    if (busy || !awaitingReply.current) return;
    awaitingReply.current = false;
    const last = messages.at(-1);
    const text = last?.role === "assistant" ? toSpeech(replyText(last)) : "";
    if (!text) {
      setState("idle");
      return;
    }
    const token = ++speakToken.current;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1.0;
    const v = pickVoice();
    if (v) u.voice = v;
    u.onend = u.onerror = () => {
      if (token !== speakToken.current || ended.current) return;
      setState("idle");
      if (handsFreeRef.current) listen();
    };
    setState("speaking");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [busy, messages, listen]);

  const onMic = () => {
    if (state === "listening") return stopListening();
    if (state === "thinking") return;
    listen(); // also barges in while Maya is speaking
  };

  const end = () => {
    ended.current = true;
    speakToken.current++;
    recRef.current?.abort();
    recRef.current = null;
    window.speechSynthesis?.cancel();
    setState("idle");
    onEnd();
  };

  const EndBtn = (
    <Button type="button" variant="outline" onClick={end} className="min-h-11 gap-2">
      <PhoneOff className="h-4 w-4" aria-hidden="true" /> End
    </Button>
  );

  if (!supported || denied)
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4">
        <p className="flex items-center gap-2">
          <MicOff className="h-5 w-5 text-warning" aria-hidden="true" />
          {denied ? "Microphone access was blocked. " : ""}Voice works best in Chrome, Edge or Safari. You can keep typing below.
        </p>
        {EndBtn}
      </div>
    );

  if (!consented)
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
        <p>Maya will use your microphone. Audio stays in your browser and isn't stored. Demo only - don't share real health information.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              localStorage.setItem(CONSENT_KEY, "1");
              setConsented(true);
            }}
            className="min-h-11 bg-cta text-cta-foreground hover:bg-cta/90"
          >
            <Mic className="h-4 w-4" aria-hidden="true" /> Start talking
          </Button>
          {EndBtn}
        </div>
      </div>
    );

  const label = { idle: "Tap the mic to talk", listening: "Listening…", thinking: "Maya is thinking…", speaking: "Maya is speaking — tap to interrupt" }[state];

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <button
        type="button"
        onClick={onMic}
        disabled={state === "thinking"}
        aria-label={state === "listening" ? "Stop listening" : state === "speaking" ? "Interrupt Maya and talk" : "Start talking"}
        className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70 ${
          state === "listening" ? "bg-primary text-primary-foreground" : "bg-cta text-cta-foreground hover:bg-cta/90"
        }`}
      >
        {state === "listening" && <span className="absolute inset-0 animate-ping rounded-full ring-4 ring-primary motion-reduce:animate-none" aria-hidden="true" />}
        {state === "thinking" ? (
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((d) => (
              <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-current motion-reduce:animate-none" style={{ animationDelay: `${d * 150}ms` }} />
            ))}
          </span>
        ) : state === "speaking" ? (
          <span className="flex h-7 items-end gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((d) => (
              <span key={d} className="w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" style={{ height: `${[60, 100, 75, 45][d]}%`, animationDelay: `${d * 120}ms` }} />
            ))}
          </span>
        ) : (
          <Mic className="h-8 w-8" aria-hidden="true" />
        )}
      </button>
      <p aria-live="polite" className="text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm">
          <input type="checkbox" checked={handsFree} onChange={(e) => setHandsFree(e.target.checked)} className="h-5 w-5 accent-primary" />
          Hands-free
        </label>
        {EndBtn}
      </div>
    </div>
  );
}
