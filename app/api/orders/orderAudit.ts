// app/api/orders/orderAudit.ts
import { prisma } from "@/app/lib/db";

type AuditParams = {
  orderId: string;
  tenantId: string;
  userId?: string | null;
  action: string;
  payload?: unknown;
};

function sanitizePayload(payload: unknown): any {
  if (payload === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return undefined;
  }
}

export async function logOrderAudit({ orderId, tenantId, userId, action, payload }: AuditParams) {
  await prisma.orderAudit.create({
    data: {
      orderId,
      tenantId,
      userId: userId ?? null,
      action,
      payload: sanitizePayload(payload),
    },
  });
}
