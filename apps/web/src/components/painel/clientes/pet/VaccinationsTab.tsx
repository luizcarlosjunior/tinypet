"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vaccinationSchema } from "@tinypet/shared";
import type { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { ConfirmDialog, ErrorBox, Table, td, th } from "@/components/painel/ui";
import { useApiMutation, usePetVaccinations } from "@/hooks/use-crm";
import { fmtDate, todayISO } from "@/lib/format";
import { useActivePartner } from "@/hooks/use-partner";
import type { Vaccination } from "@/types/api";

type VaccinationInput = z.infer<typeof vaccinationSchema>;

export function VaccinationsTab({ petId }: { petId: string }) {
  const q = usePetVaccinations(petId);
  const { partnerId } = useActivePartner();
  const [modal, setModal] = useState<{ open: boolean; row?: Vaccination }>({ open: false });
  const [del, setDel] = useState<Vaccination | null>(null);
  const keys = [["pet", petId, "vaccinations"], ["pet", petId, "history"]];
  const save = useApiMutation<{ id?: string; body: VaccinationInput }>({ path: (v) => (v.id ? `/pets/${petId}/vaccinations/${v.id}` : `/pets/${petId}/vaccinations`), method: (v) => (v.id ? "PATCH" : "POST"), body: (v) => v.body, invalidate: keys, success: "Salvo", onSuccess: () => setModal({ open: false }) });
  const remove = useApiMutation<string>({ path: (id) => `/pets/${petId}/vaccinations/${id}`, method: "DELETE", invalidate: keys, success: "Removido", onSuccess: () => setDel(null) });
  const today = todayISO();
  const items = [...(q.data ?? [])].sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1));
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button type="button" onClick={() => setModal({ open: true })}>
          <Plus className="h-4 w-4" aria-hidden /> Registrar dose
        </Button>
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Tipo</th>
              <th className={th}>Nome</th>
              <th className={th}>Aplicada</th>
              <th className={th}>Próxima</th>
              <th className={`${th} hidden sm:table-cell`}>Obs.</th>
              <th className={th}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className={`${td} text-[var(--muted)]`} colSpan={6}>
                  Nenhuma vacina ou vermífugo registrado.
                </td>
              </tr>
            )}
            {items.map((v) => {
              const late = v.nextDueAt && v.nextDueAt.slice(0, 10) < today;
              return (
                <tr key={v.id}>
                  <td className={td}>{v.kind === "DEWORMING" ? "Vermífugo" : "Vacina"}</td>
                  <td className={`${td} font-medium`}>{v.name}</td>
                  <td className={td}>{fmtDate(v.appliedAt)}</td>
                  <td className={td}>
                    {v.nextDueAt ? (
                      <span className="inline-flex items-center gap-1">
                        {fmtDate(v.nextDueAt)} {late && <Badge tone="red">Atrasada</Badge>}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${td} hidden max-w-[200px] truncate sm:table-cell`}>{v.notes ?? ""}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {/* only rows registered by this partner can be changed (tutor/other partners' rows → 403) */}
                    {v.partnerId === partnerId && (<>
                    <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label={`Editar ${v.name}`} onClick={() => setModal({ open: true, row: v })}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label={`Remover ${v.name}`} onClick={() => setDel(v)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                    </>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.row ? "Editar dose" : "Registrar dose"}>
        {modal.open && <VaccinationForm initial={modal.row} submitting={save.isPending} onCancel={() => setModal({ open: false })} onSubmit={(body) => save.mutate({ id: modal.row?.id, body })} />}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} title="Remover registro?" description={del?.name} confirmLabel="Remover" danger loading={remove.isPending} />
    </div>
  );
}

function VaccinationForm({ initial, onSubmit, onCancel, submitting }: { initial?: Vaccination; onSubmit: (v: VaccinationInput) => void; onCancel: () => void; submitting?: boolean }) {
  const clean = (v: VaccinationInput): VaccinationInput => ({ ...v, nextDueAt: v.nextDueAt || null, notes: v.notes || null });
  const { register, handleSubmit, formState: { errors } } = useForm<VaccinationInput>({
    resolver: (values, ctx, opts) => zodResolver(vaccinationSchema)(clean(values), ctx, opts),
    defaultValues: { kind: initial?.kind ?? "VACCINE", name: initial?.name ?? "", appliedAt: initial?.appliedAt?.slice(0, 10) ?? todayISO(), nextDueAt: initial?.nextDueAt?.slice(0, 10) ?? "", notes: initial?.notes ?? "" },
  });
  return (
    <form noValidate className="space-y-3" onSubmit={handleSubmit((v) => onSubmit(v))}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select id="vc-kind" label="Tipo" {...register("kind")}>
          <option value="VACCINE">Vacina</option>
          <option value="DEWORMING">Vermífugo</option>
        </Select>
        <Input id="vc-name" label="Nome" placeholder="V10, antirrábica…" {...register("name")} error={errors.name?.message} />
        <Input id="vc-applied" type="date" label="Aplicada em" {...register("appliedAt")} error={errors.appliedAt?.message} />
        <Input id="vc-next" type="date" label="Próxima dose" {...register("nextDueAt")} error={errors.nextDueAt?.message} />
      </div>
      <Textarea id="vc-notes" label="Observações" className="min-h-[60px]" {...register("notes")} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
