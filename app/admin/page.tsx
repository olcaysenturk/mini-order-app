'use client'

import { useEffect, useMemo, useState } from 'react'

type Variant = { id: string; name: string; unitPrice: number }
type Category = { id: string; name: string; variants: Variant[] }

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [catName, setCatName] = useState('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Record<string, Variant>>({}) // varId -> temp

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' })
      const data = await res.json()
      setCategories(data)
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchCategories() }, [])

  const addCategory = async () => {
    const name = catName.trim()
    if (!name) return
    const res = await fetch('/api/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) { setCatName(''); fetchCategories() }
  }

  const removeCategory = async (id: string) => {
    if (!confirm('Kategori ve varyantları silinsin mi?')) return
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  const addVariant = async (catId: string) => {
    const res = await fetch(`/api/categories/${catId}/variants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Yeni Varyant', unitPrice: 0 }),
    })
    if (res.ok) {
      const v = await res.json()
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, variants: [...c.variants, v] } : c))
    }
  }

  const startEdit = (v: Variant) => setEditing(prev => ({ ...prev, [v.id]: { ...v } }))
  const cancelEdit = (id: string) => setEditing(prev => { const p = { ...prev }; delete p[id]; return p })
  const onEditChange = (id: string, patch: Partial<Variant>) =>
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], ...patch } as Variant }))

  const saveVariant = async (catId: string, varId: string) => {
    const draft = editing[varId]
    if (!draft) return
    const res = await fetch(`/api/variants/${varId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: draft.name, unitPrice: Number(draft.unitPrice) }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCategories(prev => prev.map(c => c.id === catId ? {
        ...c, variants: c.variants.map(v => v.id === varId ? { ...v, ...updated } : v),
      } : c))
      cancelEdit(varId)
    }
  }

  const removeVariant = async (varId: string) => {
    if (!confirm('Varyant silinsin mi?')) return
    const res = await fetch(`/api/variants/${varId}`, { method: 'DELETE' })
    if (res.ok) {
      setCategories(prev => prev.map(c => ({ ...c, variants: c.variants.filter(v => v.id !== varId) })))
    }
  }

  const totalVariants = useMemo(() => categories.reduce((a, c) => a + c.variants.length, 0), [categories])

  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-4">Admin: Kategori & Varyant</h1>

      <div className="flex gap-2 mb-6">
        <input className="input" placeholder="Kategori adı"
               value={catName} onChange={e => setCatName(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && addCategory()} />
        <button className="btn" onClick={addCategory} disabled={loading}>Ekle</button>
        {loading && <span className="text-sm text-gray-500 self-center">Yükleniyor…</span>}
      </div>

      <div className="space-y-6">
        {categories.map(cat => (
          <div key={cat.id} className="border rounded-2xl p-4 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{cat.name}</h2>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => addVariant(cat.id)}>Varyant Ekle</button>
                <button className="btn-secondary" onClick={() => removeCategory(cat.id)}>Kategori Sil</button>
              </div>
            </div>

            {cat.variants.length === 0 ? (
              <p className="text-sm text-gray-500">Varyant yok. “Varyant Ekle” ile ekleyin.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Varyant Adı</th>
                    <th className="w-40">Birim Fiyat</th>
                    <th className="w-44"></th>
                  </tr>
                </thead>
                <tbody>
                  {cat.variants.map(v => {
                    const draft = editing[v.id]
                    return (
                      <tr key={v.id}>
                        <td>
                          <input className="input"
                                 value={draft ? draft.name : v.name}
                                 onChange={e => onEditChange(v.id, { name: e.target.value })}
                                 onFocus={() => !draft && startEdit(v)} />
                        </td>
                        <td>
                          <input className="input" type="number" min={0} step="0.01"
                                 value={draft ? Number(draft.unitPrice) : Number(v.unitPrice)}
                                 onChange={e => onEditChange(v.id, { unitPrice: parseFloat(e.target.value || '0') })}
                                 onFocus={() => !draft && startEdit(v)} />
                        </td>
                        <td className="flex gap-2">
                          {draft ? (
                            <>
                              <button className="btn" onClick={() => saveVariant(cat.id, v.id)}>Kaydet</button>
                              <button className="btn-secondary" onClick={() => cancelEdit(v.id)}>İptal</button>
                            </>
                          ) : (
                            <button className="btn-secondary" onClick={() => removeVariant(v.id)}>Sil</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        Toplam kategori: <b>{categories.length}</b> • Toplam varyant: <b>{totalVariants}</b>
      </div>
    </div>
  )
}
