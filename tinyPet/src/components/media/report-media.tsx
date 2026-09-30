"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Flag } from "lucide-react";
import { MEDIA_REPORT_REASONS, type MediaReportReasonKey } from "@tinypet/shared";
import { api } from "@/lib/api-client";
import { Button, Modal, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

/**
 * "Denunciar" for a photo/video that breaks the community rules. `url` is the media (or thumbnail) URL on screen;
 * the API finds the asset behind it. Logged-out visitors are sent to login.
 */
export function ReportMediaButton({ url, kind = "IMAGE", className, compact = false }: { url: string; kind?: "IMAGE" | "VIDEO"; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const what = kind === "VIDEO" ? "vídeo" : "foto";
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn("inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-600", className)}
        aria-label={`Denunciar ${what}`}
        title={`Denunciar ${what}`}
      >
        <Flag className="h-3 w-3" aria-hidden />
        {!compact && "Denunciar"}
      </button>
      {open && <ReportMediaDialog url={url} what={what} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportMediaDialog({ url, what, onClose }: { url: string; what: string; onClose: () => void }) {
  const { status } = useSession();
  const pathname = usePathname();
  const { toast } = useToast();
  const [reason, setReason] = useState<MediaReportReasonKey | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const needsDetails = reason === "OTHER" && details.trim().length < 5;

  async function submit() {
    if (!reason || needsDetails) return;
    setBusy(true);
    try {
      await api("/media/report", { method: "POST", json: { url, reason, details: details.trim() || null }, partnerId: null });
      toast("Denúncia enviada. Nossa equipe vai analisar.", "success");
      onClose();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Denunciar ${what}`}>
      {status !== "authenticated" ? (
        <div className="space-y-3 text-sm">
          <p>Entre na sua conta para denunciar conteúdo que não segue as regras da comunidade.</p>
          <Link href={`/entrar?callbackUrl=${encodeURIComponent(pathname ?? "/")}`} className="btn-primary">
            Entrar
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Qual regra da comunidade este conteúdo não segue?{" "}
            <Link href="/regras-da-comunidade" target="_blank" className="underline">
              Ver as regras
            </Link>
          </p>
          <fieldset className="space-y-2">
            <legend className="sr-only">Motivo</legend>
            {MEDIA_REPORT_REASONS.map((r) => (
              <label key={r.key} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 text-sm", reason === r.key && "border-brand-500 bg-brand-50 dark:bg-brand-900/20")}>
                <input type="radio" name="report-reason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-xs text-[var(--muted)]">{r.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Textarea label={reason === "OTHER" ? "Descreva o problema *" : "Detalhes (opcional)"} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} />
          <p className="text-xs text-[var(--muted)]">Denúncias falsas ou de má-fé podem levar à suspensão da conta ou ao bloqueio de novas denúncias.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={submit} loading={busy} disabled={!reason || needsDetails}>
              Enviar denúncia
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
