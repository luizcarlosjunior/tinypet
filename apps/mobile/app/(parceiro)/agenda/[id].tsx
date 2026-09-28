import React, { useState } from "react";
import { Alert, Linking, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { APPOINTMENT_STATUS_LABEL } from "@tinypet/shared";
import { useAppointmentStatus, useScheduleAppointment } from "@/hooks/use-partner";
import { errorMessage } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { pickAndUpload } from "@/lib/upload";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Avatar, Badge, Button, Card, ErrorState, Input, KeyValue, ListItem, Loading, Screen, Sheet, Text } from "@/components/ui";
import { statusTone } from "@/components/ui/Badge";
import { AddressBlock, LocationBadge, MapsButtons } from "@/components/appointments/AppointmentCard";
import { BackHeader } from "@/components/BackHeader";

export default function PartnerAppointmentDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useScheduleAppointment(id);
  const status = useAppointmentStatus();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [report, setReport] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [reason, setReason] = useState("");
  const a = q.data;

  const change = async (s: NonNullable<typeof a>["status"], extra: Record<string, unknown> = {}) => {
    try {
      await status.mutateAsync({ id, status: s, ...extra });
      setCompleteOpen(false);
      setCancelOpen(false);
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };
  const addPhoto = async () => {
    setUploading(true);
    try {
      const up = await pickAndUpload("ATTACHMENT");
      if (up) setPhotos((p) => [...p, up.url]);
    } catch (e) {
      Alert.alert("Erro no envio", errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <BackHeader title="Atendimento" fallback="/(parceiro)/agenda" />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {a ? (
          <>
            <Text variant="title">{a.item?.name ?? a.title ?? "Atendimento"}</Text>
            <Text tone="muted">{fmtDateTime(a.startsAt)} · {a.durationMinutes} min</Text>
            <View style={{ flexDirection: "row", gap: 6, marginVertical: spacing.md, flexWrap: "wrap" }}>
              <Badge label={APPOINTMENT_STATUS_LABEL[a.status]} tone={statusTone(a.status)} />
              <LocationBadge type={a.locationType} />
              {a.travelLeg?.alert ? <Badge label={a.travelLeg.alert} tone="warning" icon="warning" /> : null}
            </View>
            <Card>
              {a.client ? <ListItem title={a.client.name} subtitle="Cliente" onPress={() => router.push(`/(parceiro)/clientes/${a.client!.id}`)} /> : null}
              {(a.pets ?? []).map((p) => (
                <ListItem key={p.id} title={p.name} subtitle="Pet" left={<Avatar uri={p.avatarUrl} name={p.name} species={p.speciesKey} size={36} />} onPress={a.client ? () => router.push(`/(parceiro)/clientes/${a.client!.id}/pets/${p.id}`) : undefined} />
              ))}
              <KeyValue k="Profissional" v={a.membership?.user?.name ?? a.membership?.name} />
              <KeyValue k="Observações" v={a.notes} />
              {a.client?.phone ? <Button title="Ligar / WhatsApp" size="sm" variant="ghost" icon="call-outline" style={{ alignSelf: "flex-start" }} onPress={() => Linking.openURL(`https://wa.me/${a.client!.phone!.replace(/\D/g, "")}`)} /> : null}
            </Card>
            {a.locationType !== "ONLINE" ? (
              <Card>
                <Text variant="h3">Local</Text>
                <AddressBlock address={a.address} notes={a.locationNotes} />
                {a.travelLeg ? (
                  <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
                    Deslocamento: {a.travelLeg.distanceKm?.toFixed(1) ?? "?"} km · {a.travelLeg.minutes != null ? Math.round(a.travelLeg.minutes) : "?"} min{a.travelLeg.estimated ? " (estimativa)" : ""}
                  </Text>
                ) : null}
                {a.locationType === "CLIENT_HOME" || a.locationType === "OTHER" ? <MapsButtons address={a.address} /> : null}
              </Card>
            ) : null}
            {a.report || a.reportPhotos?.length ? (
              <Card>
                <Text variant="h3">Relato</Text>
                {a.report ? <Text style={{ marginTop: 4 }}>{a.report}</Text> : null}
                {a.nextSteps ? <Text variant="small" tone="muted" style={{ marginTop: 4 }}>Próximos passos: {a.nextSteps}</Text> : null}
                <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.sm, flexWrap: "wrap" }}>
                  {(a.reportPhotos ?? []).map((p) => (
                    <Image key={p} source={{ uri: p }} style={{ width: 72, height: 72, borderRadius: radius.sm }} contentFit="cover" />
                  ))}
                </View>
              </Card>
            ) : null}

            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {a.status === "REQUESTED" ? <Button title="Confirmar" icon="checkmark" onPress={() => change("CONFIRMED")} loading={status.isPending} /> : null}
              {a.status === "CONFIRMED" ? <Button title="Iniciar atendimento" icon="play" onPress={() => change("IN_PROGRESS")} loading={status.isPending} /> : null}
              {a.status === "IN_PROGRESS" || a.status === "CONFIRMED" ? <Button title="Concluir com relato" icon="checkmark-done" variant={a.status === "IN_PROGRESS" ? "primary" : "secondary"} onPress={() => setCompleteOpen(true)} /> : null}
              {a.status === "REQUESTED" || a.status === "CONFIRMED" ? (
                <>
                  <Button title="Não compareceu" variant="outline" icon="person-remove-outline" onPress={() => Alert.alert("Marcar como não compareceu?", undefined, [{ text: "Voltar", style: "cancel" }, { text: "Confirmar", style: "destructive", onPress: () => change("NO_SHOW") }])} />
                  <Button title="Cancelar atendimento" variant="ghost" onPress={() => setCancelOpen(true)} />
                </>
              ) : null}
            </View>
          </>
        ) : null}
      </Screen>

      <Sheet visible={completeOpen} onClose={() => setCompleteOpen(false)} title="Concluir atendimento">
        <Input label="Relato" multiline value={report} onChangeText={setReport} placeholder="Como foi o atendimento?" />
        <Input label="Próximos passos" multiline value={nextSteps} onChangeText={setNextSteps} />
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: spacing.md }}>
          {photos.map((p) => (
            <Image key={p} source={{ uri: p }} style={{ width: 64, height: 64, borderRadius: radius.sm, backgroundColor: t.surfaceAlt }} contentFit="cover" />
          ))}
          <Button title="Foto" size="sm" variant="secondary" icon="camera-outline" onPress={addPhoto} loading={uploading} />
        </View>
        <Text variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
          Relato e fotos vão para o histórico do pet e o tutor é notificado.
        </Text>
        <Button title="Concluir" onPress={() => change("COMPLETED", { report: report || null, nextSteps: nextSteps || null, reportPhotos: photos })} loading={status.isPending} />
      </Sheet>
      <Sheet visible={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar atendimento">
        <Input label="Motivo" multiline value={reason} onChangeText={setReason} />
        <Button title="Confirmar cancelamento" variant="danger" onPress={() => change("CANCELED", { cancelReason: reason || null })} loading={status.isPending} />
      </Sheet>
    </>
  );
}
