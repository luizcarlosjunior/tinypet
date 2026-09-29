import React from "react";
import { NotificationsList } from "@/components/notifications/NotificationsList";

export default function TutorNotificationsScreen() {
  return <NotificationsList side="tutor" fallback="/(tutor)/conta" />;
}
