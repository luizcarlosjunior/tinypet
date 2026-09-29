import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useMarkNotificationsRead, useNotifications } from "@/hooks/use-me";
import { fmtRelative } from "@/lib/format";
import { safePushRoute } from "@/lib/push";
import { useTheme } from "@/lib/theme";
import type { Notification } from "@/lib/types";
import { Button, Empty, ErrorState, ListItem, Loading, Screen } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";

type Side = "tutor" | "partner";

/** In-app screen for a notification: allowlisted `data.route`, else derived from the ids in `data`. */
export function notificationRoute(n: Notification, side: Side): string | null {
  const data = (n.data ?? {}) as Record<string, unknown>;
  const route = safePushRoute(data.route);
  if (route) return route;
  const id = (k: string) => (typeof data[k] === "string" && /^[\w-]+$/.test(data[k] as string) ? (data[k] as string) : null);
  if (side === "partner") {
    if (id("appointmentId")) return `/(parceiro)/agenda/${id("appointmentId")}`;
    if (id("clientId")) return `/(parceiro)/clientes/${id("clientId")}`;
    return null;
  }
  if (id("appointmentId")) return `/(tutor)/agenda/${id("appointmentId")}`;
  if (id("contractId")) return `/(tutor)/contratos/${id("contractId")}`;
  if (id("installmentId")) return "/(tutor)/contratos";
  if (id("petId")) return `/(tutor)/pets/${id("petId")}`;
  return null;
}

/** Notifications list shared by the tutor (Conta) and partner (Mais) areas. */
export function NotificationsList({ side, fallback }: { side: Side; fallback: string }) {
  const t = useTheme();
  const router = useRouter();
  const q = useNotifications();
  const mark = useMarkNotificationsRead();
  return (
    <>
      <BackHeader title="Notificações" fallback={fallback} right={<Button title="Marcar lidas" size="sm" variant="ghost" onPress={() => mark.mutate()} loading={mark.isPending} />} />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {q.data?.length === 0 ? <Empty icon="notifications-outline" title="Nenhuma notificação" /> : null}
        {(q.data ?? []).map((n) => {
          const route = notificationRoute(n, side);
          return (
            <ListItem
              key={n.id}
              title={n.title}
              subtitle={[n.body, fmtRelative(n.createdAt)].filter(Boolean).join(" · ")}
              onPress={route ? () => router.push(route as never) : undefined}
              chevron={!!route}
              left={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: n.readAt ? "transparent" : t.primary }} accessibilityLabel={n.readAt ? "Lida" : "Não lida"} />}
            />
          );
        })}
      </Screen>
    </>
  );
}
