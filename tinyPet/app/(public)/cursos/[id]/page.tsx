import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, GraduationCap, PlayCircle } from "lucide-react";
import { serverApi, appUrl } from "@/lib/server-api";
import { Avatar } from "@/components/ui/avatar";
import { RatingStars } from "@/components/ui/rating";
import { JsonLd } from "@/components/public/json-ld";
import { EnrollButton } from "@/components/public/enroll-button";
import { COURSE_LEVEL_LABEL, num, type PublicCourse } from "@/components/public/types";
import { formatBRL, SPECIES, safeHref } from "@tinypet/shared";

export const revalidate = 120;
/** No build-time params: each page renders on its first visit and is then served from the ISR cache. */
export async function generateStaticParams() {
  return [];
}

async function getCourse(id: string) {
  return serverApi<PublicCourse>(`/public/courses/${encodeURIComponent(id)}`, { revalidate: 120 });
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await getCourse(params.id);
  if (!c) return { title: "Curso não encontrado" };
  return { title: c.title, description: c.description?.slice(0, 160) ?? `Curso ${c.title} no tinyPet.`, openGraph: { images: c.coverUrl ? [{ url: c.coverUrl }] : undefined } };
}

export default async function CursoPage({ params }: { params: { id: string } }) {
  const c = await getCourse(params.id);
  if (!c) notFound();
  const paid = c.price != null && Number(c.price) > 0;
  const lessons = c.lessons ?? c.modules?.flatMap((m) => (m.lessons ?? []).map((l) => ({ ...l, moduleId: m.id }))) ?? [];
  const modules = c.modules?.length ? c.modules : [{ id: "all", title: "Aulas", lessons }];
  const rating = num(c.ratingAvg);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: c.title,
    description: c.description ?? undefined,
    image: c.coverUrl ?? undefined,
    provider: c.partner ? { "@type": "Organization", name: c.partner.tradeName, url: appUrl(`/p/${c.partner.slug}`) } : undefined,
    offers: { "@type": "Offer", price: paid ? Number(c.price) : 0, priceCurrency: "BRL" },
    aggregateRating: rating && c.ratingCount > 0 ? { "@type": "AggregateRating", ratingValue: rating, reviewCount: c.ratingCount } : undefined,
  };
  return (
    <article className="space-y-6">
      <JsonLd data={jsonLd} />
      <Link href="/cursos" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Todos os cursos
      </Link>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div>
          {c.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={safeHref(c.coverUrl)} alt="" className="aspect-video w-full rounded-2xl object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
              <GraduationCap className="h-12 w-12" aria-hidden />
            </div>
          )}
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {COURSE_LEVEL_LABEL[c.level]}
            {c.category ? ` · ${c.category.label}` : ""}
            {c.speciesKeys?.length ? ` · ${c.speciesKeys.map((k) => SPECIES.find((s) => s.key === k)?.label ?? k).join(", ")}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{c.title}</h1>
          <RatingStars value={c.ratingAvg} count={c.ratingCount} className="mt-2" />
          {c.description && <p className="mt-4 whitespace-pre-line text-sm">{c.description}</p>}

          <section className="mt-8" aria-labelledby="conteudo">
            <h2 id="conteudo" className="text-lg font-bold">
              Conteúdo do curso
            </h2>
            {lessons.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">As aulas aparecerão aqui em breve.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {modules.map((m) => (
                  <div key={m.id}>
                    {modules.length > 1 && <h3 className="mb-1 text-sm font-semibold">{m.title}</h3>}
                    <ol className="divide-y rounded-2xl border">
                      {(m.lessons ?? lessons).map((l, i) => (
                        <li key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                          <PlayCircle className="h-4 w-4 text-[var(--muted)]" aria-hidden />
                          <span className="flex-1">
                            {i + 1}. {l.title}
                          </span>
                          {l.durationMinutes ? (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                              <Clock className="h-3 w-3" aria-hidden /> {l.durationMinutes} min
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <aside className="card h-fit space-y-3">
          <p className="text-2xl font-bold">{paid ? formatBRL(c.price) : "Grátis"}</p>
          <p className="text-xs text-[var(--muted)]">{lessons.length} {lessons.length === 1 ? "aula" : "aulas"}{paid ? " · Ao matricular, um contrato é gerado para aceite." : ""}</p>
          <EnrollButton courseId={c.id} paid={paid} />
          {c.partner && (
            <Link href={`/p/${c.partner.slug}`} className="flex items-center gap-3 rounded-xl border p-3 hover:bg-ink-50 dark:hover:bg-ink-800/50">
              <Avatar src={c.partner.logoUrl} name={c.partner.tradeName} size={36} square />
              <span className="text-sm">
                <span className="block text-xs text-[var(--muted)]">Oferecido por</span>
                <span className="font-semibold">{c.partner.tradeName}</span>
              </span>
            </Link>
          )}
        </aside>
      </div>
    </article>
  );
}
