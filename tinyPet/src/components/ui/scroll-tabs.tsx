"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScrollTabItem<K extends string> = { key: K; label: string; icon: LucideIcon };

/**
 * Tabs with icons in one scrollable row. Sticks below the app header while scrolling; when the row overflows,
 * the edges fade and ‹ › buttons appear; the active tab is scrolled into view. Keyboard: ←/→, Home/End (WAI-ARIA tabs).
 */
export function ScrollTabs<K extends string>({ items, value, onChange, label, sticky = true }: { items: readonly ScrollTabItem<K>[]; value: K; onChange: (k: K) => void; label: string; sticky?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<K, HTMLButtonElement | null>>>({});
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  // keep the active tab visible (e.g. deep link to ?tab=conquistas on a phone)
  useEffect(() => {
    tabRefs.current[value]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [value]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = items.findIndex((t) => t.key === value);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const k = items[(next + items.length) % items.length]!.key;
    onChange(k);
    tabRefs.current[k]?.focus();
  };

  const arrow = "absolute top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-[var(--card)] text-[var(--fg)] shadow-sm hover:bg-ink-100 dark:hover:bg-ink-800";
  return (
    <nav aria-label={label} className={cn("-mx-4 border-b bg-[var(--bg)]/95 px-4 backdrop-blur", sticky && "sticky top-16 z-20")}>
      <div className="relative">
        {edges.left && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-12 bg-gradient-to-r from-[var(--bg)] to-transparent" aria-hidden />
            <button type="button" tabIndex={-1} onClick={() => scrollBy(-1)} className={cn(arrow, "left-0")} aria-label="Ver abas anteriores">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
          </>
        )}
        <div ref={scroller} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map(({ key, label: text, icon: Icon }) => {
            const active = key === value;
            return (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[key] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={active}
                aria-controls={`panel-${key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-brand-400",
                  active ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-[var(--muted)] hover:border-ink-300 hover:text-[var(--fg)] dark:hover:border-ink-600",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {text}
              </button>
            );
          })}
        </div>
        {edges.right && (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-12 bg-gradient-to-l from-[var(--bg)] to-transparent" aria-hidden />
            <button type="button" tabIndex={-1} onClick={() => scrollBy(1)} className={cn(arrow, "right-0")} aria-label="Ver mais abas">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
