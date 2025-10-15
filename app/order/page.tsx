// app/order/page.tsx
import OrderEditor from './OrderEditor'
import { headers, cookies } from 'next/headers'

type Profile = {
  companyName: string
  phone?: string | null
  email?: string | null
  address?: string | null
  taxNumber?: string | null
  taxOffice?: string | null
  logoUrl?: string | null
  instagram?: string | null
  website?: string | null
}

type Branch = {
  id: string
  name: string
  code?: string | null
  isActive: boolean
  showOnHeader: boolean
  sortOrder: number
  phone?: string | null      // <-- eklendi
  email?: string | null      // <-- eklendi
  address?: string | null    // <-- eklendi
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const h = headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host  = h.get('x-forwarded-host') ?? h.get('host')
  return `${proto}://${host}`
}

async function getJSON<T>(path: string): Promise<T> {
  const base = getBaseUrl()
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

  const profile: Profile = {
    companyName: profileRes?.profile?.companyName ?? '',
    phone:      profileRes?.profile?.phone ?? undefined,
    email:      profileRes?.profile?.email ?? undefined,
    address:    profileRes?.profile?.address ?? undefined,
    taxNumber:  profileRes?.profile?.taxNumber ?? undefined,
    taxOffice:  profileRes?.profile?.taxOffice ?? undefined,
    logoUrl:    profileRes?.profile?.logoUrl ?? undefined,
    instagram:  profileRes?.profile?.instagram ?? undefined,
    website:    profileRes?.profile?.website ?? undefined,
  }

  // API bazen {items:[...]} bazen direkt array dönerse iki durumu da karşıla
  const rawBranches = Array.isArray(branchesRes) ? branchesRes : (branchesRes?.items ?? [])

  const branches: Branch[] = rawBranches.map((b: any) => ({
    id: b.id,
    name: b.name,
    code: b.code ?? null,
    isActive: !!b.isActive,
    showOnHeader: !!b.showOnHeader,
    sortOrder: Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
    phone: b.phone ?? null,       // <-- maplendi
    email: b.email ?? null,       // <-- maplendi
    address: b.address ?? null,   // <-- maplendi
  }))

  const headerBranches = branches
    .filter(b => b.isActive && b.showOnHeader)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <OrderEditor
      profile={profile}
      branches={branches}
      headerBranches={headerBranches}
    />
  )
}
