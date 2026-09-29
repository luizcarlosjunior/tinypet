"use client";
import { useState } from "react";
import { BadgeCheck, Plus } from "lucide-react";
import { Badge, Button, Input, Modal, Select, Spinner } from "@/components/ui";
import { ErrorBox, Table, td, th } from "@/components/painel/ui";
import { useApiMutation, usePetSkills } from "@/hooks/use-crm";
import { fmtDate, todayISO } from "@/lib/format";
import { useActivePartner } from "@/hooks/use-partner";

const LEVEL: Record<string, { label: string; tone: "gray" | "amber" | "green" }> = { LEARNING: { label: "Aprendendo", tone: "gray" }, SOMETIMES: { label: "Às vezes", tone: "amber" }, MASTERED: { label: "Dominado", tone: "green" } };

export function SkillsTab({ petId }: { petId: string }) {
  const q = usePetSkills(petId);
  const { partner } = useActivePartner();
  const isTrainer = !!partner?.types?.some((t) => ("key" in t ? t.key : t.type.key) === "trainer");
  const [open, setOpen] = useState(false);
  const [skillId, setSkillId] = useState("");
  const [custom, setCustom] = useState("");
  const [level, setLevel] = useState<"LEARNING" | "SOMETIMES" | "MASTERED">("LEARNING");
  const [masteredAt, setMasteredAt] = useState(todayISO());
  const keys = [["pet", petId, "skills"], ["pet", petId, "history"]];
  const upsert = useApiMutation<{ skillId?: string; customName?: string; level: string; masteredAt?: string | null }>({ path: () => `/pets/${petId}/skills`, method: "PUT", body: (v) => v, invalidate: keys, success: "Comando salvo", onSuccess: () => setOpen(false) });
  const validate = useApiMutation<string>({ path: (sid) => `/pets/${petId}/skills/${sid}/validate`, invalidate: keys, success: "Comando validado" });
  const skills = q.data?.skills ?? [];
  const available = (q.data?.available ?? []).filter((a) => !skills.some((s) => s.skillId === a.id));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">Ao validar, o comando recebe o selo do seu estabelecimento no perfil do pet.</p>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Adicionar comando
        </Button>
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Comando</th>
              <th className={th}>Nível</th>
              <th className={`${th} hidden sm:table-cell`}>Dominado em</th>
              <th className={th}>Validação</th>
            </tr>
          </thead>
          <tbody>
            {skills.length === 0 && (
              <tr>
                <td className={`${td} text-[var(--muted)]`} colSpan={4}>
                  Nenhum comando registrado.
                </td>
              </tr>
            )}
            {skills.map((s) => (
              <tr key={s.skillId}>
                <td className={`${td} font-medium`}>{s.name}</td>
                <td className={td}>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <select aria-label={`Nível de ${s.name}`} className="input h-8 w-auto py-0 text-xs" value={s.level} onChange={(e) => upsert.mutate({ skillId: s.skillId, level: e.target.value, masteredAt: e.target.value === "MASTERED" ? todayISO() : null })}>
                      {Object.entries(LEVEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </span>
                </td>
                <td className={`${td} hidden sm:table-cell`}>{s.masteredAt ? fmtDate(s.masteredAt) : "—"}</td>
                <td className={td}>
                  {s.validated ? (
                    <Badge tone="green">
                      <BadgeCheck className="mr-1 h-3 w-3" aria-hidden /> Validado
                    </Badge>
                  ) : isTrainer && s.level === "MASTERED" ? (
                    <Button type="button" variant="secondary" className="h-8 text-xs" loading={validate.isPending && validate.variables === s.skillId} onClick={() => validate.mutate(s.skillId)}>
                      Validar
                    </Button>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Adicionar comando">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!skillId && !custom.trim()) return;
            upsert.mutate({ skillId: skillId && skillId !== "__custom" ? skillId : undefined, customName: skillId === "__custom" ? custom.trim() : undefined, level, masteredAt: level === "MASTERED" ? masteredAt : null });
          }}
        >
          <Select id="sk-id" label="Comando" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
            <option value="">Escolha…</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="__custom">Outro (personalizado)</option>
          </Select>
          {skillId === "__custom" && <Input id="sk-custom" label="Nome do comando" value={custom} onChange={(e) => setCustom(e.target.value)} />}
          <Select id="sk-level" label="Nível" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            {Object.entries(LEVEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          {level === "MASTERED" && <Input id="sk-date" type="date" label="Dominado em" value={masteredAt} onChange={(e) => setMasteredAt(e.target.value)} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={upsert.isPending} disabled={!skillId || (skillId === "__custom" && !custom.trim())}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
