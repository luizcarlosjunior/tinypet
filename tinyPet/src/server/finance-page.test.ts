import { describe, expect, it } from "vitest";
import { optionalPage } from "./finance";
import { petReportQuery, agendaQuery, planSchema, lessonSchema } from "@tinypet/shared";

describe("optionalPage (finance lists)", () => {
  const rows = Array.from({ length: 45 }, (_, i) => i);
  it("returns everything without ?page", () => {
    expect(optionalPage(rows, new URLSearchParams(""))).toEqual({ data: rows });
  });
  it("paginates with ?page&pageSize and reports meta", () => {
    const r = optionalPage(rows, new URLSearchParams("page=2&pageSize=20"));
    expect(r.data).toEqual(rows.slice(20, 40));
    expect(r.meta).toEqual({ page: 2, pageSize: 20, total: 45 });
  });
  it("clamps bad values", () => {
    expect(optionalPage(rows, new URLSearchParams("page=0&pageSize=999")).meta).toEqual({ page: 1, pageSize: 100, total: 45 });
  });
});

describe("shared query schemas used by the panel", () => {
  it("petReportQuery.neutered parses 'false' as false", () => {
    expect(petReportQuery.parse({ neutered: "false" }).neutered).toBe(false);
    expect(petReportQuery.parse({ neutered: "true" }).neutered).toBe(true);
    expect(petReportQuery.parse({ neutered: "" }).neutered).toBeUndefined();
    expect(petReportQuery.parse({}).neutered).toBeUndefined();
  });
  it("agendaQuery accepts clientId", () => {
    expect(agendaQuery.parse({ from: "2026-01-01", to: "2026-01-31", clientId: "abc" }).clientId).toBe("abc");
  });
  it("planSchema keeps sortOrder", () => {
    expect(planSchema.partial().parse({ sortOrder: 3 }).sortOrder).toBe(3);
  });
  it("lessonSchema title error is pt-BR", () => {
    const r = lessonSchema.safeParse({ title: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Informe o título da aula");
  });
});
