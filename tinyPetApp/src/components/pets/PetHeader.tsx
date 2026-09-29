import React from "react";
import { View } from "react-native";
import { ageInMonths, formatAge, lifeStageFor, LIFE_STAGE_LABEL } from "@tinypet/shared";
import { fmtDate, fmtDay } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { AccountRef, Pet } from "@/lib/types";
import { Avatar, Badge, Text } from "@/components/ui";
import { speciesKeyOf } from "@/lib/species";

/** `sharedBy`: set (or null while loading) when the pet is shared with the viewer — shows "Compartilhado por @user". */
export function PetHeader({ pet, sharedBy }: { pet: Pet; sharedBy?: AccountRef | null }) {
  const t = useTheme();
  const months = ageInMonths(pet.birthDate, pet.approxAgeMonths);
  const stage = pet.lifeStage ?? lifeStageFor(months, speciesKeyOf(pet) ?? "dog", pet.size);
  const breed = pet.breed?.name ?? pet.breedOther ?? null;
  const deceased = pet.status === "DECEASED";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md, opacity: deceased ? 0.85 : 1 }}>
      <Avatar uri={pet.avatarUrl} name={pet.name} species={speciesKeyOf(pet)} size={72} />
      <View style={{ flex: 1 }}>
        <Text variant="title">{pet.name}</Text>
        <Text variant="small" tone="muted">
          {[pet.species?.label, breed, formatAge(months)].filter(Boolean).join(" · ")}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {deceased ? <Badge label={`Em memória · ${fmtDay(pet.deceasedAt)}`} tone="neutral" icon="heart" /> : stage ? <Badge label={LIFE_STAGE_LABEL[stage]} tone="primary" /> : null}
          {pet.streakDays ? <Badge label={`${pet.streakDays} ${pet.streakDays === 1 ? "dia" : "dias"} de rotina`} tone="success" icon="flame" /> : null}
          {sharedBy !== undefined ? <Badge label={sharedBy ? `Compartilhado por ${sharedBy.username ? `@${sharedBy.username}` : sharedBy.name}` : "Compartilhado"} tone="info" icon="people" /> : null}
        </View>
      </View>
      {deceased && pet.memorialNote ? null : <View style={{ width: 0, backgroundColor: t.border }} />}
    </View>
  );
}
