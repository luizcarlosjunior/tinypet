import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { toE164BR } from "@tinypet/shared";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { spacing } from "@/lib/theme";
import { Button, Input, Screen, Segmented, Text } from "@/components/ui";

type Channel = "EMAIL" | "PHONE";

export default function Verify() {
  const router = useRouter();
  const { user, refresh, activePartnerId } = useAuth();
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await api("/auth/verify", { method: "POST", json: { channel, target: channel === "PHONE" && target.trim() ? toE164BR(target) : undefined } });
      setSent(true);
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    } finally {
      setSending(false);
    }
  };
  const confirm = async () => {
    setConfirming(true);
    try {
      await api("/auth/verify", { method: "PUT", json: { channel, code } });
      await refresh().catch(() => {});
      Alert.alert("Verificado", channel === "EMAIL" ? "E-mail confirmado." : "Telefone confirmado.");
      router.replace(activePartnerId ? "/(parceiro)/agenda" : "/(tutor)/inicio");
    } catch (e) {
      Alert.alert("Código inválido", errorMessage(e));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Screen keyboard>
      <Text variant="h2">Confirme seu contato</Text>
      <Text tone="muted" style={{ marginBottom: spacing.lg }}>
        Enviamos um código de 6 dígitos para {channel === "EMAIL" ? user?.email ?? "seu e-mail" : "seu telefone"}.
      </Text>
      <Segmented items={[{ key: "EMAIL", label: "E-mail" }, { key: "PHONE", label: "Telefone" }]} value={channel} onChange={(c) => { setChannel(c); setSent(false); }} />
      {channel === "PHONE" ? <Input label="Celular" keyboardType="phone-pad" value={target} onChangeText={setTarget} placeholder="(11) 99999-9999" hint="Deixe em branco para usar o telefone principal da conta" style={{ marginTop: spacing.md }} /> : null}
      <Button title={sent ? "Reenviar código" : "Enviar código"} variant={sent ? "secondary" : "primary"} onPress={send} loading={sending} style={{ marginTop: spacing.lg }} />
      {sent ? (
        <>
          <Input label="Código" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} style={{ marginTop: spacing.lg }} />
          <Button title="Confirmar" onPress={confirm} loading={confirming} disabled={code.length !== 6} />
        </>
      ) : null}
      <Button title="Fazer isso depois" variant="ghost" onPress={() => router.replace(activePartnerId ? "/(parceiro)/agenda" : "/(tutor)/inicio")} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
