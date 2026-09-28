import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDays, LOCATION_TYPE_LABEL } from "@tinypet/shared";
import { useCreateBooking, usePublicItem, usePublicPartner, useSlots } from "@/hooks/use-public";
import { usePets } from "@/hooks/use-pets";
import { useMyContacts } from "@/hooks/use-me";
import { errorMessage } from "@/lib/api";
import { fmtDate, fmtTime, todayISO } from "@/lib/format";
import { addressText } from "@/lib/nav";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { Address } from "@/lib/types";
import { Avatar, Button, Card, ErrorState, Input, Loading, Screen, Select, Text } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";

type Loc = "PARTNER_VENUE" | "CLIENT_HOME" | "ONLINE";

export default function BookingScreen() {
  const t = useTheme();
  const router = useRouter();
  const { partnerSlug, itemId } = useLocalSearchParams<{ partnerSlug: string; itemId: string }>();
  const partner = usePublicPartner(partnerSlug);
  const item = usePublicItem(itemId);
  const pets = usePets();
  const addresses = useMyContacts<Address>("addresses");
  const booking = useCreateBooking();

  const [petIds, setPetIds] = useState<string[]>([]);
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<string | null>(null);
  const [location, setLocation] = useState<Loc | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const slots = useSlots(partnerSlug, itemId, date);

  const locations: Loc[] = useMemo(() => {
    const l = item.data?.serviceLocations ?? (item.data?.defaultLocation ? [item.data.defaultLocation] : ["PARTNER_VENUE"]);
    return l as Loc[];
  }, [item.data]);
  const loc = location ?? item.data?.defaultLocation ?? locations[0] ?? "PARTNER_VENUE";
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => todayISO(addDays(new Date(), i))), []);
  const activePets = (pets.data ?? []).filter((p) => p.status === "ACTIVE");

  const submit = async () => {
    if (!partner.data || !slot) return;
    try {
      await booking.mutateAsync({ partnerId: partner.data.id, itemId, petIds, startsAt: slot, locationType: loc, addressId: loc === "CLIENT_HOME" ? addressId : null, notes: notes || null });
      Alert.alert("Solicitação enviada", "O parceiro vai confirmar o horário. Você recebe uma notificação.", [{ text: "OK", onPress: () => router.replace("/(tutor)/agenda") }]);
    } catch (e) {
      Alert.alert("Não foi possível agendar", errorMessage(e));
    }
  };

  const loading = partner.isLoading || item.isLoading || pets.isLoading;
  const error = partner.error ?? item.error ?? pets.error;
  const canSubmit = petIds.length > 0 && !!slot && (loc !== "CLIENT_HOME" || !!addressId);

  return (
    <>
      <BackHeader title="Agendar" />
      <Screen keyboard>
        {loading ? <Loading /> : null}
        {error ? <ErrorState error={error} /> : null}
        {partner.data && item.data ? (
          <>
            <Card>
              <Text variant="h3">{item.data.name}</Text>
              <Text variant="small" tone="muted">
                {partner.data.tradeName}
                {item.data.durationMinutes ? ` · ${item.data.durationMinutes} min` : ""}
              </Text>
            </Card>

            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              1. Para qual pet?
            </Text>
            {activePets.length === 0 ? (
              <Button title="Cadastrar um pet primeiro" variant="secondary" onPress={() => router.push("/(tutor)/pets/novo")} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, marginBottom: spacing.lg }}>
                {activePets.map((p) => {
                  const on = petIds.includes(p.id);
                  return (
                    <Pressable key={p.id} onPress={() => setPetIds((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={p.name} style={{ alignItems: "center", width: 68 }}>
                      <View style={{ padding: 2, borderRadius: 34, borderWidth: 2, borderColor: on ? t.primary : "transparent" }}>
                        <Avatar uri={p.avatarUrl} name={p.name} species={p.speciesKey} size={56} />
                      </View>
                      <Text variant="tiny" numberOfLines={1} style={{ marginTop: 4, color: on ? t.primary : t.inkMuted }}>
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              2. Dia
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: spacing.lg }}>
              {days.map((d) => {
                const on = d === date;
                return (
                  <Pressable key={d} onPress={() => { setDate(d); setSlot(null); }} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={fmtDate(d, "EEEE, d 'de' MMMM")} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: on ? t.primary : t.surface, borderWidth: 1, borderColor: on ? t.primary : t.border, alignItems: "center" }}>
                    <Text variant="tiny" style={{ color: on ? t.onPrimary : t.inkMuted, textTransform: "capitalize" }}>
                      {fmtDate(d, "EEE")}
                    </Text>
                    <Text variant="h3" style={{ color: on ? t.onPrimary : t.ink }}>
                      {fmtDate(d, "dd")}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              3. Horário
            </Text>
            {slots.isLoading ? <Loading label="Buscando horários…" /> : null}
            {slots.error ? <ErrorState error={slots.error} onRetry={slots.refetch} /> : null}
            {slots.data?.length === 0 ? (
              <Text variant="small" tone="muted" style={{ marginBottom: spacing.lg }}>
                Sem horários livres neste dia.
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.lg }}>
              {(slots.data ?? []).map((s) => (
                <Button key={`${s.startsAt}-${s.membershipId}`} title={fmtTime(s.startsAt)} size="sm" variant={slot === s.startsAt ? "primary" : "outline"} onPress={() => setSlot(s.startsAt)} />
              ))}
            </View>

            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              4. Local
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md }}>
              {locations.map((l) => (
                <Button key={l} title={LOCATION_TYPE_LABEL[l]} size="sm" variant={loc === l ? "primary" : "outline"} onPress={() => setLocation(l)} />
              ))}
            </View>
            {loc === "CLIENT_HOME" ? (
              (addresses.data ?? []).length === 0 ? (
                <Button title="Cadastrar endereço" variant="secondary" onPress={() => router.push("/(tutor)/conta/enderecos")} style={{ marginBottom: spacing.md }} />
              ) : (
                <Select label="Endereço" value={addressId} onChange={setAddressId} options={(addresses.data ?? []).map((a) => ({ value: a.id, label: a.label || addressText(a), subtitle: a.label ? addressText(a) : undefined }))} placeholder="Escolha o endereço" />
              )
            ) : null}

            <Input label="Observações" multiline value={notes} onChangeText={setNotes} placeholder="Algo que o parceiro precise saber?" />
            <Button title="Solicitar horário" size="lg" onPress={submit} loading={booking.isPending} disabled={!canSubmit} />
            <Text variant="tiny" tone="faint" style={{ textAlign: "center", marginTop: 8 }}>
              O horário fica reservado após a confirmação do parceiro.
            </Text>
          </>
        ) : null}
      </Screen>
    </>
  );
}
