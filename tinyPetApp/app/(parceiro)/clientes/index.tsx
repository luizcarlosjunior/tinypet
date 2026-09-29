import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-store";
import { useClients } from "@/hooks/use-partner";
import { spacing, useTheme } from "@/lib/theme";
import { Avatar, Badge, Button, Empty, ErrorState, Input, ListItem, Loading, Screen } from "@/components/ui";

export default function ClientsList() {
  const t = useTheme();
  const router = useRouter();
  const { activePartnerId } = useAuth();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(h);
  }, [q]);
  const list = useClients(debounced, activePartnerId);
  const items = list.data?.data ?? [];

  return (
    <Screen scroll={false} title="Clientes" subtitle={list.data?.meta ? `${list.data.meta.total} no total` : undefined} right={<Button title="Novo" size="sm" icon="person-add-outline" onPress={() => router.push("/(parceiro)/clientes/novo")} />}>
      <Input placeholder="Buscar por nome, telefone, pet…" value={q} onChangeText={setQ} accessibilityLabel="Buscar clientes" right={<Ionicons name="search" size={18} color={t.inkFaint} />} />
      {list.isLoading ? <Loading /> : null}
      {list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : null}
      {list.data ? (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={list.isFetching && !list.isLoading} onRefresh={list.refetch} tintColor={t.primary} colors={[t.primary]} />}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          ListEmptyComponent={<Empty icon="people-outline" title={debounced ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"} description={debounced ? undefined : "Cadastre o primeiro cliente e seus pets."} action={debounced ? undefined : "Novo cliente"} onAction={() => router.push("/(parceiro)/clientes/novo")} />}
          renderItem={({ item: c }) => (
            <ListItem
              title={c.name}
              subtitle={[(c.pets ?? []).map((p) => p.name).join(", ") || "Sem pets", c.primaryPhone ?? c.phones?.[0]?.number].filter(Boolean).join(" · ")}
              left={<Avatar name={c.name} size={44} />}
              right={
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {c.userId || c.user ? <Badge label="No app" tone="success" icon="phone-portrait-outline" /> : null}
                  {c.tags?.slice(0, 1).map((tag) => (
                    <Badge key={tag} label={tag} />
                  ))}
                </View>
              }
              onPress={() => router.push(`/(parceiro)/clientes/${c.id}`)}
              accessibilityLabel={`Abrir cliente ${c.name}`}
            />
          )}
        />
      ) : null}
    </Screen>
  );
}
