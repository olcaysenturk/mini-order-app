'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewDealerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Logo dosyası
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null); setLoading(true)

    const form = e.currentTarget as HTMLFormElement & {
      name: HTMLInputElement
      code: HTMLInputElement
      phone: HTMLInputElement
      email: HTMLInputElement
      address: HTMLTextAreaElement
      taxNumber: HTMLInputElement
      taxOffice: HTMLInputElement
      contactName: HTMLInputElement
      contactPhone: HTMLInputElement
      notes: HTMLTextAreaElement
    }

    const data = {
      name: form.name.value.trim(),
      code: form.code.value.trim() || undefined,
      phone: form.phone.value.trim() || undefined,
      email: form.email.value.trim() || undefined,
      address: form.address.value.trim() || undefined,
      taxNumber: form.taxNumber.value.trim() || undefined,
      taxOffice: form.taxOffice.value.trim() || undefined,
      contactName: form.contactName.value.trim() || undefined,
      contactPhone: form.contactPhone.value.trim() || undefined,
      notes: form.notes.value.trim() || undefined,
    }

    try {
      // 1) Bayiyi oluştur
      const res = await fetch('/api/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'İşlem başarısız')

      const dealerId: string | undefined = j?.dealer?.id
      if (!dealerId) throw new Error('Bayi oluşturuldu ama id alınamadı')

      // 2) Logo seçildiyse yükle
      if (logoFile) {
        const fd = new FormData()
        fd.append('file', logoFile)
        const up = await fetch(`/api/dealers/${dealerId}/logo`, {
          method: 'POST',
          body: fd,
        })
        const uj = await up.json().catch(() => ({}))
        if (!up.ok || !uj?.ok) {
          console.warn('Logo yüklenemedi:', uj?.error)
        }
      }

      router.push('/dealers')
    } catch (e: any) {
      setErr(e.message || 'İşlem başarısız')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Sayfa başlığı */}
      <div className="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Yeni Bayi
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Temel bilgileri doldurun, isterseniz logoyu da ekleyin.
              </p>
            </div>
            <a
              href="/dealers"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
            >
              Listeye dön
            </a>
          </div>
        </div>
      </div>

      {/* İçerik */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-8 md:grid-cols-3"
        >
          {/* Sol: Logo kartı */}
          <section className="md:col-span-1">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-medium text-gray-900">Logo</h2>
              <p className="mt-1 text-xs text-gray-500">
                PNG/JPG/WebP önerilir. Kare veya yatay logolar en iyi sonucu verir.
              </p>

              <label
                className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-5 text-center transition hover:bg-gray-50"
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Önizleme"
                    className="h-24 w-24 rounded-lg object-contain ring-1 ring-gray-200"
                  />
                ) : (
                  <svg
                    className="h-12 w-12 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path strokeWidth="1.5" d="M12 16V8m0 0-3 3m3-3 3 3M5 20h14a2 2 0 0 0 2-2V8.5A2.5 2.5 0 0 0 18.5 6H15l-1.447-1.724A2 2 0 0 0 11.97 3H8.5A2.5 2.5 0 0 0 6 5.5V18a2 2 0 0 0 2 2Z" />
                  </svg>
                )}
                <span className="mt-3 text-sm font-medium text-gray-800">
                  {logoPreview ? 'Başka bir logo seç' : 'Logo yükle'}
                </span>
                <span className="mt-1 text-xs text-gray-500">
                  Sürükleyip bırakabilir veya tıklayabilirsiniz.
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setLogoFile(f)
                    setLogoPreview(f ? URL.createObjectURL(f) : null)
                  }}
                />
              </label>

              {logoPreview && (
                <button
                  type="button"
                  onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                  className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  Önizlemeyi temizle
                </button>
              )}
            </div>
          </section>

          {/* Sağ: Form kartı */}
          <section className="md:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Bayi Adı *">
                  <Input name="name" required placeholder="Örn. ABC Dijital" />
                </Field>

                <Field label="Kısa Kod">
                  <Input name="code" placeholder="Örn. ABC" />
                </Field>

                <Field label="Telefon">
                  <Input name="phone" placeholder="+90..." />
                </Field>

                <Field label="E-posta">
                  <Input name="email" type="email" placeholder="bayi@ornek.com" />
                </Field>

                <Field label="Vergi No">
                  <Input name="taxNumber" />
                </Field>

                <Field label="Vergi Dairesi">
                  <Input name="taxOffice" />
                </Field>

                <Field label="Yetkili Adı">
                  <Input name="contactName" placeholder="İlgili kişi" />
                </Field>

                <Field label="Yetkili Telefon">
                  <Input name="contactPhone" placeholder="+90..." />
                </Field>

                <Field className="md:col-span-2" label="Adres">
                  <Textarea name="address" rows={2} />
                </Field>

                <Field className="md:col-span-2" label="Notlar">
                  <Textarea name="notes" rows={3} />
                </Field>
              </div>

              {err && (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                  {err}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:opacity-60"
                >
                  {loading ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => history.back()}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  Vazgeç
                </button>
              </div>
            </div>

            {/* ipucu */}
            <p className="mt-3 text-xs text-gray-500">
              Kaydettikten sonra otomatik olarak listeye döneceksiniz.
            </p>
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
