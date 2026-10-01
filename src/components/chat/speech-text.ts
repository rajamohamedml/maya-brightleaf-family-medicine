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

export function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith("en-US"));
  return (
    voices.find((v) => /Samantha/i.test(v.name)) ??
    voices.find((v) => /Google US English/i.test(v.name)) ??
    voices.find((v) => /Natural/i.test(v.name)) ??
    voices[0]
  );
}
