"use client";
import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AtSign, ChevronLeft, FileText, GraduationCap, HeartPulse, History, Images, ListChecks, Trophy, Users, Utensils } from "lucide-react";
import { ScrollTabs } from "@/components/ui/scroll-tabs";
import { canEditPet, usePet } from "@/hooks/use-pets";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Empty, Spinner } from "@/components/ui";
import { MemorialBanner, PetFicha } from "@/components/pets/pet-ficha";
import { BirthdayCard } from "@/components/pets/birthday-card";
import { errorMessage } from "@/lib/errors";
import { ageInMonths, formatAge, LIFE_STAGE_LABEL, lifeStageFor } from "@tinypet/shared";

// Only one tab renders at a time: load the others on demand (Ficha, the default tab, stays in the page bundle).
const tabLoading = () => <div className="flex justify-center py-10"><Spinner /></div>;
const PetGallery = dynamic(() => import("@/components/pets/pet-gallery").then((m) => m.PetGallery), { loading: tabLoading });
const PetHistory = dynamic(() => import("@/components/pets/pet-history").then((m) => m.PetHistory), { loading: tabLoading });
const PetHealth = dynamic(() => import("@/components/pets/pet-health").then((m) => m.PetHealth), { loading: tabLoading });
const PetSkills = dynamic(() => import("@/components/pets/pet-skills").then((m) => m.PetSkills), { loading: tabLoading });
const PetRoutine = dynamic(() => import("@/components/pets/pet-routine").then((m) => m.PetRoutine), { loading: tabLoading });
const PetFoods = dynamic(() => import("@/components/pets/pet-foods").then((m) => m.PetFoods), { loading: tabLoading });
const PetSocial = dynamic(() => import("@/components/pets/pet-social").then((m) => m.PetSocial), { loading: tabLoading });
const PetSharing = dynamic(() => import("@/components/pets/pet-sharing").then((m) => m.PetSharing), { loading: tabLoading });
const PetBadges = dynamic(() => import("@/components/pets/pet-badges").then((m) => m.PetBadges), { loading: tabLoading });

const TABS = [
  { key: "ficha", label: "Ficha", icon: FileText },
  { key: "galeria", label: "Galeria", icon: Images },
  { key: "historico", label: "Histórico", icon: History },
  { key: "saude", label: "Saúde", icon: HeartPulse },
  { key: "comandos", label: "Comandos", icon: GraduationCap },
  { key: "rotina", label: "Rotina", icon: ListChecks },
  { key: "alimentacao", label: "Alimentação", icon: Utensils },
  { key: "redes", label: "Redes sociais", icon: AtSign },
  { key: "compartilhamento", label: "Compartilhamento", icon: Users },
  { key: "conquistas", label: "Conquistas", icon: Trophy },
] as const;
type Tab = (typeof TABS)[number]["key"];

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
  const tab = (TABS.some((t) => t.key === rawTab) ? rawTab : "ficha") as Tab;
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
      <ScrollTabs items={TABS} value={tab} onChange={(key) => router.replace(`/pets/${id}?tab=${key}`, { scroll: false })} label="Seções do pet" />
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
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
