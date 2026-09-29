"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addressSchema, type AddressInput } from "@tinypet/shared";
import { Button, Input } from "@/components/ui";
import { lookupCep } from "@/hooks/use-ref";
import { useState } from "react";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function AddressForm({ defaultValues, onSubmit, onCancel, loading, submitLabel = "Salvar endereço" }: { defaultValues?: Partial<AddressInput>; onSubmit: (v: AddressInput) => void; onCancel?: () => void; loading?: boolean; submitLabel?: string }) {
  const { register, handleSubmit, setValue, formState: { errors }, watch } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: { isPrimary: false, ...defaultValues },
  });
  const [cepBusy, setCepBusy] = useState(false);
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  const zip = watch("zipCode");

  async function onCepBlur() {
    const d = (zip ?? "").replace(/\D/g, "");
    if (d.length !== 8) return;
    setCepBusy(true);
    setCepMsg(null);
    const r = await lookupCep(d);
    setCepBusy(false);
    if (!r) return setCepMsg("CEP não encontrado. Preencha o endereço manualmente.");
    setValue("zipCode", r.zipCode);
    if (r.street) setValue("street", r.street, { shouldValidate: true });
    if (r.district) setValue("district", r.district);
    if (r.city) setValue("city", r.city, { shouldValidate: true });
    if (r.state) setValue("state", r.state, { shouldValidate: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
      <Input id="addr-label" label="Nome (Casa, Trabalho…)" {...register("label")} error={errors.label?.message} />
      <div>
        <Input id="addr-zip" label="CEP" inputMode="numeric" placeholder="00000-000" {...register("zipCode")} onBlur={onCepBlur} error={errors.zipCode?.message} />
        <p className="mt-1 text-xs text-[var(--muted)]" aria-live="polite">{cepBusy ? "Buscando CEP…" : cepMsg ?? ""}</p>
      </div>
      <div className="sm:col-span-2">
        <Input id="addr-street" label="Rua / logradouro" {...register("street")} error={errors.street?.message} />
      </div>
      <Input id="addr-number" label="Número" {...register("number")} error={errors.number?.message} />
      <Input id="addr-complement" label="Complemento" {...register("complement")} />
      <Input id="addr-district" label="Bairro" {...register("district")} />
      <Input id="addr-city" label="Cidade" {...register("city")} error={errors.city?.message} />
      <div>
        <label htmlFor="addr-state" className="label">
          UF
        </label>
        <select id="addr-state" className="input" {...register("state")} aria-invalid={!!errors.state}>
          <option value="">—</option>
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        {errors.state && <p className="mt-1 text-xs text-red-600">{errors.state.message}</p>}
      </div>
      <Input id="addr-reference" label="Ponto de referência" {...register("reference")} />
      <div className="sm:col-span-2">
        <Input id="addr-access" label="Instruções de acesso (portaria, interfone…)" {...register("accessNotes")} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" {...register("isPrimary")} className="h-4 w-4 accent-brand-500" /> Endereço principal
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
