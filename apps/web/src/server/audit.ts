import { prisma } from "@tinypet/db";

export async function audit(input: { userId?: string; partnerId?: string; action: string; entity: string; entityId: string; data?: unknown; ip?: string }) {
  await prisma.auditLog.create({ data: { ...input, data: input.data as object | undefined } });
}
