// app/api/admin/users/[id]/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";

export const runtime = "nodejs";

/**
 * GET: mevcut durum bilgisi
 */
export async function GET(_req: Request, { params }: any) {
  await requireSuperAdmin();

  const userId = params?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isActive: true, mustChangePassword: true, role: true },
  });

  if (!u) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(u);
}

/**
 * PATCH: durum güncelle
 * Body örnekleri:
 *  { "active": true }                      // aktif et
 *  { "active": false }                     // pasife al
 *  { "mustChangePassword": true }          // ilk girişte şifre değiştir
 *  { "active": false, "mustChangePassword": true }
 */
export async function PATCH(req: Request, { params }: any) {
  await requireSuperAdmin();

  const userId = params?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const hasActive = Object.prototype.hasOwnProperty.call(body, "active");
  const hasMCP = Object.prototype.hasOwnProperty.call(body, "mustChangePassword");

  if (!hasActive && !hasMCP) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const data: any = {};
  if (hasActive) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active_must_be_boolean" }, { status: 422 });
    }
    data.isActive = body.active;
  }
  if (hasMCP) {
    if (typeof body.mustChangePassword !== "boolean") {
      return NextResponse.json({ error: "mustChangePassword_must_be_boolean" }, { status: 422 });
    }
    data.mustChangePassword = body.mustChangePassword;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, isActive: true, mustChangePassword: true, role: true },
  });

  return NextResponse.json(updated);
}
