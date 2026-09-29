"use client";
import { useState } from "react";
import { ImageCropper } from "./ImageCropper";
import { setVideoCover, type UploadedMedia } from "@/lib/upload";
import { errorMessage, isPlanLimit } from "@/lib/errors";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";

/**
 * Changes the cover of an already-uploaded video: pick an image, crop it to the video aspect (16:9 or 9:16),
 * upload it as VIDEO_COVER and call POST /media/:assetId/cover.
 */
export function VideoCoverEditor({ assetId, portrait, partnerId, onSaved, onCancel }: { assetId: string; portrait: boolean; partnerId?: string | null; onSaved: (m: UploadedMedia) => void; onCancel?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="space-y-3">
      <PlanLimitNotice error={error} />
      {!!error && !isPlanLimit(error) && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage(error)}
        </p>
      )}
      <ImageCropper
        file={file}
        onFile={setFile}
        aspect={portrait ? 9 / 16 : 16 / 9}
        size={320}
        submitting={busy}
        onCancel={onCancel}
        confirmLabel="Salvar capa"
        onConfirm={async (f, crop) => {
          setBusy(true);
          setError(null);
          try {
            onSaved(await setVideoCover(assetId, { file: f, crop }, { partnerId }));
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
