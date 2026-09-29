"use client";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { uploadFile, type MediaPurpose, type UploadedMedia } from "@/lib/upload";
import { errorMessage } from "@/lib/errors";
import { MEDIA_MAX_BYTES } from "@tinypet/shared";
import { cn } from "@/lib/utils";

/** Button that picks a file and runs the 3-step upload. Calls `onUploaded` for each file. */
export function UploadButton({ purpose, partnerId, onUploaded, onError, accept = "image/*", multiple, label = "Enviar arquivo", className, variant = "secondary", disabled }: { purpose: MediaPurpose; partnerId?: string | null; onUploaded: (m: UploadedMedia, file: File) => void; onError?: (e: unknown) => void; accept?: string; multiple?: boolean; label?: string; className?: string; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const { toast } = useToast();
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      if (f.size > MEDIA_MAX_BYTES) {
        toast(`${f.name}: acima de 10 MB`, "error");
        continue;
      }
      try {
        setProgress(0);
        const m = await uploadFile(f, purpose, { partnerId, onProgress: setProgress });
        onUploaded(m, f);
      } catch (err) {
        onError?.(err);
        toast(errorMessage(err), "error");
      } finally {
        setProgress(null);
      }
    }
  }
  return (
    <>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="sr-only" onChange={onChange} aria-hidden tabIndex={-1} />
      <Button type="button" variant={variant} className={cn(className)} disabled={disabled || progress !== null} loading={progress !== null} onClick={() => ref.current?.click()}>
        {progress === null && <Upload className="h-4 w-4" aria-hidden />}
        {progress !== null ? `Enviando ${progress}%` : label}
      </Button>
    </>
  );
}
