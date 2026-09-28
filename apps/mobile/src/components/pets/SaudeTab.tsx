import React, { useState } from "react";
import { Alert, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useMeasurementMutations, useMeasurements, useVaccinationMutations, useVaccinations } from "@/hooks/use-pets";
import { API_BASE, errorMessage } from "@/lib/api";
import { fmtDate, fmtWeight, todayISO } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { Measurement, MeasurementsResponse } from "@/lib/types";
import { Badge, Button, Card, ErrorState, Input, ListItem, Loading, Section, Segmented, Sheet, Text } from "@/components/ui";
import { WeightChart } from "./WeightChart";

type Period = "6m" | "1y" | "all";

/** Saúde: vaccination card + measurements list + weight chart. */
export function SaudeTab({ petId, canEdit }: { petId: string; canEdit: boolean }) {
  const t = useTheme();
  const [period, setPeriod] = useState<Period>("6m");
  const vacc = useVaccinations(petId);
  const meas = useMeasurements(petId, period);
  const vaccM = useVaccinationMutations(petId);
  const measM = useMeasurementMutations(petId);
  const [vaccOpen, setVaccOpen] = useState(false);
  const [measOpen, setMeasOpen] = useState(false);
  const [vf, setVf] = useState({ kind: "VACCINE" as "VACCINE" | "DEWORMING", name: "", appliedAt: todayISO(), nextDueAt: "", notes: "" });
  const [mf, setMf] = useState({ measuredAt: todayISO(), weightG: "", heightCm: "", neckCm: "", chestCm: "", abdomenCm: "", bodyScore: "", notes: "" });

  const data: MeasurementsResponse = Array.isArray(meas.data) ? { items: meas.data } : (meas.data ?? { items: [] });
  const items = data.items ?? [];

  const saveVacc = async () => {
    try {
      await vaccM.create.mutateAsync({ ...vf, nextDueAt: vf.nextDueAt || null, notes: vf.notes || null });
      setVaccOpen(false);
      setVf({ kind: "VACCINE", name: "", appliedAt: todayISO(), nextDueAt: "", notes: "" });
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };
  const saveMeas = async () => {
    const num = (v: string) => (v ? Number(v.replace(",", ".")) : null);
    const kg = num(mf.weightG);
    try {
      await measM.create.mutateAsync({
        measuredAt: mf.measuredAt,
        weightG: kg != null ? Math.round(kg * 1000) : 0,
        heightCm: num(mf.heightCm),
        neckCm: num(mf.neckCm),
        chestCm: num(mf.chestCm),
        abdomenCm: num(mf.abdomenCm),
        bodyScore: num(mf.bodyScore),
        notes: mf.notes || null,
      });
      setMeasOpen(false);
      setMf({ measuredAt: todayISO(), weightG: "", heightCm: "", neckCm: "", chestCm: "", abdomenCm: "", bodyScore: "", notes: "" });
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };

  return (
    <View>
      <Section title="Peso e medidas" right={canEdit ? <Button title="Registrar" size="sm" onPress={() => setMeasOpen(true)} /> : undefined}>
        <Segmented items={[{ key: "6m", label: "6 meses" }, { key: "1y", label: "1 ano" }, { key: "all", label: "Vida toda" }]} value={period} onChange={setPeriod} />
        <View style={{ height: spacing.md }} />
        {meas.isLoading ? <Loading /> : meas.error ? <ErrorState error={meas.error} onRetry={meas.refetch} /> : null}
        {data.alerts?.map((a, i) => (
          <Card key={i} style={{ backgroundColor: t.warningSoft, borderColor: t.warning }}>
            <Text variant="small" style={{ color: t.warning }}>
              {a.message}
            </Text>
          </Card>
        ))}
        {items.length ? (
          <Card>
            <WeightChart items={items} reference={data.reference} />
          </Card>
        ) : !meas.isLoading ? (
          <Text tone="muted" variant="small">
            Nenhuma pesagem no período.
          </Text>
        ) : null}
        {items.slice(0, 20).map((m: Measurement) => (
          <ListItem
            key={m.id}
            title={fmtWeight(m.weightG)}
            subtitle={[fmtDate(m.measuredAt), m.heightCm ? `alt. ${m.heightCm} cm` : null, m.chestCm ? `tórax ${m.chestCm} cm` : null, m.bodyScore ? `ECC ${m.bodyScore}` : null, m.notes].filter(Boolean).join(" · ")}
            right={m.vetVerified ? <Badge label="Aferido por veterinário" tone="info" icon="checkmark-circle" /> : m.recordedBy === "PARTNER" || m.partnerId ? <Badge label="Parceiro" /> : undefined}
            chevron={false}
          />
        ))}
        {items.length ? <Button title="Exportar histórico (PDF)" variant="ghost" size="sm" icon="download-outline" style={{ marginTop: spacing.sm }} onPress={() => WebBrowser.openBrowserAsync(`${API_BASE}/pets/${petId}/measurements/export`)} /> : null}
      </Section>

      <Section title="Vacinas e vermífugos" right={canEdit ? <Button title="Adicionar" size="sm" onPress={() => setVaccOpen(true)} /> : undefined}>
        {vacc.isLoading ? <Loading /> : vacc.error ? <ErrorState error={vacc.error} onRetry={vacc.refetch} /> : null}
        {(vacc.data ?? []).length === 0 && !vacc.isLoading ? (
          <Text tone="muted" variant="small">
            Nenhuma dose registrada.
          </Text>
        ) : null}
        {(vacc.data ?? []).map((v) => {
          const overdue = v.nextDueAt && v.nextDueAt < todayISO();
          return (
            <ListItem
              key={v.id}
              title={v.name}
              subtitle={`${v.kind === "DEWORMING" ? "Vermífugo" : "Vacina"} · aplicada em ${fmtDate(v.appliedAt)}${v.nextDueAt ? ` · próxima ${fmtDate(v.nextDueAt)}` : ""}${v.partner ? ` · ${v.partner.tradeName}` : ""}`}
              right={v.nextDueAt ? <Badge label={overdue ? "Atrasada" : "Em dia"} tone={overdue ? "danger" : "success"} /> : undefined}
              chevron={false}
            />
          );
        })}
      </Section>

      <Sheet visible={vaccOpen} onClose={() => setVaccOpen(false)} title="Nova dose">
        <Segmented items={[{ key: "VACCINE", label: "Vacina" }, { key: "DEWORMING", label: "Vermífugo" }]} value={vf.kind} onChange={(k) => setVf({ ...vf, kind: k })} />
        <View style={{ height: spacing.md }} />
        <Input label="Nome" value={vf.name} onChangeText={(v) => setVf({ ...vf, name: v })} placeholder="V10, antirrábica…" />
        <Input label="Data de aplicação" placeholder="AAAA-MM-DD" value={vf.appliedAt} onChangeText={(v) => setVf({ ...vf, appliedAt: v })} />
        <Input label="Próxima dose" placeholder="AAAA-MM-DD" value={vf.nextDueAt} onChangeText={(v) => setVf({ ...vf, nextDueAt: v })} />
        <Input label="Observações" value={vf.notes} onChangeText={(v) => setVf({ ...vf, notes: v })} />
        <Button title="Salvar" onPress={saveVacc} loading={vaccM.create.isPending} disabled={!vf.name} />
      </Sheet>
      <Sheet visible={measOpen} onClose={() => setMeasOpen(false)} title="Nova medição">
        <Input label="Data" placeholder="AAAA-MM-DD" value={mf.measuredAt} onChangeText={(v) => setMf({ ...mf, measuredAt: v })} />
        <Input label="Peso (kg)" keyboardType="decimal-pad" value={mf.weightG} onChangeText={(v) => setMf({ ...mf, weightG: v })} placeholder="Ex.: 12,5" />
        <Input label="Altura na cernelha (cm)" keyboardType="decimal-pad" value={mf.heightCm} onChangeText={(v) => setMf({ ...mf, heightCm: v })} />
        <Input label="Pescoço (cm)" keyboardType="decimal-pad" value={mf.neckCm} onChangeText={(v) => setMf({ ...mf, neckCm: v })} />
        <Input label="Tórax (cm)" keyboardType="decimal-pad" value={mf.chestCm} onChangeText={(v) => setMf({ ...mf, chestCm: v })} />
        <Input label="Abdômen (cm)" keyboardType="decimal-pad" value={mf.abdomenCm} onChangeText={(v) => setMf({ ...mf, abdomenCm: v })} />
        <Input label="Escore corporal (1 a 9)" keyboardType="number-pad" value={mf.bodyScore} onChangeText={(v) => setMf({ ...mf, bodyScore: v })} />
        <Input label="Observações" value={mf.notes} onChangeText={(v) => setMf({ ...mf, notes: v })} />
        <Button title="Salvar" onPress={saveMeas} loading={measM.create.isPending} disabled={!mf.weightG} />
      </Sheet>
    </View>
  );
}
