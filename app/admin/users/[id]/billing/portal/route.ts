// app/admin/users/[id]/billing/portal/route.ts
import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: any) {
  await requireSuperAdmin();

  const { id: userId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_required" }, { status: 400 });
  }

  // TODO: gerçek sağlayıcı portal URL'i ile değiştir
  const redirectTo = new URL(`/admin/users/${userId}/billing?portal=mock&tenant=${tenantId}`, req.url);
  return NextResponse.redirect(redirectTo);
}
