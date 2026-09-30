"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; title: string; kind: "success" | "error" | "info" };
const Ctx = createContext<{ toast: (title: string, kind?: Toast["kind"]) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((title: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, title, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className={cn("rounded-xl px-4 py-2 text-sm text-white shadow-lg", t.kind === "success" && "bg-emerald-600", t.kind === "error" && "bg-red-600", t.kind === "info" && "bg-ink-800")}>
            {t.title}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
