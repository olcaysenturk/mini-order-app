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
} from 'recharts'

type Status = 'pending' | 'processing' | 'completed' | 'cancelled'

type ApiResp = {
  mode: string
  statuses: Status[]
  currency: 'TRY' | string
  totals: { day: number; week: number; month: number; year: number }
  series30d: { date: string; total: number }[]
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(n ?? 0)
  )

type FilterKey = 'active' | 'completed' | 'all'
const STATUS_PRESETS: Record<FilterKey, string> = {
  active: 'pending,processing,completed',
  completed: 'completed',
  all: 'pending,processing,completed,cancelled',
}

export default function ReportsPage() {
  const [data, setData] = useState<ApiResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('active')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const qs = `?status=${encodeURIComponent(STATUS_PRESETS[filter])}`
      const res = await fetch(`/api/reports${qs}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Rapor verileri alınamadı')
      const json: ApiResp = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e?.message || 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // ====== Türev bilgiler
  const chartData = useMemo(() => data?.series30d ?? [], [data])
  const stats = useMemo(() => {
    if (!chartData.length) return { avg: 0, max: 0, maxDate: '—' }
    const totals = chartData.map((d) => Number(d.total || 0))
    const sum = totals.reduce((a, b) => a + b, 0)
    const avg = sum / totals.length
    let max = -Infinity
    let maxDate = chartData[0].date
    for (const d of chartData) {
      if (d.total > max) {
        max = d.total
        maxDate = d.date
      }
    }
    return { avg, max, maxDate }
  }, [chartData])

  // ====== CSV export
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
      {/* Başlık + actions */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Raporlar</h1>
        <div className="flex items-center gap-2">
          {/* Segmented filter */}
          <div
            role="tablist"
            aria-label="Durum filtresi"
            className="inline-flex rounded-xl border border-neutral-200 bg-white p-0.5"
          >
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
                className={`px-3 py-1.5 text-sm rounded-[10px] transition ${
                  filter === k ? 'bg-indigo-600 text-white' : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={load}
            disabled={loading}
            title="Listeyi yenile"
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

      {/* Metrik kartları */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Bugün" value={data ? fmtMoney(data.totals.day) : null} />
        <MetricCard label="Bu Hafta" value={data ? fmtMoney(data.totals.week) : null} />
        <MetricCard label="Bu Ay" value={data ? fmtMoney(data.totals.month) : null} />
        <MetricCard label="Bu Yıl" value={data ? fmtMoney(data.totals.year) : null} />
      </section>

      {/* Özet satırı */}
      <div className="mb-3 text-sm text-neutral-600">
        {loading ? (
          <span className="inline-block h-4 w-64 animate-pulse rounded bg-neutral-200" />
        ) : chartData.length ? (
          <>
            Son 30 gün <b>günlük ortalama</b> {fmtMoney(stats.avg)} ₺ · <b>en iyi gün</b>{' '}
            {stats.maxDate} ({fmtMoney(stats.max)} ₺)
          </>
        ) : (
          'Veri yok.'
        )}
      </div>

      {/* Son 30 gün grafiği */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold">Son 30 Gün Ciro (TRY)</div>
        <div className="h-[320px] w-full">
          {loading && !data ? (
            <div className="h-full w-full animate-pulse rounded-xl bg-neutral-100" />
          ) : (
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={16} />
                <YAxis tickFormatter={(v) => fmtMoney(Number(v))} width={80} />
                <Tooltip
                  formatter={(v: any) => fmtMoney(Number(v))}
                  labelFormatter={(l) => `Tarih: ${l}`}
                />
                {/* Ortalama referans çizgisi */}
                {chartData.length > 0 && (
                  <ReferenceLine
                    y={stats.avg}
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    ifOverflow="extendDomain"
                  />
                )}
                {/* Renk belirtmesek de okunaklı; default çizgi */}
                <Line type="monotone" dataKey="total" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string | null }) {
  const loading = value === null
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
        {/* tiny icon */}
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
