import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fmtDate } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { Review } from "@/lib/types";
import { Avatar, Badge, Card, Text } from "@/components/ui";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row" }} accessibilityLabel={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= Math.round(value) ? "star" : "star-outline"} size={size} color={t.warning} />
      ))}
    </View>
  );
}

export function ReviewRow({ r }: { r: Review }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Avatar uri={r.user?.avatarUrl} name={r.user?.name ?? "Cliente"} size={32} />
        <View style={{ flex: 1 }}>
          <Text variant="small" style={{ fontWeight: "600" }}>
            {r.user?.name ?? "Cliente"}
          </Text>
          <Text variant="tiny" tone="faint">
            {fmtDate(r.createdAt)}
          </Text>
        </View>
        <Stars value={r.rating} />
        {r.verified ? <Badge label="Cliente verificado" tone="success" icon="checkmark-circle" /> : null}
      </View>
      {r.comment ? <Text variant="small" style={{ marginTop: 6 }}>{r.comment}</Text> : null}
      {r.reply ? (
        <Text variant="small" tone="muted" style={{ marginTop: 6 }}>
          Resposta do parceiro: {r.reply.body}
        </Text>
      ) : null}
    </Card>
  );
}

