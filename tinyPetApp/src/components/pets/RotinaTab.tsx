import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useTaskMutations, useTaskTemplates, useTasks } from "@/hooks/use-pets";
import { errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { spacing } from "@/lib/theme";
import type { PetTask, TaskRule } from "@/lib/types";
import { Badge, Button, Checkbox, Empty, ErrorState, Input, ListItem, Loading, Section, Segmented, Sheet, Text } from "@/components/ui";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function describeRule(rule?: TaskRule | null, dueAt?: string | null): string {
  if (rule?.freq === "daily") return `Todo dia${rule.times?.length ? ` às ${rule.times.join(", ")}` : ""}`;
  if (rule?.freq === "weekly") return `${(rule.days ?? []).map((d) => DAYS[d]).join(", ") || "Semanal"}${rule.times?.length ? ` às ${rule.times.join(", ")}` : ""}`;
  if (dueAt) return `Até ${fmtDate(dueAt, "dd/MM HH:mm")}`;
  return "Avulsa";
}

/** Rotina: task list with complete checkbox, accept proposed routines, new task from templates. */
/** `isOwner`: may accept proposed routines. `canComplete` (default `isOwner`): may tick tasks as done — also true for shared accounts. */
export function RotinaTab({ petId, canEdit, isOwner, partnerMode, canComplete = isOwner }: { petId: string; canEdit: boolean; isOwner: boolean; partnerMode?: boolean; canComplete?: boolean }) {
  const q = useTasks(petId);
  const { create, complete, accept, remove } = useTaskMutations(petId);
  const [open, setOpen] = useState(false);
  const templates = useTaskTemplates(petId, open);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [freq, setFreq] = useState<"once" | "daily" | "weekly">("daily");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("08:00");

  const save = async () => {
    const rule: TaskRule | null = freq === "once" ? null : { freq, days: freq === "weekly" ? days : undefined, times: time ? [time] : undefined };
    try {
      await create.mutateAsync({ title, description: description || null, rule });
      setOpen(false);
      setTitle("");
      setDescription("");
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
      <Section title={partnerMode ? "Rotina do pet" : "Tarefas"} right={canEdit ? <Button title={partnerMode ? "Enviar rotina" : "Nova tarefa"} size="sm" onPress={() => setOpen(true)} /> : undefined}>
        {active.length === 0 ? <Empty icon="checkbox-outline" title="Sem tarefas" description="Passeio, remédio, escovar dentes… crie uma rotina para o pet." /> : null}
        {active.map((task: PetTask) => (
          <View key={task.id} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Checkbox
                checked={!!task.completedToday}
                disabled={!!task.completedToday || task.status === "PAUSED" || !canComplete}
                onChange={() => complete.mutateAsync({ tid: task.id }).catch((e) => Alert.alert("Erro", errorMessage(e)))}
                label={task.title}
                description={`${describeRule(task.rule, task.dueAt)}${task.status === "PAUSED" ? " · pausada" : ""}${task.lastCompletedAt ? ` · última ${fmtDate(task.lastCompletedAt, "dd/MM")}` : ""}`}
              />
            </View>
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

      <Sheet visible={open} onClose={() => setOpen(false)} title={partnerMode ? "Enviar rotina ao tutor" : "Nova tarefa"}>
        {templates.data?.length ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text variant="small" tone="muted" style={{ marginBottom: 6, fontWeight: "600" }}>
              Modelos
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {templates.data.map((tpl) => (
                <Button key={tpl.title} title={tpl.title} size="sm" variant="secondary" onPress={() => { setTitle(tpl.title); setDescription(tpl.description ?? ""); setFreq(tpl.rule?.freq === "daily" || tpl.rule?.freq === "weekly" ? tpl.rule.freq : "once"); /* API rules: daily|weekly only (seed templates may say "monthly") */ if (tpl.rule?.days) setDays(tpl.rule.days); if (tpl.rule?.times?.[0]) setTime(tpl.rule.times[0]); }} />
              ))}
            </View>
          </View>
        ) : null}
        <Input label="Título" value={title} onChangeText={setTitle} placeholder="Ex.: Passeio da manhã" />
        <Input label="Descrição" value={description} onChangeText={setDescription} multiline />
        <Text variant="small" tone="muted" style={{ marginBottom: 6, fontWeight: "600" }}>
          Frequência
        </Text>
        <Segmented items={[{ key: "once", label: "Avulsa" }, { key: "daily", label: "Diária" }, { key: "weekly", label: "Semanal" }]} value={freq} onChange={setFreq} />
        {freq === "weekly" ? (
          <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.md, flexWrap: "wrap" }}>
            {DAYS.map((d, i) => (
              <Button key={d} title={d} size="sm" variant={days.includes(i) ? "primary" : "secondary"} onPress={() => setDays((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort()))} />
            ))}
          </View>
        ) : null}
        {freq !== "once" ? <Input label="Horário" value={time} onChangeText={setTime} placeholder="HH:MM" style={{ marginTop: spacing.md }} /> : null}
        <Button title={partnerMode ? "Enviar" : "Salvar"} onPress={save} loading={create.isPending} disabled={!title} style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}
