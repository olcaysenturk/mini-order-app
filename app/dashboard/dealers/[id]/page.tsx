'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { z } from 'zod'
import { toast } from 'sonner'

type Dealer = {
  id: string
  name: string
  code?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  taxNumber?: string | null
  taxOffice?: string | null
  contactName?: string | null
  contactPhone?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  // opsiyonel logo alanı (API varsa döner)
  logoUrl?: string | null
}

const UpdateSchema = z.object({
  name: z.string().min(1, 'Zorunlu'),
  code: z.string().max(50).optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Geçersiz e-posta').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  taxNumber: z.string().optional().or(z.literal('')),
  taxOffice: z.string().optional().or(z.literal('')),
  contactName: z.string().optional().or(z.literal('')),
  contactPhone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export default function DealerDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [dealer, setDealer] = useState<Dealer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // form state
  const [form, setForm] = useState<Partial<Dealer>>({})
  // logo state
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoBusy, setLogoBusy] = useState(false)

  // load dealer
  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/dealers/${id}`, {
          cache: 'no-store',
          credentials: 'include',
        })
        const j = await res.json()
        if (cancelled) return
        if (!res.ok || !j.ok) throw new Error(j.error || 'request_failed')
        const d = j.dealer as Dealer
        setDealer(d)
        setForm(d)
        setLogoPreview(d.logoUrl || null)
      } catch (e: any) {
        if (!cancelled) setError('Kayıt alınamadı')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) run()
    return () => { cancelled = true }
  }, [id])

  // debounce helper
  const debounce = useMemo(() => {
    let t: any
    return (fn: () => void, ms = 300) => {
      clearTimeout(t)
      t = setTimeout(fn, ms)
    }
  }, [])

  function updateField<K extends keyof Dealer>(key: K, value: Dealer[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const parsed = UpdateSchema.safeParse({
        name: form.name,
        code: form.code ?? '',
        phone: form.phone ?? '',
        email: form.email ?? '',
        address: form.address ?? '',
        taxNumber: form.taxNumber ?? '',
        taxOffice: form.taxOffice ?? '',
        contactName: form.contactName ?? '',
        contactPhone: form.contactPhone ?? '',
        notes: form.notes ?? '',
        isActive: form.isActive,
      })
      if (!parsed.success) {
        const first = parsed.error.issues[0]?.message || 'Doğrulama hatası'
        throw new Error(first)
      }

      const res = await fetch(`/api/dealers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || 'Güncelleme başarısız')

      // logo seçilmişse yükle
      if (logoFile) {
        await uploadLogo()
      }

      // günceli çek
      await refreshDealer()
    } catch (e: any) {
      setError(e.message || 'Kaydetme başarısız')
    } finally {
      setSaving(false)
    }
  }

  async function refreshDealer() {
    const res = await fetch(`/api/dealers/${id}`, { cache: 'no-store', credentials: 'include' })
    const j = await res.json()
    if (res.ok && j.ok) {
      const d = j.dealer as Dealer
      setDealer(d)
      setForm(d)
      setLogoPreview(d.logoUrl || logoPreview || null)
    }
  }

  async function uploadLogo() {
    if (!logoFile) return
    setLogoBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', logoFile)
      const up = await fetch(`/api/dealers/${id}/logo`, { method: 'POST', body: fd })
      const uj = await up.json().catch(() => ({}))
      if (!up.ok || !uj?.ok) throw new Error(uj?.error || 'Logo yüklenemedi')
      // API logoUrl döndürüyorsa kullan
      if (uj.logoUrl) setLogoPreview(uj.logoUrl as string)
    } finally {
      setLogoBusy(false)
      setLogoFile(null)
    }
  }

  async function removeLogo() {
    setLogoBusy(true)
    try {
      const del = await fetch(`/api/dealers/${id}/logo`, { method: 'DELETE' })
      const dj = await del.json().catch(() => ({}))
      if (!del.ok || !dj?.ok) throw new Error(dj?.error || 'Logo silinemedi')
      setLogoPreview(null)
    } catch (e: any) {
      toast.error(e.message || 'Logo silinemedi')

    } finally {
      setLogoBusy(false)
    }
  }

  async function toggleActive() {
    if (!dealer) return
    try {
      const res = await fetch(`/api/dealers/${id}`, {
        method: dealer.isActive ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: dealer.isActive ? undefined : JSON.stringify({ isActive: true }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error('İşlem başarısız')
      setDealer(d => d ? { ...d, isActive: !d.isActive } as Dealer : d)
      setForm(f => ({ ...f, isActive: !dealer.isActive }))
    } catch (e: any) {
      toast.error(e.message || 'İşlem başarısız')
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-700 shadow-sm">
          Yükleniyor…
        </div>
      </div>
    )
  }
  if (error || !dealer) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Kayıt bulunamadı'}</p>
        <a href="/dashboard/dealers" className="mt-3 inline-block rounded-xl border px-3 py-2">
          Geri dön
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <div className="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {dealer.name || 'Bayi Detayı'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Oluşturma: {new Date(dealer.createdAt).toLocaleString()} • Güncelleme: {new Date(dealer.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/dashboard/dealers"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                Listeye dön
              </a>
              <button
                onClick={toggleActive}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm shadow-sm transition ${
                  dealer.isActive
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {dealer.isActive ? 'Pasifleştir' : 'Aktif Et'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Left: Logo card */}
          <section className="md:col-span-1">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-medium text-gray-900">Logo</h2>
              <p className="mt-1 text-xs text-gray-500">
                PNG/JPG/WebP önerilir. Kare/yatay logolar en iyi sonucu verir.
              </p>

              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-5 text-center transition hover:bg-gray-50">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="h-24 w-24 rounded-lg object-contain ring-1 ring-gray-200 bg-white"
                  />
                ) : (
                  <div className="grid place-items-center">
                    <svg
                      className="h-12 w-12 text-gray-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path strokeWidth="1.5" d="M12 16V8m0 0-3 3m3-3 3 3M5 20h14a2 2 0 0 0 2-2V8.5A2.5 2.5 0 0 0 18.5 6H15l-1.447-1.724A2 2 0 0 0 11.97 3H8.5A2.5 2.5 0 0 0 6 5.5V18a2 2 0 0 0 2 2Z" />
                    </svg>
                    <span className="mt-3 text-sm font-medium text-gray-800">Logo yükle</span>
                    <span className="mt-1 text-xs text-gray-500">Sürükleyip bırakabilir veya tıklayabilirsiniz.</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setLogoFile(f)
                    setLogoPreview(f ? URL.createObjectURL(f) : dealer.logoUrl || null)
                  }}
                />
              </label>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!logoFile || logoBusy}
                  onClick={uploadLogo}
                  className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:opacity-50"
                >
                  {logoBusy ? 'Yükleniyor…' : 'Logoyu Kaydet'}
                </button>
                <button
                  type="button"
                  disabled={logoBusy || !logoPreview}
                  onClick={removeLogo}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Logoyu Sil
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${
                dealer.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {dealer.isActive ? 'Aktif' : 'Pasif'}
              </span>
            </div>
          </section>

          {/* Right: Form card */}
          <section className="md:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Ad *">
                  <Input
                    value={form.name ?? ''}
                    onChange={(e) => updateField('name', e.target.value)}
                    required
                  />
                </Field>

                <Field label="Kod">
                  <Input
                    value={form.code ?? ''}
                    onChange={(e) => updateField('code', e.target.value)}
                    placeholder="Örn. ABC"
                  />
                </Field>

                <Field label="E-posta">
                  <Input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="bayi@ornek.com"
                  />
                </Field>

                <Field label="Telefon">
                  <Input
                    value={form.phone ?? ''}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+90..."
                  />
                </Field>

                <Field label="Vergi No">
                  <Input
                    value={form.taxNumber ?? ''}
                    onChange={(e) => updateField('taxNumber', e.target.value)}
                  />
                </Field>

                <Field label="Vergi Dairesi">
                  <Input
                    value={form.taxOffice ?? ''}
                    onChange={(e) => updateField('taxOffice', e.target.value)}
                  />
                </Field>

                <Field label="Yetkili Adı">
                  <Input
                    value={form.contactName ?? ''}
                    onChange={(e) => updateField('contactName', e.target.value)}
                  />
                </Field>

                <Field label="Yetkili Tel">
                  <Input
                    value={form.contactPhone ?? ''}
                    onChange={(e) => updateField('contactPhone', e.target.value)}
                    placeholder="+90..."
                  />
                </Field>

                <Field className="md:col-span-2" label="Adres">
                  <Textarea
                    rows={3}
                    value={form.address ?? ''}
                    onChange={(e) => updateField('address', e.target.value)}
                  />
                </Field>

                <Field className="md:col-span-2" label="Notlar">
                  <Textarea
                    rows={3}
                    value={form.notes ?? ''}
                    onChange={(e) => updateField('notes', e.target.value)}
                  />
                </Field>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={!!form.isActive}
                  onChange={(e) => updateField('isActive', e.target.checked)}
                />
                <label htmlFor="isActive" className="text-sm text-gray-800">Aktif</label>
              </div>

              {error && (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:opacity-60"
                >
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <a
                  href="/dashboard/dealers"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  İptal
                </a>
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  )
}

/* ---------- küçük UI yardımcıları ---------- */

function Field(props: React.PropsWithChildren<{ label: string; className?: string }>) {
  return (
    <div className={props.className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-800">
        {props.label}
      </label>
      {props.children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900',
        'placeholder:text-gray-400 shadow-sm outline-none transition',
        'focus-visible:ring-4 focus-visible:ring-gray-900/10 focus:border-gray-300',
        props.className || '',
      ].join(' ')}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900',
        'placeholder:text-gray-400 shadow-sm outline-none transition',
        'focus-visible:ring-4 focus-visible:ring-gray-900/10 focus:border-gray-300',
        props.className || '',
      ].join(' ')}
    />
  )
}
