// app/lib/requireTenantAdmin.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

type TenantAdminContext = {
  userId: string;
  userRole: string;
  tenantId: string | null;
  tenantRole: string | null;
  isSuperAdmin: boolean;
};

export class TenantAdminError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "TenantAdminError";
    this.status = status;
  }
}

/**
 * Ensures the current session belongs to a tenant OWNER/ADMIN or SUPERADMIN.
 * Optionally verifies that the session tenantId matches the provided tenantId.
 */
export async function requireTenantAdmin(targetTenantId?: string | null): Promise<TenantAdminContext> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) {
    throw new TenantAdminError("unauthorized", 401);
  }

  const userRole = user.role;
  const isSuperAdmin = userRole === "SUPERADMIN";
  const tenantRole = session?.tenantRole ?? null;
  const sessionTenantId = (session?.tenantId ?? null) as string | null;

  if (isSuperAdmin) {
    if (targetTenantId && sessionTenantId && targetTenantId !== sessionTenantId) {
      // superadmin can manage cross-tenant; allow regardless of targetTenantId.
      return {
        userId: user.id,
        userRole,
        tenantId: sessionTenantId,
        tenantRole,
        isSuperAdmin: true,
      };
    }
    return {
      userId: user.id,
      userRole,
      tenantId: targetTenantId ?? sessionTenantId,
      tenantRole,
      isSuperAdmin: true,
    };
  }

  if (!sessionTenantId) {
    throw new TenantAdminError("tenant_not_selected", 400);
  }

  if (tenantRole !== "OWNER" && tenantRole !== "ADMIN") {
    throw new TenantAdminError("forbidden", 403);
  }

  if (targetTenantId && targetTenantId !== sessionTenantId) {
    throw new TenantAdminError("forbidden_other_tenant", 403);
  }

  return {
    userId: user.id,
    userRole,
    tenantId: sessionTenantId,
    tenantRole,
    isSuperAdmin: false,
  };
}
