// app/api/auth/reset/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { email, token, password } = await req.json();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok:false, error:"INVALID_TOKEN" }, { status: 400 });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.userId !== user.id) {
    return NextResponse.json({ ok:false, error:"INVALID_TOKEN" }, { status: 400 });
  }
  if (record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ ok:false, error:"TOKEN_EXPIRED" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,        // ⬅️ DÜZELTME
        mustChangePassword: false, // isteğe bağlı
        updatedAt: new Date(),     // zaten @updatedAt var, ek olmasa da olur
      },
    }),
    prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, NOT: { tokenHash } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
