"use client";
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Cpu } from "lucide-react";
import { MICROCHIP_DIGITS, MICROCHIP_LOOKUPS, isValidMicrochip, normalizeMicrochip } from "@tinypet/shared";
import { cn } from "@/lib/utils";

/**
 * Microchip input: a switch ("Possui microchip") that is OFF while nothing is typed; when ON, a 15-digit field.
 * Turning it off clears the value (null). A valid number shows the lookup links right below.
 */
export function MicrochipField({ id = "pet-microchip", value, onChange, error }: { id?: string; value: string | null | undefined; onChange: (v: string | null) => void; error?: string }) {
  const digits = normalizeMicrochip(value);
  const [enabled, setEnabled] = useState(digits.length > 0);
  useEffect(() => {
    if (digits.length > 0) setEnabled(true);
  }, [digits.length]);

  const toggle = (on: boolean) => {
    setEnabled(on);
    if (!on) onChange(null);
  };

  return (
    <div className="sm:col-span-2">
      <label className="flex items-center gap-3 text-sm font-medium" htmlFor={`${id}-toggle`}>
        <button
          id={`${id}-toggle`}
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => toggle(!enabled)}
          className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition", enabled ? "bg-brand-500" : "bg-ink-300 dark:bg-ink-700")}
        >
          <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition", enabled ? "translate-x-5" : "translate-x-0.5")} />
        </button>
        <span className="inline-flex items-center gap-1">
          <Cpu className="h-4 w-4 text-[var(--muted)]" aria-hidden /> Possui microchip
        </span>
      </label>
      {enabled && (
        <div className="mt-2">
          <label htmlFor={id} className="label">
            Número do microchip ({MICROCHIP_DIGITS} dígitos)
          </label>
          <input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            maxLength={MICROCHIP_DIGITS}
            placeholder="Ex.: 963000012345678"
            className={cn("input font-mono tracking-wider", error && "border-red-500")}
            aria-invalid={!!error}
            aria-describedby={`${id}-hint`}
            value={digits}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, MICROCHIP_DIGITS) || null)}
          />
          <p id={`${id}-hint`} className={cn("mt-1 text-xs", error ? "text-red-600" : "text-[var(--muted)]")}>
            {error ?? `${digits.length}/${MICROCHIP_DIGITS} dígitos`}
          </p>
          {isValidMicrochip(digits) && <MicrochipLookupLinks chip={digits} className="mt-3" />}
        </div>
      )}
    </div>
  );
}

/** Groups of external lookup services with a copy button (the services don't accept the number in the URL). */
export function MicrochipLookupLinks({ chip, className }: { chip: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!isValidMicrochip(chip)) return null;
  const number = normalizeMicrochip(chip);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the number stays visible for manual copy */
    }
  };
  const groups = Array.from(new Set(MICROCHIP_LOOKUPS.map((l) => l.group)));
  return (
    <section className={cn("rounded-xl border p-3 text-sm", className)} aria-label="Consultar microchip">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          Consultar o chip <span className="font-mono tracking-wider">{number}</span>
        </p>
        <button type="button" onClick={() => void copy()} className="btn-secondary h-8 px-3 text-xs" aria-live="polite">
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} {copied ? "Copiado" : "Copiar número"}
        </button>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">Copie o número e cole na busca do serviço.</p>
      <div className="mt-3 space-y-3">
        {groups.map((g) => {
          const items = MICROCHIP_LOOKUPS.filter((l) => l.group === g);
          return (
            <div key={g}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{g}</p>
              <p className="text-xs text-[var(--muted)]">{items[0]?.groupDescription}</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {items.map((l) => (
                  <li key={l.key}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void copy()}
                      title={l.description ?? l.name}
                      className="inline-flex items-center gap-1 rounded-lg bg-ink-100 px-2.5 py-1 text-xs font-medium hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700"
                    >
                      {l.name} <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
