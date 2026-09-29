"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { familyMemberSchema } from "@tinypet/shared";
import type { z } from "zod";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Badge, Button, Input, Modal } from "@/components/ui";
import { Checkbox, ConfirmDialog } from "@/components/painel/ui";
import { useApiMutation, useClientFamily } from "@/hooks/use-crm";
import { fmtPhone } from "@/lib/format";
import type { FamilyMemberRow } from "@/types/api";

type FamilyInput = z.infer<typeof familyMemberSchema>;

export function FamilyEditor({ clientId, initial }: { clientId: string; initial?: FamilyMemberRow[] }) {
  const q = useClientFamily(clientId);
  const rows = q.data ?? initial ?? [];
  const [modal, setModal] = useState<{ open: boolean; row?: FamilyMemberRow }>({ open: false });
  const [del, setDel] = useState<FamilyMemberRow | null>(null);
  const keys = [["client", clientId, "family"], ["client", clientId]];
  const save = useApiMutation<{ id?: string; body: FamilyInput }>({ path: (v) => (v.id ? `/clients/${clientId}/family/${v.id}` : `/clients/${clientId}/family`), method: (v) => (v.id ? "PATCH" : "POST"), body: (v) => v.body, invalidate: keys, success: "Familiar salvo", onSuccess: () => setModal({ open: false }) });
  const remove = useApiMutation<string>({ path: (id) => `/clients/${clientId}/family/${id}`, method: "DELETE", invalidate: keys, success: "Familiar removido", onSuccess: () => setDel(null) });

  return (
    <section className="card">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" aria-hidden /> Familiares
        </h3>
        <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setModal({ open: true })}>
          <Plus className="h-4 w-4" aria-hidden /> Adicionar
        </Button>
      </header>
      <ul className="divide-y text-sm">
        {rows.length === 0 && <li className="py-2 text-[var(--muted)]">Nenhum familiar cadastrado.</li>}
        {rows.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {f.name} {f.relationship && <span className="font-normal text-[var(--muted)]">· {f.relationship}</span>}
              </span>
              <span className="text-xs text-[var(--muted)]">{[f.phone ? fmtPhone(f.phone) : null, f.email].filter(Boolean).join(" · ")}</span>
            </span>
            {f.canAuthorize && <Badge tone="blue">Autoriza</Badge>}
            {f.canPickUp && <Badge tone="amber">Retira</Badge>}
            <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label={`Editar ${f.name}`} onClick={() => setModal({ open: true, row: f })}>
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label={`Remover ${f.name}`} onClick={() => setDel(f)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.row ? "Editar familiar" : "Novo familiar"}>
        {modal.open && <FamilyForm initial={modal.row} submitting={save.isPending} onCancel={() => setModal({ open: false })} onSubmit={(body) => save.mutate({ id: modal.row?.id, body })} />}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} title="Remover familiar?" description={del?.name} confirmLabel="Remover" danger loading={remove.isPending} />
    </section>
  );
}

function FamilyForm({ initial, onSubmit, onCancel, submitting }: { initial?: FamilyMemberRow; onSubmit: (v: FamilyInput) => void; onCancel: () => void; submitting?: boolean }) {
  const clean = (v: FamilyInput): FamilyInput => ({ ...v, relationship: v.relationship || null, phone: v.phone || null, email: v.email || null });
  const { register, handleSubmit, formState: { errors } } = useForm<FamilyInput>({
    resolver: (values, ctx, opts) => zodResolver(familyMemberSchema)(clean(values), ctx, opts),
    defaultValues: { name: initial?.name ?? "", relationship: initial?.relationship ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", canAuthorize: initial?.canAuthorize ?? false, canPickUp: initial?.canPickUp ?? false },
  });
  return (
    <form noValidate className="space-y-3" onSubmit={handleSubmit((v) => onSubmit(v))}>
      <Input id="fm-name" label="Nome" {...register("name")} error={errors.name?.message} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input id="fm-rel" label="Parentesco" placeholder="Cônjuge, filho…" {...register("relationship")} />
        <Input id="fm-phone" label="Telefone" inputMode="tel" {...register("phone")} />
        <Input id="fm-email" label="E-mail" type="email" {...register("email")} error={errors.email?.message} />
      </div>
      <Checkbox label="Pode autorizar atendimentos" {...register("canAuthorize")} />
      <Checkbox label="Pode retirar o pet" {...register("canPickUp")} />
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
