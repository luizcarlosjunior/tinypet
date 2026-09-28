/** Tiny CSV helpers (no deps). Output uses UTF-8 BOM so Excel opens it correctly. */

export type CsvColumn<T> = { key: string; label: string; get?: (row: T) => unknown };

function escapeCell(v: unknown): string {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : Array.isArray(v) ? v.join(" | ") : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: CsvColumn<T>[], delimiter = ","): string {
  const header = columns.map((c) => escapeCell(c.label)).join(delimiter);
  const body = rows.map((r) => columns.map((c) => escapeCell(c.get ? c.get(r) : r[c.key])).join(delimiter));
  return "﻿" + [header, ...body].join("\r\n") + "\r\n";
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}

/** Parses CSV text into rows of cells. Handles quotes, escaped quotes, CRLF and auto-detects `,` vs `;` from the header line. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Turns parsed rows into objects keyed by the (lower-cased, trimmed) header. */
export function csvObjects(rows: string[][]): Record<string, string>[] {
  const [header, ...rest] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rest.map((r) => {
    const o: Record<string, string> = {};
    keys.forEach((k, i) => (o[k] = (r[i] ?? "").trim()));
    return o;
  });
}
