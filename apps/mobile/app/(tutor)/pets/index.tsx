import React, { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { ageInMonths, formatAge } from "@tinypet/shared";
import { usePets } from "@/hooks/use-pets";
import { spacing, useTheme } from "@/lib/theme";
import { Avatar, Badge, Button, Checkbox, Empty, ErrorState, ListItem, Loading, Screen } from "@/components/ui";

export default function PetsList() {
  const t = useTheme();
  const router = useRouter();
  const [includeDeceased, setIncludeDeceased] = useState(false);
  const q = usePets(includeDeceased);
  const pets = q.data ?? [];

  return (
    <Screen scroll={false} title="Meus pets" right={<Button title="Novo pet" size="sm" icon="add" onPress={() => router.push("/(tutor)/pets/novo")} />}>
      <Checkbox checked={includeDeceased} onChange={setIncludeDeceased} label="Mostrar pets em memória" />
      {q.isLoading ? <Loading /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
      {q.data ? (
        <FlatList
          data={pets}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch} tintColor={t.primary} colors={[t.primary]} />}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          ListEmptyComponent={<Empty title="Nenhum pet ainda" description="Cadastre seu primeiro pet para começar." action="Cadastrar pet" onAction={() => router.push("/(tutor)/pets/novo")} />}
          renderItem={({ item: p }) => (
            <ListItem
              title={p.name}
              subtitle={[p.species?.label, p.breed?.name ?? p.breedOther, formatAge(ageInMonths(p.birthDate, p.approxAgeMonths))].filter(Boolean).join(" · ")}
              left={<Avatar uri={p.avatarUrl} name={p.name} species={p.speciesKey} size={52} />}
              right={
                <View style={{ gap: 4, alignItems: "flex-end" }}>
                  {p.status === "DECEASED" ? <Badge label="Em memória" icon="heart" /> : null}
                  {p.accessLevel === "VIEW" || p.accessLevel === "EDIT" ? <Badge label="Compartilhado" tone="info" /> : null}
                </View>
              }
              onPress={() => router.push(`/(tutor)/pets/${p.id}`)}
              accessibilityLabel={`Abrir ficha de ${p.name}`}
            />
          )}
        />
      ) : null}
    </Screen>
  );
}
