'use client';
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "HATA");
      setSent(true);
    } catch (e:any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  if (sent) {
    return <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-2">E-postanı kontrol et</h1>
      <p>Parola sıfırlama bağlantısı (varsa) e-posta adresine gönderildi.</p>
    </div>;
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Şifreyi Unuttum</h1>
      <input
        className="w-full rounded-lg border px-3 py-2"
        type="email" placeholder="you@example.com"
        value={email} onChange={e=>setEmail(e.target.value)} required
      />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button
        disabled={loading}
        className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Gönderiliyor..." : "Bağlantı Gönder"}
      </button>
    </form>
  );
}
