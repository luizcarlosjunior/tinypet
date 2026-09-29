import { describe, expect, it } from "vitest";
import { MICROCHIP_LOOKUPS, isValidMicrochip, normalizeMicrochip, petSchema, updatePetSchema } from "@tinypet/shared";

describe("microchip", () => {
  it("accepts exactly 15 digits, ignoring spaces, dots and dashes", () => {
    expect(isValidMicrochip("963000012345678")).toBe(true);
    expect(isValidMicrochip("963 000 012 345 678")).toBe(true);
    expect(isValidMicrochip("963-000.012-345678")).toBe(true);
    expect(normalizeMicrochip(" 963 000 012 345 678 ")).toBe("963000012345678");
  });
  it("rejects wrong lengths and letters", () => {
    expect(isValidMicrochip("96300001234567")).toBe(false);
    expect(isValidMicrochip("9630000123456789")).toBe(false);
    expect(isValidMicrochip("96300001234567A")).toBe(false);
    expect(isValidMicrochip("")).toBe(false);
    expect(isValidMicrochip(null)).toBe(false);
  });
  it("schema: empty means no microchip; otherwise 15 digits", () => {
    const base = { name: "Thor", speciesKey: "dog", sex: "MALE" as const };
    expect(petSchema.parse({ ...base, microchip: "" }).microchip).toBeNull();
    expect(petSchema.parse({ ...base, microchip: null }).microchip).toBeNull();
    expect(petSchema.parse({ ...base }).microchip).toBeUndefined();
    expect(petSchema.parse({ ...base, microchip: "963 000 012 345 678" }).microchip).toBe("963000012345678");
    const bad = petSchema.safeParse({ ...base, microchip: "12345" });
    expect(bad.success).toBe(false);
    expect(bad.success ? "" : bad.error.issues[0]?.message).toBe("O microchip deve ter 15 dígitos");
    expect(updatePetSchema.safeParse({ microchip: "12345678901234X" }).success).toBe(false);
  });
  it("lists the national, global and private lookup services with https URLs", () => {
    expect(MICROCHIP_LOOKUPS.map((l) => l.key)).toEqual(["sinpatinhas", "aaha", "tagmeupet", "petlink", "animalltag"]);
    expect(new Set(MICROCHIP_LOOKUPS.map((l) => l.group))).toEqual(new Set(["Nacional (Brasil)", "Internacional / Global", "Bancos privados"]));
    for (const l of MICROCHIP_LOOKUPS) expect(l.url.startsWith("https://")).toBe(true);
  });
});
