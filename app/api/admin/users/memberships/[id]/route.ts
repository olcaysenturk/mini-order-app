// app/api/admin/users/memberships/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireTenantAdmin } from "@/app/lib/requireTenantAdmin";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "missing_membership_id" }, { status: 400 });
    }

    const ctx = await requireTenantAdmin();

    const membership = await prisma.membership.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        role: true,
        tenant: { select: { id: true } },
        user: { select: { id: true } },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (!ctx.isSuperAdmin && ctx.tenantId !== membership.tenantId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (membership.role === "OWNER" && !ctx.isSuperAdmin) {
      return NextResponse.json({ error: "cannot_remove_owner" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: membership.id } });

      const remaining = await tx.membership.count({
        where: { userId: membership.userId },
      });

      if (remaining === 0) {
        await tx.user.update({
          where: { id: membership.userId },
          data: { isActive: false },
        });
      }
    });

    return NextResponse.json({ ok: true, membershipId: membership.id });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = err?.message || "server_error";
    if (status >= 500) {
      console.error("DELETE /admin/users/memberships error:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
