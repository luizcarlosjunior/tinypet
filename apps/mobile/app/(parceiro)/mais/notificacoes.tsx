import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useMarkNotificationsRead, useNotifications } from "@/hooks/use-me";
import { fmtRelative } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { Button, Empty, ErrorState, ListItem, Loading, Screen } from "@/components/ui";
import { BackHeader } from "@/components/BackHeader";

export default function NotificationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const q = useNotifications();
  const mark = useMarkNotificationsRead();
  return (
    <>
      <BackHeader title="Notificações" fallback="/(parceiro)/mais" right={<Button title="Marcar lidas" size="sm" variant="ghost" onPress={() => mark.mutate()} loading={mark.isPending} />} />
      <Screen refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
        {q.isLoading ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {q.data?.length === 0 ? <Empty icon="notifications-outline" title="Nenhuma notificação" /> : null}
        {(q.data ?? []).map((n) => (
          <ListItem
            key={n.id}
            title={n.title}
            subtitle={[n.body, fmtRelative(n.createdAt)].filter(Boolean).join(" · ")}
            onPress={n.data?.route ? () => router.push(n.data!.route as never) : undefined}
            chevron={!!n.data?.route}
            left={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: n.readAt ? "transparent" : t.primary }} accessibilityLabel={n.readAt ? "Lida" : "Não lida"} />}
          />
        ))}
      </Screen>
    </>
  );
}
