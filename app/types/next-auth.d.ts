// types/next-auth.d.ts
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id?: string
      role?: 'ADMIN' | 'STAFF'
    }
    tenantId?: string | null
    tenantRole?: 'OWNER' | 'ADMIN' | 'STAFF' | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: 'ADMIN' | 'STAFF'
    tenantId?: string | null
    tenantRole?: 'OWNER' | 'ADMIN' | 'STAFF' | null
  }
}