// app/dealers/DealersView.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Dealer = {
  id: string
  name: string
  code?: string | null
  phone?: string | null
  email?: string | null
  isActive: boolean
  createdAt: string
}

type ListResponse = {
  ok: boolean
  items: Dealer[]
  total: number
  page: number
  pageSize: number
}

type Props = {
  initialQ: string
  initialActive: '' | '1' | '0'
  initialPage: number
  pageSize: number
}

export default function DealersView({
  initialQ,
  initialActive,
  initialPage,
  pageSize,
}: Props) {
  const router = useRouter()

  const [q, setQ] = useState(initialQ)
  const [active, setActive] = useState<'' | '1' | '0'>(initialActive)
  const [page, setPage] = useState(initialPage)

  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (active) params.set('active', active)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    router.replace(`/dealers?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, active, page, pageSize])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true); setErr(null)
      try {
        const url = new URL('/api/dealers', window.location.origin)
        if (q) url.searchParams.set('q', q)
        if (active) url.searchParams.set('active', active)
        url.searchParams.set('page', String(page))
        url.searchParams.set('pageSize', String(pageSize))
        const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' })
        const j = (await res.json()) as ListResponse
        if (!cancelled) {
          if (!res.ok || !j.ok) throw new Error('request_failed')
          setData(j)
        }
      } catch {
        if (!cancelled) setErr('Liste alınamadı')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [q, active, page, pageSize])

  const onSearchChange = useMemo(() => {
    let t: any
    return (v: string) => {
      clearTimeout(t)
      t = setTimeout(() => { setPage(1); setQ(v) }, 300)
    }
  }, [])

  async function toggleActive(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/dealers/${id}`, {
        method: current ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: current ? undefined : JSON.stringify({ isActive: true }),
      })
      if (!res.ok) throw new Error('failed')
      setData((d) => {
        if (!d) return d
        return { ...d, items: d.items.map(it => it.id === id ? { ...it, isActive: !current } : it) }
      })
    } catch {
      toast.error('İşlem başarısız')
    }
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Bayiler</h1>
        <a href="/dealers/new" className="px-4 py-2 rounded-xl bg-black text-white">Yeni Bayi</a>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          defaultValue={q}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border rounded-lg px-3 py-2 w-full md:w-80"
          placeholder="Arama yap"
        />
        <select
          value={active}
          onChange={(e) => { setPage(1); setActive(e.target.value as '' | '1' | '0') }}
          className="border rounded-lg px-3 py-2 w-full md:w-48"
        >
          <option value="1">Sadece aktif</option>
          <option value="0">Sadece pasif</option>
          <option value="">Hepsi</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Ad</th>
              <th className="p-3">Kod</th>
              <th className="p-3">Telefon</th>
              <th className="p-3">E-posta</th>
              <th className="p-3">Durum</th>
              <th className="p-3">Oluşturma</th>
              <th className="p-3 w-40">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-4 text-gray-500" colSpan={7}>Yükleniyor…</td></tr>}
            {!loading && data?.items?.length === 0 && <tr><td className="p-4 text-gray-500" colSpan={7}>Kayıt yok.</td></tr>}
            {!loading && data?.items?.map(d => (
              <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="p-3"><a className="text-blue-600 hover:underline" href={`/dealers/${d.id}`}>{d.name}</a></td>
                <td className="p-3">{d.code || '-'}</td>
                <td className="p-3">{d.phone || '-'}</td>
                <td className="p-3">{d.email || '-'}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                    {d.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="p-3">{new Date(d.createdAt).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <a href={`/dealers/${d.id}`} className="px-3 py-1 rounded-lg border">Düzenle</a>
                    <button
                      onClick={() => toggleActive(d.id, d.isActive)}
                      className={`px-3 py-1 rounded-lg ${d.isActive ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
                    >
                      {d.isActive ? 'Pasifleştir' : 'Aktif Et'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {err && <tr><td className="p-4 text-red-600" colSpan={7}>{err}</td></tr>}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-600">Toplam {total} kayıt • Sayfa {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Önceki</button>
            <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Sonraki</button>
          </div>
        </div>
      )}
    </div>
  )
}
