'use client';
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const email = sp.get("email") || "";
  const token = sp.get("token") || "";
  const router = useRouter();

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string|null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw1 !== pw2) { setErr("Parolalar eşleşmiyor"); return; }
    if (pw1.length < 8) { setErr("En az 8 karakter"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password: pw1 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "HATA");
      setOk(true);
      setTimeout(()=>router.push("/auth/login"), 1200);
    } catch (e:any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  if (!email || !token) {
    return <div className="mx-auto max-w-md p-6">
      <p className="text-rose-600">Bağlantı geçersiz. E-postadaki linke yeniden tıkla.</p>
    </div>;
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Yeni Parola</h1>
      <input className="w-full rounded-lg border px-3 py-2" type="password" placeholder="Yeni parola" value={pw1} onChange={e=>setPw1(e.target.value)} />
      <input className="w-full rounded-lg border px-3 py-2" type="password" placeholder="Yeni parola (tekrar)" value={pw2} onChange={e=>setPw2(e.target.value)} />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {ok && <p className="text-sm text-emerald-700">Parolan güncellendi. Giriş sayfasına yönlendiriliyor.</p>}
      <button disabled={loading} className="rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">
        {loading ? "Kaydediliyor..." : "Parolayı Güncelle"}
      </button>
    </form>
  );
}
