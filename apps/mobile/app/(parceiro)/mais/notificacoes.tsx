import React from "react";
import { NotificationsList } from "@/components/notifications/NotificationsList";

export default function NotificationsScreen() {
  return <NotificationsList side="partner" fallback="/(parceiro)/mais" />;
}
