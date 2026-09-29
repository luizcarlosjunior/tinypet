"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useSessionContext } from "@/hooks/use-session-context";
import { canEditPet, usePets } from "@/hooks/use-pets";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { Button, Modal, Spinner } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function EnrollButton({ courseId, paid }: { courseId: string; paid: boolean }) {
  const { isLoggedIn } = useSessionContext();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [petIds, setPetIds] = useState<string[]>([]);
  const pets = usePets({ enabled: open });
  const m = useMutation({
    mutationFn: () => api<{ id?: string; enrollmentId?: string; contractId?: string }>(`/public/courses/${courseId}/enroll`, { method: "POST", json: { petIds } }),
    onSuccess: (r) => {
      setOpen(false);
      if (paid && r?.contractId) {
        toast("Matrícula criada! Aceite o contrato para liberar as aulas.", "success");
        router.push(`/contratos/${r.contractId}`);
      } else {
        toast("Matrícula realizada!", "success");
        router.push("/inicio");
      }
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  if (!isLoggedIn) {
    return (
      <Link href={`/entrar?next=${encodeURIComponent(pathname)}`} className="btn-primary">
        Entrar para me matricular
      </Link>
    );
  }
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {paid ? "Matricular (gera contrato)" : "Matricular grátis"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Qual pet vai fazer o curso?">
        {pets.isLoading ? (
          <Spinner />
        ) : (pets.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Cadastre um pet primeiro em{" "}
            <Link href="/pets?new=1" className="text-brand-600 hover:underline">
              Meus pets
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {(pets.data ?? [])
              .filter((p) => p.status !== "DECEASED" && canEditPet(p)) /* enrollment is owner-only */
              .map((p) => {
                const on = petIds.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm", on && "border-brand-500 bg-brand-50 dark:bg-brand-900/20")}>
                      <input type="checkbox" checked={on} onChange={() => setPetIds((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} className="h-4 w-4 accent-brand-500" />
                      <Avatar src={p.avatarUrl} name={p.name} size={32} />
                      {p.name}
                    </label>
                  </li>
                );
              })}
          </ul>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => m.mutate()} disabled={petIds.length === 0} loading={m.isPending}>
            Confirmar matrícula
          </Button>
        </div>
      </Modal>
    </>
  );
}
