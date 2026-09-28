import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({ value, count, size = 16, className, showValue = true }: { value: number | string | null | undefined; count?: number | null; size?: number; className?: string; showValue?: boolean }) {
  const v = value == null ? 0 : typeof value === "string" ? parseFloat(value) : value;
  const label = v ? `${v.toFixed(1).replace(".", ",")} de 5${count != null ? ` (${count} ${count === 1 ? "avaliação" : "avaliações"})` : ""}` : "Sem avaliações";
  return (
    <span className={cn("inline-flex items-center gap-1", className)} role="img" aria-label={label} title={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} width={size} height={size} aria-hidden className={cn(i <= Math.round(v) ? "fill-amber-400 text-amber-400" : "text-ink-300 dark:text-ink-600")} />
      ))}
      {showValue && <span className="ml-1 text-xs text-[var(--muted)]">{v ? v.toFixed(1).replace(".", ",") : "Novo"}{count != null && count > 0 ? ` (${count})` : ""}</span>}
    </span>
  );
}

export function RatingInput({ value, onChange, id }: { value: number; onChange: (v: number) => void; id?: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Nota" id={id}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} ${i === 1 ? "estrela" : "estrelas"}`}
          onClick={() => onChange(i)}
          className="rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Star className={cn("h-7 w-7", i <= value ? "fill-amber-400 text-amber-400" : "text-ink-300 dark:text-ink-600")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
