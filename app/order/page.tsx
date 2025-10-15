// app/order/page.tsx
import OrderEditor from './OrderEditor'
import { headers, cookies } from 'next/headers'

type CompanyProfile = {
  companyName?: string
  phone?: string
  email?: string
  address?: string
  taxNumber?: string
  taxOffice?: string
  logoUrl?: string
  instagram?: string
  website?: string
}

type BranchView = {
  id: string
  name: string
  code?: string | null
  isActive: boolean
  showOnHeader: boolean
  sortOrder: number
  phone?: string | null
  email?: string | null
  address?: string | null
}

/** Base URL (senkron) */
async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host  = h.get('x-forwarded-host') ?? h.get('host')
  return `${proto}://${host}`
}

async function getJSON<T>(path: string): Promise<T> {
  const base = await getBaseUrl()
  const init: RequestInit = {
    cache: 'no-store',
    headers: { cookie: cookies().toString() },
  }
  const res = await fetch(`${base}${path}`, init)
  if (!res.ok) throw new Error(`${path} failed ${res.status}`)
  return res.json()
}

export default async function Page() {
  const [profileRes, branchesRes] = await Promise.all([
    getJSON<any>('/api/company-profile'),
    getJSON<any>('/api/branches?all=1'),
  ])

  // NULL -> undefined normalize ederek, OrderEditor içindeki Profile tipiyle uyumlu kıl.
  const profile: CompanyProfile = {
    companyName: profileRes?.profile?.companyName ?? '',
    phone:       profileRes?.profile?.phone ?? undefined,
    email:       profileRes?.profile?.email ?? undefined,
    address:     profileRes?.profile?.address ?? undefined,
    taxNumber:   profileRes?.profile?.taxNumber ?? undefined,
    taxOffice:   profileRes?.profile?.taxOffice ?? undefined,
    logoUrl:     profileRes?.profile?.logoUrl ?? undefined,
    instagram:   profileRes?.profile?.instagram ?? undefined,
    website:     profileRes?.profile?.website ?? undefined,
  }

  // API bazen {items:[...]} bazen [] döndürebilir → normalize et
  const rawBranches: any[] = Array.isArray(branchesRes) ? branchesRes : (branchesRes?.items ?? [])

  const branches: BranchView[] = rawBranches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code ?? null,
    isActive: !!b.isActive,
    showOnHeader: !!b.showOnHeader,
    sortOrder: Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
    phone: b.phone ?? null,
    email: b.email ?? null,
    address: b.address ?? null,
  }))

  const headerBranches = branches
    .filter(b => b.isActive && b.showOnHeader)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <OrderEditor
      // OrderEditor kendi içinde Profile/Branch tipini tanımlıyor.
      // Yapısal olarak uyumlu olduğundan isimler farklı olsa da sorun yok.
      profile={profile as any}
      branches={branches as any}
      headerBranches={headerBranches as any}
    />
  )
}
