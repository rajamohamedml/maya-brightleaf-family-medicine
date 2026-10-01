// Turns Maya's chat text into something pleasant for speechSynthesis to read aloud.
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty"];

function num(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  return n % 10 ? `${t} ${ONES[n % 10]}` : t;
}

function spokenTime(h: number, m: number, mer?: string): string {
  let h24 = h;
  if (mer) {
    const pm = mer.toLowerCase().startsWith("p");
    h24 = (h % 12) + (pm ? 12 : 0);
  }
  if (h24 > 23 || m > 59) return `${h}:${m}`;
  if (h24 === 12 && m === 0) return "noon";
  const h12 = h24 % 12 || 12;
  const mins = m === 0 ? "" : m < 10 ? ` oh ${num(m)}` : ` ${num(m)}`;
  const part = h24 < 12 ? "in the morning" : h24 < 17 ? "in the afternoon" : "in the evening";
  return `${num(h12)}${mins} ${part}`;
}

export function toSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_~`#>|]+/g, " ")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\b(\d{1,2}):(\d{2})\s*([AaPp]\.?\s?[Mm]\.?)?/g, (_, h, m, mer) => spokenTime(Number(h), Number(m), mer))
    .replace(/\s+/g, " ")
    .trim();
}

// Platform-specific voice preference. iOS (any browser there uses WebKit) has
// its own voice set; desktop and Android share one list.
const DESKTOP_ORDER = [
  "Google US English",
  "Microsoft Aria Online (Natural)",
  "Microsoft Jenny Online (Natural)",
  "Samantha",
];
const IOS_ORDER = ["Ava (Premium)", "Ava (Enhanced)", "Samantha (Enhanced)", "Samantha"];
const NOVELTY =
  /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa)\b/i;
const FEMALE =
  /(Female|Woman|Aria|Jenny|Ava|Samantha|Allison|Susan|Zoe|Nicky|Joelle|Michelle|Serena|Vanessa|Kathy|Zira|Libby|Nova|Sonoma|Sandy|Shelley|Emma|Ana|Victoria|Karen|Moira|Tessa|Fiona)/i;
const MALE = /\b(David|Mark|Fred|Male|James|Richard|George|Daniel|Guy|Aaron|Tom|Alex|Evan|Nathan|Ralph|Junior|Rocko|Eddy|Reed)\b/i;

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const isEnUS = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase().startsWith("en-us");

export function pickVoice(): SpeechSynthesisVoice | undefined {
  const all = window.speechSynthesis.getVoices().filter((v) => !NOVELTY.test(v.name));
  const order = isIOS() ? IOS_ORDER : DESKTOP_ORDER;
  for (const name of order) {
    // Exact name first; iOS sometimes reports names without the quality suffix in a separate field.
    const hit =
      all.find((v) => v.name === name && isEnUS(v)) ?? all.find((v) => v.name === name);
    if (hit) return hit;
  }
  const enUS = all.filter(isEnUS);
  return (
    enUS.find((v) => FEMALE.test(v.name) && !MALE.test(v.name)) ??
    enUS.find((v) => !MALE.test(v.name)) ??
    enUS[0] ??
    all.find((v) => v.lang.startsWith("en") && !MALE.test(v.name)) ??
    all[0]
  );
}

/** True once the browser has delivered its voice list. */
export function voicesReady(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis && window.speechSynthesis.getVoices().length > 0;
}

/**
 * iOS only plays speech started inside a tap. Call this synchronously in the tap
 * handler: a silent utterance unlocks the speech engine so later speaks work
 * even after waiting for the voice list.
 */
export function unlockSpeech() {
  const speech = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!speech) return;
  try {
    speech.cancel();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speech.speak(u);
  } catch {
    /* ignore */
  }
}

// iOS Safari sometimes pauses speech mid-reply (backgrounding, long text). Nudge it.
let keepAlive: number | undefined;
export function startResumeWatch() {
  if (typeof window === "undefined" || !window.speechSynthesis || keepAlive) return;
  keepAlive = window.setInterval(() => {
    const s = window.speechSynthesis;
    if (s.speaking && s.paused) s.resume();
    if (!s.speaking && !s.pending) {
      clearInterval(keepAlive);
      keepAlive = undefined;
    }
  }, 500);
}


// Browsers load their voice list asynchronously; until it arrives, speaking falls
// back to the default (often rough-sounding) system voice. Wait briefly for it.
export function waitForVoices(ms = 1500): Promise<void> {
  const speech = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!speech || speech.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      speech.removeEventListener("voiceschanged", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    speech.addEventListener("voiceschanged", done);
  });
}
