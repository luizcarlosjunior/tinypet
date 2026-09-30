import { describe, expect, it } from "vitest";
import { pickResult, profileColumns, toBreedInfo } from "./breed-info";

const dog = { name: "Border Collie", image_link: "https://x.test/bc.jpg", min_life_expectancy: 12, max_life_expectancy: 15, min_weight_male: 30, max_weight_male: 55, min_weight_female: 30, max_weight_female: 55, min_height_male: 19, max_height_male: 22, min_height_female: 18, max_height_female: 21, energy: 5, trainability: 5, barking: 4, shedding: 3, grooming: 3, drooling: 1, coat_length: 1, good_with_children: 3, good_with_other_dogs: 3, good_with_strangers: 4, playfulness: 5, protectiveness: 3 };
const cat = { name: "Persian", image_link: "https://x.test/p.jpg", origin: "Iran", length: "14 to 18 inches", min_weight: 7, max_weight: 12, min_life_expectancy: 10, max_life_expectancy: 15, family_friendly: 5, children_friendly: 2, other_pets_friendly: 5, general_health: 2, intelligence: 3, playfulness: 1, shedding: 5, grooming: 1 };
const asRow = (c: ReturnType<typeof profileColumns>) => ({ id: "p1", fetchedAt: new Date(), updatedAt: new Date(), origin: null, lengthText: null, imageUrl: null, lifeMinYears: null, lifeMaxYears: null, weightMinKgMale: null, weightMaxKgMale: null, weightMinKgFemale: null, weightMaxKgFemale: null, weightMinKg: null, weightMaxKg: null, heightMinCmMale: null, heightMaxCmMale: null, heightMinCmFemale: null, heightMaxCmFemale: null, energy: null, playfulness: null, trainability: null, intelligence: null, goodWithChildren: null, goodWithOtherDogs: null, goodWithStrangers: null, familyFriendly: null, otherPetsFriendly: null, protectiveness: null, barking: null, shedding: null, grooming: null, drooling: null, coatLength: null, generalHealth: null, source: "api-ninjas", ...c }) as Parameters<typeof toBreedInfo>[0];

describe("breed profile replication", () => {
  it("converts dog pounds → kg and inches → cm into columns", () => {
    const c = profileColumns("dog", dog);
    expect(c).toMatchObject({ speciesKey: "dog", externalName: "Border Collie", weightMinKgMale: 13.6, weightMaxKgMale: 24.9, heightMinCmMale: 48.3, heightMaxCmMale: 55.9, energy: 5, trainability: 5, coatLength: 1 });
  });
  it("maps cat fields (children_friendly → goodWithChildren, overall weight)", () => {
    const c = profileColumns("cat", cat);
    expect(c).toMatchObject({ speciesKey: "cat", origin: "Iran", weightMinKg: 3.2, weightMaxKg: 5.4, goodWithChildren: 2, familyFriendly: 5, generalHealth: 2, grooming: 1 });
  });
  it("builds the API shape with pt-BR trait labels", () => {
    const d = toBreedInfo(asRow(profileColumns("dog", dog)));
    expect(d.weightKg.male).toEqual({ min: 13.6, max: 24.9 });
    expect(d.lifeYears).toEqual({ min: 12, max: 15 });
    expect(d.traits.find((t) => t.key === "trainability")).toMatchObject({ label: "Facilidade de treino", value: 5 });
    const c = toBreedInfo(asRow(profileColumns("cat", cat)));
    expect(c.weightKg.any).toEqual({ min: 3.2, max: 5.4 });
    expect(c.traits.find((t) => t.key === "children_friendly")).toMatchObject({ label: "Com crianças", value: 2 });
    expect(c.traits.find((t) => t.key === "grooming")?.label).toBe("Facilidade de cuidar do pelo");
  });
  it("prefers the exact name among provider results", () => {
    expect(pickResult([{ name: "German Shepherd Dog" }, { name: "Shepherd" }], "shepherd")?.name).toBe("Shepherd");
    expect(pickResult([{ name: "German Shepherd Dog" }], "German Shepherd")?.name).toBe("German Shepherd Dog");
  });
});
