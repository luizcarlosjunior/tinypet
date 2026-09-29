import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, useTheme } from "@/lib/theme";
import { errorMessage } from "@/lib/api";
import { Button } from "./Button";
import { Text } from "./Text";

export function Empty({ icon = "paw-outline", title, description, action, onAction }: { icon?: keyof typeof Ionicons.glyphMap; title: string; description?: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.wrap} accessibilityLabel={title}>
      <View style={[styles.iconWrap, { backgroundColor: t.primarySoft }]}>
        <Ionicons name={icon} size={28} color={t.primary} />
      </View>
      <Text variant="h3" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {description ? (
        <Text variant="small" tone="muted" style={{ textAlign: "center", marginTop: 6 }}>
          {description}
        </Text>
      ) : null}
      {action && onAction ? <Button title={action} onPress={onAction} style={{ marginTop: spacing.lg }} /> : null}
    </View>
  );
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={styles.wrap} accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={t.primary} size="large" />
      <Text variant="small" tone="muted" style={{ marginTop: spacing.md }}>
        {label}
      </Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return <Empty icon="alert-circle-outline" title="Não foi possível carregar" description={errorMessage(error)} action={onRetry ? "Tentar novamente" : undefined} onAction={onRetry} />;
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
});
