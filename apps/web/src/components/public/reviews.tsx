"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Flag, MessageSquareReply } from "lucide-react";
import { reviewSchema, reportSchema } from "@tinypet/shared";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { fmtDate } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { RatingInput, RatingStars } from "@/components/ui/rating";
import { Button, Modal, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useSessionContext } from "@/hooks/use-session-context";
import type { PublicReview } from "./types";

type ReviewInput = z.infer<typeof reviewSchema>;

export function ReviewList({ reviews, showItem = false }: { reviews: PublicReview[]; showItem?: boolean }) {
  if (!reviews.length) return <p className="text-sm text-[var(--muted)]">Ainda não há avaliações. Seja a primeira pessoa a avaliar!</p>;
  return (
    <ul className="space-y-4">
      {reviews.map((r) => (
        <li key={r.id} className="card">
          <div className="flex items-start gap-3">
            <Avatar src={r.user?.avatarUrl} name={r.user?.name} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{r.user?.name ?? "Tutor"}</span>
                {r.verified && (
                  <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <BadgeCheck className="mr-1 h-3 w-3" aria-hidden /> Cliente verificado
                  </span>
                )}
                <span className="text-xs text-[var(--muted)]">{fmtDate(r.createdAt)}</span>
              </div>
              <RatingStars value={r.rating} size={14} showValue={false} className="mt-1" />
              {showItem && r.item && <p className="mt-1 text-xs text-[var(--muted)]">Sobre: {r.item.name}</p>}
              {r.comment && <p className="mt-2 whitespace-pre-line text-sm">{r.comment}</p>}
              {r.reply && (
                <div className="mt-3 rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-800/60">
                  <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)]">
                    <MessageSquareReply className="h-3.5 w-3.5" aria-hidden /> Resposta do parceiro · {fmtDate(r.reply.createdAt)}
                  </p>
                  <p className="whitespace-pre-line">{r.reply.body}</p>
                </div>
              )}
              <ReportButton reviewId={r.id} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ReportButton({ reviewId }: { reviewId: string }) {
  const { isLoggedIn } = useSessionContext();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<{ reason: string }>({ resolver: zodResolver(reportSchema), defaultValues: { reason: "" } });
  const m = useMutation({
    mutationFn: (v: { reason: string }) => api(`/reviews/${reviewId}/report`, { method: "POST", json: v }),
    onSuccess: () => {
      toast("Denúncia enviada. Nossa equipe vai analisar.", "success");
      setOpen(false);
      form.reset();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  if (!isLoggedIn) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-600 hover:underline">
        <Flag className="h-3 w-3" aria-hidden /> Denunciar
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Denunciar avaliação">
        <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3">
          <Textarea id={`report-${reviewId}`} label="Motivo" placeholder="Conte o que há de errado com esta avaliação" {...form.register("reason")} error={form.formState.errors.reason?.message} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={m.isPending}>
              Enviar denúncia
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function ReviewForm({ itemId, existing }: { itemId: string; existing?: PublicReview | null }) {
  const { isLoggedIn, sessionStatus } = useSessionContext();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const form = useForm<ReviewInput>({ resolver: zodResolver(reviewSchema), defaultValues: { rating: existing?.rating ?? 0, comment: existing?.comment ?? "" } });
  const rating = form.watch("rating");
  const m = useMutation({
    mutationFn: (v: ReviewInput) => api(`/reviews/items/${itemId}`, { method: "POST", json: v }),
    onSuccess: () => {
      toast("Avaliação publicada. Obrigado!", "success");
      qc.invalidateQueries({ queryKey: ["public"] });
      router.refresh();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  if (sessionStatus === "loading") return null;
  if (!isLoggedIn) {
    return (
      <div className="card text-sm">
        <p className="font-medium">Já usou este serviço ou produto?</p>
        <p className="mt-1 text-[var(--muted)]">
          <Link href={`/entrar?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`} className="text-brand-600 hover:underline">
            Entre
          </Link>{" "}
          para deixar sua avaliação.
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="card space-y-3" aria-labelledby="avaliar-titulo">
      <h3 id="avaliar-titulo" className="font-semibold">
        {existing ? "Editar minha avaliação" : "Avaliar"}
      </h3>
      <div>
        <span className="label">Sua nota</span>
        <RatingInput value={Number(rating) || 0} onChange={(v) => form.setValue("rating", v, { shouldValidate: true })} />
        {form.formState.errors.rating && <p className="mt-1 text-xs text-red-600">Escolha uma nota de 1 a 5</p>}
      </div>
      <Textarea id="review-comment" label="Depoimento (opcional)" placeholder="Como foi sua experiência?" {...form.register("comment")} error={form.formState.errors.comment?.message} />
      <div className="flex justify-end">
        <Button type="submit" loading={m.isPending}>
          {existing ? "Salvar" : "Publicar avaliação"}
        </Button>
      </div>
    </form>
  );
}
