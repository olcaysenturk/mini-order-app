'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

/* ========= Types ========= */
type Variant = { id: string; name: string; unitPrice: number }
type Category = {
  id: string
  name: string
  _count?: { variants: number }
  variants?: Variant[] // eski API uyumluluğu için (ilk yükle fallback)
}

const DEFAULT_CATEGORIES = ['TÜL PERDE', 'FON PERDE', 'GÜNEŞLİK', 'STOR PERDE', 'AKSESUAR'] as const
const ORDER = new Map(DEFAULT_CATEGORIES.map((n, i) => [n, i]))

const PERDEXA_GRAD =
  'bg-[radial-gradient(1200px_600px_at_100%_-10%,rgba(99,102,241,0.20),transparent_50%),radial-gradient(900px_500px_at_-10%_-10%,rgba(168,85,247,0.18),transparent_50%)]'

function ciEq(a: string, b: string) {
  return a.trim().toLocaleUpperCase('tr-TR') === b.trim().toLocaleUpperCase('tr-TR')
}
function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Global düzenleme: varId -> draft
  const [editing, setEditing] = useState<Record<string, Variant>>({})

  const sortFixed = (arr: Category[]) => {
    const getOrder = (name: string) => {
      const def = DEFAULT_CATEGORIES.find(def => ciEq(def, name))
      return def ? ORDER.get(def) : undefined
    }
    return [...arr].sort((a, b) => {
      const ao = getOrder(a.name) ?? Number.MAX_SAFE_INTEGER
      const bo = getOrder(b.name) ?? Number.MAX_SAFE_INTEGER
      return ao - bo
    })
  }

  const fetchCategories = async (): Promise<Category[]> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' })
      if (!res.ok) throw new Error('Kategoriler alınamadı')
      const data: Category[] = await res.json()
      const sorted = sortFixed(data)
      setCategories(sorted)
      return sorted
    } catch (e: any) {
      setError(e?.message || 'Bilinmeyen hata')
      return []
    } finally {
      setLoading(false)
    }
  }

  // Varsayılan kategoriler eksikse oluştur
  const ensureDefaults = async (list: Category[]) => {
    const existingNames = list.map(c => c.name)
    const missing = DEFAULT_CATEGORIES.filter(def => !existingNames.some(n => ciEq(n, def)))
    if (missing.length === 0) return false
    await Promise.all(
      missing.map(async (name) => {
        const r = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!r.ok && r.status !== 409) {
          const t = await r.text().catch(() => '')
          console.error('Kategori oluşturulamadı:', name, t)
        }
      })
    )
    return true
  }

  useEffect(() => {
    (async () => {
      const list = await fetchCategories()
      const createdAny = await ensureDefaults(list)
      if (createdAny) await fetchCategories()
    })()
  }, [])

  const totalVariants = useMemo(() => {
    return categories.reduce((acc, c) => {
      const cnt = c._count?.variants ?? c.variants?.length ?? 0
      return acc + cnt
    }, 0)
  }, [categories])

  // --- Üst listeyi panelden güncelleyen yardımcılar ---
  const bumpVariantCount = (catId: string, delta: number) => {
    setCategories(prev =>
      prev.map(c => {
        if (c.id !== catId) return c
        const current = c._count?.variants ?? c.variants?.length ?? 0
        return { ...c, _count: { variants: Math.max(0, current + delta) } }
      })
    )
  }
  const patchVariantInCategory = (catId: string, v: Variant) => {
    setCategories(prev =>
      prev.map(c => {
        if (c.id !== catId) return c
        if (!Array.isArray(c.variants)) return c
        return { ...c, variants: c.variants.map(x => (x.id === v.id ? { ...x, ...v } : x)) }
      })
    )
  }
  const addVariantIntoCategory = (catId: string, v: Variant) => {
    setCategories(prev =>
      prev.map(c => {
        if (c.id !== catId) return c
        return {
          ...c,
          variants: Array.isArray(c.variants) ? [v, ...c.variants] : c.variants,
          _count: { variants: (c._count?.variants ?? c.variants?.length ?? 0) + 1 },
        }
      })
    )
  }
  const removeVariantFromCategory = (catId: string, varId: string) => {
    setCategories(prev =>
      prev.map(c => {
        if (c.id !== catId) return c
        return {
          ...c,
          variants: Array.isArray(c.variants) ? c.variants.filter(v => v.id !== varId) : c.variants,
          _count: { variants: Math.max(0, (c._count?.variants ?? c.variants?.length ?? 0) - 1) },
        }
      })
    )
  }

  const Skeleton = () => (
    <div className="animate-pulse rounded-2xl border border-neutral-200 p-4">
      <div className="h-4 w-40 rounded bg-neutral-200" />
      <div className="mt-2 h-3 w-64 rounded bg-neutral-200" />
      <div className="mt-4 h-24 w-full rounded bg-neutral-100" />
    </div>
  )

  return (
    <main className={`mx-auto max-w-7xl p-4 sm:p-6 ${PERDEXA_GRAD}`}>
      {/* HERO */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-indigo-100/40 bg-white/70 p-5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path fill="currentColor" d="M3 5h18v2H3zm3 6h12v2H6zm-3 6h18v2H3z" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Kategoriler & Ürünler</h1>
              <p className="mt-0.5 text-sm text-neutral-600">Perdexa stok ve fiyat yönetimi</p>
            </div>
            {loading && <span className="ms-1 text-xs text-neutral-400">Yükleniyor…</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-xl bg-white/80 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
              Kategori: <strong className="ms-1">{categories.length}</strong>
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-white/80 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
              Ürün: <strong className="ms-1">{totalVariants}</strong>
            </span>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={fetchCategories}
              disabled={loading}
              title="Yenile"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z" />
              </svg>
              {loading ? 'Yükleniyor…' : 'Yenile'}
            </button>
          </div>
        </div>
      </div>

      {/* Bilgi */}
     

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* KATEGORİLER — YENİ ACCORDION */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {loading && categories.length === 0 && (
          <>
            <Skeleton /><Skeleton /><Skeleton />
          </>
        )}

        {!loading && categories.map((cat, i) => {
          const variantCount = cat._count?.variants ?? cat.variants?.length ?? 0

          return (
            <details
              key={cat.id}
              className="group rounded-2xl border border-neutral-200 bg-white/80 shadow-sm backdrop-blur open:shadow-md open:border-neutral-300"
            >
              {/* SUMMARY (tamamı tıklanabilir) */}
              <summary
                className="flex cursor-pointer list-none items-center gap-3 px-4 py-3"
                // <summary> default marker'ı gizle
                style={{ listStyle: 'none' } as any}
              >
                {/* Sol rozet + caret (liste görünümüyle aynı doku) */}
                <span
                  aria-hidden
                  className="grid size-7 place-items-center rounded-lg bg-neutral-100 text-[11px] font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200"
                  title="Aç / Kapat"
                >
                  {/* caret */}
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4 transition-transform group-open:rotate-90"
                  >
                    <path fill="currentColor" d="M9 6l6 6l-6 6" />
                  </svg>
                </span>

                {/* Başlık */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{cat.name}</div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-neutral-500">Kategori ürün yönetimi</div>
                </div>

                {/* Sağ sayaç rozet + mini toggle (liste aksiyon hissi) */}
                <span className="inline-flex items-center gap-1 rounded-xl bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                  {variantCount} ürün
                </span>

                {/* İkincil “toggle” görünümü — görsel vurgu, summary zaten tıklanabilir */}
                <span
                  className="ms-1 inline-flex h-8 items-center justify-center rounded-xl border border-neutral-200 bg-white px-2 text-xs text-neutral-700 shadow-sm group-open:bg-neutral-50"
                  aria-hidden
                >
                  { /* Kapalı → “Aç”, Açık → “Kapat” */ }
                  <span className="group-open:hidden">Aç</span>
                  <span className="hidden group-open:inline">Kapat</span>
                </span>
              </summary>

              {/* PANEL */}
              <div className="px-2 pb-4 pt-1 sm:px-3">
                <VariantPanel
                  cat={cat}
                  globalEditing={editing}
                  setGlobalEditing={setEditing}
                  onVariantAdded={(v) => addVariantIntoCategory(cat.id, v)}
                  onVariantRemoved={(varId) => removeVariantFromCategory(cat.id, varId)}
                  onVariantUpdated={(v) => patchVariantInCategory(cat.id, v)}
                  onBumpCount={(delta) => bumpVariantCount(cat.id, delta)}
                  rowOffset={i}
                />
              </div>
            </details>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 text-sm text-neutral-600">
        Toplam kategori: <b>{categories.length}</b> • Toplam ürün: <b>{totalVariants}</b>
      </div>

      {/* Safari accordion fix + summary marker gizle */}
      <style jsx global>{`
        details > summary::-webkit-details-marker { display: none; }
        @supports (-webkit-touch-callout: none) {
          details[open] { transition: all 0.2s ease; }
        }
      `}</style>
    </main>
  )
}

/* ================= Variants — İstemci Sayfalama (Perdexa tasarımıyla) ================= */

type PageResp = Variant[]

function VariantPanel({
  cat,
  globalEditing,
  setGlobalEditing,
  onVariantAdded,
  onVariantRemoved,
  onVariantUpdated,
  onBumpCount,
  rowOffset = 0, // sıra rozet hesaplaması için
}: {
  cat: Category
  globalEditing: Record<string, Variant>
  setGlobalEditing: React.Dispatch<React.SetStateAction<Record<string, Variant>>>
  onVariantAdded: (v: Variant) => void
  onVariantRemoved: (varId: string) => void
  onVariantUpdated: (v: Variant) => void
  onBumpCount: (delta: number) => void
  rowOffset?: number
}) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 300)
  const [sort, setSort] = useState<'name_asc' | 'price_asc' | 'price_desc'>('name_asc')
  const [take, setTake] = useState<number>(20)
  const [page, setPage] = useState(0)

  const [all, setAll] = useState<Variant[]>(cat.variants ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  useEffect(() => {
    if (cat.variants && cat.variants.length) return
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/categories/${cat.id}/variants`, { cache: 'no-store' })
        if (!res.ok) throw new Error('endpoint_unavailable')
        const data: PageResp = await res.json()
        setAll(Array.isArray(data) ? data : [])
      } catch (e: any) {
        setError(e?.message || 'Ürünler alınamadı')
        setAll([])
      } finally {
        setLoading(false)
      }
    })()
  }, [cat.id, cat.variants])

  const filteredSorted = useMemo(() => {
    let out = all
    const needle = dq.trim().toLocaleLowerCase('tr-TR')
    if (needle) out = out.filter(v => v.name.toLocaleLowerCase('tr-TR').includes(needle))
    out = [...out].sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'tr')
      if (sort === 'price_asc') return (a.unitPrice || 0) - (b.unitPrice || 0)
      return (b.unitPrice || 0) - (a.unitPrice || 0)
    })
    
    if (lastAddedId) {
    const i = out.findIndex(x => x.id === lastAddedId)
    if (i > 0) {
      const [pinned] = out.splice(i, 1)
      out.unshift(pinned)
    }
  }
    return out
  }, [all, dq, sort, lastAddedId])

  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / take))
  const current = useMemo(
    () => filteredSorted.slice(page * take, page * take + take),
    [filteredSorted, page, take]
  )
  useEffect(() => { setPage(0) }, [dq, sort, take])

  const startEdit = (v: Variant) => setGlobalEditing(prev => ({ ...prev, [v.id]: { ...v } }))
  const cancelEdit = (id: string) => setGlobalEditing(prev => {
    const p = { ...prev }; delete p[id]; return p
  })
  const onEditChange = (id: string, patch: Partial<Variant>) =>
    setGlobalEditing(prev => ({ ...prev, [id]: { ...prev[id], ...patch } as Variant }))

  const saveVariant = async (varId: string) => {
    const draft = globalEditing[varId]; if (!draft) return
    const payload = { name: String(draft.name || '').trim(), unitPrice: Number(draft.unitPrice) || 0 }
    const res = await fetch(`/api/variants/${varId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated: Variant = await res.json()
      setAll(prev => prev.map(v => (v.id === varId ? { ...v, ...updated } : v)))
      onVariantUpdated(updated); cancelEdit(varId); toast.success('Ürün güncellendi')
    } else toast.error('Ürün güncellenemedi')
  }

  const addVariant = async () => {
  const res = await fetch(`/api/categories/${cat.id}/variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Yeni Ürün', unitPrice: 0 }),
  })
  if (res.ok) {
    const v: Variant = await res.json()
    setAll(prev => [v, ...prev])         // ⬅️ Baştan ekle
    setLastAddedId(v.id)                 // ⬅️ Pinned olarak işaretle
    setPage(0)                           // ⬅️ İlk sayfaya dön
    setGlobalEditing(prev => ({ ...prev, [v.id]: v }))
    onVariantAdded(v)
    onBumpCount(1)
    toast.success('Ürün eklendi')
  } else {
    toast.error('Ürün eklenemedi')
  }
}

  const removeVariant = async (varId: string) => {
    if (!confirm('Ürün silinsin mi?')) return
    const res = await fetch(`/api/variants/${varId}`, { method: 'DELETE' })
    if (res.ok) {
      setAll(prev => prev.filter(v => v.id !== varId))
      cancelEdit(varId); onVariantRemoved(varId); onBumpCount(-1); toast.success('Ürün silindi')
    } else toast.error('Ürün silinemedi')
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              className="h-10 w-64 rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              placeholder="Ürün ara"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Ürün ara"
            />
            <svg className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24">
              <path fill="currentColor" d="M10.5 3.75a6.75 6.75 0 1 1-4.77 11.53l-2 2a.75.75 0 1 1-1.06-1.06l2-2A6.75 6.75 0 0 1 10.5 3.75m0 1.5a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 0 0 0-10.5"/>
            </svg>
          </div>

          <select
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            aria-label="Sırala"
          >
            <option value="name_asc">Ada göre (A→Z)</option>
            <option value="price_asc">Fiyat (Artan)</option>
            <option value="price_desc">Fiyat (Azalan)</option>
          </select>

          <select
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            value={take}
            onChange={(e) => setTake(Number(e.target.value))}
            aria-label="Sayfa boyutu"
          >
            <option value={10}>10 / sayfa</option>
            <option value={20}>20 / sayfa</option>
            <option value={30}>30 / sayfa</option>
            <option value={50}>50 / sayfa</option>
          </select>
        </div>

        <div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50"
            onClick={addVariant}
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="currentColor" d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z"/></svg>
            Ürün Ekle
          </button>
        </div>
      </div>

      {/* Hata */}
      {error && <div className="m-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* Desktop Tablo */}
      <div className="hidden md:block">
        <div className="overflow-auto">
          <table className="min-w-[780px] w-full text-sm">
            <thead className="sticky top-0 border-b bg-neutral-50/70 backdrop-blur supports-[backdrop-filter]:bg-neutral-50/60">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="p-3">#</th>
                <th className="p-3">Ürün Adı</th>
                <th className="w-56 p-3">Birim Fiyat</th>
                <th className="w-56 p-3 text-right">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {current.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-neutral-600">Kayıt bulunamadı.</td></tr>
              )}

              {current.map((v, idx) => {
                const draft = globalEditing[v.id]
                const name = draft ? draft.name : v.name
                const price = draft ? Number(draft.unitPrice) : Number(v.unitPrice)
                return (
                  <tr key={v.id} className="border-t hover:bg-neutral-50/50">
                    <td className="p-3 align-middle text-neutral-500">
                      <span className="inline-flex size-6 items-center justify-center rounded-lg bg-neutral-100 text-[11px] font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200">
                        {page * take + idx + 1}
                      </span>
                    </td>
                    <td className="p-3 align-middle">
                      <input
                        className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        value={name}
                        onFocus={() => !draft && startEdit(v)}
                        onChange={e => onEditChange(v.id, { name: e.target.value })}
                        placeholder="Ürün adı"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveVariant(v.id)
                          if (e.key === 'Escape') cancelEdit(v.id)
                        }}
                      />
                    </td>
                    <td className="p-3 align-middle">
                      <div className="flex items-center gap-2">
                        <input
                          className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-right text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          type="text"
                          value={Number.isFinite(price) ? price : 0}
                          onFocus={() => !draft && startEdit(v)}
                          onChange={e => onEditChange(v.id, { unitPrice: parseFloat(e.target.value || '0') })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveVariant(v.id)
                            if (e.key === 'Escape') cancelEdit(v.id)
                          }}
                        />
                        <span className="text-xs text-neutral-500">₺</span>
                      </div>
                    </td>
                    <td className="p-3 align-middle text-right">
                      {draft ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                            onClick={() => saveVariant(v.id)}
                          >Kaydet</button>
                          <button
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
                            onClick={() => cancelEdit(v.id)}
                          >İptal</button>
                        </div>
                      ) : (
                        <button
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
                          onClick={() => removeVariant(v.id)}
                        >Sil</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobil Kartlar */}
      <div className="block md:hidden">
        {current.length === 0 && <div className="p-4 text-center text-sm text-neutral-600">Kayıt bulunamadı.</div>}
        <ul className="divide-y">
          {current.map((v, idx) => {
            const draft = globalEditing[v.id]
            const name = draft ? draft.name : v.name
            const price = draft ? Number(draft.unitPrice) : Number(v.unitPrice)
            return (
              <li key={v.id} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-[11px] font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200">
                    {page * take + idx + 1}
                  </span>
                  {!draft && (
                    <button
                      className="inline-flex h-8 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      onClick={() => removeVariant(v.id)}
                    >Sil</button>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Ürün Adı</label>
                    <input
                      className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      value={name}
                      onFocus={() => !draft && startEdit(v)}
                      onChange={e => onEditChange(v.id, { name: e.target.value })}
                      placeholder="Ürün adı"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveVariant(v.id)
                        if (e.key === 'Escape') cancelEdit(v.id)
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Birim Fiyat</label>
                    <div className="flex items-center gap-2">
                      <input
                        className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-right text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        type="text"
                        value={Number.isFinite(price) ? price : 0}
                        onFocus={() => !draft && startEdit(v)}
                        onChange={e => onEditChange(v.id, { unitPrice: parseFloat(e.target.value || '0') })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveVariant(v.id)
                          if (e.key === 'Escape') cancelEdit(v.id)
                        }}
                      />
                      <span className="text-xs text-neutral-500">₺</span>
                    </div>
                  </div>

                  {draft && (
                    <div className="pt-1">
                      <div className="inline-flex items-center gap-2">
                        <button
                          className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                          onClick={() => saveVariant(v.id)}
                        >Kaydet</button>
                        <button
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
                          onClick={() => cancelEdit(v.id)}
                        >İptal</button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-2 border-t p-3 sm:flex-row">
        <div className="text-xs text-neutral-600">
          Toplam <b>{filteredSorted.length}</b> kayıt • Sayfa <b>{page + 1}</b> / <b>{pageCount}</b>
        </div>
        <div className="flex items-center gap-1">
          <button className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" onClick={() => setPage(0)} disabled={page===0} title="İlk">«</button>
          <button className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0} title="Önceki">‹</button>
          {/* Basit kısaltmalı numaralar */}
          {(() => {
            const last = pageCount - 1
            const list: (number|'…')[] = []
            list.push(0)
            if (page > 2) list.push('…')
            for (let k = Math.max(1, page-1); k <= Math.min(last-1, page+1); k++) list.push(k)
            if (page < last-2) list.push('…')
            if (last > 0) list.push(last)
            return Array.from(new Set(list)).map((n, i) =>
              n === '…' ? (
                <span key={'d'+i} className="px-2 text-neutral-400">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-sm ${
                    page===n ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                  title={`Sayfa ${n+1}`}
                >
                  {n+1}
                </button>
              )
            )
          })()}
          <button className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" onClick={() => setPage(p=>Math.min(pageCount-1,p+1))} disabled={page>=pageCount-1} title="Sonraki">›</button>
          <button className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" onClick={() => setPage(pageCount-1)} disabled={page>=pageCount-1} title="Son">»</button>
        </div>
      </div>
    </div>
  )
}
