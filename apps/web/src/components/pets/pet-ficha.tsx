"use client";
import { useState } from "react";
import { Flower2 } from "lucide-react";
import { canEditPet, useUpdatePet, type Pet } from "@/hooks/use-pets";
import { PetForm } from "./pet-form";
import { Button } from "@/components/ui";
import { DeceasedDialog } from "./deceased-dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { fmtDate } from "@/lib/format";

export function MemorialBanner({ pet }: { pet: Pet }) {
  if (pet.status !== "DECEASED") return null;
  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border border-ink-300 bg-ink-50 p-4 text-sm dark:border-ink-700 dark:bg-ink-800/60 sm:flex-row sm:items-center">
      <Flower2 className="h-6 w-6 shrink-0 text-ink-500" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">Em memória de {pet.name}</p>
        <p className="text-[var(--muted)]">
          {pet.deceasedAt ? `Partiu em ${fmtDate(pet.deceasedAt)}.` : ""} {pet.memorialNote}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">Ficha, galeria e histórico continuam guardados. Sem novas tarefas ou conquistas.</p>
      </div>
    </div>
  );
}

export function PetFicha({ pet }: { pet: Pet }) {
  const update = useUpdatePet(pet.id);
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  // Only the owner edits the registration or registers a death; shared accounts are read-only.
  const isPrimaryOwner = canEditPet(pet);

  return (
    <div className="space-y-6">
      <section className="card">
        {!isPrimaryOwner && <p className="mb-4 text-sm text-[var(--muted)]">Pet compartilhado com você: somente o tutor dono pode alterar a ficha.</p>}
        <PetForm
          pet={pet}
          readOnly={!isPrimaryOwner}
          loading={update.isPending}
          onSubmit={(v) =>
            update
              .mutateAsync(v)
              .then(() => toast("Ficha atualizada.", "success"))
              .catch((e) => toast(errorMessage(e), "error"))
          }
        />
      </section>
      {isPrimaryOwner && pet.status === "ACTIVE" && (
        <section className="card border-dashed">
          <h3 className="text-sm font-semibold">Registrar falecimento</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">Agendamentos futuros são cancelados, tarefas e lembretes param e o perfil vira um memorial. O registro é definitivo e pede a confirmação da sua senha.</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setConfirm(true)}>
            <Flower2 className="h-4 w-4" aria-hidden /> Registrar falecimento
          </Button>
          <DeceasedDialog petId={pet.id} petName={pet.name} open={confirm} onClose={() => setConfirm(false)} partnerId={null} />
        </section>
      )}
    </div>
  );
}
