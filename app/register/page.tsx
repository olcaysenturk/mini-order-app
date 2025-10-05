'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true); setErr(null)
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j?.error || 'Kayıt başarısız')
      return
    }
    // başarı -> login sayfasına
    router.push('/login')
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-4">Kayıt Ol</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="input w-full" placeholder="Ad Soyad (opsiyonel)"
               value={name} onChange={e => setName(e.target.value)} />
        <input className="input w-full" placeholder="Email" type="email"
               value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input w-full" placeholder="Şifre (min 6 karakter)" type="password"
               value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="btn w-full" disabled={loading}>
          {loading ? 'Gönderiliyor…' : 'Kayıt Ol'}
        </button>
      </form>
      <div className="mt-3 text-sm">
        Zaten hesabın var mı? <a className="underline" href="/login">Giriş yap</a>
      </div>
    </div>
  )
}
