import { useRef, useState } from "react";
import { Star } from "lucide-react";

export const ratingLabels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"] as const;

/** Read-only stars for lists. */
export function StarsDisplay({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          aria-hidden="true"
          style={{ color: n <= value ? "#14B8A6" : "#475569" }}
          fill={n <= value ? "#14B8A6" : "none"}
        />
      ))}
    </span>
  );
}

export function StarRating({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [preview, setPreview] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = preview ?? value ?? 0;

  const move = (n: number) => {
    const v = Math.min(5, Math.max(1, n));
    onChange(v);
    refs.current[v - 1]?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Rating, 1 to 5 stars"
        className="flex"
        onMouseLeave={() => setPreview(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= shown;
          const tabbable = value ? value === n : n === 1;
          return (
            <button
              key={n}
              ref={(el) => { refs.current[n - 1] = el; }}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              tabIndex={tabbable ? 0 : -1}
              onClick={() => onChange(value === n ? null : n)}
              onMouseEnter={() => setPreview(n)}
              onFocus={() => setPreview(n)}
              onBlur={() => setPreview(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); move((value ?? 0) + 1); }
                else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); move((value ?? 2) - 1); }
                else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(value === n ? null : n); }
              }}
              className="flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Star
                size={32}
                aria-hidden="true"
                style={{ color: on ? "#14B8A6" : "#475569" }}
                fill={on ? "#14B8A6" : "none"}
              />
            </button>
          );
        })}
      </div>
      <span className="min-w-[5.5rem] text-sm text-muted-foreground" aria-live="polite">
        {shown ? ratingLabels[shown] : ""}
      </span>
    </div>
  );
}
