import { describe, expect, it } from "vitest";
import { payloadFromForm, type FieldDef } from "./AdminTable";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("admin payloadFromForm", () => {
  const fields: FieldDef[] = [
    { key: "label", label: "Nome", required: true },
    { key: "sortOrder", label: "Ordem", type: "number" },
    { key: "price", label: "Preço", type: "number", decimal: true, emptyAs: "null" },
    { key: "status", label: "Status", type: "select", emptyAs: "omit" },
    { key: "species", label: "Espécie", type: "select" },
    { key: "key", label: "Chave", emptyAs: "omit" },
    { key: "active", label: "Ativo", type: "checkbox" },
  ];
  it("omits empty optional numbers/`omit` fields, nulls the rest", () => {
    expect(payloadFromForm(fd({ label: "A", sortOrder: "", price: "", status: "", species: "", key: "" }), fields)).toEqual({ label: "A", price: null, species: null, active: false });
  });
  it("coerces filled values", () => {
    expect(payloadFromForm(fd({ label: "A", sortOrder: "3", price: "9.9", status: "APPROVED", species: "dog", key: "sit", active: "on" }), fields)).toEqual({ label: "A", sortOrder: 3, price: 9.9, status: "APPROVED", species: "dog", key: "sit", active: true });
  });
});
