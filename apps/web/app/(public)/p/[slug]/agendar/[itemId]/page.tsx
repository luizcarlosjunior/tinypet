import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BookingWizard } from "@/components/public/booking-wizard";
import { serverApi } from "@/lib/server-api";
import type { PublicItem } from "@/components/public/types";
import { Empty } from "@/components/ui";

export const metadata: Metadata = { title: "Agendar", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AgendarPage({ params }: { params: { slug: string; itemId: string } }) {
  const it = await serverApi<PublicItem>(`/public/items/${encodeURIComponent(params.itemId)}`, { revalidate: 0, cache: "no-store" });
  if (!it) notFound();
  const partnerId = it.partner?.id;
  const partnerName = it.partner?.tradeName ?? "Parceiro";
  return (
    <div className="space-y-4">
      <Link href={`/p/${params.slug}/item/${it.id}`} className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden /> {it.name}
      </Link>
      <h1 className="text-2xl font-bold">Agendar {it.name}</h1>
      {!it.bookable || it.type !== "SERVICE" || !partnerId ? (
        <Empty title="Este item não aceita agendamento pelo app" description="Entre em contato com o parceiro pela página dele." action={<Link href={`/p/${params.slug}`} className="btn-primary">Ver parceiro</Link>} />
      ) : (
        <BookingWizard item={it} slug={params.slug} partnerId={partnerId} partnerName={partnerName} />
      )}
    </div>
  );
}
