'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

type Status = 'pending' | 'processing' | 'completed' | 'cancelled' | 'workshop'

type Customer = {
  id: string
  name: string
  phone: string
  email?: string | null
  address?: string | null
  note?: string | null
  createdAt: string
}

type OrderLite = {
  id: string
  createdAt: string
  status: Status
  total: number
  netTotal?: number
  discount?: number
}

const fmt = (n: number | undefined | null) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(n ?? 0)
  )

const fmtDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    typeof d === 'string' ? new Date(d) : d
  )

const statusLabel: Record<Status, string> = {
  pending: 'Beklemede',
  processing: 'İşlemde',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  workshop: "Atölyede"
}

function StatusBadge({ s }: { s: Status }) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border'
  const cls: Record<Status, string> = {
    pending: `${base} bg-neutral-100 text-neutral-700 border-neutral-200`,
    processing: `${base} bg-blue-50 text-blue-700 border-blue-200`,
    completed: `${base} bg-emerald-50 text-emerald-700 border-emerald-200`,
    cancelled: `${base} bg-rose-50 text-rose-700 border-rose-200`,
    workshop: `${base} bg-blue-50 text-blue-700 border-blue-200`,
  }
  return <span className={cls[s]}>{statusLabel[s]}</span>
}

/* ---------- Yeni Müşteri Modal ---------- */
function NewCustomerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => Promise<void> | void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      // reset
      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setNote('')
      setError(null)
      setAdding(false)
    }
  }, [open])

  const add = async () => {
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      note: note.trim() || undefined,
    }
    if (!payload.name || !payload.phone) {
      setError('İsim ve telefon zorunlu.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const txt = await res.text().catch(() => '')
      if (!res.ok) {
        setError('Kayıt başarısız.')
        console.error(txt)
        return
      }
      await onCreated()
      onClose()
    } finally {
      setAdding(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div
        className="absolute inset-x-0 top-10 mx-auto w-[min(700px,92vw)] rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Yeni Müşteri</h2>
          <button
            className="grid size-8 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Kapat"
            title="Kapat"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path
                fill="currentColor"
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-neutral-600">Ad Soyad</label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              placeholder="Ad Soyad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-neutral-600">Telefon</label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              placeholder="Telefon"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600">E-posta (opsiyonel)</label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              placeholder="ornek@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600">Adres (opsiyonel)</label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              placeholder="Adres"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-neutral-600">Not (opsiyonel)</label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              placeholder="Not"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={onClose}
          >
            İptal
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            onClick={add}
            disabled={adding}
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="currentColor" d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z" />
            </svg>
            {adding ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Customers Page (RAPORLAR UI ile hizalı) ---------- */
export default function CustomersPage() {
  // ---- state
  const [items, setItems] = useState<Customer[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // modal
  const [showCreate, setShowCreate] = useState(false)

  // inline edit draft’ları
  const [editing, setEditing] = useState<Record<string, Partial<Customer>>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // akordeon açık müşteri id’leri
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  // sipariş cache: her müşteri için durum
  const [ordersByCustomer, setOrdersByCustomer] = useState<
    Record<string, { loading: boolean; error: string | null; items: OrderLite[] }>
  >({})

  // abort controller referansı (liste fetch)
  const listAbort = useRef<AbortController | null>(null)

  // ---- helpers
  const fetchCustomers = async (query = '') => {
    listAbort.current?.abort()
    const ac = new AbortController()
    listAbort.current = ac
    setLoading(true)
    setError(null)
    try {
      const url = '/api/customers' + (query ? `?q=${encodeURIComponent(query)}` : '')
      const res = await fetch(url, { cache: 'no-store', signal: ac.signal })
      if (!res.ok) throw new Error('Müşteriler alınamadı')
      // API: { ok, items, total, page, pageSize }
      const data: any = await res.json()
      const list: Customer[] = Array.isArray(data?.items) ? data.items : []
      setItems(list)
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
    return () => listAbort.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return items
    return items.filter((c) => {
      const fields = [
        c.name,
        c.phone || '',
        c.email || '',
        c.address || '',
        c.note || '',
        new Date(c.createdAt).toLocaleDateString('tr-TR'),
      ]
      return fields.some((f) => String(f).toLowerCase().includes(needle))
    })
  }, [items, q])

  const ensureDraft = (c: Customer) => {
    setEditing((prev) =>
      prev[c.id]
        ? prev
        : {
            ...prev,
            [c.id]: {
              name: c.name,
              phone: c.phone,
              email: c.email || '',
              address: c.address || '',
              note: c.note || '',
            },
          }
    )
  }

  const changeEdit = (id: string, patch: Partial<Customer>) =>
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const cancelEdit = (id: string) =>
    setEditing((prev) => {
      const p = { ...prev }
      delete p[id]
      return p
    })

  const save = async (id: string) => {
    const draft = editing[id]
    if (!draft) return
    setSavingId(id)
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        toast.error('Güncelleme başarısız.')
        return
      }
      const updated: Customer = await res.json()
      setItems((prev) => prev.map((c) => (c.id === id ? updated : c)))
      cancelEdit(id)
    } finally {
      setSavingId(null)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Müşteri silinsin mi? (Siparişi varsa silinemez)')) return
    setRemovingId(id)
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      if (res.status === 400) {
        toast.error('Bu müşteriye bağlı siparişler var, silinemez.')
        return
      }
      if (!res.ok) {
        toast.error('Silme başarısız.')
        return
      }
      setItems((prev) => prev.filter((c) => c.id !== id))
      setOpenIds((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    } finally {
      setRemovingId(null)
    }
  }

  // sipariş fetch (müşteri detayında)
  const fetchOrdersFor = async (customerId: string) => {
    setOrdersByCustomer((prev) => ({
      ...prev,
      [customerId]: { loading: true, error: null, items: prev[customerId]?.items ?? [] },
    }))
    try {
      const res = await fetch(`/api/orders?customerId=${encodeURIComponent(customerId)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Siparişler alınamadı')
      const data: any[] = await res.json()
      const lite: OrderLite[] = data.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        status: o.status as Status,
        total: Number(o.total ?? 0),
        netTotal: Number(o.netTotal ?? o.total ?? 0),
        discount: Number(o.discount ?? 0),
      }))
      setOrdersByCustomer((prev) => ({
        ...prev,
        [customerId]: { loading: false, error: null, items: lite },
      }))
    } catch (e: any) {
      setOrdersByCustomer((prev) => ({
        ...prev,
        [customerId]: { loading: false, error: e?.message || 'Hata', items: [] },
      }))
    }
  }

  // özet
  const summary = useMemo(() => ({ count: filtered.length }), [filtered])

  // skeleton
  const Skeleton = () => (
    <div className="animate-pulse rounded-2xl border border-neutral-200 p-4">
      <div className="h-4 w-40 rounded bg-neutral-200" />
      <div className="mt-2 h-3 w-80 rounded bg-neutral-200" />
    </div>
  )

  return (
    <>
      {/* ==== HEADER (Raporlar ile aynı şerit & buton stilleri) ==== */}
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Müşteriler</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchCustomers(q)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
              title="Listeyi yenile"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z" />
              </svg>
              Yenile
            </button>

            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              title="Yeni müşteri ekle"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z" />
              </svg>
              Yeni Müşteri
            </button>
          </div>
        </div>

        {/* ==== FİLTRE KARTI (Raporlar'daki gibi) ==== */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-96">
              <input
                className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 pe-9 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                placeholder="Arama yap (ad, telefon, e-posta, adres, not…) "
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Müşterilerde ara"
              />
              <svg
                className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  d="M10 4a6 6 0 1 1 3.9 10.6l3.8 3.8-1.4 1.4-3.8-3.8A6 6 0 0 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8z"
                />
              </svg>
            </div>

            <div className="ms-auto hidden text-sm text-neutral-600 sm:block">
              {summary.count} kayıt
            </div>
          </div>

          {/* Bilgi kutusu (raporlardaki yardımcı ton) */}
          <div className="mt-3 rounded-xl border border-dashed border-neutral-200 p-3 text-xs text-neutral-500">
            Arama; <b>ad</b>, <b>telefon</b>, <b>e-posta</b>, <b>adres</b>, <b>not</b> ve <b>oluşturulma tarihi</b> alanlarında yapılır.
          </div>
        </div>

        {/* ==== Uyarılar ==== */}
        {loading && <p className="mt-3 text-sm text-neutral-500">Yükleniyor…</p>}
        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        {!loading && filtered.length === 0 && !error && (
          <p className="mt-3 text-neutral-600">Sonuç bulunamadı.</p>
        )}

        {/* ==== Liste ==== */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4">
          {loading && items.length === 0 && (
            <>
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </>
          )}

          {!loading &&
            filtered.map((c) => {
              const isOpen = openIds.has(c.id)
              const draft = editing[c.id]
              const ord = ordersByCustomer[c.id]

              return (
                <section
                  key={c.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-0 shadow-sm transition hover:shadow-md"
                >
                  {/* HEADER (kart başlığı) */}
                  <button
                    className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                    onClick={() => {
                      setOpenIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(c.id)) next.delete(c.id)
                        else {
                          next.add(c.id)
                          if (!editing[c.id]) ensureDraft(c)
                          if (!ordersByCustomer[c.id]) void fetchOrdersFor(c.id)
                        }
                        return next
                      })
                    }}
                    aria-expanded={isOpen}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{c.name}</div>
                      <div className="truncate text-xs text-neutral-600">
                        {c.phone} • {c.email || '—'} • {fmtDateTime(c.createdAt)}
                      </div>
                    </div>
                    <div className="shrink-0 text-neutral-500">
                      <svg
                        viewBox="0 0 24 24"
                        className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden
                      >
                        <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                      </svg>
                    </div>
                  </button>

                  {/* PANEL */}
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {/* Edit alanları */}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <label className="text-xs text-neutral-500">Ad Soyad</label>
                          <input
                            className="mt-1 h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                            value={draft ? String(draft.name ?? '') : c.name}
                            onChange={(e) => changeEdit(c.id, { name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-500">Telefon</label>
                          <input
                            className="mt-1 h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                            value={draft ? String(draft.phone ?? '') : c.phone}
                            onChange={(e) => changeEdit(c.id, { phone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-500">E-posta</label>
                          <input
                            className="mt-1 h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                            value={draft ? String(draft.email ?? '') : c.email ?? ''}
                            onChange={(e) => changeEdit(c.id, { email: e.target.value })}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-neutral-500">Adres</label>
                          <input
                            className="mt-1 h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                            value={draft ? String(draft.address ?? '') : c.address ?? ''}
                            onChange={(e) => changeEdit(c.id, { address: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-500">Not</label>
                          <input
                            className="mt-1 h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                            value={draft ? String(draft.note ?? '') : c.note ?? ''}
                            onChange={(e) => changeEdit(c.id, { note: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Actions (raporlar stili butonlar) */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                          onClick={() => save(c.id)}
                          disabled={savingId === c.id}
                          title="Kaydet"
                        >
                          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                            <path fill="currentColor" d="M5 13l4 4L19 7l-1.4-1.4L9 13.2L6.4 10.6z" />
                          </svg>
                          {savingId === c.id ? 'Kaydediliyor…' : 'Kaydet'}
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                          onClick={() => cancelEdit(c.id)}
                        >
                          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                            <path fill="currentColor" d="M6 19L19 6l-1.4-1.4L4.6 17.6z" />
                          </svg>
                          İptal
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          onClick={() => remove(c.id)}
                          disabled={removingId === c.id}
                        >
                          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                            <path fill="currentColor" d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
                          </svg>
                          {removingId === c.id ? 'Siliniyor…' : 'Sil'}
                        </button>
                        {/* <a
                          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                          href={`/order?customerId=${c.id}`}
                        >
                          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                            <path fill="currentColor" d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z" />
                          </svg>
                          Yeni Sipariş
                        </a> */}
                      </div>

                      {/* Siparişler */}
                      <CustomerOrders
                        customerId={c.id}
                        cache={ordersByCustomer}
                        setCache={setOrdersByCustomer}
                        fetchOrdersFor={fetchOrdersFor}
                      />
                    </div>
                  )}
                </section>
              )
            })}
        </div>
      </div>

      {/* Yeni Müşteri Modal */}
      <NewCustomerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => fetchCustomers(q)}
      />
    </>
  )
}

/* --------- alt komponent: müşteri sipariş listesi --------- */
function CustomerOrders({
  customerId,
  cache,
  setCache, // eslint-disable-line @typescript-eslint/no-unused-vars
  fetchOrdersFor,
}: {
  customerId: string
  cache: Record<string, { loading: boolean; error: string | null; items: OrderLite[] }>
  setCache: React.Dispatch<
    React.SetStateAction<
      Record<string, { loading: boolean; error: string | null; items: OrderLite[] }>
    >
  >
  fetchOrdersFor: (customerId: string) => Promise<void>
}) {
  const ord = cache[customerId]
  const total =
    ord?.items?.reduce((acc, o) => acc + Number(o.netTotal ?? o.total ?? 0), 0) ?? 0

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">
          Siparişler{' '}
          {ord && ord.items.length > 0 && (
            <span className="text-xs text-neutral-500">
              · {ord.items.length} adet · toplam {fmt(total)} ₺
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex h-8 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-700 hover:bg-neutral-50"
            onClick={() => fetchOrdersFor(customerId)}
            disabled={!!ord?.loading}
            title="Müşteri siparişlerini yenile"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path
                fill="currentColor"
                d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"
              />
            </svg>
            Yenile
          </button>
        </div>
      </div>

      {ord?.loading && <div className="text-sm text-neutral-500">Yükleniyor…</div>}
      {ord?.error && <div className="text-sm text-rose-700">{ord.error}</div>}
      {(!ord || (!ord.loading && ord.items.length === 0)) && (
        <div className="text-sm text-neutral-600">Kayıtlı sipariş bulunamadı.</div>
      )}

      {ord && ord.items.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                <th>Tarih</th>
                <th>Durum</th>
                <th className="text-right">Tutar</th>
                <th className="text-right">Net</th>
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ord.items.map((o) => (
                <tr key={o.id} className="[&>td]:px-3 [&>td]:py-2">
                  <td>{fmtDateTime(o.createdAt)}</td>
                  <td>
                    <StatusBadge s={o.status as Status} />
                  </td>
                  <td className="text-right">{fmt(o.total)} ₺</td>
                  <td className="text-right">{fmt(o.netTotal ?? o.total)} ₺</td>
                  <td className="text-right">
                    <a
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                      href={`/orders/${o.id}`}
                    >
                      Görüntüle
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
