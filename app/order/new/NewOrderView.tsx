'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, Users, AlertCircle, Loader2, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
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

/* ====== helpers: tarih ====== */
function toInputDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  x.setHours(0, 0, 0, 0)
  return x
}

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

  // Teslim tarihi
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])
  const [deliveryDate, setDeliveryDate] = useState<string>(() => toInputDate(addDays(new Date(), 7)))
  const minDateStr = useMemo(() => toInputDate(today), [today])

  // Ortak
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derived
  const activeBranches = useMemo(() => branches.filter(b => b.isActive), [branches])

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

    // teslim tarihi doğrula (min: bugün)
    const picked = new Date(deliveryDate)
    picked.setHours(0, 0, 0, 0)
    if (isNaN(picked.getTime()) || picked < today) {
      toast('Teslim tarihi bugünden önce olamaz.', 'warn')
      return
    }

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
      const payload: any = {
        dealerId: branchId,
        dealerName: branch?.name || '',
        customerId: customerPayload?.id ?? null,
        customerName: customerPayload!.name,
        customerPhone: customerPayload!.phone,
        note: note.trim() || '',
        deliveryDate: deliveryDate, // YYYY-MM-DD
      }
      setSetup(payload)

      // 3) URL’e parametre basmadan editor’a geç
      router.push('/order')
    } catch (err: any) {
      toast(err?.message || 'Hata oluştu', 'error')
    } finally {
      setSaving(false)
    }
  }

  // hızlı seçim butonları
  const quickSet = (days: number) => setDeliveryDate(toInputDate(addDays(today, days)))

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-800,#111827)]">Yeni Sipariş</h1>
            <p className="text-sm text-gray-500">Önce şube/bayi, müşteri ve teslim tarihini belirleyin</p>
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

        {/* Loading skeleton */}
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

            {/* Teslim Tarihi */}
            <section>
              <label className="mb-1 block text-sm font-medium">Teslim Tarihi *</label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <TurkishDatePicker
                  value={deliveryDate}
                  min={minDateStr}
                  onChange={(v) => setDeliveryDate(v)}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => quickSet(0)}
                    className="rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 text-sm hover:bg-[var(--surface-50,#f9fafb)]"
                    title="Bugün"
                  >
                    Bugün
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSet(3)}
                    className="rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 text-sm hover:bg-[var(--surface-50,#f9fafb)]"
                    title="+3 gün"
                  >
                    +3
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSet(7)}
                    className="rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 text-sm hover:bg-[var(--surface-50,#f9fafb)]"
                    title="+7 gün"
                  >
                    +7
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSet(14)}
                    className="rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 text-sm hover:bg-[var(--surface-50,#f9fafb)]"
                    title="+14 gün"
                  >
                    +14
                  </button>
                </div>
              </div>
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
                  (mode === 'pick' ? !customerId : (!newName.trim() || !newPhone.trim())) ||
                  !deliveryDate
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

/* ================= Türkçe Tarih Seçici ================= */

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parseYMD(s?: string) {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function useOutside(handler: () => void) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!node) return
      if (!node.contains(e.target as Node)) handler()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handler() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [node, handler])
  return { setRef: setNode }
}

function trMonthName(d: Date) {
  return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(d)
}
const TR_WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] // Pazartesi başlangıç

function buildMonthGrid(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  let startIdx = (first.getDay() + 6) % 7 // Pazartesi=0 olacak şekilde kaydır
  const start = new Date(first)
  start.setDate(first.getDate() - startIdx)

  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push(d)
  }
  return cells
}

function formatTR(d: Date) {
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function TurkishDatePicker({
  value,
  min,
  onChange,
}: {
  value: string
  min?: string
  onChange: (v: string) => void
}) {
  const selected = parseYMD(value) || new Date()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<Date>(() => parseYMD(value) || new Date())
  const minDate = parseYMD(min || '')

  useEffect(() => {
    const v = parseYMD(value)
    if (v) setView(v)
  }, [value])

  const { setRef } = useOutside(() => setOpen(false))

  const disableTyping = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Enter']
    if (!allowed.includes(e.key)) e.preventDefault()
  }

  return (
    <div className="relative" ref={setRef}>
      {/* Görünen text input (elle yazma kilitli) */}
      <input
        lang="tr-TR"
        type="text"
        value={formatTR(selected)}
        onKeyDown={disableTyping}
        onBeforeInput={(e) => e.preventDefault()}
        onPaste={(e) => e.preventDefault()}
        readOnly
        onClick={() => setOpen((s) => !s)}
        className="w-full cursor-pointer rounded-xl border border-[var(--surface-300,#d1d5db)] px-3 py-2 pr-9 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500,#6366F1)] focus-visible:ring-offset-2"
        aria-label="Tarih seç"
      />
      {/* takvim ikonu */}
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        aria-hidden
      >
        <CalendarIcon className="h-4 w-4" />
      </span>

      {open && (
        <div
          className="
            absolute z-50 mt-2 w-[280px] rounded-2xl border
            border-[var(--surface-200,#e5e7eb)] bg-white p-3 shadow-xl
          "
          role="dialog"
          aria-label="Takvim"
        >
          {/* Başlık */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--surface-300,#d1d5db)] hover:bg-[var(--surface-50,#f9fafb)]"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              aria-label="Önceki ay"
            >
              ‹
            </button>
            <div className="text-sm font-semibold capitalize">
              {trMonthName(view)}
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--surface-300,#d1d5db)] hover:bg-[var(--surface-50,#f9fafb)]"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              aria-label="Sonraki ay"
            >
              ›
            </button>
          </div>

          {/* Haftalık başlıklar */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-500">
            {TR_WEEKDAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Günler */}
          <div className="mt-1 grid grid-cols-7 gap-1">
            {buildMonthGrid(view).map((d) => {
              const inMonth = d.getMonth() === view.getMonth()
              const isSelected = sameDay(d, selected)
              const isToday = sameDay(d, new Date())
              const isDisabled = !!minDate && d < minDate

              const base = "h-9 w-9 rounded-lg text-sm flex items-center justify-center transition"
              const tone =
                isDisabled ? "text-gray-300 cursor-not-allowed"
                : isSelected ? "bg-[var(--brand-600,#111827)] text-white"
                : isToday ? "border border-[var(--brand-400,#9CA3AF)]"
                : inMonth ? "text-gray-900 hover:bg-[var(--surface-50,#f9fafb)]"
                : "text-gray-400 hover:bg-[var(--surface-50,#f9fafb)]"

              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={isDisabled}
                  className={`${base} ${tone}`}
                  onClick={() => {
                    onChange(ymd(d))
                    setOpen(false)
                  }}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {/* Bugün / Kapat */}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              className="text-xs text-gray-600 hover:underline"
              onClick={() => {
                const t = new Date(); t.setHours(0,0,0,0)
                if (minDate && t < minDate) {
                  onChange(ymd(minDate))
                } else {
                  onChange(ymd(t))
                }
                setView(parseYMD(value) || new Date())
                setOpen(false)
              }}
            >
              Bugün
            </button>
            <button
              type="button"
              className="text-xs text-gray-600 hover:underline"
              onClick={() => setOpen(false)}
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
