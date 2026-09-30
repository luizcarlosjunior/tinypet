"use client";
import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { usePetResource, type Pet } from "@/hooks/use-pets";
import { ageInMonths, celebrationAge, safeHref } from "@tinypet/shared";
import { fmtDay } from "@/lib/format";

type ReportCard = { age?: string; ageMonths?: number; badges?: number; masteredSkills?: number; streakDays?: number; visits?: number; photos?: number; nextBirthday?: string; highlights?: string[] };

export function BirthdayCard({ pet }: { pet: Pet }) {
  const [open, setOpen] = useState(false);
  const rc = usePetResource<ReportCard>(pet.id, "report-card", "", { enabled: open });
  const { toast } = useToast();
  const months = ageInMonths(pet.birthDate, pet.approxAgeMonths);
  // under 1 year the card counts months ("mesversário"); from 1 year, whole years
  const age = celebrationAge(months);
  const underOneYear = months != null && months < 12;
  const d = rc.data ?? {};
  const stats = [
    { label: "Conquistas", value: d.badges ?? "—" },
    { label: "Comandos", value: d.masteredSkills ?? "—" },
    { label: "Dias de rotina", value: d.streakDays ?? pet.streakDays },
  ];
  // only mention non-zero numbers ("Já domina 0 comandos" reads badly)
  const facts = [d.masteredSkills ? `já domina ${d.masteredSkills} ${d.masteredSkills === 1 ? "comando" : "comandos"}` : null, d.badges ? `tem ${d.badges} ${d.badges === 1 ? "conquista" : "conquistas"}` : null].filter(Boolean);
  const text = `🎂 ${age ? `${pet.name} ${underOneYear ? "completa" : "faz"} ${age}` : `${pet.name} faz aniversário`}! ${facts.length ? `${facts.join(" e ")} no tinyPet` : "Muito amor e muitas aventuras no tinyPet"}. #tinyPet`;

  // the pet page itself is private: only share a link when the owner enabled the public profile
  const publicUrl = pet.publicProfile && pet.publicSlug && typeof window !== "undefined" ? `${window.location.origin}/pet/${pet.publicSlug}` : null;
  const fullText = publicUrl ? `${text} ${publicUrl}` : text;

  async function share() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `${underOneYear ? "Mesversário" : "Aniversário"} de ${pet.name}`, text, ...(publicUrl ? { url: publicUrl } : {}) });
      } else {
        await navigator.clipboard.writeText(fullText);
        toast("Texto copiado! Cole nas suas redes.", "success");
      }
    } catch {
      /* user canceled */
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" aria-hidden /> Compartilhar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cartão comemorativo">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-400 to-amber-300 p-6 text-white shadow-lg" role="img" aria-label={text}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20" viewBox="0 0 400 300" aria-hidden>
            {Array.from({ length: 18 }).map((_, i) => (
              <circle key={i} cx={(i * 73) % 400} cy={(i * 117) % 300} r={6 + (i % 4) * 3} fill="white" />
            ))}
          </svg>
          <div className="relative flex items-center gap-4">
            {pet.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={safeHref(pet.avatarUrl)} alt="" className="h-20 w-20 rounded-full border-4 border-white/70 object-cover" />
            ) : (
              <span className="inline-flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/70 bg-white/20 text-2xl font-bold">{pet.name[0]}</span>
            )}
            <div>
              <p className="text-xs uppercase tracking-widest opacity-90">{underOneYear ? "Feliz mesversário" : "Feliz aniversário"}</p>
              <p className="text-3xl font-extrabold leading-tight">{pet.name}</p>
              <p className="text-sm opacity-90">{age ?? "idade desconhecida"}{pet.birthDate ? ` · ${fmtDay(pet.birthDate, "d 'de' MMMM")}` : ""}</p>
            </div>
          </div>
          <dl className="relative mt-5 grid grid-cols-3 gap-2 text-center">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/20 p-2">
                <dd className="text-xl font-bold">{s.value}</dd>
                <dt className="text-[11px] opacity-90">{s.label}</dt>
              </div>
            ))}
          </dl>
          <p className="relative mt-4 text-right text-xs font-semibold opacity-90">tinyPet</p>
        </div>
        {publicUrl ? (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Inclui o link do perfil público:{" "}
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="break-all underline">
              {publicUrl}
            </a>
          </p>
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">Ative “Permitir perfil público” na Ficha para incluir um link do perfil de {pet.name}.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(fullText).then(() => toast("Texto copiado!", "success"))}>
            <Copy className="h-4 w-4" aria-hidden /> Copiar texto
          </Button>
          <Button type="button" onClick={share}>
            <Share2 className="h-4 w-4" aria-hidden /> Compartilhar
          </Button>
        </div>
      </Modal>
    </>
  );
}
