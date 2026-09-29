"use client";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { flattenCategories, type BlogCategoryNode } from "@/hooks/use-blog-admin";
import { cn } from "@/lib/utils";

/** Multi-select tree (categories + subcategories). Selecting a child does not auto-select the parent. */
export function CategoryTreePicker({ tree, value, onChange, disabled }: { tree: BlogCategoryNode[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const flat = useMemo(() => flattenCategories(tree), [tree]);
  const needle = q.trim().toLowerCase();
  const visible = flat.filter(({ node, parentId }) => {
    if (needle) {
      const self = node.name.toLowerCase().includes(needle);
      const childMatch = node.children?.some((c) => c.name.toLowerCase().includes(needle));
      return self || childMatch;
    }
    return !parentId || !collapsed.has(parentId);
  });
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const names = flat.filter((f) => value.includes(f.node.id)).map((f) => f.node.name);

  if (!tree.length) return <p className="text-sm text-[var(--muted)]">Nenhuma categoria cadastrada. Crie em Blog › Categorias.</p>;
  return (
    <div className="space-y-2">
      {flat.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
          <input className="input pl-9 py-1.5" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar categorias…" aria-label="Filtrar categorias" />
        </div>
      )}
      <ul className="max-h-64 space-y-0.5 overflow-y-auto rounded-xl border p-1.5" role="group" aria-label="Categorias">
        {visible.map(({ node, depth }) => {
          const hasChildren = !!node.children?.length;
          const isCollapsed = collapsed.has(node.id);
          return (
            <li key={node.id} className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
              {hasChildren ? (
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-ink-100 dark:hover:bg-ink-800"
                  aria-label={isCollapsed ? `Expandir ${node.name}` : `Recolher ${node.name}`}
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsed((s) => {
                      const n = new Set(s);
                      if (n.has(node.id)) n.delete(node.id);
                      else n.add(node.id);
                      return n;
                    })
                  }
                >
                  <ChevronRight className={cn("h-4 w-4 transition", !isCollapsed && "rotate-90")} />
                </button>
              ) : (
                <span className="w-5" />
              )}
              <label className={cn("flex flex-1 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-ink-50 dark:hover:bg-ink-900", !node.active && "opacity-60")}>
                <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-400" checked={value.includes(node.id)} onChange={() => toggle(node.id)} disabled={disabled} />
                <span className={cn(depth === 0 && "font-medium")}>{node.name}</span>
                {!node.active && <span className="text-xs text-[var(--muted)]">(inativa)</span>}
              </label>
            </li>
          );
        })}
      </ul>
      {names.length > 0 && <p className="text-xs text-[var(--muted)]">Selecionadas: {names.join(", ")}</p>}
    </div>
  );
}
