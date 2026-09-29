"use client";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientInput } from "@tinypet/shared";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { TagsInput, SOURCES } from "./TagsInput";
import type { Client } from "@/types/api";

export function ClientForm({ initial, onSubmit, submitting, submitLabel = "Salvar" }: { initial?: Client | null; onSubmit: (v: ClientInput) => void; submitting?: boolean; submitLabel?: string }) {
  const clean = (v: ClientInput): ClientInput => ({ ...v, source: v.source || null, birthDate: v.birthDate || null, notes: v.notes || null });
  const form = useForm<ClientInput>({
    resolver: (values, ctx, opts) => zodResolver(clientSchema)(clean(values), ctx, opts),
    defaultValues: { name: initial?.name ?? "", notes: initial?.notes ?? "", tags: initial?.tags ?? [], source: initial?.source ?? "", birthDate: initial?.birthDate?.slice(0, 10) ?? "" },
  });
  const { register, handleSubmit, control, formState: { errors } } = form;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((v) => onSubmit(v))}
    >
      <Input id="cl-name" label="Nome" {...register("name")} error={errors.name?.message} autoFocus={!initial} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="cl-source" label="Origem" {...register("source")}>
          <option value="">—</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Input id="cl-birth" type="date" label="Data de nascimento" {...register("birthDate")} error={errors.birthDate?.message} />
      </div>
      <Controller control={control} name="tags" render={({ field }) => <TagsInput value={field.value ?? []} onChange={field.onChange} />} />
      <Textarea id="cl-notes" label="Notas internas (privadas)" {...register("notes")} />
      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
