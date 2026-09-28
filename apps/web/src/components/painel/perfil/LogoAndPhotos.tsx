"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ImageIcon, Trash2 } from "lucide-react";
import { VENUE_PHOTOS_MAX, safeHref } from "@tinypet/shared";
import { api } from "@/lib/api-client";
import { uploadFile } from "@/lib/upload";
import { Button, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { FieldGroup, ConfirmDialog } from "@/components/painel/ui";
import { ImageCropper, type CropRect } from "@/components/media/ImageCropper";
import { UploadButton } from "@/components/media/UploadButton";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { errorMessage } from "@/lib/errors";
import type { Partner, VenuePhoto } from "@/types/api";

export function LogoCard({ partner, onSaved, canEdit }: { partner: Partner; onSaved: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<unknown>(null);
  const save = useMutation({
    mutationFn: async ({ f, crop }: { f: File; crop: CropRect }) => {
      const m = await uploadFile(f, "PARTNER_LOGO", { crop, partnerId: partner.id });
      await api(`/partners/${partner.id}`, { method: "PATCH", json: { logoUrl: m.url } });
    },
    onSuccess: () => {
      toast("Logomarca atualizada", "success");
      setOpen(false);
      setFile(null);
      onSaved();
    },
    onError: (e) => {
      setError(e);
      toast(errorMessage(e), "error");
    },
  });
  const removeLogo = useMutation({
    mutationFn: () => api(`/partners/${partner.id}`, { method: "PATCH", json: { logoUrl: null } }),
    onSuccess: () => {
      toast("Logomarca removida", "success");
      onSaved();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  return (
    <FieldGroup title="Logomarca" description="Recorte quadrado; salva com até 1000×1000 px.">
      <div className="flex items-center gap-4">
        {partner.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeHref(partner.logoUrl)} alt={`Logo de ${partner.tradeName}`} className="h-24 w-24 rounded-2xl border object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed text-[var(--muted)]">
            <ImageIcon className="h-8 w-8" aria-hidden />
          </div>
        )}
        {canEdit && (
          <div className="flex flex-col gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
              {partner.logoUrl ? "Trocar logomarca" : "Enviar logomarca"}
            </Button>
            {partner.logoUrl && (
              <Button type="button" variant="ghost" className="text-red-600" onClick={() => removeLogo.mutate()} loading={removeLogo.isPending}>
                Remover
              </Button>
            )}
          </div>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Recortar logomarca">
        <PlanLimitNotice error={error} className="mb-3" compact />
        <ImageCropper file={file} onFile={setFile} onCancel={() => setOpen(false)} submitting={save.isPending} onConfirm={(f, crop) => save.mutate({ f, crop })} confirmLabel="Salvar logomarca" />
      </Modal>
    </FieldGroup>
  );
}

export function VenuePhotosCard({ partner, onSaved, canEdit }: { partner: Partner; onSaved: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const photos = [...(partner.venuePhotos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const [del, setDel] = useState<VenuePhoto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const base = `/partners/${partner.id}/venue-photos`;
  const add = useMutation({
    mutationFn: (m: { url: string; thumbUrl?: string | null }) => api(base, { method: "POST", json: { url: m.url, thumbUrl: m.thumbUrl ?? null, sortOrder: photos.length } }),
    onSuccess: () => onSaved(),
    onError: (e) => {
      setError(e);
      toast(errorMessage(e), "error");
    },
  });
  const caption = useMutation({
    mutationFn: ({ id, caption }: { id: string; caption: string }) => api(`${base}/${id}`, { method: "PATCH", json: { caption: caption || null } }),
    onSuccess: () => onSaved(),
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const order = useMutation({
    mutationFn: (ids: string[]) => api(`${base}/order`, { method: "PUT", json: { ids } }),
    onSuccess: () => onSaved(),
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`${base}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDel(null);
      onSaved();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const ids = photos.map((p) => p.id);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    order.mutate(ids);
  };
  return (
    <FieldGroup title="Fotos do estabelecimento" description={`Até ${VENUE_PHOTOS_MAX} fotos com legenda, na ordem em que aparecem na página pública.`}>
      <PlanLimitNotice error={error} className="mb-3" />
      {photos.length === 0 && <p className="mb-3 text-sm text-[var(--muted)]">Nenhuma foto ainda.</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {photos.map((p, i) => (
          <li key={p.id} className="overflow-hidden rounded-xl border bg-[var(--card)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={safeHref(p.thumbUrl || p.url)} alt={p.caption ?? `Foto ${i + 1}`} className="aspect-square w-full object-cover" />
            {canEdit ? (
              <>
                <input type="text" aria-label={`Legenda da foto ${i + 1}`} placeholder="Legenda" maxLength={140} defaultValue={p.caption ?? ""} onBlur={(e) => e.target.value !== (p.caption ?? "") && caption.mutate({ id: p.id, caption: e.target.value })} className="w-full border-t bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand-400" />
                <div className="flex items-center justify-between border-t p-1">
                  <button type="button" className="btn-ghost h-7 w-7 p-0" aria-label="Mover para cima" disabled={i === 0 || order.isPending} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-ghost h-7 w-7 p-0" aria-label="Mover para baixo" disabled={i === photos.length - 1 || order.isPending} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-ghost h-7 w-7 p-0 text-red-600" aria-label="Remover foto" onClick={() => setDel(p)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              p.caption && <p className="px-2 py-1 text-xs">{p.caption}</p>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="mt-3 flex items-center gap-3">
          <UploadButton purpose="VENUE_PHOTO" partnerId={partner.id} multiple accept="image/*" disabled={photos.length >= VENUE_PHOTOS_MAX} label="Adicionar fotos" onUploaded={(m) => add.mutate(m)} onError={setError} />
          <span className="text-xs text-[var(--muted)]">
            {photos.length}/{VENUE_PHOTOS_MAX}
          </span>
        </div>
      )}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} title="Remover foto?" confirmLabel="Remover" danger loading={remove.isPending} />
    </FieldGroup>
  );
}
