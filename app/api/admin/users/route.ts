// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireTenantAdmin } from "@/app/lib/requireTenantAdmin";
import { TenantRole, UserRole } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(191).optional(),
  tenantId: z.string().optional(),
});

function normalizeUsername(input: string): string {
  const fallback = "user";
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return base.length ? base : fallback;
}

async function generateUniqueUsername(base: string) {
  const root = normalizeUsername(base);
  for (let i = 0; i < 10_000; i++) {
    const candidate = i === 0 ? root : `${root}_${i}`;
    const exists = await prisma.user.findUnique({ where: { username: candidate } });
    if (!exists) return candidate;
  }
  throw new Error("username_generation_failed");
}

function mapMembership(member: {
  id: string;
  role: TenantRole;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
  };
}) {
  return {
    membershipId: member.id,
    createdAt: member.createdAt.toISOString(),
    tenantRole: member.role,
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.user.role,
      isActive: member.user.isActive,
      createdAt: member.user.createdAt.toISOString(),
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantParam = searchParams.get("tenantId") || undefined;
    const ctx = await requireTenantAdmin(tenantParam);
    const tenantId = tenantParam ?? ctx.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "tenant_required" }, { status: 400 });
    }

    const memberships = await prisma.membership.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      items: memberships.map(mapMembership),
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = err?.message || "server_error";
    if (status >= 500) {
      console.error("GET /admin/users failed:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = CreateUserSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { email, name, tenantId: bodyTenantId } = parsed.data;
    const ctx = await requireTenantAdmin(bodyTenantId);
    const tenantId = bodyTenantId ?? ctx.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "tenant_required" }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        role: true,
        isActive: true,
        name: true,
        createdAt: true,
        username: true,
      },
    });

    let initialPassword: string | null = null;
    let userId: string;

    if (existingUser) {
      if (!existingUser.isActive) {
        return NextResponse.json({ error: "user_inactive" }, { status: 409 });
      }
      const alreadyMember = await prisma.membership.findUnique({
        where: { userId_tenantId: { userId: existingUser.id, tenantId } },
        select: { id: true },
      });
      if (alreadyMember) {
        return NextResponse.json({ error: "user_already_member" }, { status: 409 });
      }

      await prisma.membership.create({
        data: {
          tenantId,
          userId: existingUser.id,
          role: TenantRole.STAFF,
        },
      });
      userId = existingUser.id;
    } else {
      const rawPassword = randomBytes(9).toString("base64");
      initialPassword = rawPassword.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "Pass1234";
      const passwordHash = await bcrypt.hash(initialPassword, 12);
      const username = await generateUniqueUsername(emailLower.split("@")[0] || "user");

      const created = await prisma.user.create({
        data: {
          email: emailLower,
          name: name?.trim() || null,
          passwordHash,
          username,
          role: UserRole.STAFF,
          isActive: true,
          mustChangePassword: true,
          memberships: {
            create: {
              tenantId,
              role: TenantRole.STAFF,
            },
          },
        },
        select: { id: true },
      });
      userId = created.id;
    }

    const membership = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        member: membership ? mapMembership(membership) : null,
        initialPassword,
      },
      { status: 201 }
    );
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = err?.message || "server_error";
    if (status >= 500) {
      console.error("POST /admin/users error:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
