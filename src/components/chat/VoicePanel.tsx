// Browser-native voice mode for Maya: Web Speech API in, speechSynthesis out. Nothing leaves the browser except the final transcript.
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMERGENCY_MESSAGE } from "@/lib/booking-rules";
import { pickVoice, startResumeWatch, toSpeech, unlockSpeech, voicesReady, waitForVoices } from "./speech-text";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";
const CONSENT_KEY = "maya-voice-consent";
const SILENCE_MS = 2500;
const DIGIT_SILENCE_MS = 3500; // phone numbers / dates of birth
const RESTART_MS = 50;
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
  "Are you still there?",
  "Since I haven't heard back, I'll close our conversation for now. Thank you for contacting Brightleaf Family Medicine — your well-being is our sole purpose. Take care, and reach out anytime.",
] as const;
// Cumulative 8s / 16s / 24s of silence, counted from 1.5s after Maya finishes.
const VOICE_IDLE_MS = [9500, 8000, 8000];

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

/** True when what the mic heard closely matches (over 80%) Maya's own sentence coming back through the speakers. */
function isEcho(heard: string, spoken: string): boolean {
  const h = words(heard);
  if (!h.length) return true;
  const said = new Set(words(spoken));
  return h.filter((w) => said.has(w)).length / h.length > 0.8;
}

/** Rough spoken length of a sentence at Maya's rate (~130 words/min). */
const estimateMs = (s: string) => Math.max(800, words(s).length * 460);

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
  onStateChange,
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
  onStateChange?: (state: VoiceState) => void;
}) {
  const [supported, setSupported] = useState(true);
  const [denied, setDenied] = useState(false);
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
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
  const heardSinceReply = useRef(false);
  const armIdle = useCallback(() => {
    if (idleTimer.current || emergencyRef.current || heardSinceReply.current) return;
    idleTimer.current = setTimeout(() => {
      idleTimer.current = null;
      fireIdleRef.current();
    }, VOICE_IDLE_MS[idleStep.current] ?? 8000);
  }, []);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  // Sentence queue: what Maya is saying now and what's still unsaid.
  const sentences = useRef<string[]>([]);
  const sentenceIdx = useRef(0);
  const speaking = useRef(false);
  // While Maya speaks, the recogniser runs in "monitor" mode and only reacts to a real interruption.
  const monitoring = useRef(false);
  const pendingInterruption = useRef<Interruption | null>(null);
  // Current patient turn, built from recogniser results.
  const turnFinal = useRef("");
  const turnInterim = useRef("");
  const turnConfidence = useRef(1);
  const consumed = useRef(0); // results below this index belong to an earlier turn / echo
  const appended = useRef(new Set<number>()); // final results already added to the turn
  const firstNonFinal = useRef(0);
  const resultLen = useRef(0);
  const midSpeech = useRef(false);
  const ptt = useRef(false);
  const [pttHeld, setPttHeld] = useState(false);
  // Hidden debug panel (?debug=voice).
  const debugOn = useRef(false);
  const [debug, setDebug] = useState<{ on: boolean; rec: string; event: string; interim: string }>({
    on: false,
    rec: "off",
    event: "",
    interim: "",
  });
  const note = (event: string) => {
    if (!debugOn.current) return;
    setDebug({
      on: true,
      rec: recRef.current ? (midSpeech.current ? "running (speech)" : "running") : "stopped",
      event: `${event} @ ${new Date().toLocaleTimeString()}`,
      interim: `${turnFinal.current.trim()} | ${turnInterim.current}`,
    });
  };
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
        if (!active.current || ended.current) {
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

  useEffect(() => {
    ended.current = false;
    setSupported(!!getRecCtor());
    setConsented(localStorage.getItem(CONSENT_KEY) === "1");
    if (new URLSearchParams(window.location.search).get("debug") === "voice") {
      debugOn.current = true;
      setDebug((d) => ({ ...d, on: true }));
    }
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
  }, []);

  /** Start a fresh turn; keep a phrase the patient is in the middle of saying. */
  const resetTurn = () => {
    turnFinal.current = "";
    turnInterim.current = "";
    turnConfidence.current = 1;
    consumed.current = firstNonFinal.current;
  };

  const speakReplyRef = useRef<(text: string, after: () => void, opts?: { monitor?: boolean }) => void>(() => {});
  const listenRef = useRef<(opts?: { monitor?: boolean }) => void>(() => {});

  /** The patient's turn is over: send what was heard to Maya. Recognition keeps running. */
  const submitTurn = () => {
    if (silence.current) clearTimeout(silence.current);
    silence.current = null;
    const text = `${turnFinal.current} ${turnInterim.current}`.trim();
    const hadFinal = !!turnFinal.current.trim();
    const conf = turnConfidence.current;
    turnFinal.current = "";
    turnInterim.current = "";
    turnConfidence.current = 1;
    consumed.current = resultLen.current; // anything already shown belongs to this turn
    note("turn-submitted");
    if (!text || ended.current) return;
    monitoring.current = true;
    if (hadFinal && conf < LOW_CONFIDENCE) {
      // Unsure what was said: ask again instead of guessing.
      onTranscript("");
      speakReplyRef.current(NOT_CAUGHT, () => !ended.current && active.current && listenRef.current(), { monitor: true });
      return;
    }
    awaitingReply.current = true;
    setState("thinking");
    const intr = pendingInterruption.current ?? undefined;
    pendingInterruption.current = null;
    onSend(text, intr);
  };

  const armSilence = () => {
    if (silence.current) clearTimeout(silence.current);
    if (ptt.current) return; // push-to-talk sends on release
    const heard = `${turnFinal.current} ${turnInterim.current}`;
    silence.current = setTimeout(submitTurn, /\d/.test(heard) ? DIGIT_SILENCE_MS : SILENCE_MS);
  };

  /** Exactly one recogniser per session; it runs continuously until the session ends. */
  const startRec = () => {
    const Ctor = getRecCtor();
    if (!Ctor || ended.current || recRef.current) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    appended.current = new Set();
    consumed.current = 0;
    firstNonFinal.current = 0;
    resultLen.current = 0;
    rec.onresult = (e) => {
      if (recRef.current !== rec) return;
      const res = e.results;
      resultLen.current = res.length;
      let fnf = res.length;
      for (let i = 0; i < res.length; i++) if (!res[i].isFinal) { fnf = i; break; }
      firstNonFinal.current = fnf;

      if (monitoring.current) {
        if (!speaking.current) {
          if (awaitingReply.current) {
            // Maya is preparing a reply: this belongs to no turn.
            consumed.current = fnf;
            note("result-ignored(thinking)");
            return;
          }
          // Maya has finished (or her end event is late): treat as the patient.
          monitoring.current = false;
          setState("listening");
        } else {
          let latest = "";
          for (let i = Math.max(consumed.current, e.resultIndex); i < res.length; i++) latest += res[i][0].transcript;
          const cur = sentences.current[sentenceIdx.current] ?? "";
          const prev = sentences.current[sentenceIdx.current - 1] ?? "";
          if (isEcho(latest, `${prev} ${cur}`)) {
            consumed.current = Math.max(consumed.current, fnf);
            note("result-echo");
            return;
          }
          cutSpeech(); // real interruption (barge-in)
          setState("listening");
        }
      }

      // Read every result from resultIndex on: finals join the turn once, non-finals form the interim.
      let interim = "";
      const start = Math.min(consumed.current, e.resultIndex);
      for (let i = start; i < res.length; i++) {
        if (i < consumed.current) continue;
        const r = res[i];
        if (r.isFinal) {
          if (!appended.current.has(i)) {
            appended.current.add(i);
            turnFinal.current += ` ${r[0].transcript}`;
            if (typeof r[0].confidence === "number" && r[0].confidence > 0)
              turnConfidence.current = Math.min(turnConfidence.current, r[0].confidence);
          }
        } else interim += r[0].transcript;
      }
      turnInterim.current = interim;
      const heard = `${turnFinal.current} ${interim}`.replace(/\s+/g, " ").trim();
      note("result");
      if (!heard) return;
      heardSinceReply.current = true;
      clearIdle(true); // the patient is talking: cancel the countdown
      onTranscript(heard);
      armSilence();
    };
    const r = rec as unknown as { onspeechstart: (() => void) | null; onspeechend: (() => void) | null; onstart: (() => void) | null };
    r.onstart = () => note("start");
    r.onspeechstart = () => {
      midSpeech.current = true;
      note("speechstart");
      if (monitoring.current) return;
      heardSinceReply.current = true;
      clearIdle(true);
      if (silence.current) clearTimeout(silence.current); // still talking
    };
    r.onspeechend = () => {
      midSpeech.current = false;
      note("speechend");
      if (`${turnFinal.current}${turnInterim.current}`.trim()) armSilence();
    };
    rec.onerror = (e) => {
      note(`error:${e.error}`);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        active.current = false;
        clearIdle(true);
        setDenied(true);
      }
      // Other errors (no-speech, aborted, network, audio-capture) are followed by "end", which restarts.
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      // Keep a phrase cut off by the browser and continue the same turn on the new recogniser.
      if (turnInterim.current) {
        turnFinal.current += ` ${turnInterim.current}`;
        turnInterim.current = "";
      }
      const wasMid = midSpeech.current;
      midSpeech.current = false;
      note("end");
      if (active.current && !ended.current) {
        window.setTimeout(() => active.current && !ended.current && startRec(), wasMid ? 0 : RESTART_MS);
      } else setState("idle");
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      if ((err as { name?: string })?.name === "InvalidStateError") return; // already started
      recRef.current = null;
      if (active.current && !ended.current) window.setTimeout(startRec, RESTART_MS);
    }
  };

  const listen = useCallback(
    (opts?: { monitor?: boolean }) => {
      if (!getRecCtor() || ended.current) return;
      startRec();
      if (opts?.monitor) {
        monitoring.current = true;
        return;
      }
      const wasMonitoring = monitoring.current;
      cutSpeech();
      if (wasMonitoring) resetTurn(); // drop Maya's echo, keep a phrase in progress
      setState("listening");
      armIdle();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cutSpeech, onSend, onTranscript, armIdle, clearIdle],
  );
  listenRef.current = listen;

  /** Speak a reply sentence by sentence, listening for a real interruption the whole time. */
  const speakReply = useCallback(
    (text: string, after: () => void, opts?: { monitor?: boolean }) => {
      const list = splitSentences(text);
      if (!list.length) return after();
      sentences.current = list;
      heardSinceReply.current = false; // countdown restarts after each reply
      sentenceIdx.current = 0;
      speaking.current = true;
      const token = ++speakToken.current;
      const play = (i: number) => {
        if (token !== speakToken.current || ended.current) return;
        if (i >= list.length) {
          speaking.current = false;
          return after();
        }
        sentenceIdx.current = i;
        const u = utter(list[i]!);
        // Chrome sometimes fires onend late or never: move on after the estimated length + 500ms.
        let done = false;
        const next = () => {
          if (done) return;
          done = true;
          clearTimeout(fallback);
          play(i + 1);
        };
        const fallback = setTimeout(next, estimateMs(list[i]!) + 500);
        u.onend = u.onerror = next;
        window.speechSynthesis.speak(u);
        startResumeWatch();
      };
      setState("speaking");
      window.speechSynthesis.cancel();
      play(0);
      if (opts?.monitor && active.current && getRecCtor()) {
        startVad();
        listen({ monitor: true });
      }
    },
    [listen, startVad],
  );
  speakReplyRef.current = speakReply;

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
    // Ask for the echo-cancelled microphone and start recognition immediately
    // in the user's tap, before Maya begins speaking.
    startVad();
    listen({ monitor: true });
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
    // Recognition remains live during the greeting. Echo-like results are ignored,
    // while real speech can still interrupt Maya.
    if (voicesReady()) {
      speakReply(VOICE_GREETING, () => {
        if (!ended.current && active.current) listen();
      });
      return;
    }
    unlockSpeech();
    void waitForVoices().then(() => {
      speakReply(VOICE_GREETING, () => {
        if (!ended.current && active.current) listen();
      });
    });
  }, [listen, onSessionStart, speakReply, clearIdle, startVad]);

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
        // The recogniser is already running: switch to normal listening (keeps any phrase in progress).
        listen();
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
    onTranscript("");
    onIdlePrompt?.(text);
    const after = () => {
      if (ended.current) return;
      if (step >= 2) return closeForInactivity();
      idleStep.current = step + 1;
      if (active.current) listen();
    };
    if (!window.speechSynthesis) return after();
    speakReply(text, after, { monitor: true });
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
    speech.cancel();
    speech.speak(utter(VOICE_FAREWELL));
    startResumeWatch();
  };

  /** Stop button: silence Maya, stop listening and cancel any reply in progress, immediately. */
  const stopAll = () => {
    clearIdle(true);
    if (silence.current) clearTimeout(silence.current);
    ended.current = true;
    active.current = false;
    greeted.current = false;
    speaking.current = false;
    monitoring.current = false;
    awaitingReply.current = false;
    ptt.current = false;
    setPttHeld(false);
    pendingInterruption.current = null;
    turnFinal.current = "";
    turnInterim.current = "";
    speakToken.current++;
    window.speechSynthesis?.cancel();
    stopVad();
    const rec = recRef.current;
    recRef.current = null;
    rec?.abort();
    setState("idle");
    onTranscript("");
    onStop?.();
  };

  /** Push-to-talk: everything said while held is one turn, sent on release. */
  const pttDown = () => {
    if (ptt.current || state === "thinking") return;
    if (!active.current) {
      if (!consented) return setShowNotice(true);
      ended.current = false;
      active.current = true;
      greeted.current = true;
      onSessionStart?.();
      startVad();
    }
    ptt.current = true;
    setPttHeld(true);
    clearIdle(true);
    if (silence.current) clearTimeout(silence.current);
    listen();
    note("ptt-down");
  };
  const pttUp = () => {
    if (!ptt.current) return;
    ptt.current = false;
    setPttHeld(false);
    note("ptt-up");
    window.setTimeout(submitTurn, 600); // let the last words finalise
  };
  const pttRef = useRef({ down: pttDown, up: pttUp });
  pttRef.current = { down: pttDown, up: pttUp };

  useEffect(() => {
    if (state === "idle" && !pttHeld) return;
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName) || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || typing(e.target)) return;
      e.preventDefault();
      pttRef.current.down();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return;
      e.preventDefault();
      pttRef.current.up();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [state, pttHeld]);

  if (!supported || denied)
    return (
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <span role="status" className="flex min-w-0 items-center gap-2 text-sm text-warning">
          <MicOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-xs sm:text-sm">
            {denied ? "Microphone is off - allow mic access for this site" : "Voice works best in Chrome, Edge or Safari - you can chat with Maya here instead."}
          </span>
        </span>
        {denied && (
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => { setDenied(false); beginVoiceSession(); }}>
            Retry
          </Button>
        )}
      </div>
    );

  const label = {
    idle: "Tap the mic to talk",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
  }[state];

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
      <span className="mr-auto" />
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
