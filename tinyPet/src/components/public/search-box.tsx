"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Search } from "lucide-react";

/** Home hero search: "what" + "city". */
export function SearchBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const sp = new URLSearchParams();
        if (q) sp.set("q", q);
        if (city) sp.set("city", city);
        router.push(`/buscar${sp.toString() ? `?${sp}` : ""}`);
      }}
      className={`flex flex-col gap-2 rounded-2xl border bg-[var(--card)] p-2 shadow-sm sm:flex-row ${compact ? "" : "sm:p-3"}`}
    >
      <label className="relative flex-1">
        <span className="sr-only">O que você procura</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Adestrador, banho e tosa, vacina…" className="input h-11 border-0 bg-transparent pl-9 focus:ring-0" />
      </label>
      <label className="relative flex-1 border-t sm:border-l sm:border-t-0">
        <span className="sr-only">Cidade</span>
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="input h-11 border-0 bg-transparent pl-9 focus:ring-0" />
      </label>
      <button type="submit" className="btn-primary h-11 px-6">
        Buscar
      </button>
    </form>
  );
}
