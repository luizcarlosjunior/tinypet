"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.theme = next ? "dark" : "light";
    } catch {
      /* ignore */
    }
  }
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"} aria-pressed={dark} className={cn("btn-ghost h-10 px-3", className)}>
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
      {withLabel && <span>{dark ? "Tema claro" : "Tema escuro"}</span>}
    </button>
  );
}
