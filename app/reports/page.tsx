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
} from 'recharts'

type ApiResp = {
  mode: string
  statuses: ('pending' | 'processing' | 'completed' | 'cancelled')[]
  currency: 'TRY' | string
  totals: { day: number; week: number; month: number; year: number }
  series30d: { date: string; total: number }[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

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
      const res = await fetch(`/api/reports${qs}`, { next: { revalidate: 60 } })

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

  const chartData = useMemo(() => data?.series30d ?? [], [data])

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold">Raporlar</h1>
        <div className="flex items-center gap-2">
          <select
            className="select h-[40px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            title="Durum filtresi"
          >
            <option value="active">Aktif (Beklemede+İşlemde+Tamamlandı)</option>
            <option value="completed">Sadece Tamamlananlar</option>
            <option value="all">Tümü (İptal dahil)</option>
          </select>
          <button className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-600">
          {error}
        </div>
      )}

      {/* Metrik kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Bugün" value={data ? fmt(data.totals.day) : '—'} />
        <MetricCard label="Bu Hafta" value={data ? fmt(data.totals.week) : '—'} />
        <MetricCard label="Bu Ay" value={data ? fmt(data.totals.month) : '—'} />
        <MetricCard label="Bu Yıl" value={data ? fmt(data.totals.year) : '—'} />
      </div>

      {/* Son 30 gün grafiği */}
      <div className="card p-4">
        <div className="text-sm font-semibold mb-3">Son 30 Gün Ciro (TRY)</div>
        <div className="w-full h-[320px]">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(v) => fmt(Number(v))}
                width={80}
              />
              <Tooltip
                formatter={(v) => fmt(Number(v))}
                labelFormatter={(l) => `Tarih: ${l}`}
              />
              {/* renk belirtmeyin: default (lint/stil sade) */}
              <Line type="monotone" dataKey="total" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-2xl p-4 dark:border-gray-800">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-semibold tracking-wide">{value} ₺</div>
    </div>
  )
}
