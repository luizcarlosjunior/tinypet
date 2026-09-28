import React, { useState } from "react";
import { Alert } from "react-native";
import { useContactMutations, useMyContacts } from "@/hooks/use-me";
import { errorMessage } from "@/lib/api";
import { addressText } from "@/lib/nav";
import type { Address } from "@/lib/types";
import { Badge, Button, Empty, ErrorState, ListItem, Loading, Screen, Sheet } from "@/components/ui";
import { AddressForm } from "@/components/AddressForm";
import { BackHeader } from "@/components/BackHeader";

export default function Addresses() {
  const q = useMyContacts<Address>("addresses");
  const m = useContactMutations("addresses");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  return (
    <>
      <BackHeader title="Endereços" fallback="/(tutor)/conta" right={<Button title="Novo" size="sm" icon="add" onPress={() => { setEditing(null); setOpen(true); }} />} />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {q.data?.length === 0 ? <Empty icon="location-outline" title="Nenhum endereço" description="Adicione um endereço para atendimentos a domicílio." action="Adicionar" onAction={() => setOpen(true)} /> : null}
        {(q.data ?? []).map((a) => (
          <ListItem
            key={a.id}
            title={a.label || addressText(a)}
            subtitle={a.label ? addressText(a) : a.complement}
            right={a.isPrimary ? <Badge label="Principal" tone="primary" /> : undefined}
            onPress={() => { setEditing(a); setOpen(true); }}
          />
        ))}
      </Screen>
      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? "Editar endereço" : "Novo endereço"}>
        <AddressForm
          initial={editing ?? undefined}
          onSubmit={async (v) => {
            try {
              if (editing) await m.update.mutateAsync({ id: editing.id, ...v });
              else await m.create.mutateAsync(v);
              setOpen(false);
            } catch (e) {
              Alert.alert("Erro", errorMessage(e));
            }
          }}
        />
        {editing ? (
          <Button
            title="Remover endereço"
            variant="ghost"
            style={{ marginTop: 8 }}
            onPress={() => Alert.alert("Remover endereço?", undefined, [{ text: "Cancelar", style: "cancel" }, { text: "Remover", style: "destructive", onPress: () => m.remove.mutateAsync(editing.id).then(() => setOpen(false)).catch((e) => Alert.alert("Erro", errorMessage(e))) }])}
          />
        ) : null}
      </Sheet>
    </>
  );
}
