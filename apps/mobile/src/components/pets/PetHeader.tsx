import React from "react";
import { View } from "react-native";
import { ageInMonths, formatAge, lifeStageFor, LIFE_STAGE_LABEL } from "@tinypet/shared";
import { fmtDate } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { Pet } from "@/lib/types";
import { Avatar, Badge, Text } from "@/components/ui";

export function PetHeader({ pet }: { pet: Pet }) {
  const t = useTheme();
  const months = ageInMonths(pet.birthDate, pet.approxAgeMonths);
  const stage = lifeStageFor(months, pet.speciesKey, pet.size);
  const breed = pet.breed?.name ?? pet.breedOther ?? null;
  const deceased = pet.status === "DECEASED";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md, opacity: deceased ? 0.85 : 1 }}>
      <Avatar uri={pet.avatarUrl} name={pet.name} species={pet.speciesKey} size={72} />
      <View style={{ flex: 1 }}>
        <Text variant="title">{pet.name}</Text>
        <Text variant="small" tone="muted">
          {[pet.species?.label, breed, formatAge(months)].filter(Boolean).join(" · ")}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {deceased ? <Badge label={`Em memória · ${fmtDate(pet.deceasedAt)}`} tone="neutral" icon="heart" /> : stage ? <Badge label={LIFE_STAGE_LABEL[stage]} tone="primary" /> : null}
          {pet.streakDays ? <Badge label={`${pet.streakDays} dias de rotina`} tone="success" icon="flame" /> : null}
          {pet.accessLevel === "VIEW" ? <Badge label="Somente leitura" /> : null}
        </View>
      </View>
      {deceased && pet.memorialNote ? null : <View style={{ width: 0, backgroundColor: t.border }} />}
    </View>
  );
}
