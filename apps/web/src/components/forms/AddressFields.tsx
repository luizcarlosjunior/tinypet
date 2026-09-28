"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addressSchema, type AddressInput } from "@tinypet/shared";
import { Button, Input, Textarea } from "@/components/ui";
import { Checkbox } from "@/components/painel/ui";
import { lookupCep } from "@/hooks/use-ref";
import type { AddressRow } from "@/types/api";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

/** Standalone address form with CEP lookup. Used for client, partner and inline appointment addresses. */
export function AddressForm({ initial, onSubmit, onCancel, submitting, showAccessNotes = true, compact }: { initial?: Partial<AddressRow> | null; onSubmit: (v: AddressInput) => void | Promise<void>; onCancel?: () => void; submitting?: boolean; showAccessNotes?: boolean; compact?: boolean }) {
  const form = useForm<AddressInput>({
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
      latitude: initial?.latitude != null ? Number(initial.latitude) : undefined,
      longitude: initial?.longitude != null ? Number(initial.longitude) : undefined,
    },
  });
  const [cepLoading, setCepLoading] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = form;

  async function onCepBlur(v: string) {
    if (v.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    const r = await lookupCep(v);
    setCepLoading(false);
    if (!r) return;
    setValue("zipCode", r.zipCode);
    if (r.street) setValue("street", r.street);
    if (r.district) setValue("district", r.district);
    if (r.city) setValue("city", r.city);
    if (r.state) setValue("state", r.state);
    document.getElementById("addr-number")?.focus();
  }

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v))} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Input id="addr-label" label="Rótulo" placeholder="Casa, Trabalho…" {...register("label")} error={errors.label?.message} />
        <div>
          <Input id="addr-zip" label="CEP" inputMode="numeric" placeholder="00000-000" {...register("zipCode", { onBlur: (e) => onCepBlur(e.target.value) })} error={errors.zipCode?.message} />
          {cepLoading && <p className="mt-1 text-xs text-[var(--muted)]">Buscando CEP…</p>}
        </div>
        <Input id="addr-number" label="Número" {...register("number")} error={errors.number?.message} />
      </div>
      <Input id="addr-street" label="Logradouro" {...register("street")} error={errors.street?.message} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </div>
      {!compact && <Input id="addr-reference" label="Ponto de referência" {...register("reference")} />}
      {showAccessNotes && !compact && <Textarea id="addr-access" label="Instruções de acesso (portaria, interfone)" className="min-h-[60px]" {...register("accessNotes")} />}
      <Checkbox label="Endereço principal" {...register("isPrimary")} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          Salvar endereço
        </Button>
      </div>
    </form>
  );
}
