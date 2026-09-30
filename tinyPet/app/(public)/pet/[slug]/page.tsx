import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AtSign, Award, ExternalLink, Flower2, GraduationCap } from "lucide-react";
import { PET_SOCIAL_NETWORKS, petSocialProfileUrl, safeHref, type PetSocialNetworkKey } from "@tinypet/shared";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui";
import { PublicPetGallery } from "@/components/public/public-pet-gallery";
import { serverApi, appUrl } from "@/lib/server-api";

// Always fresh: when the owner turns the public profile off it must disappear immediately.
export const dynamic = "force-dynamic";

type PublicPet = {
  name: string;
  avatarUrl: string | null;
  sex: "MALE" | "FEMALE" | null;
  status: "ACTIVE" | "DECEASED";
  deceasedAt: string | null;
  species: { key: string; label: string } | null;
  breed: string | null;
  ageLabel: string | null;
  media: { id: string; kind: "IMAGE" | "VIDEO"; url: string; thumbUrl: string | null; title: string | null; description: string | null; takenAt: string }[];
  badges: { key: string; name: string; description: string | null; iconUrl: string | null; earnedAt: string }[];
  skills: string[];
  socialProfiles: { network: PetSocialNetworkKey; username: string }[];
};

const getPet = (slug: string) => serverApi<PublicPet>(`/public/pets/${encodeURIComponent(slug)}`, { cache: "no-store" });

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPet(params.slug);
  if (!p) return { title: "Perfil não encontrado", robots: { index: false } };
  const desc = [p.species?.label, p.breed, p.ageLabel].filter(Boolean).join(" · ");
  return {
    title: `${p.name} no tinyPet`,
    description: desc || `Conheça ${p.name} no tinyPet.`,
    // shared by link only: not listed in search engines
    robots: { index: false, follow: false },
    openGraph: { title: `${p.name} no tinyPet`, description: desc, url: appUrl(`/pet/${params.slug}`), images: p.avatarUrl ? [{ url: p.avatarUrl }] : undefined },
  };
}

export default async function PublicPetPage({ params }: { params: { slug: string } }) {
  const p = await getPet(params.slug);
  if (!p) notFound();
  const deceased = p.status === "DECEASED";
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <Avatar src={p.avatarUrl} name={p.name} size={112} className={deceased ? "grayscale" : ""} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">{p.name}</h1>
          <p className="text-[var(--muted)]">{[p.species?.label, p.breed, p.sex ? (p.sex === "MALE" ? "Macho" : "Fêmea") : null, p.ageLabel].filter(Boolean).join(" · ")}</p>
          {deceased && (
            <Badge tone="gray" className="mt-2">
              <Flower2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Em memória
            </Badge>
          )}
          {p.socialProfiles.length > 0 && (
            <ul className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {p.socialProfiles.map((s) => (
                <li key={s.network}>
                  <a href={petSocialProfileUrl(s.network, s.username)} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-ink-100 dark:hover:bg-ink-800">
                    <AtSign className="h-3 w-3" aria-hidden /> {PET_SOCIAL_NETWORKS.find((n) => n.key === s.network)?.label}: {s.username}
                    <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {p.media.length > 0 && (
        <section aria-labelledby="galeria">
          <h2 id="galeria" className="mb-3 text-lg font-semibold">
            Galeria
          </h2>
          <PublicPetGallery items={p.media} />
        </section>
      )}

      {(p.badges.length > 0 || p.skills.length > 0) && (
        <section className="grid gap-6 sm:grid-cols-2">
          {p.badges.length > 0 && (
            <div aria-labelledby="conquistas">
              <h2 id="conquistas" className="mb-3 inline-flex items-center gap-2 text-lg font-semibold">
                <Award className="h-5 w-5" aria-hidden /> Conquistas
              </h2>
              <ul className="space-y-2">
                {p.badges.map((b) => (
                  <li key={b.key} className="flex items-center gap-3 rounded-xl border p-2.5">
                    {b.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={safeHref(b.iconUrl)} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <Award className="h-5 w-5" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{b.name}</span>
                      {b.description && <span className="block text-xs text-[var(--muted)]">{b.description}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.skills.length > 0 && (
            <div aria-labelledby="comandos">
              <h2 id="comandos" className="mb-3 inline-flex items-center gap-2 text-lg font-semibold">
                <GraduationCap className="h-5 w-5" aria-hidden /> Comandos que domina
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {p.skills.map((s) => (
                  <li key={s} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {p.media.length === 0 && p.badges.length === 0 && p.skills.length === 0 && <p className="text-center text-sm text-[var(--muted)]">{p.name} ainda não tem fotos públicas nem conquistas.</p>}

      <p className="text-center text-xs text-[var(--muted)]">
        Perfil compartilhado pelo tutor no tinyPet. <a href="/regras-da-comunidade" className="underline">Regras da comunidade</a>
      </p>
    </div>
  );
}
