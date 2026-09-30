import { describe, expect, it } from "vitest";
import { parsePetSocialUsername, petSocialProfileUrl, petSocialProfilesSchema } from "@tinypet/shared";

const user = (r: ReturnType<typeof parsePetSocialUsername>) => (r.ok ? r.username : `ERR: ${r.message}`);

describe("parsePetSocialUsername", () => {
  it("accepts @user, bare user and lowercases", () => {
    expect(user(parsePetSocialUsername("INSTAGRAM", "@Rex.Dog"))).toBe("rex.dog");
    expect(user(parsePetSocialUsername("INSTAGRAM", "  rex_dog  "))).toBe("rex_dog");
  });
  it("treats a dotted handle without slash as a username, not a URL", () => {
    expect(user(parsePetSocialUsername("INSTAGRAM", "rex.dog"))).toBe("rex.dog");
  });
  it("extracts the username from profile URLs (with or without scheme, www, query, trailing slash)", () => {
    expect(user(parsePetSocialUsername("INSTAGRAM", "https://www.instagram.com/rex.dog/?igsh=abc123"))).toBe("rex.dog");
    expect(user(parsePetSocialUsername("INSTAGRAM", "instagram.com/rex.dog"))).toBe("rex.dog");
    expect(user(parsePetSocialUsername("TIKTOK", "https://www.tiktok.com/@rexdog?lang=pt-BR"))).toBe("rexdog");
    expect(user(parsePetSocialUsername("YOUTUBE", "https://m.youtube.com/@CanalDoRex/videos"))).toBe("canaldorex");
    expect(user(parsePetSocialUsername("FACEBOOK", "https://web.facebook.com/rex.dog.oficial"))).toBe("rex.dog.oficial");
    expect(user(parsePetSocialUsername("X", "https://twitter.com/RexDog"))).toBe("rexdog");
    expect(user(parsePetSocialUsername("X", "x.com/rexdog/status/123"))).toBe("rexdog");
    expect(user(parsePetSocialUsername("THREADS", "https://www.threads.net/@rex.dog"))).toBe("rex.dog");
    expect(user(parsePetSocialUsername("PINTEREST", "https://br.pinterest.com/rexdog/"))).toBe("rexdog");
  });
  it("rejects links of another network", () => {
    expect(user(parsePetSocialUsername("INSTAGRAM", "https://www.tiktok.com/@rexdog"))).toBe("ERR: Este link é do TikTok, não do Instagram");
    expect(user(parsePetSocialUsername("INSTAGRAM", "https://example.com/rex"))).toBe("ERR: Este link não é do Instagram");
  });
  it("rejects posts, pages and profile ids instead of profiles", () => {
    expect(parsePetSocialUsername("INSTAGRAM", "https://www.instagram.com/p/Cx1abc/").ok).toBe(false);
    expect(parsePetSocialUsername("YOUTUBE", "https://www.youtube.com/watch?v=abc").ok).toBe(false);
    expect(parsePetSocialUsername("YOUTUBE", "https://www.youtube.com/channel/UC123").ok).toBe(false);
    expect(parsePetSocialUsername("FACEBOOK", "https://www.facebook.com/profile.php?id=1000").ok).toBe(false);
    expect(parsePetSocialUsername("TIKTOK", "https://www.tiktok.com/rexdog").ok).toBe(false);
  });
  it("rejects short links", () => {
    expect(user(parsePetSocialUsername("TIKTOK", "https://vm.tiktok.com/ZMabc/"))).toMatch(/^ERR: Links curtos/);
    expect(parsePetSocialUsername("YOUTUBE", "https://youtu.be/abc").ok).toBe(false);
  });
  it("validates the username format per network", () => {
    expect(parsePetSocialUsername("X", "@nome_muito_longo_demais").ok).toBe(false);
    expect(parsePetSocialUsername("INSTAGRAM", "rex..dog").ok).toBe(false);
    expect(parsePetSocialUsername("INSTAGRAM", "rex.").ok).toBe(false);
    expect(parsePetSocialUsername("FACEBOOK", "rex").ok).toBe(false);
    expect(parsePetSocialUsername("INSTAGRAM", "rex dog").ok).toBe(false);
    expect(user(parsePetSocialUsername("INSTAGRAM", ""))).toBe("ERR: Informe o usuário do Instagram");
  });
});

describe("petSocialProfileUrl", () => {
  it("rebuilds the profile link from the stored username", () => {
    expect(petSocialProfileUrl("INSTAGRAM", "rex.dog")).toBe("https://www.instagram.com/rex.dog");
    expect(petSocialProfileUrl("TIKTOK", "rexdog")).toBe("https://www.tiktok.com/@rexdog");
    expect(petSocialProfileUrl("YOUTUBE", "canaldorex")).toBe("https://www.youtube.com/@canaldorex");
    expect(petSocialProfileUrl("X", "rexdog")).toBe("https://x.com/rexdog");
  });
});

describe("petSocialProfilesSchema", () => {
  it("normalizes URLs to usernames and drops empty rows", () => {
    const r = petSocialProfilesSchema.parse({ profiles: [
      { network: "INSTAGRAM", username: "https://instagram.com/Rex.Dog/" },
      { network: "TIKTOK", username: "  " },
      { network: "X", username: "@rexdog" },
    ] });
    expect(r.profiles).toEqual([{ network: "INSTAGRAM", username: "rex.dog" }, { network: "X", username: "rexdog" }]);
  });
  it("reports the message on the username path and rejects duplicate networks", () => {
    const r = petSocialProfilesSchema.safeParse({ profiles: [
      { network: "INSTAGRAM", username: "https://www.tiktok.com/@rex" },
      { network: "X", username: "a" },
      { network: "X", username: "b" },
    ] });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = r.error.issues.map((i) => [i.path.join("."), i.message]);
    expect(issues).toContainEqual(["profiles.0.username", "Este link é do TikTok, não do Instagram"]);
    expect(issues).toContainEqual(["profiles.2.network", "Rede social repetida"]);
  });
});

import { gramsToKgInput, parseKgToGrams } from "@tinypet/shared";

describe("parseKgToGrams / gramsToKgInput", () => {
  it("accepts comma or dot decimals and rounds to grams", () => {
    expect(parseKgToGrams("8,5")).toBe(8500);
    expect(parseKgToGrams(" 12.345 ")).toBe(12345);
    expect(parseKgToGrams("0,35")).toBe(350);
  });
  it("empty = not informed; invalid = undefined", () => {
    expect(parseKgToGrams("")).toBeNull();
    expect(parseKgToGrams("abc")).toBeUndefined();
    expect(parseKgToGrams("0")).toBeUndefined();
    expect(parseKgToGrams("1500")).toBeUndefined();
  });
  it("formats grams back with a decimal comma", () => {
    expect(gramsToKgInput(8500)).toBe("8,5");
    expect(gramsToKgInput(null)).toBe("");
  });
});

import { gramsToInput, parseWeightToGrams, preferredWeightUnit } from "@tinypet/shared";

describe("parseWeightToGrams (kg/g selector)", () => {
  it("kg accepts decimals with comma or dot", () => {
    expect(parseWeightToGrams("2,5", "kg")).toBe(2500);
    expect(parseWeightToGrams("15", "kg")).toBe(15000);
    expect(parseWeightToGrams("0.35", "kg")).toBe(350);
  });
  it("g only accepts whole numbers", () => {
    expect(parseWeightToGrams("250", "g")).toBe(250);
    expect(parseWeightToGrams("2,5", "g")).toBeUndefined();
    expect(parseWeightToGrams("abc", "g")).toBeUndefined();
  });
  it("empty is null, zero/negative invalid", () => {
    expect(parseWeightToGrams(" ", "kg")).toBeNull();
    expect(parseWeightToGrams("0", "g")).toBeUndefined();
  });
  it("formats and picks the display unit", () => {
    expect(gramsToInput(2500, "kg")).toBe("2,5");
    expect(gramsToInput(2500, "g")).toBe("2500");
    expect(preferredWeightUnit(250, "kg")).toBe("g");
    expect(preferredWeightUnit(15000, "g")).toBe("kg");
    expect(preferredWeightUnit(null, "kg")).toBe("kg");
  });
});
