"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { petSchema, type PetInput } from "@tinypet/shared";
import { Button, Input, Select, Textarea, Modal } from "@/components/ui";
import { Checkbox, Avatar } from "@/components/painel/ui";
import { ImageCropper } from "@/components/media/ImageCropper";
import { useSpecies } from "@/hooks/use-ref";
import { uploadFile } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import type { Pet } from "@/types/api";

export const SEX_LABEL = { MALE: "Macho", FEMALE: "Fêmea" };
export const SIZE_LABEL = { SMALL: "Pequeno", MEDIUM: "Médio", LARGE: "Grande", GIANT: "Gigante" };

export function PetForm({ initial, partnerId, onSubmit, submitting, submitLabel = "Salvar" }: { initial?: Pet | null; partnerId: string | null; onSubmit: (v: PetInput) => void; submitting?: boolean; submitLabel?: string }) {
  const species = useSpecies();
  const { toast } = useToast();
  const [cropOpen, setCropOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const form = useForm<PetInput>({
    resolver: (values, ctx, opts) => zodResolver(petSchema)(clean(values), ctx, opts),
    defaultValues: {
      name: initial?.name ?? "",
      speciesKey: initial?.species?.key ?? initial?.speciesKey ?? "dog",
      breedId: initial?.breedId ?? initial?.breed?.id ?? "",
      breedOther: initial?.breedOther ?? "",
      color: initial?.color ?? "",
      sex: initial?.sex ?? undefined,
      size: initial?.size ?? undefined,
      birthDate: initial?.birthDate?.slice(0, 10) ?? "",
      approxAgeMonths: initial?.approxAgeMonths ?? undefined,
      neutered: initial?.neutered ?? false,
      microchip: initial?.microchip ?? "",
      avatarUrl: initial?.avatarUrl ?? undefined,
      temperament: initial?.temperament ?? "",
      specialCare: initial?.specialCare ?? "",
      feedingNotes: initial?.feedingNotes ?? "",
    },
  });
  const { register, handleSubmit, watch, setValue, formState: { errors } } = form;
  const speciesKey = watch("speciesKey");
  const breedId = watch("breedId");
  const avatarUrl = watch("avatarUrl");
  const name = watch("name");
  const sp = species.data?.find((s) => s.key === speciesKey);
  const breeds = sp?.breeds ?? [];

  async function onCrop(f: File, crop: { x: number; y: number; width: number; height: number }) {
    setUploading(true);
    try {
      const m = await uploadFile(f, "PET_AVATAR", { crop, partnerId });
      setValue("avatarUrl", m.url);
      setCropOpen(false);
      setFile(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setUploading(false);
    }
  }

  function clean(v: PetInput): PetInput {
    return {
    ...v,
    breedId: v.breedId && v.breedId !== "__other" ? v.breedId : null,
    breedOther: v.breedId === "__other" ? v.breedOther || null : null,
    color: v.color || null,
    sex: v.sex || undefined,
    size: v.size || null,
    birthDate: v.birthDate || null,
    approxAgeMonths: v.approxAgeMonths == null || Number.isNaN(v.approxAgeMonths) ? null : v.approxAgeMonths,
    microchip: v.microchip || null,
    temperament: v.temperament || null,
    specialCare: v.specialCare || null,
    feedingNotes: v.feedingNotes || null,
    avatarUrl: v.avatarUrl || null,
    };
  }

  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit((v) => onSubmit(v))}>
      <div className="flex items-center gap-4">
        <Avatar src={avatarUrl} name={name || "Pet"} size={72} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setCropOpen(true)}>
            {avatarUrl ? "Trocar avatar" : "Adicionar avatar"}
          </Button>
          {avatarUrl && (
            <Button type="button" variant="ghost" onClick={() => setValue("avatarUrl", null)}>
              Remover
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="pet-name" label="Nome" {...register("name")} error={errors.name?.message} />
        <Select id="pet-species" label="Espécie" {...register("speciesKey", { onChange: () => setValue("breedId", "") })} error={errors.speciesKey?.message}>
          {(species.data ?? []).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select id="pet-breed" label="Raça" {...register("breedId")}>
          <option value="">—</option>
          {breeds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          <option value="__other">Outra (informar)</option>
        </Select>
        {breedId === "__other" && <Input id="pet-breed-other" label="Qual raça?" {...register("breedOther")} />}
        <Input id="pet-color" label="Cor" {...register("color")} />
        <Select id="pet-sex" label="Sexo *" required aria-required="true" error={errors.sex?.message} {...register("sex")}>
          <option value="" disabled>
            Selecione
          </option>
          {Object.entries(SEX_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Select id="pet-size" label="Porte" {...register("size")}>
          <option value="">—</option>
          <option value="SMALL">Pequeno</option>
          <option value="MEDIUM">Médio</option>
          <option value="LARGE">Grande</option>
          <option value="GIANT">Gigante</option>
        </Select>
        <Input id="pet-birth" type="date" label="Nascimento" {...register("birthDate")} error={errors.birthDate?.message} />
        <Input id="pet-age" type="number" min={0} label="Idade aproximada (meses), se não souber a data" {...register("approxAgeMonths", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })} error={errors.approxAgeMonths?.message} />
        <Input id="pet-chip" label="Microchip" {...register("microchip")} />
        <div className="flex items-end pb-2">
          <Checkbox label="Castrado(a)" {...register("neutered")} />
        </div>
      </div>
      <Textarea id="pet-temp" label="Temperamento" className="min-h-[60px]" {...register("temperament")} />
      <Textarea id="pet-care" label="Cuidados especiais" className="min-h-[60px]" {...register("specialCare")} />
      <Textarea id="pet-feed" label="Alimentação" className="min-h-[60px]" {...register("feedingNotes")} />
      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>

      <Modal open={cropOpen} onClose={() => setCropOpen(false)} title="Avatar do pet">
        <ImageCropper file={file} onFile={setFile} onConfirm={onCrop} onCancel={() => setCropOpen(false)} submitting={uploading} confirmLabel="Enviar" />
      </Modal>
    </form>
  );
}
