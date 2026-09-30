import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, CalendarCheck, GraduationCap, HeartPulse, ShoppingBag, Star, Stethoscope, Store } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { Footer } from "@/components/layout/footer";
import { SearchBox } from "@/components/public/search-box";
import { PartnerCard } from "@/components/public/partner-card";
import { serverApiList } from "@/lib/server-api";
import type { PublicPartnerSummary } from "@/components/public/types";

export const metadata: Metadata = {
  title: "tinyPet — encontre quem cuida do seu pet",
  description: "Adestradores, clínicas veterinárias, lojas e pet shops perto de você. Agende visitas, acompanhe a saúde e a rotina dos seus pets.",
};
// Rendered per request (in Docker the API isn't reachable during `next build`); the data fetch below is cached 5 min.
export const dynamic = "force-dynamic";

const TYPES = [
  { key: "trainer", label: "Treinadores e adestradores", icon: GraduationCap, text: "Obediência, comportamento e cursos online." },
  { key: "vet_clinic", label: "Clínicas veterinárias", icon: Stethoscope, text: "Consultas, vacinas e exames com histórico no app." },
  { key: "specialty_store", label: "Lojas especializadas", icon: Store, text: "Ração, acessórios e ofertas das marcas que seu pet usa." },
  { key: "pet_shop", label: "Pet shops", icon: ShoppingBag, text: "Banho, tosa e tudo para o dia a dia." },
];

export default async function Home() {
  const featured = await serverApiList<PublicPartnerSummary[]>("/public/partners?pageSize=6", { revalidate: 300 });
  const partners = featured?.data ?? [];
  return (
    <>
      <PublicHeader showSearch={false} />
      <main>
        <section className="bg-gradient-to-b from-brand-50 to-[var(--bg)] dark:from-brand-900/20">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Encontre quem cuida do seu pet</h1>
              <p className="mt-4 text-base text-[var(--muted)] sm:text-lg">Adestradores, clínicas, lojas e pet shops perto de você. Agende visitas, acompanhe saúde, rotina e conquistas em um só lugar.</p>
            </div>
            <div className="mx-auto mt-8 max-w-3xl">
              <SearchBox />
            </div>
            <p className="mt-4 text-center text-sm text-[var(--muted)]">
              Ou explore por tipo:{" "}
              {TYPES.map((t, i) => (
                <span key={t.key}>
                  <Link href={`/buscar?type=${t.key}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                    {t.label.toLowerCase()}
                  </Link>
                  {i < TYPES.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="tipos">
          <h2 id="tipos" className="text-2xl font-bold">
            Parceiros para cada necessidade
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TYPES.map(({ key, label, icon: Icon, text }) => (
              <Link key={key} href={`/buscar?type=${key}`} className="card group transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-3 font-semibold group-hover:underline">{label}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
              </Link>
            ))}
          </div>
        </section>

        {partners.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="destaques">
            <div className="flex items-end justify-between">
              <h2 id="destaques" className="text-2xl font-bold">
                Parceiros em destaque
              </h2>
              <Link href="/buscar" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                Ver todos
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {partners.map((p) => (
                <PartnerCard key={p.id} p={p} />
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="como">
          <h2 id="como" className="text-2xl font-bold">
            Como funciona
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { icon: Star, title: "Busque e compare", text: "Filtre por tipo, categoria, espécie e nota. Veja avaliações de clientes verificados." },
              { icon: CalendarCheck, title: "Agende pelo app", text: "Escolha o pet, o horário e onde será o atendimento. O parceiro confirma e você recebe lembretes." },
              { icon: HeartPulse, title: "Acompanhe a saúde", text: "Vacinas, peso, comandos e rotina de cada pet em uma ficha única." },
              { icon: BadgeCheck, title: "Ganhe conquistas", text: "Streaks, badges e cartões de aniversário para compartilhar." },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="card">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">{i + 1}</span>
                  <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl bg-ink-900 px-6 py-10 text-white dark:bg-brand-600 sm:px-10">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Sou parceiro</h2>
                <p className="mt-2 max-w-xl text-ink-200 dark:text-brand-50">Publique seu perfil e catálogo, gerencie clientes, agenda, contratos e parcelas. Comece grátis.</p>
              </div>
              <Link href="/painel/novo" className="btn bg-white text-ink-900 hover:bg-ink-100">
                Criar meu negócio
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
