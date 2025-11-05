// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await requireSuperAdmin();

  let userId: string | undefined;
  try {
    const params = await context.params;
    userId = params?.id;
  } catch {
    userId = undefined;
  }
  if (!userId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (target.role === "SUPERADMIN") {
    return NextResponse.json({ error: "cannot_delete_superadmin" }, { status: 403 });
  }

  const tenantOwned = await prisma.tenant.findFirst({
    where: { createdById: userId },
    select: { id: true, name: true },
  });
  if (tenantOwned) {
    return NextResponse.json(
      {
        error: "user_has_tenants",
        message: "Kullanıcıya bağlı tenant kayıtları var. Silmeden önce devretmeli veya temizlemelisin.",
      },
      { status: 409 },
    );
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
