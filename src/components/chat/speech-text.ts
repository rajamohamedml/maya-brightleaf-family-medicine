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

// Bright, friendly female voices first (Aria/Jenny/Ava on Windows and Edge,
// Natural and Google voices), then warmer ones (Samantha) and any soft English
// voice. Known-harsh voices are skipped.
const GENTLE_ORDER: RegExp[] = [
  /Aria/i,
  /Jenny/i,
  /Ava/i,
  /Natural/i,
  /Google US English/i,
  /(Michelle|Serena|Vanessa|Kathy|Zira|Libby|Nova|Sonoma|Allison|Sandy|Shelley)/i,
  /Samantha/i,
  /Female/i,
];
const HARSH = /\b(David|Mark|Fred|Male|James|Richard|George|Daniel)\b/i;

function score(voice: SpeechSynthesisVoice): number {
  const i = GENTLE_ORDER.findIndex((re) => re.test(voice.name));
  const base = i === -1 ? GENTLE_ORDER.length : i;
  // Within the same tier, prefer the "Natural" neural variant (e.g.
  // "Microsoft Aria Online (Natural)" over the older robotic "Microsoft Aria").
  const naturalBonus = /Natural/i.test(voice.name) ? 0 : 0.5;
  return base + naturalBonus;
}

export function pickVoice(): SpeechSynthesisVoice | undefined {
  const all = window.speechSynthesis.getVoices();
  const enUS = all.filter((v) => v.lang.replace("_", "-").startsWith("en-US") && !HARSH.test(v.name));
  const ordered = [...enUS].sort((a, b) => score(a) - score(b));
  return ordered[0] ?? enUS[0] ?? all.find((v) => v.lang.startsWith("en") && !HARSH.test(v.name)) ?? all[0];
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
