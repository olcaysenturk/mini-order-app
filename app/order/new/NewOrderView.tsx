'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, Users, AlertCircle, Loader2, ChevronRight } from 'lucide-react'
import { useOrderSetupStore } from '@/app/lib/orderSetupStore'

/** Company altındaki şube (bayi) tipi */
type Branch = {
  id: string
  name: string
  code?: string | null
  isActive: boolean
}
type BranchesResp = { ok: boolean; items: Branch[]; total?: number }

type Customer = { id: string; name: string; phone: string; email?: string | null }
type CustomersResp = { ok: boolean; items: Customer[]; total?: number }

export default function NewOrderView() {
  const router = useRouter()
  const setSetup = useOrderSetupStore((s) => s.setSetup)

  // === Branches (Dealers) ===
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState('')

  // === Customers ===
  const [mode, setMode] = useState<'pick' | 'create'>('pick')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [custQ, setCustQ] = useState('')
  const [customerId, setCustomerId] = useState('')

  // Yeni müşteri (sadece sipariş formuna taşınır)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')

  // Ortak
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derived
  const activeBranches = useMemo(() => branches.filter(b => b.isActive), [branches])
  const selectedBranchName = useMemo(
    () => branches.find(b => b.id === branchId)?.name || '',
    [branches, branchId]
  )

  // Branches fetch (company altından)
  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true); setError(null)
      try {
        const url = new URL('/api/branches', window.location.origin)
        url.searchParams.set('active', '1')
        url.searchParams.set('page', '1')
        url.searchParams.set('pageSize', '1000')
        const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' })
        const j: BranchesResp | Branch[] = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error('request_failed')
        const items = (j as any)?.items ?? (Array.isArray(j) ? j : [])
        setBranches(items)
      } catch {
        if (!cancelled) setError('Şube listesi alınamadı')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  // Customers fetch (debounced)
  useEffect(() => {
    let cancelled = false
    if (mode !== 'pick') return
    const t = setTimeout(async () => {
      try {
        const url = new URL('/api/customers', window.location.origin)
        if (custQ) url.searchParams.set('q', custQ)
        url.searchParams.set('page', '1')
        url.searchParams.set('pageSize', '20')
        const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' })
        const j: CustomersResp | Customer[] = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error('request_failed')
        const items = (j as any)?.items ?? (Array.isArray(j) ? j : [])
        setCustomers(items)
      } catch {
        if (!cancelled) setCustomers([])
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [custQ, mode])

  // “şube yoksa” boş durum
  if (!loading && activeBranches.length === 0) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--surface-200,#e5e7eb)] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[var(--brand-50,#EEF2FF)] px-3 py-1.5 text-sm font-medium text-[var(--brand-800,#3730A3)]">
              Bilgi
            </div>
            <div>
              <h2 className="text-lg font-semibold">Sipariş için önce bir şube/bayi ekleyin</h2>
              <p className="mt-1 text-sm text-gray-600">
                Aktif şubeniz yok. Şirket Ayarları → Şubeler’den ekledikten sonra bu sayfaya dönün.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <a
                  href="/company"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-600,#111827)] px-4 py-2 text-white transition hover:bg-[var(--brand-700,#0b1220)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
                >
                  Şirket Ayarları <ChevronRight className="h-4 w-4" />
                </a>
                <button
                  onClick={() => router.refresh()}
                  className="rounded-xl border border-[var(--surface-300,#d1d5db)] px-4 py-2 transition hover:bg-[var(--surface-50,#f9fafb)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
                >
                  Listeyi Yenile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!branchId) { toast('Lütfen bir şube/bayi seçin.', 'warn'); return }

    setSaving(true)
    try {
      // 1) seçilen/oluşturulan müşteri
      let customerPayload: { id?: string; name: string; phone: string; email?: string } | null = null

      if (mode === 'pick') {
        const chosen = customers.find(c => c.id === customerId)
        if (!customerId || !chosen) throw new Error('Lütfen bir müşteri seçin')
        customerPayload = { id: chosen.id, name: chosen.name, phone: chosen.phone, email: chosen.email || undefined }
      } else {
        if (!newName.trim() || !newPhone.trim()) {
          throw new Error('Yeni müşteri için ad ve telefon zorunludur')
        }
        customerPayload = { name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim() || undefined }
      }

      // 2) store'a yaz
      const branch = branches.find(b => b.id === branchId)
      setSetup({
        dealerId: branchId,
        dealerName: branch?.name || '',
        customerId: customerPayload?.id ?? null,
        customerName: customerPayload!.name,
        customerPhone: customerPayload!.phone,
        note: note.trim() || '',
      })

      // 3) URL’e parametre basmadan editor’a geç
      router.push('/order')
    } catch (err: any) {
      toast(err?.message || 'Hata oluştu', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-800,#111827)]">Yeni Sipariş</h1>
            <p className="text-sm text-gray-500">Önce şube/bayi ve müşteriyi seçelim</p>
          </div>
          <span className="text-xs text-gray-400">
            {loading ? 'Yükleniyor…' : 'Hazır'}
          </span>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {/* Loading skeleton – daha modern karşılık */}
        {loading ? (
          <div className="space-y-4 rounded-2xl border border-[var(--surface-200,#e5e7eb)] bg-white p-5 shadow-sm">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-[var(--surface-200,#e5e7eb)]" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-[var(--surface-200,#e5e7eb)]" />
            <div className="h-32 w-full animate-pulse rounded-xl bg-[var(--surface-200,#e5e7eb)]" />
            <div className="h-10 w-48 animate-pulse rounded-xl bg-[var(--surface-200,#e5e7eb)]" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-[var(--surface-200,#e5e7eb)] bg-white p-5 shadow-sm">
            {/* ŞUBE/BAYİ */}
            <section>
              <label className="mb-1 block text-sm font-medium">Şube / Bayi *</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
                required
              >
                <option value="" disabled>Seçiniz…</option>
                {activeBranches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.code ? ` — ${b.code}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Şubeler <b>Şirket Ayarları → Şubeler</b> üzerinden yönetilir.
              </p>
            </section>

            {/* MÜŞTERİ */}
            <section className="rounded-2xl border border-[var(--surface-200,#e5e7eb)] p-4">
              {/* Segmented control */}
              <div className="mb-4 inline-flex rounded-xl border border-[var(--surface-300,#d1d5db)] bg-[var(--surface-50,#f9fafb)] p-1">
                <button
                  type="button"
                  onClick={() => setMode('pick')}
                  className={[
                    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition',
                    mode === 'pick'
                      ? 'bg-[var(--brand-600,#111827)] text-white shadow'
                      : 'text-gray-700 hover:bg-white'
                  ].join(' ')}
                >
                  <Users className="h-4 w-4" /> Kayıtlıdan Seç
                </button>
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className={[
                    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition',
                    mode === 'create'
                      ? 'bg-[var(--brand-600,#111827)] text-white shadow'
                      : 'text-gray-700 hover:bg-white'
                  ].join(' ')}
                >
                  <UserPlus className="h-4 w-4" /> Yeni Müşteri
                </button>
              </div>

              {mode === 'pick' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium">Müşteri Ara</label>
                    <div className="relative">
                      <input
                        value={custQ}
                        onChange={(e) => setCustQ(e.target.value)}
                        className="w-full rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 pr-9 transition placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
                        placeholder="Ad, telefon veya e-posta"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Search className="h-4 w-4" />
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium">Sonuçlar</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
                      size={Math.min(8, Math.max(3, customers.length || 3))}
                    >
                      <option value="" disabled>Seçiniz…</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.phone}{c.email ? ` — ${c.email}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Seçtiğiniz müşterinin <b>adı/telefonu</b> siparişe anlık kopyalanır (snapshot).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Ad *</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 transition placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
                      placeholder="Ad Soyad"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Telefon *</label>
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 transition placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
                      placeholder="05xx xxx xx xx"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium">E-posta</label>
                    <input
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 transition placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
                      type="email"
                      placeholder="Opsiyonel"
                    />
                  </div>
                  <p className="md:col-span-2 text-xs text-gray-500">
                    Bu ekranda müşteri hesabı <b>oluşturulmaz</b>; bilgiler sipariş formuna taşınır.
                    Kaydederken telefonla eşleşirse bağlanır, yoksa oluşturulur.
                  </p>
                </div>
              )}
            </section>

            {/* Not */}
            <section>
              <label className="mb-1 block text-sm font-medium">Sipariş Notu</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 transition placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
                placeholder="Opsiyonel"
              />
            </section>

            <div className="flex gap-3">
              <button
                disabled={
                  saving ||
                  !branchId ||
                  (mode === 'pick' ? !customerId : (!newName.trim() || !newPhone.trim()))
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-600,#111827)] px-4 py-2 text-white transition hover:bg-[var(--brand-700,#0b1220)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
              >
                {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Yönlendiriliyor…</>) : (<>Devam Et <ChevronRight className="h-4 w-4" /></>)}
              </button>
              <a
                href="/orders"
                className="rounded-xl border border-[var(--surface-300,#d1d5db)] px-4 py-2 transition hover:bg-[var(--surface-50,#f9fafb)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
              >
                Vazgeç
              </a>
            </div>
          </form>
        )}
      </div>

      {/* toast root */}
      <div id="toast-root" className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2" />
    </div>
  )
}

/* ================= UI Helpers ================ */

function toast(msg: string, variant: 'info' | 'warn' | 'error' = 'info') {
  if (typeof document === 'undefined') return
  const root = document.getElementById('toast-root')
  if (!root) return
  const el = document.createElement('div')

  const base =
    'pointer-events-auto rounded-xl px-3 py-2 text-sm shadow-md border transition-all backdrop-blur-sm'
  const theme =
    variant === 'warn'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : variant === 'error'
      ? 'bg-rose-50 border-rose-200 text-rose-900'
      : 'bg-white border-[var(--surface-200,#e5e7eb)] text-gray-900'
  const accent =
    variant === 'info'
      ? 'border-l-4 border-l-[var(--brand-500,#6366F1)]'
      : variant === 'warn'
      ? 'border-l-4 border-l-amber-400'
      : 'border-l-4 border-l-rose-400'

  el.className = `${base} ${theme} ${accent}`
  el.textContent = msg
  root.appendChild(el)
  el.style.opacity = '0'
  el.style.transform = 'translateY(6px)'
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(6px)'
    setTimeout(() => el.remove(), 200)
  }, 2400)
}
