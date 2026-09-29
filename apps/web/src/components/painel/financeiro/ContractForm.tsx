"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { contractSchema, formatBRL, LOCATION_TYPE_LABEL, LocationTypeEnum, type ContractInput } from "@tinypet/shared";
import { api, apiList } from "@/lib/api-client";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { Checkbox, FieldGroup, Table, td, th } from "@/components/painel/ui";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { splitInstallmentsPreview as splitInstallments } from "@/lib/installments";
import { ClientSearch, clientPets } from "@/components/forms/ClientSearch";
import { useCreateContract } from "@/hooks/use-finance";
import { errorMessage } from "@/lib/errors";
import { fmtAddress, fmtDate, localToISO, num, todayISO } from "@/lib/format";
import type { CatalogItem, Client, TeamMember } from "@/types/api";
import { CONTRACT_TYPE_LABEL, PERIODICITY_LABEL } from "./common";

type Gen = { startsAt: string; durationMinutes: number; recurrence: "WEEKLY" | "BIWEEKLY" | "MONTHLY"; locationType: ContractInput["generateAppointments"] extends infer G ? (G extends { locationType: infer L } ? L : never) : never; addressId: string; membershipId: string; itemId: string };


export function ContractForm({ partnerId, initialClientId }: { partnerId: string | null; initialClientId?: string | null }) {
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [genEnabled, setGenEnabled] = useState(false);
  const [gen, setGen] = useState<Gen>({ startsAt: "", durationMinutes: 60, recurrence: "WEEKLY", locationType: "PARTNER_VENUE", addressId: "", membershipId: "", itemId: "" });
  const [genError, setGenError] = useState<string | null>(null);

  const form = useForm<ContractInput>({
    resolver: zodResolver(contractSchema),
    defaultValues: { clientId: initialClientId ?? "", petIds: [], type: "SINGLE", title: "", description: "", items: [{ itemId: null, description: "", quantity: 1, unitPrice: 0 }], discount: 0, installmentsCount: 1, firstDueDate: todayISO(), periodicity: "MONTHLY", sessionsCount: null, terms: "" },
  });
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // preload client from ?clientId=
  const preload = useQuery({ queryKey: ["client", initialClientId], queryFn: () => api<Client>(`/clients/${initialClientId}`), enabled: !!initialClientId && !client });
  useEffect(() => {
    if (preload.data && !client) setClient(preload.data);
  }, [preload.data, client]);
  useEffect(() => {
    setValue("clientId", client?.id ?? "", { shouldValidate: !!client });
    setValue("petIds", []);
  }, [client, setValue]);

  const catalog = useQuery({ queryKey: ["catalog", partnerId, "all"], queryFn: () => apiList<CatalogItem[]>("/catalog?pageSize=100"), enabled: !!partnerId });
  const catalogItems = catalog.data?.data ?? [];
  const members = useQuery({ queryKey: ["partner", partnerId, "members"], queryFn: () => api<TeamMember[]>(`/partners/${partnerId}/members`), enabled: !!partnerId && genEnabled });

  const values = watch();
  const pets = clientPets(client);
  const subtotal = (values.items ?? []).reduce((a, it) => a + num(it.quantity) * num(it.unitPrice), 0);
  const total = Math.max(0, subtotal - num(values.discount));
  const preview = useMemo(() => splitInstallments(total, num(values.installmentsCount), values.firstDueDate, values.periodicity), [total, values.installmentsCount, values.firstDueDate, values.periodicity]);
  const addresses = client?.addresses ?? [];

  const create = useCreateContract((c) => router.push(`/painel/financeiro/contratos/${c.id}`));

  function pickCatalog(index: number, itemId: string) {
    const it = catalogItems.find((c) => c.id === itemId);
    setValue(`items.${index}.itemId`, itemId || null);
    if (it) {
      setValue(`items.${index}.description`, it.name, { shouldValidate: true });
      setValue(`items.${index}.unitPrice`, num(it.promoPrice ?? it.price), { shouldValidate: true });
      if (!values.title) setValue("title", it.name);
    }
  }

  function onSubmit(v: ContractInput) {
    setGenError(null);
    let generateAppointments: ContractInput["generateAppointments"] | undefined;
    // the API only generates lessons for PACKAGE contracts with a number of sessions
    if (genEnabled && v.type === "PACKAGE") {
      if (!v.sessionsCount) {
        setGenError("Informe o número de sessões do pacote para gerar as aulas na agenda.");
        return;
      }
      const parsed = contractSchema.shape.generateAppointments.safeParse({
        startsAt: gen.startsAt ? localToISO(gen.startsAt) : "",
        durationMinutes: gen.durationMinutes,
        recurrence: gen.recurrence,
        locationType: gen.locationType,
        addressId: gen.locationType === "CLIENT_HOME" && gen.addressId ? gen.addressId : null,
        membershipId: gen.membershipId || null,
        itemId: gen.itemId || null,
      });
      if (!parsed.success) {
        setGenError("Preencha data/hora e duração para gerar as aulas na agenda.");
        return;
      }
      generateAppointments = parsed.data;
    }
    create.mutate({ ...v, description: v.description || null, terms: v.terms || null, sessionsCount: v.type === "PACKAGE" ? v.sessionsCount || null : null, generateAppointments });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" noValidate>
      <div className="space-y-4">
        <FieldGroup title="Cliente e pets">
          <ClientSearch value={client} onChange={setClient} error={errors.clientId?.message} />
          {client && (
            <div className="mt-3">
              <span className="label">Pets incluídos</span>
              {pets.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Este cliente ainda não tem pets cadastrados.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {pets.map((p) => (
                    <Checkbox key={p.id} label={p.name} value={p.id} {...register("petIds")} />
                  ))}
                </div>
              )}
            </div>
          )}
        </FieldGroup>

        <FieldGroup title="Contrato">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select id="c-type" label="Tipo" {...register("type")} error={errors.type?.message}>
              {Object.entries(CONTRACT_TYPE_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <Input id="c-title" label="Título" placeholder="Ex.: Pacote 10 aulas de obediência" {...register("title")} error={errors.title?.message} />
            </div>
          </div>
          <div className="mt-3">
            <Textarea id="c-desc" label="Descrição" className="min-h-[60px]" {...register("description")} />
          </div>
          {values.type === "PACKAGE" && (
            <div className="mt-3 max-w-xs">
              <Input id="c-sessions" label="Número de sessões" type="number" min={1} max={200} {...register("sessionsCount", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} error={errors.sessionsCount?.message} />
            </div>
          )}
        </FieldGroup>

        <FieldGroup title="Itens" description="Escolha do catálogo ou descreva livremente.">
          <div className="space-y-3">
            {fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px_120px_40px] sm:items-end">
                <Select id={`c-item-${i}`} label="Do catálogo" value={values.items?.[i]?.itemId ?? ""} onChange={(e) => pickCatalog(i, e.target.value)}>
                  <option value="">Texto livre</option>
                  {catalogItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {formatBRL(c.promoPrice ?? c.price)}
                    </option>
                  ))}
                </Select>
                <Input id={`c-item-desc-${i}`} label="Descrição" {...register(`items.${i}.description`)} error={errors.items?.[i]?.description?.message} />
                <Input id={`c-item-qty-${i}`} label="Qtd." type="number" min={1} {...register(`items.${i}.quantity`)} error={errors.items?.[i]?.quantity?.message} />
                <Input id={`c-item-price-${i}`} label="Valor unit. (R$)" type="number" step="0.01" min={0} inputMode="decimal" {...register(`items.${i}.unitPrice`)} error={errors.items?.[i]?.unitPrice?.message} />
                <button type="button" className="btn-ghost h-9 w-9 p-0 text-red-600" aria-label="Remover item" disabled={fields.length === 1} onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {errors.items?.root?.message && <p className="text-xs text-red-600">{errors.items.root.message}</p>}
            <Button type="button" variant="secondary" onClick={() => append({ itemId: null, description: "", quantity: 1, unitPrice: 0 })}>
              <Plus className="h-4 w-4" aria-hidden /> Adicionar item
            </Button>
          </div>
        </FieldGroup>

        <FieldGroup title="Pagamento">
          <div className="grid gap-3 sm:grid-cols-4">
            <Input id="c-discount" label="Desconto (R$)" type="number" step="0.01" min={0} inputMode="decimal" {...register("discount")} error={errors.discount?.message} />
            <Input id="c-count" label="Parcelas" type="number" min={1} max={60} {...register("installmentsCount")} error={errors.installmentsCount?.message} />
            <Input id="c-first" label="1º vencimento" type="date" {...register("firstDueDate")} error={errors.firstDueDate?.message} />
            <Select id="c-period" label="Periodicidade" {...register("periodicity")} error={errors.periodicity?.message}>
              {Object.entries(PERIODICITY_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
        </FieldGroup>

{values.type === "PACKAGE" && (
        <FieldGroup title="Gerar aulas na agenda" description="Cria automaticamente os agendamentos do pacote a partir da primeira data.">
          <Checkbox label="Gerar agendamentos para este contrato" checked={genEnabled} onChange={(e) => setGenEnabled(e.target.checked)} />
          {genEnabled && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input id="g-start" label="Primeira aula (data e hora)" type="datetime-local" value={gen.startsAt} onChange={(e) => setGen((g) => ({ ...g, startsAt: e.target.value }))} required />
              <Input id="g-dur" label="Duração (min)" type="number" min={5} value={gen.durationMinutes} onChange={(e) => setGen((g) => ({ ...g, durationMinutes: parseInt(e.target.value || "0", 10) }))} />
              <Select id="g-rec" label="Recorrência" value={gen.recurrence} onChange={(e) => setGen((g) => ({ ...g, recurrence: e.target.value as Gen["recurrence"] }))}>
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="MONTHLY">Mensal</option>
              </Select>
              <Select id="g-loc" label="Local" value={gen.locationType} onChange={(e) => setGen((g) => ({ ...g, locationType: e.target.value as Gen["locationType"] }))}>
                {LocationTypeEnum.options.map((l) => (
                  <option key={l} value={l}>
                    {LOCATION_TYPE_LABEL[l]}
                  </option>
                ))}
              </Select>
              {gen.locationType === "CLIENT_HOME" && (
                <Select id="g-addr" label="Endereço do cliente" value={gen.addressId} onChange={(e) => setGen((g) => ({ ...g, addressId: e.target.value }))}>
                  <option value="">{addresses.length ? "Escolha…" : "Cliente sem endereço cadastrado"}</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label ? `${a.label} · ` : ""}
                      {fmtAddress(a)}
                    </option>
                  ))}
                </Select>
              )}
              <Select id="g-member" label="Profissional" value={gen.membershipId} onChange={(e) => setGen((g) => ({ ...g, membershipId: e.target.value }))}>
                <option value="">Qualquer</option>
                {(members.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.user?.name ?? m.id}
                    {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                  </option>
                ))}
              </Select>
              <Select id="g-item" label="Serviço do catálogo" value={gen.itemId} onChange={(e) => setGen((g) => ({ ...g, itemId: e.target.value }))}>
                <option value="">—</option>
                {catalogItems
                  .filter((c) => c.type === "SERVICE")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
              <p className="text-xs text-[var(--muted)] sm:col-span-2">Serão geradas {values.type === "PACKAGE" && values.sessionsCount ? values.sessionsCount : "as"} sessões seguindo a recorrência escolhida; conflitos de agenda serão apontados pelo sistema.</p>
              {genError && <p className="text-xs text-red-600 sm:col-span-2">{genError}</p>}
            </div>
          )}
        </FieldGroup>
        )}

        <FieldGroup title="Termos" description="O tutor aceita pelo app; data, hora e IP ficam registrados.">
          <Textarea id="c-terms" label="Termos do contrato" className="min-h-[120px]" placeholder="Condições de cancelamento, remarcação, política de pagamento…" {...register("terms")} />
        </FieldGroup>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <FieldGroup title="Prévia">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Subtotal</dt>
              <dd className="tabular-nums">{formatBRL(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Desconto</dt>
              <dd className="tabular-nums">− {formatBRL(num(values.discount))}</dd>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatBRL(total)}</dd>
            </div>
          </dl>
          <Table className="mt-3">
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Vencimento</th>
                <th className={`${th} text-right`}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p) => (
                <tr key={p.number}>
                  <td className={td}>{p.number}</td>
                  <td className={td}>{p.dueDate ? fmtDate(p.dueDate) : "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatBRL(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </FieldGroup>
        <PlanLimitNotice error={create.error} />
        {create.error && !isPlan(create.error) && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(create.error)}
          </p>
        )}
        <Button type="submit" className="w-full" loading={create.isPending} disabled={!client}>
          Criar contrato
        </Button>
        {!client && <p className="text-center text-xs text-[var(--muted)]">Escolha um cliente para continuar.</p>}
      </aside>
    </form>
  );
}

import { isPlanLimit } from "@/lib/errors";
function isPlan(e: unknown) {
  return isPlanLimit(e);
}
