import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useTaskMutations, useTaskTemplates, useTasks } from "@/hooks/use-pets";
import { errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { spacing } from "@/lib/theme";
import type { PetTask, TaskRule } from "@/lib/types";
import { Badge, Button, Checkbox, Empty, ErrorState, Input, ListItem, Loading, Section, Segmented, Sheet, Text } from "@/components/ui";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** One-tap reasons for "não deu hoje". */
const SKIP_REASONS = ["Estava chovendo", "Tive um compromisso", "Pet indisposto", "Viagem", "Consulta veterinária"];

export function describeRule(rule?: TaskRule | null, dueAt?: string | null): string {
  if (rule?.freq === "daily") return `Todo dia${rule.times?.length ? ` às ${rule.times.join(", ")}` : ""}`;
  if (rule?.freq === "monthly") return `Todo mês${rule.dayOfMonth ? `, dia ${rule.dayOfMonth}` : ""}${rule.times?.length ? ` às ${rule.times.join(", ")}` : ""}`;
  if (rule?.freq === "weekly") return `${(rule.days ?? []).map((d) => DAYS[d]).join(", ") || "Semanal"}${rule.times?.length ? ` às ${rule.times.join(", ")}` : ""}`;
  if (dueAt) return `Até ${fmtDate(dueAt, "dd/MM HH:mm")}`;
  return "Avulsa";
}

/** Rotina: task list with complete checkbox, accept proposed routines, new task from templates. */
/** `isOwner`: may accept proposed routines. `canComplete` (default `isOwner`): may tick tasks as done — also true for shared accounts. */
export function RotinaTab({ petId, canEdit, isOwner, partnerMode, canComplete = isOwner }: { petId: string; canEdit: boolean; isOwner: boolean; partnerMode?: boolean; canComplete?: boolean }) {
  const q = useTasks(petId);
  const { create, complete, accept, remove, update, skip, unskip } = useTaskMutations(petId);
  const [skipping, setSkipping] = useState<PetTask | null>(null);
  const [skipNote, setSkipNote] = useState("");
  const saveSkip = async () => {
    if (!skipping || skipNote.trim().length < 2) return;
    try {
      await skip.mutateAsync({ tid: skipping.id, note: skipNote.trim(), forDate: skipping.forDate });
      setSkipping(null);
      setSkipNote("");
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };
  const [open, setOpen] = useState(false);
  // null = new task; otherwise the task being edited
  const [editing, setEditing] = useState<PetTask | null>(null);
  const templates = useTaskTemplates(petId, open && !editing);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [freq, setFreq] = useState<"once" | "daily" | "weekly" | "monthly">("daily");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [time, setTime] = useState("08:00");

  const fill = (t?: Partial<PetTask>) => {
    setTitle(t?.title ?? "");
    setDescription(t?.description ?? "");
    setFreq(t?.rule?.freq ?? (t ? "once" : "daily"));
    setDays(t?.rule?.days ?? [1, 3, 5]);
    setDayOfMonth(t?.rule?.dayOfMonth ? String(t.rule.dayOfMonth) : "");
    setTime(t?.rule?.times?.[0] ?? (t && !t.rule ? "" : "08:00"));
  };
  const openNew = () => {
    setEditing(null);
    fill();
    setOpen(true);
  };
  const openEdit = (t: PetTask) => {
    setEditing(t);
    fill(t);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const save = async () => {
    const dom = Number(dayOfMonth);
    const rule: TaskRule | null =
      freq === "once" ? null : { freq, days: freq === "weekly" ? days : undefined, dayOfMonth: freq === "monthly" && dom >= 1 && dom <= 31 ? dom : undefined, times: time ? [time] : undefined };
    try {
      if (editing) await update.mutateAsync({ tid: editing.id, title, description: description || null, rule });
      else await create.mutateAsync({ title, description: description || null, rule });
      close();
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const tasks = q.data ?? [];
  const proposed = tasks.filter((x) => x.status === "PROPOSED");
  const active = tasks.filter((x) => x.status !== "PROPOSED");

  return (
    <View>
      {proposed.length ? (
        <Section title="Rotinas propostas">
          {proposed.map((task) => (
            <ListItem
              key={task.id}
              title={task.title}
              subtitle={`${task.proposedBy ? `Enviada por ${task.proposedBy.tradeName} · ` : ""}${describeRule(task.rule, task.dueAt)}`}
              chevron={false}
              right={isOwner ? <Button title="Aceitar" size="sm" onPress={() => accept.mutateAsync(task.id).catch((e) => Alert.alert("Erro", errorMessage(e)))} /> : <Badge label="Aguardando tutor" tone="warning" />}
            />
          ))}
        </Section>
      ) : null}
      <Section title={partnerMode ? "Rotina do pet" : "Tarefas"} right={canEdit ? <Button title={partnerMode ? "Enviar rotina" : "Nova tarefa"} size="sm" onPress={openNew} /> : undefined}>
        {active.length === 0 ? <Empty icon="checkbox-outline" title="Sem tarefas" description="Passeio, remédio, escovar dentes… crie uma rotina para o pet." /> : null}
        {active.map((task: PetTask) => (
          <View key={task.id} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Checkbox
                checked={!!task.completedToday}
                disabled={!!task.completedToday || task.status === "PAUSED" || !canComplete}
                onChange={() => complete.mutateAsync({ tid: task.id }).catch((e) => Alert.alert("Erro", errorMessage(e)))}
                label={task.title}
                description={`${describeRule(task.rule, task.dueAt)}${task.status === "PAUSED" ? " · pausada" : ""}${task.skippedToday ? ` · não feita hoje: ${task.skipNote}` : ""}${task.lastCompletedAt ? ` · última ${fmtDate(task.lastCompletedAt, "dd/MM")}` : ""}`}
              />
            </View>
            {canComplete && task.skippedToday ? <Button title="Desfazer" variant="ghost" size="sm" onPress={() => unskip.mutateAsync({ tid: task.id, forDate: task.forDate }).catch((e) => Alert.alert("Erro", errorMessage(e)))} /> : null}
            {canComplete && task.dueToday && !task.completedToday && !task.skippedToday && task.status === "ACTIVE" ? (
              <Button
                title="Não deu"
                variant="ghost"
                size="sm"
                accessibilityLabel={`Não deu para fazer ${task.title} hoje`}
                onPress={() => {
                  setSkipping(task);
                  setSkipNote("");
                }}
              />
            ) : null}
            {canEdit && !partnerMode ? <Button title="Editar" variant="ghost" size="sm" onPress={() => openEdit(task)} /> : null}
            {canEdit ? (
              <Button
                title="Remover"
                variant="ghost"
                size="sm"
                onPress={() => Alert.alert("Remover tarefa?", task.title, [{ text: "Cancelar", style: "cancel" }, { text: "Remover", style: "destructive", onPress: () => remove.mutateAsync(task.id).catch((e) => Alert.alert("Erro", errorMessage(e))) }])}
              />
            ) : null}
          </View>
        ))}
      </Section>

      <Sheet visible={!!skipping} onClose={() => setSkipping(null)} title="Não deu para fazer hoje?">
        <Text variant="small" tone="muted" style={{ marginBottom: spacing.sm }}>
          {skipping?.title} — conte o motivo. Um dia justificado não zera a sequência de dias de rotina (mas também não soma).
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm }}>
          {SKIP_REASONS.map((r) => (
            <Button key={r} title={r} size="sm" variant={skipNote === r ? "primary" : "secondary"} onPress={() => setSkipNote(r)} />
          ))}
        </View>
        <Input label="Motivo" value={skipNote} onChangeText={setSkipNote} maxLength={500} placeholder="Ex.: estava chovendo muito" />
        <Button title="Registrar" onPress={saveSkip} loading={skip.isPending} disabled={skipNote.trim().length < 2} />
      </Sheet>
      <Sheet visible={open} onClose={close} title={editing ? "Editar tarefa" : partnerMode ? "Enviar rotina ao tutor" : "Nova tarefa"}>
        {!editing && templates.data?.length ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text variant="small" tone="muted" style={{ marginBottom: 6, fontWeight: "600" }}>
              Modelos
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {templates.data.map((tpl) => (
                <Button key={tpl.title} title={tpl.title} size="sm" variant="secondary" onPress={() => { setTitle(tpl.title); setDescription(tpl.description ?? ""); setFreq(tpl.rule?.freq ?? "once"); if (tpl.rule?.days) setDays(tpl.rule.days); if (tpl.rule?.dayOfMonth) setDayOfMonth(String(tpl.rule.dayOfMonth)); if (tpl.rule?.times?.[0]) setTime(tpl.rule.times[0]); }} />
              ))}
            </View>
          </View>
        ) : null}
        <Input label="Título" value={title} onChangeText={setTitle} placeholder="Ex.: Passeio da manhã" />
        <Input label="Descrição" value={description} onChangeText={setDescription} multiline />
        <Text variant="small" tone="muted" style={{ marginBottom: 6, fontWeight: "600" }}>
          Frequência
        </Text>
        <Segmented items={[{ key: "once", label: "Avulsa" }, { key: "daily", label: "Diária" }, { key: "weekly", label: "Semanal" }, { key: "monthly", label: "Mensal" }]} value={freq} onChange={setFreq} />
        {freq === "monthly" ? <Input label="Dia do mês" keyboardType="number-pad" value={dayOfMonth} onChangeText={setDayOfMonth} placeholder="Ex.: 10" hint="Em meses mais curtos, vale o último dia." style={{ marginTop: spacing.md }} /> : null}
        {freq === "weekly" ? (
          <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.md, flexWrap: "wrap" }}>
            {DAYS.map((d, i) => (
              <Button key={d} title={d} size="sm" variant={days.includes(i) ? "primary" : "secondary"} onPress={() => setDays((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort()))} />
            ))}
          </View>
        ) : null}
        {freq !== "once" ? <Input label="Horário" value={time} onChangeText={setTime} placeholder="HH:MM" style={{ marginTop: spacing.md }} /> : null}
        <Button title={partnerMode && !editing ? "Enviar" : "Salvar"} onPress={save} loading={create.isPending || update.isPending} disabled={!title || (freq === "weekly" && days.length === 0)} style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}
