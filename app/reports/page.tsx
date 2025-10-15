'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

type Status = 'pending' | 'processing' | 'completed' | 'cancelled'
type FilterKey = 'active' | 'completed' | 'all'
const STATUS_PRESETS: Record<FilterKey, string> = {
  active: 'pending,processing,completed',
  completed: 'completed',
  all: 'pending,processing,completed,cancelled',
}
const fmtMoney = (n: number | undefined | null) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n ?? 0))
const fmtInt = (n: number | undefined | null) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(n ?? 0))

/** ---------- API shapes (section bazlı) ---------- */
// overview (mevcut datana uyumlu)
type OverviewResp = {
  mode: string
  statuses: Status[]
  currency: 'TRY' | string
  totals: { day: number; week: number; month: number; year: number }
  series30d: { date: string; total: number }[]
}

// payments: ödenen/ödenmeyen, yöntem dağılımı, kümülatif
type PaymentsResp = {
  paid: { amount: number; count: number }
  unpaid: { amount: number; count: number }
  methods: { method: 'CASH' | 'TRANSFER' | 'CARD' | string; amount: number; count: number }[]
  last30dCumulative?: { date: string; paid: number; unpaid: number }[]
}

// categories: kategori ve kategori+varyant kırılımı
type CategoriesResp = {
  byCategory: { category: string; amount: number; qty: number }[]
}
type VariantsResp = {
  topVariants: { variant: string; category?: string; amount: number; qty: number }[]
}

// customers: top müşteriler
type CustomersResp = {
  topCustomers: { customer: string; orders: number; amount: number }[]
}

export default function ReportsPage() {
  const [filter, setFilter] = useState<FilterKey>('active')

  // data buckets
  const [over, setOver] = useState<OverviewResp | null>(null)
  const [pay, setPay] = useState<PaymentsResp | null>(null)
  const [cats, setCats] = useState<CategoriesResp | null>(null)
  const [vars, setVars] = useState<VariantsResp | null>(null)
  const [cust, setCust] = useState<CustomersResp | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const statusQs = `status=${encodeURIComponent(STATUS_PRESETS[filter])}`
      const [r1, r2, r3, r4, r5] = await Promise.all([
        fetch(`/api/reports?section=overview&${statusQs}`, { cache: 'no-store' }),
        fetch(`/api/reports?section=payments&${statusQs}`, { cache: 'no-store' }),
        fetch(`/api/reports?section=categories&${statusQs}`, { cache: 'no-store' }),
        fetch(`/api/reports?section=variants&${statusQs}`, { cache: 'no-store' }),
        fetch(`/api/reports?section=customers&${statusQs}`, { cache: 'no-store' }),
      ])

      // section’lar opsiyonel olabilir — tek tek güvenle parse et
      setOver(r1.ok ? ((await r1.json()) as OverviewResp) : null)
      setPay(r2.ok ? ((await r2.json()) as PaymentsResp) : null)
      setCats(r3.ok ? ((await r3.json()) as CategoriesResp) : null)
      setVars(r4.ok ? ((await r4.json()) as VariantsResp) : null)
      setCust(r5.ok ? ((await r5.json()) as CustomersResp) : null)
    } catch (e: any) {
      setError(e?.message || 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // ---- türevler
  const chartData = useMemo(() => over?.series30d ?? [], [over])
  const avgMax = useMemo(() => {
    if (!chartData.length) return { avg: 0, max: 0, maxDate: '—' }
    const totals = chartData.map((d) => Number(d.total || 0))
    const sum = totals.reduce((a, b) => a + b, 0)
    const avg = sum / totals.length
    let max = -Infinity
    let maxDate = chartData[0].date
    for (const d of chartData) {
      if (d.total > max) {
        max = d.total; maxDate = d.date
      }
    }
    return { avg, max, maxDate }
  }, [chartData])

  // colors for pies/bars (recharts default renkleri de OK; burada nazikçe birkaç ton)
  const PIE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9', '#A855F7', '#84CC16']

  // ---- CSV export (series30d)
  const downloadCSV = () => {
    if (!chartData.length) return
    const rows = [['Tarih', 'Toplam (TRY)'], ...chartData.map((x) => [x.date, String(x.total)])]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapor_son30gun_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Raporlar</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* segmented */}
          <div role="tablist" aria-label="Durum filtresi" className="inline-flex rounded-xl border border-neutral-200 bg-white p-0.5">
            {([
              { k: 'active', label: 'Aktif' },
              { k: 'completed', label: 'Tamamlanan' },
              { k: 'all', label: 'Tümü' },
            ] as { k: FilterKey; label: string }[]).map(({ k, label }) => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 text-sm rounded-[10px] transition ${filter === k ? 'bg-indigo-600 text-white' : 'text-neutral-700 hover:bg-neutral-50'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={loadAll}
            disabled={loading}
            title="Yenile"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="currentColor" d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z" />
            </svg>
            {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>

          <button
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            onClick={downloadCSV}
            disabled={!chartData.length}
            title="Son 30 gün CSV indir"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="currentColor" d="M12 3v10l4-4 1.4 1.4L12 17l-5.4-6.6L8 9l4 4V3zM5 19h14v2H5z" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Bugün" value={over ? fmtMoney(over.totals.day) : null} />
        <MetricCard label="Bu Hafta" value={over ? fmtMoney(over.totals.week) : null} />
        <MetricCard label="Bu Ay" value={over ? fmtMoney(over.totals.month) : null} />
        <MetricCard label="Bu Yıl" value={over ? fmtMoney(over.totals.year) : null} />
      </section>

      {/* Ödemeler: alınan / bekleyen + yöntem dağılımı */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sol: ödenen/ödenmeyen özet */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Ödeme Durumu</div>
          {!pay ? (
            <SkeletonBox />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatTile title="Ödenen" amount={fmtMoney(pay.paid?.amount)} count={fmtInt(pay.paid?.count)} accent="emerald" />
              <StatTile title="Bekleyen" amount={fmtMoney(pay.unpaid?.amount)} count={fmtInt(pay.unpaid?.count)} accent="rose" />
              <div className="col-span-2 mt-2 text-xs text-neutral-600">
                {pay.last30dCumulative?.length ? 'Son 30 gün kümülatif görünüm sağ sütunda.' : 'Detay grafiği mevcut değil.'}
              </div>
            </div>
          )}
        </div>

        {/* Orta: ödeme yöntemi dağılımı (pie) */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Ödeme Yöntemi Dağılımı</div>
          {!pay || !pay.methods?.length ? (
            <SkeletonBox />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie dataKey="amount" data={pay.methods} innerRadius={50} outerRadius={80} label>
                    {pay.methods.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${fmtMoney(Number(v))} ₺`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Sağ: kümülatif paid/unpaid (bar/line) */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Son 30 Gün Kümülatif (Ödeme)</div>
          {!pay?.last30dCumulative?.length ? (
            <SkeletonBox />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer>
                <BarChart data={pay.last30dCumulative}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={16} />
                  <YAxis tickFormatter={(v) => fmtMoney(Number(v))} width={70} />
                  <Tooltip formatter={(v: any) => `${fmtMoney(Number(v))} ₺`} />
                  <Bar dataKey="paid" stackId="a" />
                  <Bar dataKey="unpaid" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Son 30 gün ciro (mevcut grafiğin geliştirilmiş versiyonu) */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold">Son 30 Gün Ciro (TRY)</div>
        <div className="mb-3 text-sm text-neutral-600">
          {chartData.length
            ? <>Günlük ortalama <b>{fmtMoney(avgMax.avg)}</b> ₺ · En iyi gün <b>{avgMax.maxDate}</b> ({fmtMoney(avgMax.max)} ₺)</>
            : 'Veri yok.'}
        </div>
        <div className="h-[320px] w-full">
          {!chartData.length ? (
            <SkeletonBox />
          ) : (
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={16} />
                <YAxis tickFormatter={(v) => fmtMoney(Number(v))} width={80} />
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} labelFormatter={(l) => `Tarih: ${l}`} />
                {chartData.length > 0 && (
                  <ReferenceLine y={avgMax.avg} strokeDasharray="4 4" strokeOpacity={0.6} ifOverflow="extendDomain" />
                )}
                <Line type="monotone" dataKey="total" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Kategori / Varyant kırılımı */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Kategori */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Kategori Bazlı Satış (₺)</div>
          {!cats?.byCategory?.length ? (
            <SkeletonBox />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer>
                <BarChart data={cats.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-10} height={60} />
                  <YAxis tickFormatter={(v) => fmtMoney(Number(v))} width={80} />
                  <Tooltip formatter={(v: any) => `${fmtMoney(Number(v))} ₺`} />
                  <Bar dataKey="amount" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* En popüler varyantlar */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">En Popüler Varyantlar</div>
          {!vars?.topVariants?.length ? (
            <SkeletonBox />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                    <th>Varyant</th>
                    <th>Kategori</th>
                    <th className="text-right">Adet</th>
                    <th className="text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vars.topVariants.map((v, i) => (
                    <tr key={i} className="[&>td]:px-3 [&>td]:py-2">
                      <td className="font-medium">{v.variant}</td>
                      <td>{v.category || '—'}</td>
                      <td className="text-right">{fmtInt(v.qty)}</td>
                      <td className="text-right">{fmtMoney(v.amount)} ₺</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* En çok sipariş veren müşteriler */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold">En Çok Sipariş Veren Müşteriler</div>
        {!cust?.topCustomers?.length ? (
          <SkeletonBox />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                  <th>Müşteri</th>
                  <th className="text-right">Sipariş</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cust.topCustomers.map((c, i) => (
                  <tr key={i} className="[&>td]:px-3 [&>td]:py-2">
                    <td className="font-medium">{c.customer}</td>
                    <td className="text-right">{fmtInt(c.orders)}</td>
                    <td className="text-right">{fmtMoney(c.amount)} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

/* ---------- UI Helpers ---------- */
function MetricCard({ label, value }: { label: string; value: string | null }) {
  const loading = value === null
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
          <path fill="currentColor" d="M4 20h16v-2H4zM6 16h3V8H6zm5 0h3V4h-3zm5 0h3v-6h-3z" />
        </svg>
        {label}
      </div>
      {loading ? (
        <div className="h-6 w-24 animate-pulse rounded bg-neutral-200" />
      ) : (
        <div className="text-lg font-semibold tracking-wide">{value} ₺</div>
      )}
    </div>
  )
}

function SkeletonBox() {
  return <div className="h-[260px] w-full animate-pulse rounded-xl bg-neutral-100" />
}

function StatTile({
  title, amount, count, accent = 'indigo',
}: { title: string; amount: string; count: string; accent?: 'indigo' | 'emerald' | 'rose' }) {
  const tone =
    accent === 'emerald'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : accent === 'rose'
      ? 'text-rose-700 bg-rose-50 border-rose-200'
      : 'text-indigo-700 bg-indigo-50 border-indigo-200'
  return (
    <div className={`rounded-xl border ${tone} p-3`}>
      <div className="text-xs">{title}</div>
      <div className="mt-1 text-base font-semibold">{amount} ₺</div>
      <div className="text-xs">({count} sipariş)</div>
    </div>
  )
}
