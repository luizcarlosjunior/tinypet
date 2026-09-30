import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MEDIA_REPORT_REASONS, type MediaReportReasonKey } from "@tinypet/shared";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Button, Input, Sheet, Text } from "@/components/ui";

/**
 * "Denunciar" for a photo/video that breaks the community rules (POST /media/report). `url` is the media URL on screen.
 * False reports can be sanctioned, which the sheet says up front.
 */
export function ReportMediaButton({ url, kind = "IMAGE" }: { url: string; kind?: "IMAGE" | "VIDEO" }) {
  const t = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<MediaReportReasonKey | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const what = kind === "VIDEO" ? "vídeo" : "foto";
  const needsDetails = reason === "OTHER" && details.trim().length < 5;

  const submit = async () => {
    if (!reason || needsDetails) return;
    setBusy(true);
    try {
      await api("/media/report", { method: "POST", json: { url, reason, details: details.trim() || null }, partnerId: null });
      setOpen(false);
      setReason(null);
      setDetails("");
      Alert.alert("Denúncia enviada", "Nossa equipe vai analisar. Obrigado por ajudar a manter a comunidade segura.");
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable onPress={() => (token ? setOpen(true) : router.push("/(auth)/entrar"))} accessibilityRole="button" accessibilityLabel={`Denunciar ${what}`} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}>
        <Ionicons name="flag-outline" size={14} color={t.inkMuted} />
        <Text variant="small" tone="muted">
          Denunciar
        </Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={`Denunciar ${what}`}>
        <Text variant="small" tone="muted" style={{ marginBottom: spacing.sm }}>
          Qual regra da comunidade este conteúdo não segue?
        </Text>
        {MEDIA_REPORT_REASONS.map((r) => {
          const on = reason === r.key;
          return (
            <Pressable key={r.key} onPress={() => setReason(r.key)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.sm, marginBottom: 6, borderRadius: radius.md, borderWidth: 1, borderColor: on ? t.primary : t.border, backgroundColor: on ? t.primarySoft : "transparent" }}>
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? t.primary : t.inkMuted} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }}>{r.label}</Text>
                <Text variant="small" tone="muted">
                  {r.description}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Input label={reason === "OTHER" ? "Descreva o problema *" : "Detalhes (opcional)"} value={details} onChangeText={setDetails} multiline maxLength={1000} />
        <Text variant="small" tone="muted" style={{ marginBottom: spacing.md }}>
          Denúncias falsas ou de má-fé podem levar à suspensão da conta ou ao bloqueio de novas denúncias.
        </Text>
        <Button title="Enviar denúncia" variant="danger" onPress={submit} loading={busy} disabled={!reason || needsDetails} />
      </Sheet>
    </>
  );
}
