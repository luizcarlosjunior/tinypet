"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, HeartCrack, Undo2 } from "lucide-react";
import { ageInMonths, formatAge, lifeStageFor, LIFE_STAGE_LABEL, type PetInput } from "@tinypet/shared";
import { Badge, Button, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { Avatar, ErrorBox, Tabs } from "@/components/painel/ui";
import { useActivePartner } from "@/hooks/use-partner";
import { useApiMutation, usePet } from "@/hooks/use-crm";
import { fmtDate, todayISO } from "@/lib/format";
import { PetForm, SEX_LABEL } from "@/components/painel/clientes/PetForm";
import { HistoryTab } from "@/components/painel/clientes/pet/HistoryTab";
import { MeasurementsTab } from "@/components/painel/clientes/pet/MeasurementsTab";
import { VaccinationsTab } from "@/components/painel/clientes/pet/VaccinationsTab";
import { SkillsTab } from "@/components/painel/clientes/pet/SkillsTab";
import { RoutineTab } from "@/components/painel/clientes/pet/RoutineTab";

type Tab = "ficha" | "historico" | "medidas" | "vacinas" | "comandos" | "rotina";
const TABS: { key: Tab; label: string }[] = [
  { key: "ficha", label: "Ficha" },
  { key: "historico", label: "Histórico" },
  { key: "medidas", label: "Medidas" },
  { key: "vacinas", label: "Vacinas" },
  { key: "comandos", label: "Comandos" },
  { key: "rotina", label: "Rotina" },
];

export default function PetPage() {
  const { id: clientId, petId } = useParams<{ id: string; petId: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (TABS.some((t) => t.key === sp.get("tab")) ? sp.get("tab") : "ficha") as Tab;
  const setTab = (t: Tab) => router.replace(`/painel/clientes/${clientId}/pets/${petId}?tab=${t}`);
  const { partnerId } = useActivePartner();
  const q = usePet(petId);
  const [deceasedOpen, setDeceasedOpen] = useState(false);
  const [deceasedAt, setDeceasedAt] = useState(todayISO());
  const [memorial, setMemorial] = useState("");
  const keys = [["pet", petId], ["client", clientId], ["clients"]];
  const update = useApiMutation<PetInput>({ path: () => `/pets/${petId}`, method: "PATCH", body: (v) => v, invalidate: keys, success: "Ficha salva" });
  const markDeceased = useApiMutation<void>({ path: () => `/pets/${petId}/deceased`, body: () => ({ deceasedAt, memorialNote: memorial || null }), invalidate: keys, success: "Registro atualizado", onSuccess: () => setDeceasedOpen(false) });
  const undoDeceased = useApiMutation<void>({ path: () => `/pets/${petId}/deceased`, method: "DELETE", invalidate: keys, success: "Registro desfeito" });

  if (q.isLoading)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  if (q.error || !q.data) return <ErrorBox error={q.error ?? new Error("Pet não encontrado")} retry={() => q.refetch()} />;
  const pet = q.data;
  const months = ageInMonths(pet.birthDate, pet.approxAgeMonths);
  const stage = lifeStageFor(months, pet.species?.key ?? pet.speciesKey ?? "other", pet.size);
  /** Once a tutor owns the pet, the tutor controls the profile and the deceased status; the partner only complements. */
  const tutorControlled = !!pet.ownerId;

  return (
    <div>
      <Link href={`/painel/clientes/${clientId}?tab=pets`} className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar ao cliente
      </Link>
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <Avatar src={pet.avatarUrl} name={pet.name} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            {pet.name}
            {pet.status === "DECEASED" && <Badge tone="gray">Falecido{pet.deceasedAt ? ` em ${fmtDate(pet.deceasedAt)}` : ""}</Badge>}
            {stage && pet.status !== "DECEASED" && <Badge tone="blue">{LIFE_STAGE_LABEL[stage]}</Badge>}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {[pet.species?.label, pet.breed?.name ?? pet.breedOther, pet.sex ? SEX_LABEL[pet.sex] : null, formatAge(months)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {tutorControlled ? null : pet.status === "DECEASED" ? (
          <Button type="button" variant="secondary" loading={undoDeceased.isPending} onClick={() => undoDeceased.mutate()}>
            <Undo2 className="h-4 w-4" aria-hidden /> Desfazer falecimento
          </Button>
        ) : (
          <Button type="button" variant="ghost" className="text-[var(--muted)]" onClick={() => setDeceasedOpen(true)}>
            <HeartCrack className="h-4 w-4" aria-hidden /> Marcar como falecido
          </Button>
        )}
      </header>
      <Tabs value={tab} onChange={setTab} items={TABS} className="mb-4" />

      {tab === "ficha" && (
        <section className="card">
          {pet.memorialNote && <p className="mb-4 rounded-xl bg-ink-100 p-3 text-sm italic dark:bg-ink-800">{pet.memorialNote}</p>}
          {tutorControlled ? (
            <div className="space-y-3 text-sm">
              <p className="rounded-xl bg-brand-50 p-3 text-brand-800 dark:bg-brand-900/30 dark:text-brand-100">
                A ficha deste pet é gerenciada pelo tutor. Você pode registrar atendimentos, medidas, vacinas, comandos e rotinas nas outras abas.
              </p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Cor/pelagem", pet.color],
                  ["Nascimento", pet.birthDate ? fmtDate(pet.birthDate) : null],
                  ["Castrado", pet.neutered == null ? null : pet.neutered ? "Sim" : "Não"],
                  ["Microchip", pet.microchip],
                  ["Temperamento", pet.temperament],
                  ["Cuidados especiais", pet.specialCare],
                  ["Alimentação", pet.feedingNotes],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-xs text-[var(--muted)]">{label}</dt>
                    <dd>{value || "Não informado"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <PetForm key={pet.id + (pet.avatarUrl ?? "")} initial={pet} partnerId={partnerId} onSubmit={(v) => update.mutate(v)} submitting={update.isPending} />
          )}
        </section>
      )}
      {tab === "historico" && <HistoryTab petId={petId} partnerId={partnerId} />}
      {tab === "medidas" && <MeasurementsTab petId={petId} />}
      {tab === "vacinas" && <VaccinationsTab petId={petId} />}
      {tab === "comandos" && <SkillsTab petId={petId} />}
      {tab === "rotina" && <RoutineTab petId={petId} />}

      <Modal open={deceasedOpen} onClose={() => setDeceasedOpen(false)} title={`Registrar falecimento de ${pet.name}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            markDeceased.mutate();
          }}
        >
          <p className="text-sm text-[var(--muted)]">Agendamentos futuros serão cancelados e as rotinas pausadas. O tutor é avisado.</p>
          <Input id="dc-date" type="date" label="Data" value={deceasedAt} onChange={(e) => setDeceasedAt(e.target.value)} required />
          <Textarea id="dc-note" label="Nota em memória (opcional)" className="min-h-[60px]" value={memorial} onChange={(e) => setMemorial(e.target.value)} maxLength={1000} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeceasedOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={markDeceased.isPending}>
              Confirmar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
