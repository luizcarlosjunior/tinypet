import { prisma } from "@tinypet/db";
import { sendMail, layout, textToHtml } from "./mail";

type Notify = { userId: string; type: string; title: string; body?: string; data?: Record<string, unknown>; email?: boolean };

/** Creates an in-app notification, sends Expo push (if tokens) and optionally e-mail. */
export async function notify(n: Notify) {
  const notification = await prisma.notification.create({ data: { userId: n.userId, type: n.type, title: n.title, body: n.body, data: n.data as object | undefined } });
  const tokens = await prisma.pushToken.findMany({ where: { userId: n.userId } });
  if (tokens.length) {
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokens.map((t) => ({ to: t.token, title: n.title, body: n.body, data: n.data }))),
      });
    } catch (e) {
      console.warn("[push] failed", e);
    }
  }
  if (n.email) {
    const u = await prisma.user.findUnique({ where: { id: n.userId }, select: { email: true } });
    if (u) await sendMail(u.email, n.title, layout(n.title, `<p>${textToHtml(n.body ?? "")}</p>`), n.body);
  }
  return notification;
}

/** Notifies every member of a partner. */
export async function notifyPartner(partnerId: string, n: Omit<Notify, "userId">) {
  const members = await prisma.membership.findMany({ where: { partnerId }, select: { userId: true } });
  await Promise.all(members.map((m) => notify({ ...n, userId: m.userId })));
}
