// app/api/admin/impersonate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/app/lib/db";
import { SignJWT } from "jose";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const me = session?.user;
    if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const isAdmin = me.role === "ADMIN" || me.role === "SUPERADMIN";
    if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { targetUserId, scope } = await req.json().catch(() => ({}));
    if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });

    const target = await prisma.user.findUnique({
      where: { id: String(targetUserId) },
      select: { id: true, isActive: true },
    });
    if (!target) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    if (!target.isActive) return NextResponse.json({ error: "user_inactive" }, { status: 400 });

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const now = Math.floor(Date.now() / 1000);

    // 5 dakikalık tek kullanımlık impersonation token
    const jwt = await new SignJWT({
      sub: target.id,
      impersonatorId: me.id,
      scope: scope === "global" ? "global" : "tenant",
      typ: "impersonate",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 5 * 60)
      .sign(secret);

    return NextResponse.json({ token: jwt, next: "/" });
  } catch (e) {
    console.error("POST /api/admin/impersonate error", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
