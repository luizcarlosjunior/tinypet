import Link from "next/link";
import { Flame } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ageInMonths, formatAge } from "@tinypet/shared";
import type { Pet } from "@/hooks/use-pets";
import { fmtDate } from "@/lib/format";

export function PetCard({ pet }: { pet: Pet }) {
  const deceased = pet.status === "DECEASED";
  const age = formatAge(ageInMonths(pet.birthDate, pet.approxAgeMonths));
  return (
    <Link href={`/pets/${pet.id}`} className={`card flex items-center gap-4 transition hover:shadow-md ${deceased ? "opacity-80 grayscale" : ""}`}>
      <Avatar src={pet.avatarUrl} name={pet.name} size={64} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{pet.name}</p>
        <p className="truncate text-xs text-[var(--muted)]">{[pet.species?.label, pet.breed?.name ?? pet.breedOther, age].filter(Boolean).join(" · ")}</p>
        {deceased ? (
          <p className="mt-1 text-xs text-[var(--muted)]">Em memória · {fmtDate(pet.deceasedAt)}</p>
        ) : (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            {pet.streakDays > 0 && (
              <>
                <Flame className="h-3.5 w-3.5 text-brand-500" aria-hidden /> {pet.streakDays} {pet.streakDays === 1 ? "dia" : "dias"} de rotina
              </>
            )}
            {pet.access && pet.access !== "owner" && <span className="badge bg-ink-100 dark:bg-ink-800">compartilhado</span>}
          </p>
        )}
      </div>
    </Link>
  );
}
