"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, MapPin, Phone, Plus, Star, Trash2, Pencil } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button, Input, Select, Modal, Badge } from "@/components/ui";
import { ConfirmDialog, Checkbox } from "@/components/painel/ui";
import { errorMessage } from "@/lib/errors";
import { fmtAddress, fmtPhone } from "@/lib/format";
import { AddressForm } from "./AddressFields";
import type { AddressRow, EmailRow, PhoneRow } from "@/types/api";
import type { AddressInput } from "@tinypet/shared";

const PHONE_TYPES = [
  { key: "MOBILE", label: "Celular" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "LANDLINE", label: "Fixo" },
];

/**
 * Generic phones/emails/addresses CRUD for `/clients/:id` or `/partners/:id` (uses `${base}/phones` etc).
 * `extra` renders extra actions per row (e.g. "Verificar" for partners).
 */
export function ContactsEditor({ base, phones, emails, addresses, invalidateKey, extraPhone, extraEmail }: { base: string; phones: PhoneRow[]; emails: EmailRow[]; addresses: AddressRow[]; invalidateKey: unknown[]; extraPhone?: (p: PhoneRow) => React.ReactNode; extraEmail?: (e: EmailRow) => React.ReactNode }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [phoneModal, setPhoneModal] = useState<{ open: boolean; row?: PhoneRow }>({ open: false });
  const [emailModal, setEmailModal] = useState<{ open: boolean; row?: EmailRow }>({ open: false });
  const [addrModal, setAddrModal] = useState<{ open: boolean; row?: AddressRow }>({ open: false });
  const [del, setDel] = useState<{ kind: "phones" | "emails" | "addresses"; id: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: invalidateKey });
  const save = useMutation({
    mutationFn: ({ kind, id, body }: { kind: string; id?: string; body: unknown }) => api(id ? `${base}/${kind}/${id}` : `${base}/${kind}`, { method: id ? "PATCH" : "POST", json: body }),
    onSuccess: () => {
      invalidate();
      toast("Salvo", "success");
      setPhoneModal({ open: false });
      setEmailModal({ open: false });
      setAddrModal({ open: false });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const remove = useMutation({
    mutationFn: ({ kind, id }: { kind: string; id: string }) => api(`${base}/${kind}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast("Removido", "success");
      setDel(null);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="card">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Phone className="h-4 w-4" aria-hidden /> Telefones
          </h3>
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setPhoneModal({ open: true })}>
            <Plus className="h-4 w-4" aria-hidden /> Adicionar
          </Button>
        </header>
        <ul className="divide-y text-sm">
          {phones.length === 0 && <li className="py-2 text-[var(--muted)]">Nenhum telefone.</li>}
          {phones.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block">{fmtPhone(p.number)}</span>
                <span className="text-xs text-[var(--muted)]">{PHONE_TYPES.find((t) => t.key === p.type)?.label}</span>
              </span>
              {p.isPrimary && (
                <Badge tone="brand">
                  <Star className="mr-1 h-3 w-3" aria-hidden /> Principal
                </Badge>
              )}
              {extraPhone?.(p)}
              <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label="Editar telefone" onClick={() => setPhoneModal({ open: true, row: p })}>
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label="Remover telefone" onClick={() => setDel({ kind: "phones", id: p.id })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4" aria-hidden /> E-mails
          </h3>
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEmailModal({ open: true })}>
            <Plus className="h-4 w-4" aria-hidden /> Adicionar
          </Button>
        </header>
        <ul className="divide-y text-sm">
          {emails.length === 0 && <li className="py-2 text-[var(--muted)]">Nenhum e-mail.</li>}
          {emails.map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate">{e.address}</span>
              {e.isPrimary && <Badge tone="brand">Principal</Badge>}
              {extraEmail?.(e)}
              <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label="Editar e-mail" onClick={() => setEmailModal({ open: true, row: e })}>
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label="Remover e-mail" onClick={() => setDel({ kind: "emails", id: e.id })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4" aria-hidden /> Endereços
          </h3>
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setAddrModal({ open: true })}>
            <Plus className="h-4 w-4" aria-hidden /> Adicionar
          </Button>
        </header>
        <ul className="divide-y text-sm">
          {addresses.length === 0 && <li className="py-2 text-[var(--muted)]">Nenhum endereço.</li>}
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start gap-2 py-2">
              <span className="min-w-0 flex-1">
                {a.label && <span className="block text-xs font-medium text-[var(--muted)]">{a.label}</span>}
                <span className="block">{fmtAddress(a)}</span>
                <span className="text-xs text-[var(--muted)]">CEP {a.zipCode}</span>
              </span>
              {a.isPrimary && <Badge tone="brand">Principal</Badge>}
              <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label="Editar endereço" onClick={() => setAddrModal({ open: true, row: a })}>
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label="Remover endereço" onClick={() => setDel({ kind: "addresses", id: a.id })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Modal open={phoneModal.open} onClose={() => setPhoneModal({ open: false })} title={phoneModal.row ? "Editar telefone" : "Novo telefone"}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            save.mutate({ kind: "phones", id: phoneModal.row?.id, body: { type: fd.get("type"), number: fd.get("number"), isPrimary: fd.get("isPrimary") === "on" } });
          }}
        >
          <Select id="ph-type" label="Tipo" name="type" defaultValue={phoneModal.row?.type ?? "MOBILE"}>
            {PHONE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
          <Input id="ph-number" label="Número" name="number" inputMode="tel" placeholder="(11) 99999-9999" defaultValue={phoneModal.row?.number ?? ""} required />
          <Checkbox name="isPrimary" label="Telefone principal" defaultChecked={phoneModal.row?.isPrimary} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPhoneModal({ open: false })}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={emailModal.open} onClose={() => setEmailModal({ open: false })} title={emailModal.row ? "Editar e-mail" : "Novo e-mail"}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            save.mutate({ kind: "emails", id: emailModal.row?.id, body: { address: fd.get("address"), isPrimary: fd.get("isPrimary") === "on" } });
          }}
        >
          <Input id="em-address" label="E-mail" name="address" type="email" defaultValue={emailModal.row?.address ?? ""} required />
          <Checkbox name="isPrimary" label="E-mail principal" defaultChecked={emailModal.row?.isPrimary} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEmailModal({ open: false })}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={addrModal.open} onClose={() => setAddrModal({ open: false })} title={addrModal.row ? "Editar endereço" : "Novo endereço"} className="sm:max-w-2xl">
        {addrModal.open && <AddressForm initial={addrModal.row} submitting={save.isPending} onCancel={() => setAddrModal({ open: false })} onSubmit={(v: AddressInput) => save.mutate({ kind: "addresses", id: addrModal.row?.id, body: v })} />}
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del)} title="Remover contato?" description="Esta ação não pode ser desfeita." confirmLabel="Remover" danger loading={remove.isPending} />
    </div>
  );
}
