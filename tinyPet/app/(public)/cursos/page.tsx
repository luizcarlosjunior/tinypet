import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { serverApiList } from "@/lib/server-api";
import { RatingStars } from "@/components/ui/rating";
import { Empty } from "@/components/ui";
import { COURSE_LEVEL_LABEL, type PublicCourse } from "@/components/public/types";
import { formatBRL, safeHref } from "@tinypet/shared";

export const metadata: Metadata = { title: "Cursos", description: "Cursos online de adestramento e cuidados com pets, feitos por parceiros tinyPet." };
// Rendered per request (API unreachable during `next build` in Docker); the data fetch is cached 2 min.
export const dynamic = "force-dynamic";

export default async function CursosPage() {
  const res = await serverApiList<PublicCourse[]>("/public/courses?pageSize=50", { revalidate: 120 });
  const courses = res?.data ?? [];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Cursos</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Aprenda com adestradores e veterinários parceiros. Aulas geram tarefas na rotina do seu pet.</p>
      </header>
      {courses.length === 0 ? (
        <Empty title="Nenhum curso publicado ainda" description="Os parceiros estão preparando conteúdos. Volte em breve!" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <li key={c.id} className="card flex flex-col p-0">
              <Link href={`/cursos/${c.id}`} className="block overflow-hidden rounded-t-2xl">
                {c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={safeHref(c.coverUrl)} alt="" className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                    <GraduationCap className="h-10 w-10" aria-hidden />
                  </div>
                )}
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs text-[var(--muted)]">
                  {COURSE_LEVEL_LABEL[c.level]}
                  {c.category ? ` · ${c.category.label}` : ""}
                </p>
                <h2 className="mt-1 font-semibold">
                  <Link href={`/cursos/${c.id}`} className="hover:underline">
                    {c.title}
                  </Link>
                </h2>
                {c.partner && <p className="mt-0.5 text-xs text-[var(--muted)]">por {c.partner.tradeName}</p>}
                <div className="mt-auto flex items-center justify-between pt-3">
                  <RatingStars value={c.ratingAvg} count={c.ratingCount} size={13} />
                  <span className="font-semibold">{c.price == null || Number(c.price) === 0 ? "Grátis" : formatBRL(c.price)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
