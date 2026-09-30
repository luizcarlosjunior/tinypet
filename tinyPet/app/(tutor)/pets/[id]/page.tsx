"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { canEditPet, usePet } from "@/hooks/use-pets";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Empty, Spinner } from "@/components/ui";
import { MemorialBanner, PetFicha } from "@/components/pets/pet-ficha";
import { PetGallery } from "@/components/pets/pet-gallery";
import { PetHistory } from "@/components/pets/pet-history";
import { PetHealth } from "@/components/pets/pet-health";
import { PetSkills } from "@/components/pets/pet-skills";
import { PetRoutine } from "@/components/pets/pet-routine";
import { PetFoods } from "@/components/pets/pet-foods";
import { PetSocial } from "@/components/pets/pet-social";
import { PetSharing } from "@/components/pets/pet-sharing";
import { PetBadges } from "@/components/pets/pet-badges";
import { BirthdayCard } from "@/components/pets/birthday-card";
import { errorMessage } from "@/lib/errors";
import { ageInMonths, formatAge, LIFE_STAGE_LABEL, lifeStageFor } from "@tinypet/shared";
import { cn } from "@/lib/utils";

const TABS = [
  ["ficha", "Ficha"],
  ["galeria", "Galeria"],
  ["historico", "Histórico"],
  ["saude", "Saúde"],
  ["comandos", "Comandos"],
  ["rotina", "Rotina"],
  ["alimentacao", "Alimentação"],
  ["redes", "Redes sociais"],
  ["compartilhamento", "Compartilhamento"],
  ["conquistas", "Conquistas"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function PetPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<Spinner />}>
      <PetDetail id={params.id} />
    </Suspense>
  );
}

function PetDetail({ id }: { id: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const rawTab = sp.get("tab") === "familia" ? "compartilhamento" : sp.get("tab"); // old links
  const tab = (TABS.some((t) => t[0] === rawTab) ? rawTab : "ficha") as Tab;
  const pet = usePet(id);
  if (pet.isLoading) return <Spinner />;
  if (pet.isError || !pet.data) return <Empty title="Pet não encontrado" description={errorMessage(pet.error)} action={<Link href="/pets" className="btn-secondary">Voltar</Link>} />;
  const p = pet.data;
  const deceased = p.status === "DECEASED";
  const months = ageInMonths(p.birthDate, p.approxAgeMonths);
  const stage = lifeStageFor(months, p.species?.key ?? p.speciesKey ?? "dog", p.size);
  // shared accounts are read-only (they can only mark routine tasks as done)
  const readOnly = !canEditPet(p);

  return (
    <div className="space-y-5">
      <Link href="/pets" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Meus pets
      </Link>
      <header className="flex flex-wrap items-center gap-4">
        <Avatar src={p.avatarUrl} name={p.name} size={80} className={deceased ? "grayscale" : ""} />
        {/* min width so the birthday button wraps below on phones instead of squeezing the name column */}
        <div className="min-w-[11rem] flex-1">
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="text-sm text-[var(--muted)]">{[p.species?.label, p.breed?.name ?? p.breedOther, formatAge(months)].filter(Boolean).join(" · ")}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {stage && <Badge tone="brand">{LIFE_STAGE_LABEL[stage]}</Badge>}
            {p.level > 1 && <Badge tone="amber">Nível {p.level}</Badge>}
            {p.streakDays > 0 && !deceased && <Badge tone="green">{p.streakDays} {p.streakDays === 1 ? "dia" : "dias"} de rotina</Badge>}
            {deceased && <Badge tone="gray">Em memória</Badge>}
            {readOnly && <Badge tone="blue">Compartilhado por {p.owner?.username ? `@${p.owner.username}` : p.owner?.name ?? "outro tutor"} · somente leitura</Badge>}
          </div>
        </div>
        {!deceased && <BirthdayCard pet={p} />}
      </header>
      <MemorialBanner pet={p} />
      <nav className="-mx-4 overflow-x-auto px-4" aria-label="Seções do pet">
        <ul className="flex gap-1 border-b" role="tablist">
          {TABS.map(([key, label]) => (
            <li key={key} role="presentation">
              <button type="button" role="tab" aria-selected={tab === key} onClick={() => router.replace(`/pets/${id}?tab=${key}`, { scroll: false })} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", tab === key ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]")}>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section role="tabpanel" aria-label={TABS.find((t) => t[0] === tab)?.[1]}>
        {tab === "ficha" && <PetFicha pet={p} />}
        {tab === "galeria" && <PetGallery petId={p.id} deceased={deceased} readOnly={readOnly} />}
        {tab === "historico" && <PetHistory petId={p.id} deceased={deceased} readOnly={readOnly} />}
        {tab === "saude" && <PetHealth pet={p} readOnly={readOnly} />}
        {tab === "comandos" && <PetSkills petId={p.id} deceased={deceased} readOnly={readOnly} />}
        {tab === "rotina" && <PetRoutine petId={p.id} deceased={deceased} readOnly={readOnly} />}
        {tab === "alimentacao" && <PetFoods petId={p.id} deceased={deceased} readOnly={readOnly} />}
        {tab === "redes" && <PetSocial petId={p.id} canEdit={!readOnly} />}
        {tab === "compartilhamento" && <PetSharing petId={p.id} petName={p.name} deceased={deceased} />}
        {tab === "conquistas" && <PetBadges petId={p.id} />}
      </section>
    </div>
  );
}
