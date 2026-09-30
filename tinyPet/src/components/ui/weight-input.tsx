"use client";
import { useEffect, useState } from "react";
import { gramsToInput, parseWeightToGrams, preferredWeightUnit, type WeightUnit } from "@tinypet/shared";
import { cn } from "@/lib/utils";

/**
 * Weight field with a kg / g switch. kg accepts decimals ("2,5"), g only whole numbers. Reports grams to `onChange`
 * (`null` = empty, `undefined` = invalid input, so the form can block saving).
 */
export function WeightInput({ id, label, valueG, onChange, defaultUnit = "kg", error, hint }: { id: string; label: string; valueG: number | null | undefined; onChange: (grams: number | null | undefined) => void; defaultUnit?: WeightUnit; error?: string; hint?: string }) {
  const [unit, setUnit] = useState<WeightUnit>(() => preferredWeightUnit(valueG, defaultUnit));
  const [text, setText] = useState(() => gramsToInput(valueG, preferredWeightUnit(valueG, defaultUnit)));
  const parsed = parseWeightToGrams(text, unit);
  const invalid = parsed === undefined;

  // External reset (e.g. opening the modal for another item): re-derive the text when the grams differ from ours.
  useEffect(() => {
    if ((valueG ?? null) !== (parsed ?? null) && !invalid) {
      const u = preferredWeightUnit(valueG, defaultUnit);
      setUnit(u);
      setText(gramsToInput(valueG, u));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueG]);

  function update(nextText: string, nextUnit: WeightUnit) {
    setText(nextText);
    setUnit(nextUnit);
    onChange(parseWeightToGrams(nextText, nextUnit));
  }

  function switchUnit(u: WeightUnit) {
    if (u === unit) return;
    // keep the same amount when switching (2,5 kg → 2500 g); g → kg may produce decimals, which kg accepts
    const g = parseWeightToGrams(text, unit);
    update(g ? gramsToInput(g, u) : text, u);
  }

  const msg = error ?? (invalid ? (unit === "g" ? "Em gramas, use um número inteiro (ex.: 250)" : "Informe o peso em kg (ex.: 2,5)") : undefined);
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex gap-2">
        <input id={id} className={cn("input flex-1", msg && "border-red-500")} inputMode={unit === "g" ? "numeric" : "decimal"} value={text} onChange={(e) => update(e.target.value, unit)} placeholder={unit === "g" ? "ex.: 250" : "ex.: 2,5"} aria-invalid={!!msg} aria-describedby={msg || hint ? `${id}-msg` : undefined} />
        <div className="inline-flex rounded-xl border p-0.5" role="radiogroup" aria-label={`Unidade de ${label}`}>
          {(["kg", "g"] as const).map((u) => (
            <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => switchUnit(u)} className={cn("rounded-lg px-3 text-sm font-medium", unit === u ? "bg-brand-500 text-white" : "text-[var(--muted)] hover:text-[var(--fg)]")}>
              {u}
            </button>
          ))}
        </div>
      </div>
      {(msg || hint) && (
        <p id={`${id}-msg`} className={cn("mt-1 text-xs", msg ? "text-red-600" : "text-[var(--muted)]")}>
          {msg ?? hint}
        </p>
      )}
    </div>
  );
}
