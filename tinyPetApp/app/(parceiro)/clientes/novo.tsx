import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientInput } from "@tinypet/shared";
import { useClientMutations } from "@/hooks/use-partner";
import { ApiError, errorMessage } from "@/lib/api";
import { spacing } from "@/lib/theme";
import { Button, Input, Screen, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";
import { isPlanLimit, PlanLimitNotice } from "@/components/PlanLimitNotice";

type Form = { name: string; phone: string; email: string; notes: string };

export default function NewClient() {
  const router = useRouter();
  const { create } = useClientMutations();
  const [limit, setLimit] = useState<ApiError | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({ defaultValues: { name: "", phone: "", email: "", notes: "" } });

  const onSubmit = handleSubmit(async (v) => {
    const input: ClientInput = {
      name: v.name.trim(),
      notes: v.notes || null,
      phones: v.phone ? [{ type: "MOBILE", number: v.phone, isPrimary: true }] : undefined,
      emails: v.email ? [{ address: v.email.toLowerCase(), isPrimary: true }] : undefined,
    };
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) {
      Alert.alert("Dados inválidos", parsed.error.issues[0]?.message ?? "Verifique os campos");
      return;
    }
    try {
      const c = await create.mutateAsync(parsed.data);
      router.replace(`/(parceiro)/clientes/${c.id}`);
    } catch (e) {
      if (isPlanLimit(e)) setLimit(e);
      else Alert.alert("Erro", errorMessage(e));
    }
  });

  return (
    <>
      <BackHeader title="Novo cliente" fallback="/(parceiro)/clientes" />
      <Screen keyboard>
        {limit ? <PlanLimitNotice error={limit} compact /> : null}
        <Controller control={control} name="name" rules={{ required: "Informe o nome", minLength: { value: 2, message: "Nome muito curto" } }} render={({ field, fieldState }) => <Input label="Nome" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoFocus />} />
        <Controller control={control} name="phone" render={({ field }) => <Input label="Celular / WhatsApp" keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} />} />
        <Controller control={control} name="email" render={({ field }) => <Input label="E-mail" keyboardType="email-address" autoCapitalize="none" value={field.value} onChangeText={field.onChange} hint="Usado para convidar o cliente ao app" />} />
        <Controller control={control} name="notes" render={({ field }) => <Input label="Observações" multiline value={field.value} onChangeText={field.onChange} />} />
        <Button title="Cadastrar cliente" onPress={onSubmit} loading={formState.isSubmitting} size="lg" />
        <Text variant="tiny" tone="faint" style={{ textAlign: "center", marginTop: spacing.sm }}>
          Endereços e pets podem ser adicionados na ficha do cliente.
        </Text>
      </Screen>
    </>
  );
}
