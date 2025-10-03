'use client'

import { useEffect, useMemo, useState } from 'react'

type Status = 'pending' | 'processing' | 'completed' | 'cancelled'

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

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // yeni müşteri formu
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')

  // inline edit draft’ları
  const [editing, setEditing] = useState<Record<string, Partial<Customer>>>({})

  // akordeon açık müşteri id’leri
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  // sipariş cache: her müşteri için durum
  const [ordersByCustomer, setOrdersByCustomer] = useState<
    Record<string, { loading: boolean; error: string | null; items: OrderLite[] }>
  >({})

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
  const fmt = (n: number | undefined | null) =>
    new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      Number(n ?? 0)
    )

  const fetchCustomers = async (query = '') => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/customers' + (query ? `?q=${encodeURIComponent(query)}` : ''), {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Müşteriler alınamadı')
      const data: Customer[] = await res.json()
      setItems(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
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

  const add = async () => {
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      note: note.trim() || undefined,
    }
    if (!payload.name || !payload.phone) {
      alert('İsim ve telefon zorunlu.')
      return
    }
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.status === 409) {
      alert('Bu telefon numarası zaten kayıtlı.')
      return
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.error(t)
      alert('Kayıt başarısız.')
      return
    }
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setNote('')
    fetchCustomers(q)
  }

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
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (res.status === 409) {
      alert('Telefon zaten kullanılıyor.')
      return
    }
    if (!res.ok) {
      alert('Güncelleme başarısız.')
      return
    }
    const updated: Customer = await res.json()
    setItems((prev) => prev.map((c) => (c.id === id ? updated : c)))
    cancelEdit(id)
  }

  const remove = async (id: string) => {
    if (!confirm('Müşteri silinsin mi? (Siparişi varsa silinemez)')) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.status === 400) {
      alert('Bu müşteriye bağlı siparişler var, silinemez.')
      return
    }
    if (!res.ok) {
      alert('Silme başarısız.')
      return
    }
    setItems((prev) => prev.filter((c) => c.id !== id))
    setOpenIds((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
  }

  // sipariş fetch
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
      // UI’da gereken alanlara indirgeme
      const lite: OrderLite[] = data.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        status: o.status,
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

  const toggleOpen = (c: Customer) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(c.id)) {
        next.delete(c.id)
      } else {
        next.add(c.id)
        // ilk kez açılıyorsa: draft hazırla + sipariş çek
        ensureDraft(c)
        if (!ordersByCustomer[c.id]) fetchOrdersFor(c.id)
      }
      return next
    })
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-xl font-semibold">Müşteriler</h1>
        <div className="flex gap-2">
          <input
            className="input h-[40px]"
            placeholder="Ara: ad, telefon, e-posta…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn-secondary" onClick={() => fetchCustomers(q)}>
            Yenile
          </button>
        </div>
      </div>

      {/* Yeni müşteri formu */}
      <div className="border rounded-2xl p-4 mb-6">
        <div className="font-medium mb-3">Yeni Müşteri</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            className="input"
            placeholder="Ad Soyad"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Telefon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="input"
            placeholder="E-posta (opsiyonel)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            placeholder="Adres (opsiyonel)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className="input"
            placeholder="Not (opsiyonel)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <button className="btn" onClick={add}>
            Ekle
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500 mb-2">Yükleniyor…</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {!loading && filtered.length === 0 && <p>Sonuç bulunamadı.</p>}

      {/* Akordeon liste */}
      <div className="space-y-3">
        {filtered.map((c) => {
          const isOpen = openIds.has(c.id)
          const draft = editing[c.id]
          const ord = ordersByCustomer[c.id]
          return (
            <div key={c.id} className="border rounded-2xl">
              {/* HEADER */}
              <button
                className="w-full text-left p-4 flex items-center justify-between gap-3"
                onClick={() => toggleOpen(c)}
                aria-expanded={isOpen}
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-sm text-gray-600 truncate">
                    {c.phone} • {c.email || '—'} • {fmtDate(c.createdAt)}
                  </div>
                </div>
                <div className="shrink-0 text-gray-500">{isOpen ? '▲' : '▼'}</div>
              </button>

              {/* PANEL */}
              {isOpen && (
                <div className="px-4 pb-4">
                  {/* Edit alanları */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs">Ad Soyad</label>
                      <input
                        className="input mt-1"
                        value={draft ? String(draft.name ?? '') : c.name}
                        onChange={(e) => changeEdit(c.id, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs">Telefon</label>
                      <input
                        className="input mt-1"
                        value={draft ? String(draft.phone ?? '') : c.phone}
                        onChange={(e) => changeEdit(c.id, { phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs">E-posta</label>
                      <input
                        className="input mt-1"
                        value={draft ? String(draft.email ?? '') : c.email ?? ''}
                        onChange={(e) => changeEdit(c.id, { email: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs">Adres</label>
                      <input
                        className="input mt-1"
                        value={draft ? String(draft.address ?? '') : c.address ?? ''}
                        onChange={(e) => changeEdit(c.id, { address: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs">Not</label>
                      <input
                        className="input mt-1"
                        value={draft ? String(draft.note ?? '') : c.note ?? ''}
                        onChange={(e) => changeEdit(c.id, { note: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button className="btn" onClick={() => save(c.id)}>
                      Kaydet
                    </button>
                    <button className="btn-secondary" onClick={() => cancelEdit(c.id)}>
                      İptal
                    </button>
                    <button className="btn-secondary" onClick={() => remove(c.id)}>
                      Sil
                    </button>
                    <a className="btn-secondary" href={`/order?customerId=${c.id}`}>
                      + Yeni Sipariş
                    </a>
                  </div>

                  {/* Siparişler */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">Siparişler</div>
                      <div className="flex gap-2">
                        <button
                          className="btn-secondary"
                          onClick={() => fetchOrdersFor(c.id)}
                          disabled={!!ord?.loading}
                        >
                          Yenile
                        </button>
                      </div>
                    </div>

                    {ord?.loading && <div className="text-sm text-gray-500">Yükleniyor…</div>}
                    {ord?.error && <div className="text-sm text-red-600">{ord.error}</div>}
                    {(!ord || (!ord.loading && ord.items.length === 0)) && (
                      <div className="text-sm text-gray-600">Kayıtlı sipariş bulunamadı.</div>
                    )}

                    {ord && ord.items.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Tarih</th>
                              <th>Durum</th>
                              <th className="text-right">Tutar</th>
                              <th className="text-right">Net</th>
                              <th className="w-28"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {ord.items.map((o) => (
                              <tr key={o.id}>
                                <td>{fmtDate(o.createdAt)}</td>
                                <td>
                                  <span className="inline-block px-2 py-0.5 text-xs rounded-full border">
                                    {statusLabel(o.status)}
                                  </span>
                                </td>
                                <td className="text-right">{fmt(o.total)} ₺</td>
                                <td className="text-right">{fmt(o.netTotal ?? o.total)} ₺</td>
                                <td className="text-right">
                                  <a className="btn-secondary" href={`/orders/${o.id}`}>
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
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function statusLabel(s: Status) {
  switch (s) {
    case 'pending':
      return 'Beklemede'
    case 'processing':
      return 'İşlemde'
    case 'completed':
      return 'Tamamlandı'
    case 'cancelled':
      return 'İptal'
    default:
      return s
  }
}
