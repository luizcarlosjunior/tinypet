"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createPartnerSchema, isValidCNPJ, isValidCPF, onlyDigits } from "@tinypet/shared";
import { api, setActivePartnerId } from "@/lib/api-client";
import { Button, Input, Textarea, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { usePartnerTypes, lookupCnpj } from "@/hooks/use-ref";
import { sessionContextKey } from "@/hooks/use-session-context";
import { errorMessage } from "@/lib/errors";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const schema = createPartnerSchema
  .extend({ legalName: z.string().optional().nullable() })
  .superRefine((v, ctx) => {
    if (v.documentType === "CNPJ" && v.document && !isValidCNPJ(v.document)) ctx.addIssue({ code: "custom", path: ["document"], message: "CNPJ inválido" });
    if (v.documentType === "CPF" && v.document && !isValidCPF(v.document)) ctx.addIssue({ code: "custom", path: ["document"], message: "CPF inválido" });
    if (v.documentType && !v.document) ctx.addIssue({ code: "custom", path: ["document"], message: "Informe o documento" });
  });
type Form = z.infer<typeof schema>;

const STEPS = ["Negócio", "Documento", "Revisão"];

export default function NovoParceiroPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const types = usePartnerTypes();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { tradeName: "", typeKeys: [], description: "", documentType: null, document: "", legalName: "" }, mode: "onTouched" });
  const { register, handleSubmit, watch, setValue, trigger, formState: { errors, isSubmitting } } = form;
  const typeKeys = watch("typeKeys");
  const documentType = watch("documentType");
  const document = watch("document");

  async function next() {
    const ok = await trigger(step === 0 ? ["tradeName", "typeKeys", "description"] : ["documentType", "document"]);
    if (ok) setStep((s) => Math.min(2, s + 1));
  }

  async function onCnpjLookup() {
    if (!document || !isValidCNPJ(document)) return;
    setCnpjLoading(true);
    const r = await lookupCnpj(document);
    setCnpjLoading(false);
    if (r) {
      setValue("legalName", r.legalName);
      if (!watch("tradeName") && r.tradeName) setValue("tradeName", r.tradeName);
      toast("Razão social encontrada", "success");
    } else toast("CNPJ não encontrado na base pública", "info");
  }

  async function onSubmit(v: Form) {
    setError(null);
    try {
      const created = await api<{ id: string; slug: string }>("/partners", { method: "POST", partnerId: null, json: { tradeName: v.tradeName, typeKeys: v.typeKeys, description: v.description || null, documentType: v.documentType ?? null, document: v.document ? onlyDigits(v.document) : null } });
      if (v.legalName) await api(`/partners/${created.id}`, { method: "PATCH", partnerId: created.id, json: { legalName: v.legalName } }).catch(() => null);
      setActivePartnerId(created.id);
      await qc.invalidateQueries({ queryKey: sessionContextKey });
      toast("Parceiro criado! Complete o perfil para publicar.", "success");
      router.replace("/painel/perfil");
    } catch (e) {
      setError(e);
      toast(errorMessage(e), "error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Criar parceiro" description="Cadastre seu negócio para usar agenda, clientes, catálogo e página pública." />
      <ol className="mb-6 flex items-center gap-2 text-sm" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", i < step ? "bg-emerald-500 text-white" : i === step ? "bg-brand-500 text-white" : "bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-ink-200")} aria-current={i === step ? "step" : undefined}>
              {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn(i === step ? "font-medium" : "text-[var(--muted)]")}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-ink-300 dark:bg-ink-700" aria-hidden />}
          </li>
        ))}
      </ol>
      <PlanLimitNotice error={error} className="mb-4" />
      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4" noValidate>
        {step === 0 && (
          <>
            <Input id="tradeName" label="Nome fantasia" placeholder="Ex.: Clínica Amigo Pet" {...register("tradeName")} error={errors.tradeName?.message} />
            <div>
              <span className="label">Tipo de negócio (um ou mais)</span>
              {types.isLoading ? (
                <Spinner />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Tipos de parceiro">
                  {(types.data ?? []).map((t) => {
                    const on = typeKeys.includes(t.key);
                    return (
                      <label key={t.key} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm", on && "border-brand-500 bg-brand-50 dark:bg-brand-900/20")}>
                        <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={on} onChange={() => setValue("typeKeys", on ? typeKeys.filter((k) => k !== t.key) : [...typeKeys, t.key], { shouldValidate: true })} />
                        {t.label}
                      </label>
                    );
                  })}
                </div>
              )}
              {errors.typeKeys && <p className="mt-1 text-xs text-red-600">{errors.typeKeys.message}</p>}
            </div>
            <Textarea id="description" label="Descrição (aparece na página pública)" maxLength={2000} {...register("description")} error={errors.description?.message} />
          </>
        )}
        {step === 1 && (
          <>
            <fieldset>
              <legend className="label">Documento (opcional)</legend>
              <div className="flex flex-wrap gap-3 text-sm">
                {[
                  { v: "", l: "Nenhum" },
                  { v: "CNPJ", l: "CNPJ" },
                  { v: "CPF", l: "CPF" },
                ].map((o) => (
                  <label key={o.v} className="flex items-center gap-2">
                    <input type="radio" name="documentType" className="accent-brand-500" checked={(documentType ?? "") === o.v} onChange={() => { setValue("documentType", (o.v || null) as Form["documentType"]); setValue("document", ""); setValue("legalName", ""); }} />
                    {o.l}
                  </label>
                ))}
              </div>
            </fieldset>
            {documentType && (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Input id="document" label={documentType} inputMode="numeric" placeholder={documentType === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"} {...register("document")} error={errors.document?.message} />
                {documentType === "CNPJ" && (
                  <Button type="button" variant="secondary" onClick={onCnpjLookup} loading={cnpjLoading} disabled={!document || !isValidCNPJ(document)}>
                    Buscar razão social
                  </Button>
                )}
              </div>
            )}
            {documentType === "CNPJ" && <Input id="legalName" label="Razão social" {...register("legalName")} />}
          </>
        )}
        {step === 2 && (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <dt className="text-[var(--muted)]">Nome fantasia</dt>
            <dd className="font-medium">{watch("tradeName")}</dd>
            <dt className="text-[var(--muted)]">Tipos</dt>
            <dd>{typeKeys.map((k) => types.data?.find((t) => t.key === k)?.label ?? k).join(", ")}</dd>
            <dt className="text-[var(--muted)]">Documento</dt>
            <dd>{documentType ? `${documentType} ${document}` : "Nenhum"}</dd>
            {watch("legalName") && (
              <>
                <dt className="text-[var(--muted)]">Razão social</dt>
                <dd>{watch("legalName")}</dd>
              </>
            )}
            <dt className="text-[var(--muted)]">Descrição</dt>
            <dd className="whitespace-pre-wrap">{watch("description") || "—"}</dd>
          </dl>
        )}
        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={next}>
              Continuar
            </Button>
          ) : (
            <Button type="submit" loading={isSubmitting}>
              Criar parceiro
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
