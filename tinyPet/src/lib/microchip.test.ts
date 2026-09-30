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

import { microchipParts, microchipProblem, petSchema as petSchemaForChip } from "@tinypet/shared";

describe("microchip rules (ISO 11784/11785)", () => {
  it("rejects numbers starting with 900 (factory/test chips)", () => {
    expect(microchipProblem("900123456789012")).toBe("TEST_PREFIX");
    expect(isValidMicrochip("900123456789012")).toBe(false);
    const r = petSchemaForChip.safeParse({ name: "Rex", speciesKey: "dog", sex: "MALE", microchip: "900 123 456 789 012" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/900/);
  });
  it("tells letters from wrong length", () => {
    expect(microchipProblem("98102000012345A")).toBe("NOT_NUMERIC");
    expect(microchipProblem("98102000012345")).toBe("LENGTH");
    expect(microchipProblem("")).toBe("EMPTY");
    expect(microchipProblem("981020000123456")).toBeNull();
  });
  it("splits code and serial, naming known manufacturers and Brazil", () => {
    expect(microchipParts("981020000123456")).toEqual({ code: "981", serial: "020000123456", kind: "MANUFACTURER", label: "Fabricante: Datamars (código secundário) (Datamars Microchips)" });
    expect(microchipParts("977200000123456")?.label).toBe("Fabricante: Virbac (BackHome)");
    expect(microchipParts("933000000123456")?.label).toBe("Fabricante: Avid Identification Systems (Avid FriendChip)");
    expect(microchipParts("076123456789012")?.label).toBe("País: Brasil");
    expect(microchipParts("840123456789012")?.label).toBe("País: Estados Unidos");
    expect(microchipParts("032123456789012")?.label).toBe("País: Argentina");
    expect(microchipParts("100123456789012")?.label).toBe("Código de país");
    expect(microchipParts("963000012345678")?.label).toBe("Código de fabricante");
    expect(microchipParts("12345")).toBeNull();
  });
});
