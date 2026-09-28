"use client";
import Link from "next/link";
import { GraduationCap, ImageOff, Plus } from "lucide-react";
import { formatBRL } from "@tinypet/shared";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { QueryState, UsageBar } from "@/components/painel/ui";
import { useActivePartner, usePartnerPlan } from "@/hooks/use-partner";
import { useCourses } from "@/hooks/use-courses";
import { COURSE_LEVEL_LABEL, COURSE_STATUS_LABEL, COURSE_STATUS_TONE } from "@/components/painel/cursos/helpers";

export default function CursosPage() {
  const { partnerId } = useActivePartner();
  const plan = usePartnerPlan(partnerId);
  const list = useCourses(partnerId);
  const limits = plan.data?.limits ?? {};
  const usage = plan.data?.usage ?? {};

  return (
    <div>
      <PageHeader
        title="Cursos"
        description="Cursos online para tutores, com aulas, exercícios e certificado."
        actions={
          <Link href="/painel/cursos/novo" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden /> Novo curso
          </Link>
        }
      />
      {plan.data && (
        <div className="card mb-4 grid gap-3 sm:grid-cols-2">
          <UsageBar label="Cursos" used={usage.courses ?? list.data?.length ?? 0} limit={limits.courses?.quantity ?? null} enabled={limits.courses?.enabled ?? true} />
          <div className="text-xs text-[var(--muted)]">
            <p className="mb-1 font-medium text-[var(--fg)]">Aulas por curso</p>
            <p>{limits.lessons_per_course?.quantity == null ? "Ilimitadas" : `Até ${limits.lessons_per_course.quantity} aulas por curso`}</p>
            <p className="mt-1">Cursos pagos: {limits.paid_courses?.enabled === false ? "não disponíveis no seu plano" : "liberados"}</p>
          </div>
        </div>
      )}
      <QueryState isLoading={list.isLoading} error={list.error} retry={() => list.refetch()} isEmpty={(list.data ?? []).length === 0} empty={<Empty title="Nenhum curso ainda" description="Crie um curso com aulas em vídeo e exercícios para a rotina do pet." action={<Link href="/painel/cursos/novo" className="btn-primary">Novo curso</Link>} />}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(list.data ?? []).map((c) => (
            <li key={c.id}>
              <Link href={`/painel/cursos/${c.id}`} className="card flex h-full flex-col overflow-hidden p-0 transition hover:border-brand-300">
                <div className="aspect-video w-full bg-ink-100 dark:bg-ink-900">
                  {c.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[var(--muted)]">
                      <ImageOff className="h-6 w-6" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{c.title}</h3>
                    <Badge tone={COURSE_STATUS_TONE[c.status]}>{COURSE_STATUS_LABEL[c.status]}</Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{COURSE_LEVEL_LABEL[c.level]}</p>
                  <p className="mt-auto flex items-center justify-between text-sm">
                    <span className="font-semibold">{c.price == null || Number(c.price) === 0 ? "Grátis" : formatBRL(c.price)}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                      <GraduationCap className="h-3.5 w-3.5" aria-hidden /> {c._count?.lessons ?? c.lessons?.length ?? 0} aulas · {c._count?.enrollments ?? 0} alunos
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}
