"use client";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { safeHref } from "@tinypet/shared";

export function Avatar({ src, name, size = 40, className, square = false }: { src?: string | null; name?: string | null; size?: number; className?: string; square?: boolean }) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size / 2.6)) };
  const shape = square ? "rounded-xl" : "rounded-full";
  const safeSrc = safeHref(src);
  if (safeSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={safeSrc} alt={name ?? ""} width={size} height={size} loading="lazy" decoding="async" style={style} className={cn(shape, "shrink-0 object-cover bg-ink-100 dark:bg-ink-800", className)} />;
  }
  return (
    <span aria-hidden style={style} className={cn(shape, "inline-flex shrink-0 select-none items-center justify-center bg-brand-100 font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200", className)}>
      {initials(name) || "?"}
    </span>
  );
}
