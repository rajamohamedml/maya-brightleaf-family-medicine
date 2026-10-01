// Browser-native voice mode for Maya: Web Speech API in, speechSynthesis out. Nothing leaves the browser except the final transcript.
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMERGENCY_MESSAGE } from "@/lib/booking-rules";
import { pickVoice, toSpeech, waitForVoices } from "./speech-text";

type VState = "idle" | "listening" | "thinking" | "speaking";
const CONSENT_KEY = "maya-voice-consent";
const SILENCE_MS = 1500;
export const VOICE_GREETING =
  "Welcome to Brightleaf Family Medicine. I'm Maya, your anytime front desk assistant. How can I help you today?";
const BOOKING_CLOSING = "At Brightleaf Family Medicine, your well-being is our sole purpose";
export const VOICE_FAREWELL =
  "It was a pleasure talking to you, have a nice day! Take care and thank you for contacting Brightleaf Family Medicine!";

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

export const IDLE_PROMPTS = [
  "I haven't heard anything yet — take your time. I'm still here whenever you're ready.",
  "I still haven't heard a response. Are you still there?",
  "Since I haven't heard back, I'll close our conversation for now. Thank you for contacting Brightleaf Family Medicine — your well-being is our sole purpose. Take care, and reach out anytime.",
] as const;
const VOICE_IDLE_MS = [5000, 8000, 8000];

export type Interruption = { sentence: string; unsaid: string[] };

const VAD_THRESHOLD = 0.035; // RMS energy that counts as someone talking
const VAD_HOLD_MS = 300; // talking must last this long
const LOW_CONFIDENCE = 0.45;
const NOT_CAUGHT = "Sorry, I didn't quite catch that. Could you say it again?";

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? []).map((x) => x.trim()).filter(Boolean);
}

const words = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);

/** True when what the mic heard is mostly Maya's own sentence coming back through the speakers. */
function isEcho(heard: string, spoken: string): boolean {
  const h = words(heard);
  if (!h.length) return true;
  const said = new Set(words(spoken));
  return h.filter((w) => said.has(w)).length / h.length >= 0.6;
}

function utter(text: string) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.88;
  u.pitch = 1.18;
  const v = pickVoice();
  if (v) u.voice = v;
  return u;
}

export function VoicePanel({
  messages,
  busy,
  onTranscript,
  onSend,
  onEnd,
  onSessionStart,
  startSignal = 0,
  emergency = false,
  onIdlePrompt,
  onIdleClose,
  skipGreeting = false,
  showClear = false,
  clearDisabled = false,
  onClear,
}: {
  messages: UIMessage[];
  busy: boolean;
  onTranscript: (t: string) => void;
  onSend: (t: string, interruption?: Interruption) => void;
  onEnd: () => void;
  onSessionStart?: () => void;
  startSignal?: number;
  /** Emergency screen showing: never run the inactivity close. */
  emergency?: boolean;
  onIdlePrompt?: (text: string) => void;
  onIdleClose?: () => void;
  skipGreeting?: boolean;
  /** "Clear conversation" control, rendered beside Keep listening. */
  showClear?: boolean;
  clearDisabled?: boolean;
  onClear?: () => void;
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
  /** Resuming a restored voice conversation: no repeat greeting. */
  const skipGreetingRef = useRef(skipGreeting);
  skipGreetingRef.current = skipGreeting;
  const lastStartSignal = useRef(startSignal);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleStep = useRef(0);
  const emergencyRef = useRef(emergency);
  emergencyRef.current = emergency;
  const fireIdleRef = useRef<() => void>(() => {});
  const clearIdle = useCallback((resetStep: boolean) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (resetStep) idleStep.current = 0;
  }, []);
  /** Start the silence countdown (only while listening and nothing has been heard). */
  const armIdle = useCallback(() => {
    if (idleTimer.current || emergencyRef.current) return;
    idleTimer.current = setTimeout(() => {
      idleTimer.current = null;
      fireIdleRef.current();
    }, VOICE_IDLE_MS[idleStep.current] ?? 8000);
  }, []);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;

  // Sentence queue: what Maya is saying now and what's still unsaid.
  const sentences = useRef<string[]>([]);
  const sentenceIdx = useRef(0);
  const speaking = useRef(false);
  // While Maya speaks, the recogniser runs in "monitor" mode and only reacts to a real interruption.
  const monitoring = useRef(false);
  const resultBase = useRef(0); // ignore recogniser results before this index (echo)
  const resultCount = useRef(0);
  const pendingInterruption = useRef<Interruption | null>(null);
  // Voice-activity detection (Web Audio energy on an echo-cancelled mic stream).
  const vad = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number; loudSince: number | null; activeAt: number } | null>(null);
  const vadAvailable = useRef(true);

  const stopVad = useCallback(() => {
    const v = vad.current;
    if (!v) return;
    cancelAnimationFrame(v.raf);
    v.stream.getTracks().forEach((t) => t.stop());
    void v.ctx.close().catch(() => {});
    vad.current = null;
  }, []);

  const startVad = useCallback(() => {
    if (vad.current || !navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((stream) => {
        if (!speaking.current || ended.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const state = { stream, ctx, raf: 0, loudSince: null as number | null, activeAt: 0 };
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const x of buf) sum += x * x;
          const rms = Math.sqrt(sum / buf.length);
          const now = performance.now();
          if (rms > VAD_THRESHOLD) {
            state.loudSince ??= now;
            if (now - state.loudSince >= VAD_HOLD_MS) state.activeAt = now;
          } else state.loudSince = null;
          state.raf = requestAnimationFrame(tick);
        };
        tick();
        vad.current = state;
        vadAvailable.current = true;
      })
      .catch(() => {
        vadAvailable.current = false; // fall back to the words-only check
      });
  }, []);

  /** Someone has been talking for ~300ms within the last second. */
  const voiceActive = () => {
    if (!vad.current) return !vadAvailable.current;
    return performance.now() - vad.current.activeAt < 1000;
  };

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
      if (idleTimer.current) clearTimeout(idleTimer.current);
      stopVad();
    };
  }, [stopVad]);

  useEffect(() => {
    if (emergency) clearIdle(true);
  }, [emergency, clearIdle]);

  /** Stop Maya mid-sentence and remember what she hadn't said yet. */
  const cutSpeech = useCallback(() => {
    if (speaking.current) {
      const i = sentenceIdx.current;
      pendingInterruption.current = {
        sentence: sentences.current[i] ?? "",
        unsaid: sentences.current.slice(i + 1),
      };
    }
    speaking.current = false;
    monitoring.current = false;
    speakToken.current++;
    window.speechSynthesis?.cancel();
    stopVad();
  }, [stopVad]);

  const listen = useCallback(
    (opts?: { monitor?: boolean }) => {
      const Ctor = getRecCtor();
      if (!Ctor || ended.current) return;
      const monitor = !!opts?.monitor;
      if (!monitor) cutSpeech();
      recRef.current?.abort();
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      monitoring.current = monitor;
      resultBase.current = 0;
      resultCount.current = 0;
      let finalText = "";
      let heard = "";
      let confidence = 1;
      const arm = () => {
        if (silence.current) clearTimeout(silence.current);
        silence.current = setTimeout(() => rec.stop(), SILENCE_MS);
      };
      rec.onresult = (e) => {
        resultCount.current = e.results.length;
        if (monitoring.current) {
          // Barge-in check: real voice energy AND words that aren't Maya's own sentence.
          let latest = "";
          for (let i = resultBase.current; i < e.results.length; i++) latest += e.results[i][0].transcript;
          const i = sentenceIdx.current;
          const spoken = `${sentences.current[i - 1] ?? ""} ${sentences.current[i] ?? ""} ${sentences.current[i + 1] ?? ""}`;
          if (isEcho(latest, spoken) || !voiceActive()) return;
          cutSpeech();
          resultBase.current = e.results.length - 1; // keep only the patient's words
          setState("listening");
        }
        let interim = "";
        finalText = "";
        confidence = 1;
        for (let i = resultBase.current; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) {
            finalText += r[0].transcript;
            if (typeof r[0].confidence === "number" && r[0].confidence > 0) confidence = Math.min(confidence, r[0].confidence);
          } else interim += r[0].transcript;
        }
        heard = (finalText + interim).trim();
        if (heard) clearIdle(true); // the patient is talking: cancel the countdown
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
        if (monitoring.current) {
          // Browser closed the monitor session while Maya is still talking — reopen it.
          if (speaking.current && !ended.current) window.setTimeout(() => speaking.current && listen({ monitor: true }), 150);
          return;
        }
        const text = (finalText || heard).trim();
        if (text && !ended.current) {
          if (finalText && confidence < LOW_CONFIDENCE) {
            // Unsure what was said: ask again instead of guessing.
            onTranscript("");
            const token = ++speakToken.current;
            const u = utter(NOT_CAUGHT);
            u.onend = u.onerror = () => {
              if (token === speakToken.current && !ended.current && active.current) listen();
            };
            setState("speaking");
            window.speechSynthesis?.cancel();
            window.speechSynthesis?.speak(u);
            return;
          }
          awaitingReply.current = true;
          setState("thinking");
          const intr = pendingInterruption.current ?? undefined;
          pendingInterruption.current = null;
          onSend(text, intr);
        } else if (active.current && !ended.current) {
          // Browser ended the session on its own — keep listening until the user taps off.
          window.setTimeout(() => active.current && listen(), 150);
        } else setState("idle");
      };
      recRef.current = rec;
      try {
        rec.start();
        if (!monitor) {
          setState("listening");
          armIdle();
        }
      } catch {
        if (!monitor) setState("idle");
      }
    },
    [cutSpeech, onSend, onTranscript, armIdle, clearIdle],
  );

  /** Speak a reply sentence by sentence, listening for a real interruption the whole time. */
  const speakReply = useCallback(
    (text: string, after: () => void, opts?: { monitor?: boolean }) => {
      const list = splitSentences(text);
      if (!list.length) return after();
      sentences.current = list;
      sentenceIdx.current = 0;
      speaking.current = true;
      const token = ++speakToken.current;
      const play = (i: number) => {
        if (token !== speakToken.current || ended.current) return;
        if (i >= list.length) {
          speaking.current = false;
          stopVad();
          return after();
        }
        sentenceIdx.current = i;
        const u = utter(list[i]!);
        u.onend = u.onerror = () => play(i + 1);
        window.speechSynthesis.speak(u);
      };
      setState("speaking");
      window.speechSynthesis.cancel();
      play(0);
      if (opts?.monitor && active.current && getRecCtor()) {
        startVad();
        listen({ monitor: true });
      }
    },
    [listen, startVad, stopVad],
  );

  const stopListening = () => {
    clearIdle(true);
    active.current = false;
    recRef.current?.stop();
    greeted.current = false;
    onEnd();
  };

  const beginVoiceSession = useCallback(() => {
    if (ended.current) ended.current = false;
    active.current = true;
    clearIdle(true);
    onSessionStart?.();
    if (greeted.current || skipGreetingRef.current) {
      greeted.current = true;
      listen();
      return;
    }

    greeted.current = true;
    if (!window.speechSynthesis) {
      setState("idle");
      listen();
      return;
    }
    // The greeting plays before the mic opens, so Maya never hears herself.
    void waitForVoices().then(() => {
      speakReply(VOICE_GREETING, () => {
        if (!ended.current && active.current) listen();
      });
    });
  }, [listen, onSessionStart, speakReply, clearIdle]);

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
      ? toSpeech(
          `${responseText}${hasBooking(last) ? `. ${BOOKING_CLOSING}` : ""}${
            hasBooking(last) ? ` ${VOICE_FAREWELL}` : ""
          }`,
        )
      : "";
    const afterReply = () => {
      if (handsFreeRef.current && active.current && !ended.current) {
        if (recRef.current && monitoring.current) {
          // The monitor is already listening: switch it to normal listening, dropping the echo heard so far.
          monitoring.current = false;
          resultBase.current = resultCount.current;
          setState("listening");
          armIdle();
        } else listen();
      } else {
        recRef.current?.abort();
        recRef.current = null;
        monitoring.current = false;
        active.current = false;
        setState("idle");
      }
    };
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
    speakReply(text, afterReply, { monitor: true });
  }, [busy, messages, listen, speakReply]);

  /** Tap the mic or Stop while Maya talks: she stops at once and listens. */
  /** Shut the session after the inactivity closing has been spoken. */
  const closeForInactivity = () => {
    clearIdle(true);
    ended.current = true;
    active.current = false;
    greeted.current = false;
    speaking.current = false;
    monitoring.current = false;
    pendingInterruption.current = null;
    speakToken.current++;
    stopVad();
    const rec = recRef.current;
    recRef.current = null;
    rec?.abort();
    setState("idle");
    onIdleClose?.();
  };

  fireIdleRef.current = () => {
    if (!active.current || ended.current || speaking.current || emergencyRef.current || awaitingReply.current) return;
    const step = idleStep.current;
    const text = IDLE_PROMPTS[step] ?? IDLE_PROMPTS[2];
    // Stop the mic while Maya speaks the prompt, so she never hears herself.
    const rec = recRef.current;
    recRef.current = null;
    rec?.abort();
    onTranscript("");
    onIdlePrompt?.(text);
    const after = () => {
      if (ended.current) return;
      if (step >= 2) return closeForInactivity();
      idleStep.current = step + 1;
      if (active.current) listen();
    };
    if (!window.speechSynthesis) return after();
    speakReply(text, after);
  };

  const interrupt = () => {
    active.current = true;
    listen();
  };

  const onMic = () => {
    if (state === "listening") return stopListening();
    if (state === "thinking") return;
    if (state === "speaking") return interrupt();
    requestStart();
  };

  const end = () => {
    clearIdle(true);
    ended.current = true;
    active.current = false;
    greeted.current = false;
    speaking.current = false;
    monitoring.current = false;
    pendingInterruption.current = null;
    speakToken.current++;
    stopVad();
    recRef.current?.abort();
    recRef.current = null;
    setState("idle");
    onEnd();
    // Say goodbye out loud, with the same gentle voice Maya already uses.
    const speech = window.speechSynthesis;
    if (!speech) return;
    void waitForVoices().then(() => {
      speech.cancel();
      speech.speak(utter(VOICE_FAREWELL));
    });
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
    speaking: "Maya is speaking — just talk, or tap Stop",
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
      {showClear && onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={clearDisabled}
          className="min-h-11 shrink-0 px-2 text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear conversation
        </button>
      )}
      {state === "speaking" && (
        <Button type="button" size="sm" variant="ghost" onClick={interrupt} className="min-h-11 text-primary">
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Stop
        </Button>
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
