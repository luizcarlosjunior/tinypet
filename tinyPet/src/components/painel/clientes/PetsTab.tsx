"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Unlink } from "lucide-react";
import { ageInMonths, formatAge, type PetInput } from "@tinypet/shared";
import { Badge, Button, Modal } from "@/components/ui";
import { Avatar, ConfirmDialog } from "@/components/painel/ui";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { useApiMutation } from "@/hooks/use-crm";
import { clientPets } from "@/components/forms/ClientSearch";
import { PetForm } from "./PetForm";
import type { Client, Pet, PetSummary } from "@/types/api";

export function PetsTab({ client, partnerId }: { client: Client; partnerId: string | null }) {
  const [open, setOpen] = useState(false);
  const [unlink, setUnlink] = useState<PetSummary | null>(null);
  const pets = clientPets(client) as Pet[];
  const keys = [["client", client.id], ["clients"]];
  const create = useApiMutation<PetInput>({ path: () => `/clients/${client.id}/pets`, body: (v) => v, invalidate: keys, success: "Pet adicionado", onSuccess: () => setOpen(false) });
  const remove = useApiMutation<string>({ path: (petId) => `/clients/${client.id}/pets/${petId}`, method: "DELETE", invalidate: keys, success: "Pet desvinculado", onSuccess: () => setUnlink(null) });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Adicionar pet
        </Button>
      </div>
      {pets.length === 0 ? (
        <p className="card text-sm text-[var(--muted)]">Nenhum pet cadastrado para este cliente.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((p) => {
            const months = ageInMonths(p.birthDate, p.approxAgeMonths);
            return (
              <li key={p.id} className="card flex items-center gap-3">
                <Link href={`/painel/clientes/${client.id}/pets/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar src={p.avatarUrl} name={p.name} size={48} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">{[p.species?.label, p.breed?.name ?? p.breedOther].filter(Boolean).join(" · ")}</span>
                    <span className="text-xs text-[var(--muted)]">{formatAge(months)}</span>
                  </span>
                </Link>
                {p.status === "DECEASED" && <Badge tone="gray">Falecido</Badge>}
                <button type="button" className="btn-ghost h-8 w-8 p-0 text-[var(--muted)]" aria-label={`Desvincular ${p.name}`} title="Desvincular" onClick={() => setUnlink(p)}>
                  <Unlink className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo pet" className="sm:max-w-2xl">
        <PlanLimitNotice error={create.error} className="mb-3" />
        {open && <PetForm partnerId={partnerId} submitting={create.isPending} onSubmit={(v) => create.mutate(v)} submitLabel="Adicionar pet" />}
      </Modal>
      <ConfirmDialog open={!!unlink} onClose={() => setUnlink(null)} onConfirm={() => unlink && remove.mutate(unlink.id)} title="Desvincular pet?" description={`${unlink?.name} deixará de aparecer na ficha deste cliente.`} confirmLabel="Desvincular" danger loading={remove.isPending} />
    </div>
  );
}
