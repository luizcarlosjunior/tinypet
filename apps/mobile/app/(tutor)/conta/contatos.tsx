import React, { useState } from "react";
import { Alert } from "react-native";
import { useContactMutations, useMyContacts } from "@/hooks/use-me";
import { errorMessage } from "@/lib/api";
import type { Email, Phone } from "@/lib/types";
import { Badge, Button, Checkbox, ErrorState, Input, ListItem, Loading, Screen, Section, Select, Sheet } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";

const PHONE_TYPE = { MOBILE: "Celular", LANDLINE: "Fixo", WHATSAPP: "WhatsApp" } as const;

export default function Contacts() {
  const phones = useMyContacts<Phone>("phones");
  const emails = useMyContacts<Email>("emails");
  const pm = useContactMutations("phones");
  const em = useContactMutations("emails");
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pf, setPf] = useState<{ type: Phone["type"]; number: string; isPrimary: boolean }>({ type: "MOBILE", number: "", isPrimary: false });
  const [ef, setEf] = useState({ address: "", isPrimary: false });

  const confirmRemove = (label: string, fn: () => Promise<unknown>) => Alert.alert("Remover?", label, [{ text: "Cancelar", style: "cancel" }, { text: "Remover", style: "destructive", onPress: () => fn().catch((e) => Alert.alert("Erro", errorMessage(e))) }]);

  return (
    <>
      <BackHeader title="Telefones e e-mails" fallback="/(tutor)/conta" />
      <Screen refreshing={phones.isFetching && !phones.isLoading} onRefresh={() => { phones.refetch(); emails.refetch(); }}>
        <Section title="Telefones" right={<Button title="Adicionar" size="sm" onPress={() => setPhoneOpen(true)} />}>
          {phones.isLoading ? <Loading /> : phones.error ? <ErrorState error={phones.error} onRetry={phones.refetch} /> : null}
          {(phones.data ?? []).map((p) => (
            <ListItem key={p.id} title={p.number} subtitle={PHONE_TYPE[p.type]} right={p.isPrimary ? <Badge label="Principal" tone="primary" /> : undefined} onPress={() => confirmRemove(p.number, () => pm.remove.mutateAsync(p.id))} chevron={false} accessibilityLabel={`Remover telefone ${p.number}`} />
          ))}
        </Section>
        <Section title="E-mails" right={<Button title="Adicionar" size="sm" onPress={() => setEmailOpen(true)} />}>
          {emails.isLoading ? <Loading /> : emails.error ? <ErrorState error={emails.error} onRetry={emails.refetch} /> : null}
          {(emails.data ?? []).map((e) => (
            <ListItem key={e.id} title={e.address} right={e.isPrimary ? <Badge label="Principal" tone="primary" /> : e.verifiedAt ? <Badge label="Verificado" tone="success" /> : undefined} onPress={() => confirmRemove(e.address, () => em.remove.mutateAsync(e.id))} chevron={false} accessibilityLabel={`Remover e-mail ${e.address}`} />
          ))}
        </Section>
      </Screen>
      <Sheet visible={phoneOpen} onClose={() => setPhoneOpen(false)} title="Novo telefone">
        <Select label="Tipo" value={pf.type} onChange={(v) => setPf({ ...pf, type: (v ?? "MOBILE") as Phone["type"] })} options={(Object.keys(PHONE_TYPE) as Phone["type"][]).map((k) => ({ value: k, label: PHONE_TYPE[k] }))} />
        <Input label="Número" keyboardType="phone-pad" value={pf.number} onChangeText={(v) => setPf({ ...pf, number: v })} placeholder="(11) 99999-9999" />
        <Checkbox checked={pf.isPrimary} onChange={(v) => setPf({ ...pf, isPrimary: v })} label="Telefone principal" />
        <Button title="Salvar" loading={pm.create.isPending} disabled={pf.number.replace(/\D/g, "").length < 8} onPress={() => pm.create.mutateAsync(pf).then(() => { setPhoneOpen(false); setPf({ type: "MOBILE", number: "", isPrimary: false }); }).catch((e) => Alert.alert("Erro", errorMessage(e)))} />
      </Sheet>
      <Sheet visible={emailOpen} onClose={() => setEmailOpen(false)} title="Novo e-mail">
        <Input label="E-mail" keyboardType="email-address" autoCapitalize="none" value={ef.address} onChangeText={(v) => setEf({ ...ef, address: v })} />
        <Checkbox checked={ef.isPrimary} onChange={(v) => setEf({ ...ef, isPrimary: v })} label="E-mail principal" />
        <Button title="Salvar" loading={em.create.isPending} disabled={!ef.address.includes("@")} onPress={() => em.create.mutateAsync(ef).then(() => { setEmailOpen(false); setEf({ address: "", isPrimary: false }); }).catch((e) => Alert.alert("Erro", errorMessage(e)))} />
      </Sheet>
    </>
  );
}
