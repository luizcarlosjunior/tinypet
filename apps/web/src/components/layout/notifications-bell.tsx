"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications, useMarkNotificationsRead } from "@/hooks/use-notifications";
import { useSessionContext } from "@/hooks/use-session-context";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsBell({ className }: { className?: string }) {
  const { isLoggedIn } = useSessionContext();
  const { data } = useNotifications(isLoggedIn);
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = (data ?? []).filter((n) => !n.readAt).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isLoggedIn) return null;
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={unread ? `Notificações, ${unread} não lidas` : "Notificações"} aria-expanded={open} className="btn-ghost relative h-10 w-10 px-0">
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-brand-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border bg-[var(--card)] shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <button type="button" onClick={() => markRead.mutate()} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Marcar todas como lidas
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {(data ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">Nenhuma notificação por aqui.</li>}
            {(data ?? []).map((n) => (
              <li key={n.id} className={cn("border-b px-4 py-3 last:border-0", !n.readAt && "bg-brand-50/60 dark:bg-brand-900/10")}>
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-[var(--muted)]">{n.body}</p>}
                <p className="mt-1 text-[11px] text-[var(--muted)]">{fmtDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
