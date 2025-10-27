'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

type Variant = { id: string; name: string; unitPrice: number }
type Category = {
  id: string
  name: string
  _count?: { variants: number }
  variants?: Variant[] // eski API uyumluluğu için (ilk yükle fallback)
}

const DEFAULT_CATEGORIES = ['TÜL PERDE', 'FON PERDE', 'GÜNEŞLİK', 'STOR PERDE', 'AKSESUAR'] as const
const ORDER = new Map(DEFAULT_CATEGORIES.map((n, i) => [n, i]))

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

  // Akordeon açık seti
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Global düzenleme: varId -> draft
  const [editing, setEditing] = useState<Record<string, Variant>>({})

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  // --- Panelden gelen callback’ler: üstte sayaç ve (varsa) local variants’ı güncelle ---
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
        return {
          ...c,
          variants: c.variants.map(x => (x.id === v.id ? { ...x, ...v } : x)),
        }
      })
    )
  }

  const addVariantIntoCategory = (catId: string, v: Variant) => {
    setCategories(prev =>
      prev.map(c => {
        if (c.id !== catId) return c
        return {
          ...c,
          // Sunucu yeni GET’te _count geleceği için burada hem listeyi hem sayaçı güncelliyoruz
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
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      {/* HEADER */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Kategori &amp; Ürün</h1>
          {loading && <span className="text-xs text-neutral-400">Yükleniyor…</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-xl bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
            Kategori: <strong className="ms-1">{categories.length}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-xl bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
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

      {/* Bilgi kutusu */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-neutral-700">
          Kategoriler sabittir (<b>{DEFAULT_CATEGORIES.join(', ')}</b>).
          Yeni kategori eklenemez, silinemez. <b>Ürünler</b> panel bazında sayfalı yüklenir.
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* KATEGORİLER */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {loading && categories.length === 0 && (
          <>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </>
        )}

        {!loading &&
          categories.map(cat => {
            const isOpen = expanded.has(cat.id)
            const variantCount = cat._count?.variants ?? cat.variants?.length ?? 0

            return (
              <section
                key={cat.id}
                className="rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4">
                  <button
                    onClick={() => toggle(cat.id)}
                    className="group flex items-center gap-3 text-left"
                    aria-expanded={isOpen}
                    aria-controls={`panel-${cat.id}`}
                  >
                    <span
                      className={`grid size-6 place-items-center rounded-full border border-neutral-300 text-xs text-neutral-700 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    >
                      ▸
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{cat.name}</div>
                      <div className="mt-0.5 text-xs text-neutral-500">{variantCount} ürün</div>
                    </div>
                  </button>
                </div>

                {/* Panel */}
                <div
                  id={`panel-${cat.id}`}
                  className={`overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out grid ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="min-h-0">
                    {isOpen && (
                      <VariantPanel
                        cat={cat}
                        globalEditing={editing}
                        setGlobalEditing={setEditing}
                        onVariantAdded={(v) => {
                          addVariantIntoCategory(cat.id, v)
                        }}
                        onVariantRemoved={(varId) => {
                          removeVariantFromCategory(cat.id, varId)
                        }}
                        onVariantUpdated={(v) => {
                          patchVariantInCategory(cat.id, v)
                        }}
                        onBumpCount={(delta) => bumpVariantCount(cat.id, delta)}
                      />
                    )}
                  </div>
                </div>
              </section>
            )
          })}
      </div>

      {/* Footer toplamlar */}
      <div className="mt-6 text-sm text-neutral-600">
        Toplam kategori: <b>{categories.length}</b> • Toplam ürün: <b>{totalVariants}</b>
      </div>

      {/* Safari akordeon fix */}
      <style jsx global>{`
        @supports (-webkit-touch-callout: none) {
          [id^='panel-'] { transition-property: max-height !important; }
        }
      `}</style>
    </main>
  )
}

/* ================= Variants (per panel) ================= */

type PageResp = {
  items: Variant[]
  nextCursor?: string | null
  total?: number
}

function VariantPanel({
  cat,
  globalEditing,
  setGlobalEditing,
  onVariantAdded,
  onVariantRemoved,
  onVariantUpdated,
  onBumpCount,
}: {
  cat: Category
  globalEditing: Record<string, Variant>
  setGlobalEditing: React.Dispatch<React.SetStateAction<Record<string, Variant>>>
  onVariantAdded: (v: Variant) => void
  onVariantRemoved: (varId: string) => void
  onVariantUpdated: (v: Variant) => void
  onBumpCount: (delta: number) => void
}) {
  const [items, setItems] = useState<Variant[]>(() => [])
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // arama + sıralama
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 350)
  const [sort, setSort] = useState<'name_asc' | 'price_asc' | 'price_desc'>('name_asc')

  // ilk açılışta yükle
  useEffect(() => {
    if (!items.length && nextCursor === undefined) {
      if (cat.variants && cat.variants.length) {
        // Eski API: kategoriden gelen dizi ile başla
        setItems(cat.variants)
        setNextCursor(null)
      } else {
        loadFirst()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // arama/sıralama değişince baştan
  useEffect(() => {
    if (nextCursor !== undefined) loadFirst()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, sort])

  const fetchPage = async ({ cursor }: { cursor: string | null }) => {
    const params = new URLSearchParams()
    params.set('take', '30')
    params.set('sort', sort)
    if (dq) params.set('q', dq)
    if (cursor) params.set('cursor', cursor)

    const res = await fetch(`/api/categories/${cat.id}/variants?` + params.toString(), {
      cache: 'no-store',
    })
    if (!res.ok) {
      // Eski API’da bu endpoint olmayabilir
      throw new Error('endpoint_unavailable')
    }
    const data: PageResp = await res.json()
    return data
  }

  const loadFirst = async () => {
    setError(null)
    setLoading(true)
    try {
      const page = await fetchPage({ cursor: null })
      setItems(page.items ?? [])
      setNextCursor(page.nextCursor ?? null)
    } catch (e: any) {
      setError(e?.message || 'Ürünler alınamadı')
      // Fallback: server desteklemiyorsa
      if (cat.variants?.length) {
        setItems(filterSortLocal(cat.variants))
        setNextCursor(null)
      } else {
        setItems([]) // temiz başla
        setNextCursor(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (!nextCursor || loading) return
    setLoading(true)
    try {
      const page = await fetchPage({ cursor: nextCursor })
      setItems(prev => (Array.isArray(prev) ? prev.concat(page.items) : [...page.items]))
      setNextCursor(page.nextCursor ?? null)
    } finally {
      setLoading(false)
    }
  }

  // sonsuz kaydırma sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!sentinelRef.current) return
    const el = sentinelRef.current
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) void loadMore()
      })
    }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.unobserve(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinelRef.current, nextCursor, loading])

  const startEdit = (v: Variant) =>
    setGlobalEditing(prev => ({ ...prev, [v.id]: { ...v } }))

  const cancelEdit = (id: string) =>
    setGlobalEditing(prev => {
      const p = { ...prev }
      delete p[id]
      return p
    })

  const onEditChange = (id: string, patch: Partial<Variant>) =>
    setGlobalEditing(prev => ({ ...prev, [id]: { ...prev[id], ...patch } as Variant }))

  const saveVariant = async (varId: string) => {
    const draft = globalEditing[varId]
    if (!draft) return
    const payload = { name: String(draft.name || '').trim(), unitPrice: Number(draft.unitPrice) || 0 }
    const res = await fetch(`/api/variants/${varId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated: Variant = await res.json()
      setItems(prev => prev.map(v => (v.id === varId ? { ...v, ...updated } : v)))
      onVariantUpdated(updated) // üstte varsa local listede de güncelle
      cancelEdit(varId)
      toast.success('Ürün güncellendi')
    } else {
      toast.error('Ürün güncellenemedi')
    }
  }

  const addVariant = async () => {
    const res = await fetch(`/api/categories/${cat.id}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Yeni Ürün', unitPrice: 0 }),
    })
    if (res.ok) {
      const v: Variant = await res.json()
      setItems(prev => (Array.isArray(prev) ? [v, ...prev] : [v]))
      setGlobalEditing(prev => ({ ...prev, [v.id]: v }))
      onVariantAdded(v)   // üst sayaç + varsa category.variants güncelle
      onBumpCount(1)      // garanti olsun
      toast.success('Ürün eklendi')
    } else {
      toast.error('Ürün eklenemedi')
    }
  }

  const removeVariant = async (varId: string) => {
    if (!confirm('Ürün silinsin mi?')) return
    const res = await fetch(`/api/variants/${varId}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(prev => (Array.isArray(prev) ? prev.filter(v => v.id !== varId) : []))
      cancelEdit(varId)
      onVariantRemoved(varId) // üst liste/ sayaç güncelle
      onBumpCount(-1)
      toast.success('Ürün silindi')
    } else {
      toast.error('Ürün silinemedi')
    }
  }

  const filterSortLocal = (data: Variant[]) => {
    let out = data
    const needle = dq.trim().toLocaleLowerCase('tr-TR')
    if (needle) {
      out = out.filter(v => v.name.toLocaleLowerCase('tr-TR').includes(needle))
    }
    out = [...out].sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'tr')
      if (sort === 'price_asc') return (a.unitPrice || 0) - (b.unitPrice || 0)
      return (b.unitPrice || 0) - (a.unitPrice || 0)
    })
    return out
  }

  // ⬇️ Gösterim her zaman items’tan (tek doğruluk kaynağı)
  const shown = filterSortLocal(items)

  return (
    <div className="px-4 pb-4">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <input
            className="h-9 w-64 rounded-xl border border-neutral-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            placeholder="Ürün ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Ürün ara"
          />
          <svg
            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path fill="currentColor" d="M10 4a6 6 0 1 1 3.9 10.6l3.8 3.8-1.4 1.4-3.8-3.8A6 6 0 0 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8z" />
          </svg>
        </div>

        <select
          className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          aria-label="Sırala"
        >
          <option value="name_asc">Ada göre (A→Z)</option>
          <option value="price_asc">Fiyat (Artan)</option>
          <option value="price_desc">Fiyat (Azalan)</option>
        </select>

        <button
          className="ms-auto inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          onClick={addVariant}
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="currentColor" d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z" />
          </svg>
          Ürün Ekle
        </button>
      </div>

      {/* Liste */}
      {error && (
        <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {shown.length === 0 && !loading && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          Kayıt bulunamadı.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(v => {
          const draft = globalEditing[v.id]
          const name = draft ? draft.name : v.name
          const price = draft ? Number(draft.unitPrice) : Number(v.unitPrice)

          return (
            <div
              key={v.id}
              className="rounded-xl border border-neutral-200 bg-white p-3 transition hover:shadow-sm"
            >
              <div className="mb-1 text-[11px] text-neutral-500">Ürün</div>
              <input
                className="mb-2 h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                value={name}
                onFocus={() => !draft && startEdit(v)}
                onChange={e => onEditChange(v.id, { name: e.target.value })}
                placeholder="Ürün adı"
              />

              <div className="mb-1 text-[11px] text-neutral-500">Birim Fiyat</div>
              <div className="flex items-center gap-2">
                <input
                  className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-right text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(price) ? price : 0}
                  onFocus={() => !draft && startEdit(v)}
                  onChange={e => onEditChange(v.id, { unitPrice: parseFloat(e.target.value || '0') })}
                />
                <span className="text-xs text-neutral-500">₺</span>
              </div>

              <div className="mt-3 flex gap-2">
                {draft ? (
                  <>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                      onClick={() => saveVariant(v.id)}
                    >
                      Kaydet
                    </button>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
                      onClick={() => cancelEdit(v.id)}
                    >
                      İptal
                    </button>
                  </>
                ) : (
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
                    onClick={() => removeVariant(v.id)}
                  >
                    Sil
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sonsuz kaydırma sentinel + yükleniyor */}
      <div ref={sentinelRef} className="h-6 w-full" />
      {loading && <div className="mt-2 text-sm text-neutral-500">Yükleniyor…</div>}
      {!!nextCursor && !loading && (
        <div className="mt-2">
          <button
            onClick={loadMore}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Daha Fazla Yükle
          </button>
        </div>
      )}
    </div>
  )
}
