"use client";
import { useState } from "react";
import { Flower2, Undo2 } from "lucide-react";
import { useMarkDeceased, useUndoDeceased, useUpdatePet, type Pet } from "@/hooks/use-pets";
import { PetForm } from "./pet-form";
import { Button, Input, Textarea } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { fmtDate, toDateKey } from "@/lib/format";

export function MemorialBanner({ pet }: { pet: Pet }) {
  const undo = useUndoDeceased(pet.id);
  const { toast } = useToast();
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
      <Button type="button" variant="secondary" loading={undo.isPending} onClick={() => undo.mutateAsync().then(() => toast("Registro desfeito.", "success")).catch((e) => toast(errorMessage(e), "error"))}>
        <Undo2 className="h-4 w-4" aria-hidden /> Desfazer
      </Button>
    </div>
  );
}

export function PetFicha({ pet }: { pet: Pet }) {
  const update = useUpdatePet(pet.id);
  const mark = useMarkDeceased(pet.id);
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [deceasedAt, setDeceasedAt] = useState(toDateKey());
  const [note, setNote] = useState("");
  const canEdit = pet.access !== "family" || pet.accessLevel === "EDIT";

  return (
    <div className="space-y-6">
      <section className="card">
        <PetForm
          pet={pet}
          loading={update.isPending}
          onSubmit={(v) =>
            update
              .mutateAsync(v)
              .then(() => toast("Ficha atualizada.", "success"))
              .catch((e) => toast(errorMessage(e), "error"))
          }
        />
      </section>
      {canEdit && pet.status === "ACTIVE" && (
        <section className="card border-dashed">
          <h3 className="text-sm font-semibold">Registrar falecimento</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">Agendamentos futuros são cancelados, tarefas e lembretes param e o perfil vira um memorial. Você pode desfazer.</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setConfirm(true)}>
            <Flower2 className="h-4 w-4" aria-hidden /> Marcar como falecido
          </Button>
          <ConfirmDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            title={`Registrar que ${pet.name} faleceu?`}
            description="Sentimos muito. Esta ação pode ser desfeita a qualquer momento."
            confirmLabel="Confirmar"
            danger
            loading={mark.isPending}
            onConfirm={() =>
              mark
                .mutateAsync({ deceasedAt, memorialNote: note || null })
                .then(() => {
                  setConfirm(false);
                  toast("Registro feito. Estamos com você.", "info");
                })
                .catch((e) => toast(errorMessage(e), "error"))
            }
          >
            <div className="mt-3 space-y-3">
              <Input id="dec-date" type="date" label="Data" value={deceasedAt} max={toDateKey()} onChange={(e) => setDeceasedAt(e.target.value)} />
              <Textarea id="dec-note" label="Mensagem (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Uma lembrança carinhosa" />
            </div>
          </ConfirmDialog>
        </section>
      )}
    </div>
  );
}
