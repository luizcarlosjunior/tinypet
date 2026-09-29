import Link from "next/link";
import { Flame, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ageInMonths, formatAge } from "@tinypet/shared";
import type { Pet } from "@/hooks/use-pets";
import { fmtDay } from "@/lib/format";

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
          <p className="mt-1 text-xs text-[var(--muted)]">Em memória · {fmtDay(pet.deceasedAt)}</p>
        ) : (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            {pet.streakDays > 0 && (
              <>
                <Flame className="h-3.5 w-3.5 text-brand-500" aria-hidden /> {pet.streakDays} {pet.streakDays === 1 ? "dia" : "dias"} de rotina
              </>
            )}
          </p>
        )}
        {pet.role === "shared" && (
          <p className="mt-1">
            <span className="badge inline-flex items-center gap-1 bg-ink-100 dark:bg-ink-800">
              <Users className="h-3 w-3" aria-hidden /> Compartilhado por {pet.owner?.username ? `@${pet.owner.username}` : pet.owner?.name ?? "outro tutor"}
            </span>
          </p>
        )}
      </div>
    </Link>
  );
}
