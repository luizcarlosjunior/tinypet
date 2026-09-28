import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useSkillComparison, useSkillMutations, useSkills } from "@/hooks/use-pets";
import { errorMessage } from "@/lib/api";
import { fmtDate, todayISO } from "@/lib/format";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { PetSkill } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorState, Input, ListItem, Loading, Section, Segmented, Select, Sheet, Text } from "@/components/ui";

const LEVELS = [{ key: "LEARNING", label: "Aprendendo" }, { key: "SOMETIMES", label: "Às vezes" }, { key: "MASTERED", label: "Domina" }] as const;
type Level = PetSkill["level"];
const levelTone = { LEARNING: "warning", SOMETIMES: "info", MASTERED: "success" } as const;
const levelLabel = (l: Level) => LEVELS.find((x) => x.key === l)?.label ?? l;

type Chip = "breed" | "state" | "city" | "nearMe";
const CHIPS: { key: Chip; label: string }[] = [{ key: "breed", label: "Mesma raça" }, { key: "state", label: "Estado" }, { key: "city", label: "Cidade" }, { key: "nearMe", label: "Perto de mim" }];

/** Comandos: skill list with level picker, trainer validation, comparison card with filter chips. */
export function ComandosTab({ petId, canEdit, canValidate }: { petId: string; canEdit: boolean; canValidate: boolean }) {
  const t = useTheme();
  const q = useSkills(petId);
  const { upsert, remove, validate } = useSkillMutations(petId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PetSkill | null>(null);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [level, setLevel] = useState<Level>("LEARNING");
  const [chips, setChips] = useState<Chip[]>(["breed"]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const filters: Record<string, string | number | boolean | undefined> = { breed: chips.includes("breed") || undefined, state: chips.includes("state") || undefined, city: chips.includes("city") || undefined, nearMe: chips.includes("nearMe") || undefined, lat: coords?.lat, lng: coords?.lng };
  const cmp = useSkillComparison(petId, filters, (q.data?.skills.length ?? 0) > 0);

  const toggleChip = async (c: Chip) => {
    if (c === "nearMe" && !chips.includes("nearMe") && !coords) {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        /* falls back to the primary address on the server */
      }
    }
    setChips((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const openNew = () => {
    setEditing(null);
    setSkillId(null);
    setCustomName("");
    setLevel("LEARNING");
    setOpen(true);
  };
  const openEdit = (s: PetSkill) => {
    setEditing(s);
    setSkillId(s.skillId);
    setCustomName("");
    setLevel(s.level);
    setOpen(true);
  };
  const save = async () => {
    try {
      await upsert.mutateAsync({ skillId: skillId ?? undefined, customName: !skillId && customName ? customName : undefined, level, masteredAt: level === "MASTERED" ? todayISO() : null });
      setOpen(false);
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const skills = q.data?.skills ?? [];
  const available = (q.data?.available ?? []).filter((a) => !skills.some((s) => s.skillId === a.id));
  const mastered = skills.filter((s) => s.level === "MASTERED").length;

  return (
    <View>
      {skills.length > 0 ? (
        <Card style={{ backgroundColor: t.primarySoft, borderColor: t.primary }}>
          <Text variant="h3">Comparativo</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: spacing.sm }}>
            {CHIPS.map((c) => {
              const on = chips.includes(c.key);
              return (
                <Pressable key={c.key} onPress={() => toggleChip(c.key)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={c.label} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: on ? t.primary : t.surface, borderWidth: 1, borderColor: on ? t.primary : t.border }}>
                  <Text variant="tiny" style={{ color: on ? t.onPrimary : t.inkMuted }}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {cmp.isLoading ? (
            <Text variant="small" tone="muted">
              Calculando…
            </Text>
          ) : cmp.data ? (
            <View>
              <Text>
                {mastered} {mastered === 1 ? "comando dominado" : "comandos dominados"} — sabe mais que <Text style={{ fontWeight: "700" }}>{Math.round(cmp.data.summary.percentile)}%</Text> dos pets {cmp.data.scope ? `(${cmp.data.scope})` : ""}
              </Text>
              <Text variant="tiny" tone="muted" style={{ marginTop: 4 }}>
                Grupo de {cmp.data.groupSize} pets{cmp.data.widened ? " · escopo ampliado por falta de pets suficientes" : ""}. Atualizado diariamente.
              </Text>
            </View>
          ) : (
            <Text variant="small" tone="muted">
              Comparativo indisponível.
            </Text>
          )}
        </Card>
      ) : null}

      <Section title="Comandos" right={canEdit ? <Button title="Adicionar" size="sm" onPress={openNew} /> : undefined}>
        {skills.length === 0 ? <Empty icon="school-outline" title="Nenhum comando registrado" description="Marque o que o pet já sabe fazer: senta, deita, fica…" /> : null}
        {skills.map((s) => {
          const pct = cmp.data?.perSkill.find((p) => p.skillId === s.skillId)?.pct;
          return (
            <ListItem
              key={s.skillId}
              title={s.name}
              subtitle={[s.masteredAt ? `dominado em ${fmtDate(s.masteredAt)}` : null, pct != null ? `${Math.round(pct)}% dos pets semelhantes dominam` : null, s.markedBy ? `marcado por ${s.markedBy}` : null].filter(Boolean).join(" · ") || null}
              onPress={canEdit ? () => openEdit(s) : undefined}
              chevron={false}
              right={
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Badge label={levelLabel(s.level)} tone={levelTone[s.level]} />
                  {s.validated ? <Badge label="Validado por adestrador" tone="primary" icon="ribbon" /> : canValidate ? <Button title="Validar" size="sm" variant="outline" onPress={() => validate.mutateAsync(s.skillId).catch((e) => Alert.alert("Erro", errorMessage(e)))} /> : null}
                </View>
              }
            />
          );
        })}
      </Section>

      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? editing.name : "Novo comando"}>
        {!editing ? (
          <>
            <Select label="Comando" value={skillId} onChange={setSkillId} options={available.map((a) => ({ value: a.id, label: a.name }))} searchable allowClear placeholder="Escolha da lista" />
            {!skillId ? <Input label="Ou crie um personalizado" value={customName} onChangeText={setCustomName} placeholder="Ex.: buscar a bolinha" hint="Comandos personalizados ficam fora do comparativo" /> : null}
          </>
        ) : null}
        <Text variant="small" tone="muted" style={{ marginBottom: 6, fontWeight: "600" }}>
          Nível
        </Text>
        <Segmented items={LEVELS.map((l) => ({ key: l.key, label: l.label }))} value={level} onChange={setLevel} />
        <View style={{ height: spacing.lg }} />
        <Button title="Salvar" onPress={save} loading={upsert.isPending} disabled={!editing && !skillId && !customName} />
        {editing ? (
          <Button
            title="Remover comando"
            variant="ghost"
            style={{ marginTop: spacing.sm }}
            onPress={() => {
              const id = editing.skillId;
              setOpen(false);
              remove.mutateAsync(id).catch((e) => Alert.alert("Erro", errorMessage(e)));
            }}
          />
        ) : null}
      </Sheet>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm }}>
        <Ionicons name="information-circle-outline" size={14} color={t.inkFaint} />
        <Text variant="tiny" tone="faint">
          Quando o adestrador vinculado confirma, o comando ganha o selo de validado.
        </Text>
      </View>
    </View>
  );
}
