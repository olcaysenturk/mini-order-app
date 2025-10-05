import type { DefaultSession } from "next-auth";
import { UserRole, TenantRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id: string;
      role: UserRole;
    };
    tenantId?: string | null;
    tenantRole?: TenantRole | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    tenantId?: string | null;
    tenantRole?: TenantRole | null;
  }
}
