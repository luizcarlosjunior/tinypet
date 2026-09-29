"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Flower2 } from "lucide-react";
import { Button, Input, Modal, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useSessionContext } from "@/hooks/use-session-context";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { toDateKey } from "@/lib/format";

/**
 * Registers a pet's death. Irreversible: the user must acknowledge it and confirm with their password
 * (or with a code sent by e-mail when the account signs in only with Google/Apple).
 * `partnerId`: null for the tutor area (never send the active partner header), the partner id in the panel.
 */
export function DeceasedDialog({ petId, petName, open, onClose, onDone, partnerId = null }: { petId: string; petName: string; open: boolean; onClose: () => void; onDone?: () => void; partnerId?: string | null }) {
  const session = useSessionContext();
  const hasPassword = session.data?.user.hasPassword !== false;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deceasedAt, setDeceasedAt] = useState(toDateKey());
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAck(false);
    setPassword("");
    setCode("");
    setError(null);
  }

  async function sendCode() {
    setError(null);
    try {
      await api(`/pets/${petId}/deceased/code`, { method: "POST", partnerId });
      setCodeSent(true);
      toast("Enviamos um código para o seu e-mail.", "info");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api(`/pets/${petId}/deceased`, {
        method: "POST",
        partnerId,
        json: { deceasedAt, memorialNote: note.trim() || null, ...(hasPassword ? { password } : { code: code.trim() }) },
      });
      qc.invalidateQueries({ queryKey: ["pets"] });
      qc.invalidateQueries({ queryKey: ["me", "home"] });
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast("Registro feito. Estamos com você.", "info");
      reset();
      onDone?.();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const proofOk = hasPassword ? password.length > 0 : /^\d{6}$/.test(code.trim());
  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={`Registrar o falecimento de ${petName}`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ack && proofOk && !busy) void submit();
        }}
      >
        <div role="alert" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Este registro é definitivo e não pode ser desfeito.</p>
            <p className="mt-1">Os agendamentos futuros serão cancelados, as tarefas e lembretes param e o perfil vira um memorial. A ficha, a galeria e o histórico continuam guardados.</p>
          </div>
        </div>
        <Input id="dec-date" type="date" label="Data do falecimento" value={deceasedAt} max={toDateKey()} onChange={(e) => setDeceasedAt(e.target.value)} required />
        <Textarea id="dec-note" label="Mensagem (opcional)" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Uma lembrança carinhosa" />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>Confirmo que {petName} faleceu e entendo que este registro não pode ser desfeito.</span>
        </label>
        {hasPassword ? (
          <Input id="dec-password" type="password" label="Sua senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">Sua conta entra com Google ou Apple. Para confirmar, enviaremos um código ao seu e-mail.</p>
            {codeSent ? (
              <Input id="dec-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} label="Código recebido por e-mail" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
            ) : null}
            <Button type="button" variant="secondary" onClick={() => void sendCode()}>
              {codeSent ? "Reenviar código" : "Enviar código"}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="danger" loading={busy} disabled={!ack || !proofOk}>
            <Flower2 className="h-4 w-4" aria-hidden /> Registrar falecimento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
