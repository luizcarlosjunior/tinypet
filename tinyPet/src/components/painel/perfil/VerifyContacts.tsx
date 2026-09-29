"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";

/** "Verificar" button + code modal: POST /partners/:id/verify {channel,target} → PUT {channel,code}. */
export function VerifyButton({ partnerId, channel, target, verified, onVerified }: { partnerId: string; channel: "EMAIL" | "PHONE"; target: string; verified: boolean; onVerified: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const send = useMutation({
    mutationFn: () => api(`/partners/${partnerId}/verify`, { method: "POST", json: { channel, target } }),
    onSuccess: () => {
      toast(`Código enviado para ${target}`, "success");
      setOpen(true);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const confirm = useMutation({
    mutationFn: () => api(`/partners/${partnerId}/verify`, { method: "PUT", json: { channel, code } }),
    onSuccess: () => {
      toast("Verificado!", "success");
      setOpen(false);
      setCode("");
      onVerified();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  if (verified)
    return (
      <span className="badge gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
        <BadgeCheck className="h-3 w-3" aria-hidden /> Verificado
      </span>
    );
  return (
    <>
      <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => send.mutate()} loading={send.isPending}>
        Verificar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={channel === "EMAIL" ? "Verificar e-mail" : "Verificar celular"}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            confirm.mutate();
          }}
        >
          <p className="text-sm text-[var(--muted)]">Digite o código de 6 dígitos enviado para {target}.</p>
          <Input id="verify-code" label="Código" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => send.mutate()} loading={send.isPending}>
              Reenviar código
            </Button>
            <Button type="submit" loading={confirm.isPending} disabled={code.length !== 6}>
              Confirmar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
