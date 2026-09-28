"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Modal } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { ImageCropper } from "./image-cropper";
import { uploadFile, type MediaPurpose } from "@/lib/upload";
import { errorMessage, planLimitOf } from "@/lib/errors";
import { IMAGE_MIME, MEDIA_MAX_BYTES } from "@tinypet/shared";

/** Avatar with "change photo" action: file → square crop → 3-step upload → onChange(url). */
export function AvatarUpload({ value, name, purpose, onChange, size = 96, square = false, label = "Alterar foto" }: { value?: string | null; name?: string | null; purpose: MediaPurpose; onChange: (url: string) => void; size?: number; square?: boolean; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!(IMAGE_MIME as readonly string[]).includes(f.type) && !f.type.startsWith("image/")) return toast("Escolha uma imagem (JPG, PNG ou WebP).", "error");
    if (f.size > MEDIA_MAX_BYTES) return toast("A imagem deve ter até 10 MB.", "error");
    setFile(f);
  }

  async function confirm(crop: { x: number; y: number; width: number; height: number }) {
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadFile(file, purpose, { crop });
      onChange(res.url);
      setFile(null);
      toast("Foto atualizada!", "success");
    } catch (e) {
      const pl = planLimitOf(e);
      toast(pl ? "Limite de armazenamento do seu plano atingido." : errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar src={value} name={name} size={size} square={square} />
      <div>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={pick} aria-label={label} />
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary">
          <Camera className="h-4 w-4" aria-hidden /> {label}
        </button>
        <p className="mt-1 text-xs text-[var(--muted)]">JPG, PNG ou WebP até 10 MB. Recorte quadrado.</p>
      </div>
      <Modal open={!!file} onClose={() => !busy && setFile(null)} title="Recortar foto">
        {file && <ImageCropper file={file} onCancel={() => setFile(null)} onConfirm={confirm} loading={busy} />}
      </Modal>
    </div>
  );
}
