import React, { useMemo, useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { petSchema, type PetInput } from "@tinypet/shared";
import { useSpecies } from "@/hooks/use-ref";
import { pickAndUpload } from "@/lib/upload";
import { BASE_URL, errorMessage } from "@/lib/api";
import { spacing, useTheme } from "@/lib/theme";
import type { Pet } from "@/lib/types";
import { MicrochipField } from "./Microchip";
import { Avatar, Button, Input, Segmented, Select, Text } from "@/components/ui";
import { speciesKeyOf } from "@/lib/species";

const SEX = [{ key: "MALE", label: "Macho" }, { key: "FEMALE", label: "Fêmea" }] as const;
const SIZE = [{ value: "SMALL", label: "Pequeno" }, { value: "MEDIUM", label: "Médio" }, { value: "LARGE", label: "Grande" }, { value: "GIANT", label: "Gigante" }] as const;

type Props = { initial?: Partial<Pet>; onSubmit: (values: PetInput) => Promise<void>; submitLabel?: string };

/** Pet create/edit form (petSchema) with species/breed pickers and square avatar upload. */
export function PetForm({ initial, onSubmit, submitLabel = "Salvar" }: Props) {
  const t = useTheme();
  const species = useSpecies();
  const [uploading, setUploading] = useState(false);
  const { control, handleSubmit, formState, watch, setValue } = useForm<PetInput>({
    resolver: zodResolver(petSchema),
    defaultValues: {
      name: initial?.name ?? "",
      speciesKey: speciesKeyOf(initial) ?? "dog",
      breedId: initial?.breedId ?? null,
      breedOther: initial?.breedOther ?? null,
      color: initial?.color ?? null,
      sex: (initial?.sex ?? undefined) as PetInput["sex"],
      size: initial?.size ?? null,
      birthDate: initial?.birthDate?.slice(0, 10) ?? null,
      approxAgeMonths: initial?.approxAgeMonths ?? null,
      neutered: initial?.neutered ?? null,
      microchip: initial?.microchip ?? null,
      publicProfile: initial?.publicProfile ?? false,
      avatarUrl: initial?.avatarUrl ?? null,
      temperament: initial?.temperament ?? null,
      specialCare: initial?.specialCare ?? null,
      feedingNotes: initial?.feedingNotes ?? null,
    },
  });
  const speciesKey = watch("speciesKey");
  const avatarUrl = watch("avatarUrl");
  const breedId = watch("breedId");
  const name = watch("name");

  const breeds = useMemo(() => species.data?.find((s) => s.key === speciesKey)?.breeds ?? [], [species.data, speciesKey]);
  const otherBreed = breeds.find((b) => b.isOther);
  const showBreedOther = !!breedId && breedId === otherBreed?.id;

  const pickAvatar = async () => {
    setUploading(true);
    try {
      const up = await pickAndUpload("PET_AVATAR", { avatar: true });
      if (up) setValue("avatarUrl", up.url, { shouldDirty: true });
    } catch (e) {
      Alert.alert("Erro no envio", errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const submit = handleSubmit(async (values) => {
    await onSubmit({ ...values, birthDate: values.birthDate || null, breedId: values.breedId || null });
  });

  return (
    <View>
      <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <Pressable onPress={pickAvatar} accessibilityRole="button" accessibilityLabel="Escolher foto do pet" disabled={uploading}>
          <Avatar uri={avatarUrl} name={name || "Pet"} species={speciesKey} size={96} />
          <View style={{ position: "absolute", right: -2, bottom: -2, backgroundColor: t.primary, borderRadius: 14, width: 28, height: 28, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: t.bg }}>
            <Ionicons name={uploading ? "hourglass" : "camera"} size={14} color="#fff" />
          </View>
        </Pressable>
        <Text variant="small" tone="muted" style={{ marginTop: 6 }}>
          Foto quadrada, até 10 MB
        </Text>
      </View>

      <Controller control={control} name="name" render={({ field, fieldState }) => <Input label="Nome" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
      <Controller
        control={control}
        name="speciesKey"
        render={({ field, fieldState }) => (
          <Select
            label="Espécie"
            value={field.value}
            onChange={(v) => {
              field.onChange(v ?? "dog");
              setValue("breedId", null);
            }}
            options={(species.data ?? []).map((s) => ({ value: s.key, label: s.label }))}
            error={fieldState.error?.message}
            placeholder={species.isLoading ? "Carregando…" : "Selecionar"}
          />
        )}
      />
      {breeds.length ? (
        <Controller control={control} name="breedId" render={({ field }) => <Select label="Raça" value={field.value ?? null} onChange={field.onChange} options={breeds.map((b) => ({ value: b.id, label: b.name }))} searchable allowClear placeholder="Selecionar raça" />} />
      ) : null}
      {showBreedOther || (!breeds.length && speciesKey !== "dog" && speciesKey !== "cat") ? (
        <Controller control={control} name="breedOther" render={({ field }) => <Input label="Qual raça?" value={field.value ?? ""} onChangeText={field.onChange} />} />
      ) : null}
      <Controller control={control} name="color" render={({ field }) => <Input label="Cor / pelagem" value={field.value ?? ""} onChangeText={field.onChange} />} />

      <Text variant="small" tone="muted" style={{ marginBottom: 6, fontWeight: "600" }}>
        Sexo *
      </Text>
      <Controller control={control} name="sex" render={({ field }) => <Segmented items={SEX.map((s) => ({ key: s.key, label: s.label }))} value={(field.value ?? null) as (typeof SEX)[number]["key"] | null} onChange={(k) => field.onChange(k)} />} />
      {formState.errors.sex?.message ? (
        <Text variant="small" style={{ color: t.danger, marginTop: 4 }} accessibilityRole="alert">
          {formState.errors.sex.message}
        </Text>
      ) : null}
      <View style={{ height: spacing.md }} />
      <Controller control={control} name="size" render={({ field }) => <Select label="Porte" value={field.value ?? null} onChange={field.onChange} options={SIZE.map((s) => ({ value: s.value, label: s.label }))} allowClear />} />

      <Controller control={control} name="birthDate" render={({ field, fieldState }) => <Input label="Data de nascimento" placeholder="AAAA-MM-DD" value={field.value ?? ""} onChangeText={field.onChange} error={fieldState.error?.message} keyboardType="numbers-and-punctuation" hint="Se não souber, informe a idade aproximada abaixo" />} />
      <Controller control={control} name="approxAgeMonths" render={({ field, fieldState }) => <Input label="Idade aproximada (meses)" keyboardType="number-pad" value={field.value != null ? String(field.value) : ""} onChangeText={(v) => field.onChange(v ? Number(v) : null)} error={fieldState.error?.message} />} />

      <Text variant="small" tone="muted" style={{ marginBottom: 6, fontWeight: "600" }}>
        Castrado?
      </Text>
      <Controller control={control} name="neutered" render={({ field }) => <Segmented items={[{ key: "yes", label: "Sim" }, { key: "no", label: "Não" }, { key: "na", label: "Não sei" }]} value={field.value === true ? "yes" : field.value === false ? "no" : "na"} onChange={(k) => field.onChange(k === "yes" ? true : k === "no" ? false : null)} />} />
      <View style={{ height: spacing.md }} />
      <Controller control={control} name="microchip" render={({ field, fieldState }) => <MicrochipField value={field.value} onChange={field.onChange} error={fieldState.error?.message} />} />
      <Controller
        control={control}
        name="publicProfile"
        render={({ field }) => (
          <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "600", flex: 1 }}>Permitir perfil público</Text>
              <Switch accessibilityLabel="Permitir perfil público" value={!!field.value} onValueChange={field.onChange} trackColor={{ true: t.primary, false: t.border }} />
            </View>
            <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
              Quem tiver o link vê nome, foto, espécie, raça, idade, fotos “Público” da galeria, conquistas, comandos e redes sociais. Microchip, saúde e seus dados nunca aparecem.
            </Text>
            {field.value && initial?.publicProfile && initial.publicSlug ? (
              <Pressable onPress={() => void Clipboard.setStringAsync(`${BASE_URL}/pet/${initial.publicSlug}`).then(() => Alert.alert("Link copiado", `${BASE_URL}/pet/${initial.publicSlug}`))} accessibilityRole="button" style={{ marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="link-outline" size={16} color={t.primary} />
                <Text variant="small" tone="primary">
                  Copiar link do perfil público
                </Text>
              </Pressable>
            ) : field.value ? (
              <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
                Salve para gerar o link público.
              </Text>
            ) : null}
          </View>
        )}
      />
      <Controller control={control} name="temperament" render={({ field }) => <Input label="Temperamento" multiline value={field.value ?? ""} onChangeText={field.onChange} />} />
      <Controller control={control} name="specialCare" render={({ field }) => <Input label="Cuidados especiais" multiline value={field.value ?? ""} onChangeText={field.onChange} />} />
      <Controller control={control} name="feedingNotes" render={({ field }) => <Input label="Observações de alimentação" multiline value={field.value ?? ""} onChangeText={field.onChange} />} />

      <Button title={submitLabel} onPress={submit} loading={formState.isSubmitting} size="lg" style={{ marginTop: spacing.md }} />
    </View>
  );
}
