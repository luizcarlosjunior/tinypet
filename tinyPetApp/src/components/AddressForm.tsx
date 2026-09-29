import React, { useState } from "react";
import { View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addressSchema, type AddressInput } from "@tinypet/shared";
import { lookupCep } from "@/hooks/use-ref";
import { maskCep } from "@/lib/format";
import { spacing } from "@/lib/theme";
import type { Address } from "@/lib/types";
import { Button, Checkbox, Input, Text } from "@/components/ui";

/** Address form with ViaCEP lookup via GET /ref/cep; reused by tutor account and partner CRM. */
export function AddressForm({ initial, onSubmit, submitLabel = "Salvar" }: { initial?: Partial<Address>; onSubmit: (v: AddressInput) => Promise<void>; submitLabel?: string }) {
  const [looking, setLooking] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const { control, handleSubmit, formState, setValue, getValues } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: initial?.label ?? "",
      zipCode: initial?.zipCode ?? "",
      street: initial?.street ?? "",
      number: initial?.number ?? "",
      complement: initial?.complement ?? "",
      reference: initial?.reference ?? "",
      accessNotes: initial?.accessNotes ?? "",
      district: initial?.district ?? "",
      city: initial?.city ?? "",
      state: initial?.state ?? "",
      isPrimary: initial?.isPrimary ?? false,
    },
  });

  const lookup = async () => {
    const cep = getValues("zipCode").replace(/\D/g, "");
    if (cep.length !== 8) return;
    setLooking(true);
    setCepError(null);
    try {
      const r = await lookupCep(cep);
      if (r.street) setValue("street", r.street);
      if (r.district) setValue("district", r.district);
      if (r.city) setValue("city", r.city);
      if (r.state) setValue("state", r.state);
    } catch {
      setCepError("CEP não encontrado");
    } finally {
      setLooking(false);
    }
  };

  return (
    <View>
      <Controller control={control} name="label" render={({ field }) => <Input label="Apelido" placeholder="Casa, trabalho…" value={field.value ?? ""} onChangeText={field.onChange} />} />
      <Controller
        control={control}
        name="zipCode"
        render={({ field, fieldState }) => (
          <Input label="CEP" keyboardType="number-pad" value={field.value} onChangeText={(v) => field.onChange(maskCep(v))} onBlur={() => { field.onBlur(); lookup(); }} error={fieldState.error?.message ?? cepError ?? undefined} right={<Button title={looking ? "…" : "Buscar"} size="sm" variant="ghost" onPress={lookup} loading={looking} />} />
        )}
      />
      <Controller control={control} name="street" render={({ field, fieldState }) => <Input label="Rua" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="number" render={({ field }) => <Input label="Número" value={field.value ?? ""} onChangeText={field.onChange} />} />
        </View>
        <View style={{ flex: 2 }}>
          <Controller control={control} name="complement" render={({ field }) => <Input label="Complemento" value={field.value ?? ""} onChangeText={field.onChange} />} />
        </View>
      </View>
      <Controller control={control} name="district" render={({ field }) => <Input label="Bairro" value={field.value ?? ""} onChangeText={field.onChange} />} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 3 }}>
          <Controller control={control} name="city" render={({ field, fieldState }) => <Input label="Cidade" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
        </View>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="state" render={({ field, fieldState }) => <Input label="UF" autoCapitalize="characters" maxLength={2} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
        </View>
      </View>
      <Controller control={control} name="reference" render={({ field }) => <Input label="Ponto de referência" value={field.value ?? ""} onChangeText={field.onChange} />} />
      <Controller control={control} name="accessNotes" render={({ field }) => <Input label="Instruções de acesso" placeholder="Portaria, interfone…" value={field.value ?? ""} onChangeText={field.onChange} />} />
      <Controller control={control} name="isPrimary" render={({ field }) => <Checkbox checked={!!field.value} onChange={field.onChange} label="Endereço principal" />} />
      <Text variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
        O endereço é geocodificado para rotas e busca por proximidade.
      </Text>
      <Button title={submitLabel} onPress={handleSubmit(onSubmit)} loading={formState.isSubmitting} />
    </View>
  );
}
