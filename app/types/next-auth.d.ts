// types/next-auth.d.ts
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      role: 'ADMIN' | 'STAFF'
    }
    tenantId: string | null
    tenantRole: 'OWNER' | 'ADMIN' | 'STAFF' | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'ADMIN' | 'STAFF'
    tenantId: string | null
    tenantRole: 'OWNER' | 'ADMIN' | 'STAFF' | null
  }
}
