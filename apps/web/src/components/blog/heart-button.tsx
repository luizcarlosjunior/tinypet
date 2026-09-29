"use client";
import Link from "next/link";
import { useState } from "react";
import { Heart } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Props = {
  /** `/blog/posts/:id/heart` or `/blog/comments/:id/heart` */
  endpoint: string;
  initialHearted: boolean;
  initialCount: number;
  loggedIn: boolean;
  /** Where to come back after login. */
  nextPath: string;
  size?: "sm" | "md";
  label?: string;
};

/** "Merece um coração" toggle: optimistic, aria-pressed, count announced politely. Logged out → login link. */
export function HeartButton({ endpoint, initialHearted, initialCount, loggedIn, nextPath, size = "md", label = "Merece um coração" }: Props) {
  const [hearted, setHearted] = useState(initialHearted);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-full border font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
    size === "md" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-xs",
    hearted ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300" : "hover:bg-ink-100 dark:hover:bg-ink-800",
  );
  const icon = <Heart className={cn(size === "md" ? "h-5 w-5" : "h-4 w-4", hearted && "fill-current")} aria-hidden />;
  const counter = (
    <span aria-live="polite" aria-atomic="true">
      <span className="sr-only">{hearted ? "Você deu um coração. " : ""}Total: </span>
      {count}
    </span>
  );

  if (!loggedIn) {
    return (
      <Link href={`/entrar?next=${encodeURIComponent(nextPath)}`} className={cls} title="Entre para dar um coração">
        {icon}
        <span className={size === "sm" ? "sr-only" : ""}>{label}</span>
        <span aria-label={`${count} corações`}>{count}</span>
      </Link>
    );
  }

  async function toggle() {
    if (busy) return;
    const prev = { hearted, count };
    setHearted(!hearted);
    setCount(Math.max(0, count + (hearted ? -1 : 1)));
    setBusy(true);
    try {
      const r = await api<{ hearted: boolean; heartsCount: number }>(endpoint, { method: "POST" });
      setHearted(r.hearted);
      setCount(r.heartsCount);
    } catch (e) {
      setHearted(prev.hearted);
      setCount(prev.count);
      toast(e instanceof Error ? e.message : "Não foi possível registrar", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={hearted} className={cls} title={label}>
      {icon}
      <span className={size === "sm" ? "sr-only" : ""}>{label}</span>
      {counter}
    </button>
  );
}
