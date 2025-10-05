'use client'

import { useEffect, useMemo, useState } from 'react'

type Variant = { id: string; name: string; unitPrice: number }
type Category = { id: string; name: string; variants: Variant[] }

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [catName, setCatName] = useState('')
  const [loading, setLoading] = useState(false)

  // varId -> draft
  const [editing, setEditing] = useState<Record<string, Variant>>({})

  // Akordeon açık seti
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' })
      const data: Category[] = await res.json()
      setCategories(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchCategories() }, [])

  const addCategory = async () => {
    const name = catName.trim()
    if (!name) return
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setCatName('')
      fetchCategories()
    }
  }

  const removeCategory = async (id: string) => {
    if (!confirm('Kategori ve içindeki tüm varyantlar silinsin mi?')) return
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    setCategories(prev => prev.filter(c => c.id !== id))
    setExpanded(prev => {
      const next = new Set(prev); next.delete(id); return next
    })
  }

  const addVariant = async (catId: string) => {
    const res = await fetch(`/api/categories/${catId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Yeni Varyant', unitPrice: 0 }),
    })
    if (res.ok) {
      const v: Variant = await res.json()
      setCategories(prev => prev.map(c =>
        c.id === catId ? { ...c, variants: [...c.variants, v] } : c
      ))
      setEditing(prev => ({ ...prev, [v.id]: v })) // direkt edite al
      setExpanded(prev => new Set(prev).add(catId)) // paneli açık tut
    }
  }

  const startEdit = (v: Variant) =>
    setEditing(prev => ({ ...prev, [v.id]: { ...v } }))

  const cancelEdit = (id: string) =>
    setEditing(prev => {
      const p = { ...prev }
      delete p[id]
      return p
    })

  const onEditChange = (id: string, patch: Partial<Variant>) =>
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], ...patch } as Variant }))

  const saveVariant = async (catId: string, varId: string) => {
    const draft = editing[varId]
    if (!draft) return
    const payload = {
      name: String(draft.name || '').trim(),
      unitPrice: Number(draft.unitPrice) || 0,
    }
    const res = await fetch(`/api/variants/${varId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated: Variant = await res.json()
      setCategories(prev => prev.map(c =>
        c.id === catId
          ? { ...c, variants: c.variants.map(v => v.id === varId ? { ...v, ...updated } : v) }
          : c
      ))
      cancelEdit(varId)
    }
  }

  const removeVariant = async (varId: string) => {
    if (!confirm('Varyant silinsin mi?')) return
    const res = await fetch(`/api/variants/${varId}`, { method: 'DELETE' })
    if (res.ok) {
      setCategories(prev => prev.map(c => ({
        ...c,
        variants: c.variants.filter(v => v.id !== varId),
      })))
      cancelEdit(varId)
    }
  }

  const totalVariants = useMemo(
    () => categories.reduce((a, c) => a + c.variants.length, 0),
    [categories]
  )

  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-4">Admin: Kategori & Varyant</h1>

      {/* Kategori ekleme */}
      <div className="flex gap-2 mb-6">
        <input
          className="input"
          placeholder="Kategori adı"
          value={catName}
          onChange={e => setCatName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCategory()}
        />
        <button className="btn" onClick={addCategory} disabled={loading}>Ekle</button>
        {loading && <span className="text-sm text-gray-500 self-center">Yükleniyor…</span>}
      </div>

      {/* Akordeon liste */}
      <div className="space-y-4">
        {categories.map(cat => {
          const isOpen = expanded.has(cat.id)
          const variantCount = cat.variants.length

          return (
            <div
              key={cat.id}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm"
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
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 transition-transform
                      ${isOpen ? 'rotate-90' : ''}`}
                  >
                    ▸
                  </span>
                  <div>
                    <div className="font-semibold">{cat.name}</div>
                    <div className="text-xs text-gray-500">
                      {variantCount} varyant
                    </div>
                  </div>
                </button>

                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => addVariant(cat.id)}>
                    + Varyant
                  </button>
                  <button className="btn-secondary" onClick={() => removeCategory(cat.id)}>
                    Kategoriyi Sil
                  </button>
                </div>
              </div>

              {/* Panel */}
              <div
                id={`panel-${cat.id}`}
                className={`overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out grid
                  ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="min-h-0">
                  {variantCount === 0 ? (
                    <div className="px-4 pb-4 text-sm text-gray-500">
                      Varyant yok. “+ Varyant” ile ekleyebilirsiniz.
                    </div>
                  ) : (
                    <div className="px-4 pb-4">
                      {/* Kart grid */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {cat.variants.map(v => {
                          const draft = editing[v.id]
                          const name = draft ? draft.name : v.name
                          const price = draft ? Number(draft.unitPrice) : Number(v.unitPrice)

                          return (
                            <div
                              key={v.id}
                              className="rounded-xl border border-gray-200 p-3 hover:shadow-sm transition bg-white"
                            >
                              <div className="text-xs text-gray-500 mb-1">Varyant</div>
                              <input
                                className="input mb-2"
                                value={name}
                                onFocus={() => !draft && startEdit(v)}
                                onChange={e => onEditChange(v.id, { name: e.target.value })}
                                placeholder="Varyant adı"
                              />

                              <div className="text-xs text-gray-500 mb-1">Birim Fiyat</div>
                              <div className="flex items-center gap-2">
                                <input
                                  className="input"
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={Number.isFinite(price) ? price : 0}
                                  onFocus={() => !draft && startEdit(v)}
                                  onChange={e =>
                                    onEditChange(v.id, {
                                      unitPrice: parseFloat(e.target.value || '0'),
                                    })
                                  }
                                />
                                <span className="text-xs text-gray-500">₺</span>
                              </div>

                              <div className="mt-3 flex gap-2">
                                {draft ? (
                                  <>
                                    <button
                                      className="btn"
                                      onClick={() => saveVariant(cat.id, v.id)}
                                    >
                                      Kaydet
                                    </button>
                                    <button
                                      className="btn-secondary"
                                      onClick={() => cancelEdit(v.id)}
                                    >
                                      İptal
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="btn-secondary"
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
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 text-sm text-gray-600">
        Toplam kategori: <b>{categories.length}</b> • Toplam varyant: <b>{totalVariants}</b>
      </div>

      {/* Minik stil dokunuşları */}
      <style jsx global>{`
        /* grid-rows transition için safari fix */
        @supports (-webkit-touch-callout: none) {
          [id^="panel-"] { transition-property: max-height !important; }
        }
      `}</style>
    </div>
  )
}
