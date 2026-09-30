"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { petSchema, type PetInput } from "@tinypet/shared";
import { useSpecies } from "@/hooks/use-ref";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { AvatarUpload } from "@/components/media/avatar-upload";
import type { Pet } from "@/hooks/use-pets";
import { MicrochipField, MicrochipLookupLinks } from "./microchip";

const SEX = [["MALE", "Macho"], ["FEMALE", "Fêmea"]] as const;
const SIZE = [["", "Não informado"], ["SMALL", "Pequeno"], ["MEDIUM", "Médio"], ["LARGE", "Grande"], ["GIANT", "Gigante"]] as const;

function toInput(pet?: Pet | null): Partial<PetInput> {
  // sex starts empty: the user must pick it (required on create)
  if (!pet) return { speciesKey: "dog", neutered: null, sex: "" as PetInput["sex"] };
  return {
    name: pet.name,
    speciesKey: pet.species?.key ?? pet.speciesKey ?? "dog",
    breedId: pet.breedId ?? null,
    breedOther: pet.breedOther ?? null,
    color: pet.color ?? null,
    sex: (pet.sex ?? "") as PetInput["sex"],
    size: pet.size ?? null,
    birthDate: pet.birthDate ? pet.birthDate.slice(0, 10) : null,
    approxAgeMonths: pet.approxAgeMonths ?? null,
    neutered: pet.neutered ?? null,
    microchip: pet.microchip ?? null,
    avatarUrl: pet.avatarUrl ?? null,
    temperament: pet.temperament ?? null,
    specialCare: pet.specialCare ?? null,
    feedingNotes: pet.feedingNotes ?? null,
  };
}

const empty = (v: unknown) => (v === "" ? null : v);

/** `readOnly`: shared accounts see the registration but can't change it (fields disabled, no photo upload / save). */
export function PetForm({ pet, onSubmit, onCancel, loading, submitLabel, readOnly = false }: { pet?: Pet | null; onSubmit: (v: PetInput) => void; onCancel?: () => void; loading?: boolean; submitLabel?: string; readOnly?: boolean }) {
  const species = useSpecies();
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<PetInput>({ resolver: zodResolver(petSchema), defaultValues: toInput(pet) });
  const speciesKey = watch("speciesKey");
  const breedId = watch("breedId");
  const avatarUrl = watch("avatarUrl");
  const [ageMode, setAgeMode] = useState<"date" | "approx">(pet?.approxAgeMonths != null && !pet.birthDate ? "approx" : "date");
  const current = species.data?.find((s) => s.key === speciesKey);
  const breeds = current?.breeds ?? [];
  const otherBreed = breeds.find((b) => b.id === breedId)?.isOther;

  useEffect(() => {
    if (breedId && breeds.length && !breeds.some((b) => b.id === breedId)) setValue("breedId", null);
  }, [speciesKey, breedId, breeds, setValue]);

  // Species/breed options arrive after the form mounts: a native <select> registered before its <option>s exist shows
  // the first option ("Não informada") while the form keeps the saved id. Re-apply the values once the options render.
  const optionsReady = !!species.data?.length;
  useEffect(() => {
    if (!optionsReady) return;
    setValue("speciesKey", getValues("speciesKey"));
    setValue("breedId", getValues("breedId") ?? null);
  }, [optionsReady, breeds.length, getValues, setValue]);

  return (
    <form onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <fieldset disabled={readOnly} className="min-w-0 space-y-4">
      {!readOnly && <AvatarUpload value={avatarUrl} name={watch("name")} purpose="PET_AVATAR" onChange={(url) => setValue("avatarUrl", url, { shouldDirty: true })} label={avatarUrl ? "Trocar foto" : "Adicionar foto"} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id="pet-name" label="Nome" {...register("name")} error={errors.name?.message} />
        <Select id="pet-species" label="Espécie" {...register("speciesKey")} error={errors.speciesKey?.message}>
          {(species.data ?? []).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
          {!species.data?.length && <option value="dog">Cachorro</option>}
        </Select>
        <Select id="pet-breed" label="Raça" {...register("breedId", { setValueAs: empty })}>
          <option value="">Não informada</option>
          {breeds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.isMixed ? "SRD (sem raça definida)" : b.name}
            </option>
          ))}
        </Select>
        {(otherBreed || (!breeds.length && speciesKey)) && <Input id="pet-breed-other" label="Qual raça?" {...register("breedOther", { setValueAs: empty })} />}
        <Input id="pet-color" label="Cor / pelagem" {...register("color", { setValueAs: empty })} />
        <Select id="pet-sex" label="Sexo *" required aria-required="true" error={errors.sex?.message} {...register("sex", { setValueAs: empty })}>
          {/* not `disabled`: with a disabled placeholder the browser pre-selects "Macho" and the required check is bypassed */}
          <option value="">Selecione</option>
          {SEX.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select id="pet-size" label="Porte" {...register("size", { setValueAs: empty })}>
          {SIZE.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <div>
          <div className="mb-1 flex items-center gap-3 text-xs">
            <span className="label mb-0">Idade</span>
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="ageMode" checked={ageMode === "date"} onChange={() => { setAgeMode("date"); setValue("approxAgeMonths", null); }} className="accent-brand-500" /> Data de nascimento
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="ageMode" checked={ageMode === "approx"} onChange={() => { setAgeMode("approx"); setValue("birthDate", null); }} className="accent-brand-500" /> Aproximada
            </label>
          </div>
          {ageMode === "date" ? (
            <Input id="pet-birth" type="date" aria-label="Data de nascimento" {...register("birthDate", { setValueAs: empty })} error={errors.birthDate?.message} />
          ) : (
            <Input id="pet-age" type="number" min={0} placeholder="meses" aria-label="Idade aproximada em meses" {...register("approxAgeMonths", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} error={errors.approxAgeMonths?.message} />
          )}
        </div>
        <Select id="pet-neutered" label="Castrado(a)?" {...register("neutered", { setValueAs: (v) => (v === "" ? null : v === "true" || v === true) })}>
          <option value="">Não sei</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </Select>
        <MicrochipField showLookups={!readOnly} value={watch("microchip")} onChange={(v) => setValue("microchip", v, { shouldValidate: true, shouldDirty: true })} error={errors.microchip?.message} />
      </div>
      <Textarea id="pet-temperament" label="Temperamento" placeholder="Ex.: dócil, tímido com estranhos" {...register("temperament", { setValueAs: empty })} />
      <Textarea id="pet-care" label="Cuidados especiais" placeholder="Alergias, medicamentos, restrições" {...register("specialCare", { setValueAs: empty })} />
      <Textarea id="pet-feeding" label="Observações de alimentação" {...register("feedingNotes", { setValueAs: empty })} />
      </fieldset>
      {/* Outside the disabled fieldset so shared accounts can still copy the number and open the lookups. */}
      {readOnly && pet?.microchip ? <MicrochipLookupLinks chip={pet.microchip} /> : null}
      {!readOnly && <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {submitLabel ?? (pet ? "Salvar" : "Cadastrar pet")}
        </Button>
      </div>}
    </form>
  );
}
