"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { updatePartnerSchema, isValidCNPJ, isValidCPF, onlyDigits, withHttps } from "@tinypet/shared";
import { api } from "@/lib/api-client";
import { Button, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { FieldGroup } from "@/components/painel/ui";
import { usePartnerTypes, lookupCnpj } from "@/hooks/use-ref";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { Partner } from "@/types/api";

const schema = updatePartnerSchema
  .pick({ tradeName: true, typeKeys: true, description: true, documentType: true, document: true, legalName: true, website: true, serviceRadiusKm: true, cancellationHours: true, bufferMinutes: true, travelSlackMinutes: true })
  .superRefine((v, ctx) => {
    if (v.documentType === "CNPJ" && v.document && !isValidCNPJ(v.document)) ctx.addIssue({ code: "custom", path: ["document"], message: "CNPJ inválido" });
    if (v.documentType === "CPF" && v.document && !isValidCPF(v.document)) ctx.addIssue({ code: "custom", path: ["document"], message: "CPF inválido" });
  });
type Form = z.infer<typeof schema>;

export function partnerTypeKeys(p: Partner | null): string[] {
  return (p?.types ?? []).map((t) => ("type" in t ? t.type.key : t.key));
}

export function PartnerDataForm({ partner, onSaved, canEdit }: { partner: Partner; onSaved: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const types = usePartnerTypes();
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      tradeName: partner.tradeName,
      typeKeys: partnerTypeKeys(partner),
      description: partner.description ?? "",
      documentType: partner.documentType ?? null,
      document: partner.document ?? "",
      legalName: partner.legalName ?? "",
      website: partner.website ?? "",
      serviceRadiusKm: partner.serviceRadiusKm ?? null,
      cancellationHours: partner.cancellationHours ?? 24,
      bufferMinutes: partner.bufferMinutes ?? 0,
      travelSlackMinutes: partner.travelSlackMinutes ?? 10,
    },
  });
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isDirty } } = form;
  useEffect(() => {
    reset({
      tradeName: partner.tradeName,
      typeKeys: partnerTypeKeys(partner),
      description: partner.description ?? "",
      documentType: partner.documentType ?? null,
      document: partner.document ?? "",
      legalName: partner.legalName ?? "",
      website: partner.website ?? "",
      serviceRadiusKm: partner.serviceRadiusKm ?? null,
      cancellationHours: partner.cancellationHours ?? 24,
      bufferMinutes: partner.bufferMinutes ?? 0,
      travelSlackMinutes: partner.travelSlackMinutes ?? 10,
    });
  }, [partner, reset]);
  const typeKeys = watch("typeKeys") ?? [];
  const documentType = watch("documentType");
  const document = watch("document");

  const save = useMutation({
    mutationFn: (v: Form) =>
      api(`/partners/${partner.id}`, {
        method: "PATCH",
        json: {
          ...v,
          description: v.description || null,
          document: v.document ? onlyDigits(v.document) : null,
          documentType: v.documentType || null,
          legalName: v.legalName || null,
          website: v.website || null,
          serviceRadiusKm: v.serviceRadiusKm === null || (v.serviceRadiusKm as unknown) === "" ? null : v.serviceRadiusKm,
        },
      }),
    onSuccess: () => {
      toast("Dados salvos", "success");
      onSaved();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  async function onCnpjLookup() {
    if (!document || !isValidCNPJ(document)) return;
    setCnpjLoading(true);
    const r = await lookupCnpj(document);
    setCnpjLoading(false);
    if (r) setValue("legalName", r.legalName, { shouldDirty: true });
    else toast("CNPJ não encontrado", "info");
  }

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
      <FieldGroup title="Dados do negócio" description="Como seu negócio aparece na página pública.">
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="p-tradeName" label="Nome fantasia" {...register("tradeName")} error={errors.tradeName?.message} />
            <Input id="p-website" label="Site" placeholder="https://" {...register("website", { setValueAs: (v: string) => withHttps(v) })} error={errors.website?.message} />
          </div>
          <div>
            <span className="label">Tipos de negócio</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos de parceiro">
              {(types.data ?? []).map((t) => {
                const on = typeKeys.includes(t.key);
                return (
                  <button key={t.key} type="button" aria-pressed={on} onClick={() => setValue("typeKeys", on ? typeKeys.filter((k) => k !== t.key) : [...typeKeys, t.key], { shouldDirty: true, shouldValidate: true })} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            {errors.typeKeys && <p className="mt-1 text-xs text-red-600">{errors.typeKeys.message as string}</p>}
          </div>
          <Textarea id="p-description" label="Descrição" maxLength={2000} {...register("description")} error={errors.description?.message} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="p-docType" className="label">
                Documento
              </label>
              <select id="p-docType" className="input" {...register("documentType", { setValueAs: (v) => (v === "" ? null : v) })}>
                <option value="">Nenhum</option>
                <option value="CNPJ">CNPJ</option>
                <option value="CPF">CPF</option>
              </select>
            </div>
            {documentType && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input id="p-document" label={documentType} inputMode="numeric" {...register("document")} error={errors.document?.message} />
                </div>
                {documentType === "CNPJ" && (
                  <Button type="button" variant="secondary" onClick={onCnpjLookup} loading={cnpjLoading} disabled={!document || !isValidCNPJ(document)}>
                    Buscar
                  </Button>
                )}
              </div>
            )}
            {documentType === "CNPJ" && <Input id="p-legalName" label="Razão social" {...register("legalName")} />}
          </div>
        </fieldset>
      </FieldGroup>

      <FieldGroup title="Atendimento e agenda" description="Área de atendimento a domicílio e regras da agenda.">
        <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input id="p-radius" type="number" min={0} max={500} label="Raio de atendimento (km)" placeholder="0 = não atende a domicílio" {...register("serviceRadiusKm", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} error={errors.serviceRadiusKm?.message} />
          <Input id="p-cancel" type="number" min={0} max={720} label="Prazo de cancelamento (horas)" {...register("cancellationHours", { valueAsNumber: true })} error={errors.cancellationHours?.message} />
          <Input id="p-buffer" type="number" min={0} max={240} label="Intervalo entre atendimentos (min)" {...register("bufferMinutes", { valueAsNumber: true })} error={errors.bufferMinutes?.message} />
          <Input id="p-slack" type="number" min={0} max={120} label="Folga no deslocamento (min)" {...register("travelSlackMinutes", { valueAsNumber: true })} error={errors.travelSlackMinutes?.message} />
        </fieldset>
      </FieldGroup>

      {canEdit && (
        <div className="sticky bottom-3 z-10 flex justify-end">
          <Button type="submit" loading={save.isPending} disabled={!isDirty} className="shadow-lg">
            Salvar alterações
          </Button>
        </div>
      )}
    </form>
  );
}
