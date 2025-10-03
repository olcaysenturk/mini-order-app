'use client'

import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const router = useRouter()
  const sp = useSearchParams()
  const callbackUrl = sp.get('callbackUrl') || '/'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true); setErr(null)
    const res = await signIn('credentials', { email, password, redirect: false, callbackUrl })
    setLoading(false)
    if (!res || res.error) { setErr('Email veya şifre hatalı'); return }
    router.push(res.url || '/')
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-4">Giriş Yap</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="input w-full" placeholder="Email" type="email"
               value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input w-full" placeholder="Şifre" type="password"
               value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="btn w-full" disabled={loading}>
          {loading ? 'Gönderiliyor…' : 'Giriş Yap'}
        </button>
      </form>
      <div className="mt-3 text-sm">
        Hesabın yok mu? <a className="underline" href="/register">Kayıt ol</a>
      </div>
    </div>
  )
}
