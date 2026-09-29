import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fromZonedTime } from "date-fns-tz";
import { APPOINTMENT_STATUS_LABEL, DEFAULT_TIMEZONE } from "@tinypet/shared";
import { useAppointmentActions, useMyAppointment } from "@/hooks/use-me";
import { errorMessage } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import { Badge, Button, Card, ErrorState, Input, KeyValue, Loading, Screen, Sheet, Text } from "@/components/ui";
import { statusTone } from "@/components/ui/Badge";
import { AddressBlock, LocationBadge, MapsButtons, appointmentAddress } from "@/components/appointments/AppointmentCard";
import { BackHeader } from "@/components/BackHeader";

export default function TutorAppointmentDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useMyAppointment(id);
  const { cancel, reschedule } = useAppointmentActions();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reschedOpen, setReschedOpen] = useState(false);
  const [newDate, setNewDate] = useState("");

  const a = q.data;
  // canManage=false: shared account (doesn't own every pet) — the API answers 403 to cancel/reschedule.
  const canAct = a && a.canManage !== false && (a.status === "REQUESTED" || a.status === "CONFIRMED");
  const address = a ? appointmentAddress(a, "owner") : null;
  const cancellationHours = a?.partner?.cancellationHours;

  const doCancel = async () => {
    if (!a) return;
    try {
      await cancel.mutateAsync({ id: a.id, reason });
      setCancelOpen(false);
      Alert.alert("Cancelado", "O parceiro foi avisado.");
    } catch (e) {
      Alert.alert("Não foi possível cancelar", errorMessage(e));
    }
  };
  const doReschedule = async () => {
    if (!a) return;
    // Typed time is São Paulo wall-clock time, whatever the device timezone is.
    const iso = fromZonedTime(newDate.replace(" ", "T") + ":00", DEFAULT_TIMEZONE).toISOString();
    try {
      await reschedule.mutateAsync({ id: a.id, startsAt: iso });
      setReschedOpen(false);
      Alert.alert("Proposta enviada", "O parceiro precisa confirmar o novo horário.");
    } catch (e) {
      Alert.alert("Não foi possível remarcar", errorMessage(e));
    }
  };

  return (
    <>
      <BackHeader title="Visita" fallback="/(tutor)/agenda" />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {!q.isLoading && !q.error && !a ? <ErrorState error={new Error("Agendamento não encontrado")} /> : null}
        {a ? (
          <>
            <Text variant="title">{a.item?.name ?? a.title ?? "Atendimento"}</Text>
            <Text tone="muted">{fmtDateTime(a.startsAt)} · {a.durationMinutes} min</Text>
            <View style={{ flexDirection: "row", gap: 6, marginVertical: spacing.md, flexWrap: "wrap" }}>
              <Badge label={APPOINTMENT_STATUS_LABEL[a.status]} tone={statusTone(a.status)} />
              <LocationBadge type={a.locationType} />
            </View>
            <Card>
              <KeyValue k="Parceiro" v={a.partner?.tradeName} />
              <KeyValue k="Pets" v={(a.pets ?? []).map((p) => p.name).join(", ")} />
              <KeyValue k="Profissional" v={a.membership?.user?.name ?? a.membership?.name} />
              <KeyValue k="Observações" v={a.notes} />
              {a.cancelReason ? <KeyValue k="Motivo" v={a.cancelReason} /> : null}
            </Card>
            {a.locationType !== "ONLINE" ? (
              <Card>
                <Text variant="h3">Como chegar</Text>
                <AddressBlock address={address} notes={a.locationNotes} />
                {address ? <MapsButtons address={address} /> : <Text variant="small" tone="muted">Endereço não informado.</Text>}
              </Card>
            ) : null}
            {a.status === "COMPLETED" && (a.report || a.nextSteps) ? (
              <Card>
                <Text variant="h3">Relato do atendimento</Text>
                {a.report ? <Text style={{ marginTop: 4 }}>{a.report}</Text> : null}
                {a.nextSteps ? (
                  <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
                    Próximos passos: {a.nextSteps}
                  </Text>
                ) : null}
              </Card>
            ) : null}
            {a.status === "COMPLETED" && a.item ? <Button title="Avaliar serviço" icon="star-outline" variant="secondary" onPress={() => router.push(`/(tutor)/item/${a.item!.id}?review=1`)} /> : null}
            {canAct ? (
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <Button title="Pedir remarcação" variant="outline" icon="time-outline" onPress={() => setReschedOpen(true)} />
                <Button title="Cancelar visita" variant="ghost" icon="close-circle-outline" onPress={() => setCancelOpen(true)} />
                {cancellationHours ? (
                  <Text variant="tiny" tone="faint" style={{ textAlign: "center" }}>
                    Cancelamento gratuito até {cancellationHours}h antes.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </Screen>
      <Sheet visible={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar visita">
        <Input label="Motivo" value={reason} onChangeText={setReason} multiline placeholder="Conte ao parceiro o motivo" />
        <Button title="Confirmar cancelamento" variant="danger" onPress={doCancel} loading={cancel.isPending} disabled={reason.trim().length < 2} />
      </Sheet>
      <Sheet visible={reschedOpen} onClose={() => setReschedOpen(false)} title="Pedir remarcação">
        <Input label="Novo horário" value={newDate} onChangeText={setNewDate} placeholder="AAAA-MM-DD HH:MM" hint="O parceiro receberá a proposta e precisa confirmar" />
        <Button title="Enviar proposta" onPress={doReschedule} loading={reschedule.isPending} disabled={!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(newDate)} style={{ backgroundColor: t.primary }} />
      </Sheet>
    </>
  );
}
