'use client'

import { useEffect, useMemo, useState } from 'react'

type OrderItem = {
  id: string
  qty: number
  width: number
  height: number
  unitPrice: number
  subtotal: number
  note?: string | null
  category: { name: string }
  variant: { name: string }
}
type Order = {
  id: string
  createdAt: string
  note?: string | null
  total: number
  items: OrderItem[]
  customerName: string
  customerPhone: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [q, setQ] = useState('')

  // Açık (genişletilmiş) sipariş id'leri
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const toggleOpen = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fetchOrders = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' })
      if (!res.ok) throw new Error('Siparişler alınamadı')
      const data: Order[] = await res.json()
      setOrders(data)
    } catch (e: any) {
      setError(e?.message || 'Bilinmeyen hata')
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchOrders() }, [])

  const removeOrder = async (id: string) => {
    if (!confirm(`#${id} siparişini silmek istiyor musun?`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Silme başarısız')
      setOrders(prev => prev.filter(o => o.id !== id))
      setOpenIds(prev => {
        const next = new Set(prev); next.delete(id); return next
      })
    } catch (e: any) {
      alert(e?.message || 'Silmede hata')
    } finally { setDeletingId(null) }
  }

  // Filtrelenmiş liste (metin aramasına göre)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return orders
    return orders.filter(o => {
      const inHeader =
        o.id.toLowerCase().includes(needle) ||
        (o.note || '').toLowerCase().includes(needle) ||
        (o.customerName || '').toLowerCase().includes(needle) ||
        (o.customerPhone || '').toLowerCase().includes(needle)

      const inItems = o.items.some(it =>
        it.category.name.toLowerCase().includes(needle) ||
        it.variant.name.toLowerCase().includes(needle) ||
        (it.note || '').toLowerCase().includes(needle)
      )
      return inHeader || inItems
    })
  }, [orders, q])

  return (
    <div className="card">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Siparişler</h1>
        <div className="flex gap-2">
          <input
            className="input h-[40px]"
            placeholder="Ara: müşteri, telefon, not, kategori/varyant…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <a href="/order" className="btn whitespace-nowrap">+ Yeni Sipariş</a>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500 mb-2">Yükleniyor…</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {!loading && filtered.length === 0 && <p>Sonuç bulunamadı.</p>}

      <div className="space-y-4">
        {filtered.map((order, idx) => {
          const num = filtered.length - idx
          const isOpen = openIds.has(order.id)
          const detailId = `order-detail-${order.id}`
          return (
            <div key={order.id} className="border rounded-2xl p-4 dark:border-gray-800">
              {/* Header satırı (kısa özet) */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="font-semibold">Sipariş #{num}</div>
                  <div className="text-sm">
                    <span className="font-medium">Müşteri:</span> {order.customerName || '—'}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Telefon:</span> {order.customerPhone || '—'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString('tr-TR')}
                  </div>
                  <button
                    className="btn-secondary whitespace-nowrap"
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    onClick={() => toggleOpen(order.id)}
                  >
                    {isOpen ? '▲ Gizle' : '▼ Detay'}
                  </button>
                </div>
              </div>

              {/* Detay (açılır/kapanır) */}
              {isOpen && (
                <div id={detailId} className="mt-4">
                  {order.note && (
                    <div className="mb-3 text-sm">
                      <span className="font-medium">Sipariş Notu:</span> {order.note}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="table mb-3">
                      <thead>
                        <tr>
                          <th>Kategori</th>
                          <th>Varyant</th>
                          <th className="text-right">Adet</th>
                          <th className="text-right">En</th>
                          <th className="text-right">Boy</th>
                          <th className="text-right">Birim</th>
                          <th className="text-right">Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map(it => (
                          <tr key={it.id}>
                            <td>{it.category.name}</td>
                            <td>
                              <div>{it.variant.name}</div>
                              {it.note && <div className="text-xs text-gray-500">Not: {it.note}</div>}
                            </td>
                            <td className="text-right">{it.qty}</td>
                            <td className="text-right">{it.width}</td>
                            <td className="text-right">{it.height}</td>
                            <td className="text-right">{fmt(Number(it.unitPrice))}</td>
                            <td className="text-right">{fmt(Number(it.subtotal))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6} className="text-right font-semibold">Toplam</td>
                          <td className="text-right font-bold">{fmt(Number(order.total))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="flex gap-2">
                    <a href={`/orders/${order.id}`} className="btn-secondary">Düzenle</a>
                    <a href={`/orders/${order.id}/print`} className="btn-secondary" target="_blank">🖨️ Yazdır</a>
                    <button
                      className="btn-secondary disabled:opacity-50"
                      onClick={() => removeOrder(order.id)}
                      disabled={deletingId === order.id}
                    >
                      {deletingId === order.id ? 'Siliniyor…' : 'Sil'}
                    </button>
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
