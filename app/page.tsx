// app/page.tsx (LIGHT MODE – erişilebilirlik & UX)
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/orders");

  return (
    <main id="main" className="relative min-h-screen overflow-hidden bg-white">
      {/* ======= Dekoratif Arka Planlar ======= */}
      <div aria-hidden className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_30%,#000,transparent)]">
        {/* grid pattern (light) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />
        {/* aurora blobs */}
        <div className="absolute -top-40 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(79,70,229,.18),transparent)] blur-2xl" />
        <div className="absolute -bottom-48 right-1/2 h-[520px] w-[980px] translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,.14),transparent)] blur-2xl" />
      </div>

      {/* ======= HERO ======= */}
      <section className="relative z-10 mt-[-32px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Text */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/60 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur">
                <span aria-hidden className="size-2 rounded-full bg-indigo-600" /> Yeni: Yazdırılabilir A4 & Pro Raporlar
              </div>
              <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
                Perde siparişlerini <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">tek yerden</span> yönetin.
              </h1>
              <p className="mt-4 text-base sm:text-lg text-neutral-600 max-w-xl">
                Kategori & varyant tanımla, m² ve file sıklığına göre tutarı otomatik hesapla, yazdırılabilir formla işi hızlandır. Çok kullanıcılı, çok cihazlı, bulutta.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link prefetch={false} href="/register" className="inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">Hemen Başla</Link>
                <a href="#ozellikler" className="inline-flex items-center rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">Özellikleri Gör</a>
              </div>
              <div className="mt-6 flex items-center gap-5 text-sm text-neutral-500">
                <span>• Mobil uyumlu</span>
                <span>• Yazdırılabilir A4</span>
                <span>• Raporlama</span>
              </div>
              {/* Trust row / logos placeholder */}
              {/* <div className="mt-6 flex items-center gap-6 opacity-80" aria-label="Referans logoları (örnek)">
                <div className="h-8 w-24 rounded-md bg-neutral-200" />
                <div className="h-8 w-24 rounded-md bg-neutral-200" />
                <div className="h-8 w-24 rounded-md bg-neutral-200" />
              </div> */}
            </div>

            {/* Visual Mockup */}
            <div className="relative">
              <div className="relative rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md shadow-xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200">
                  <div aria-hidden className="size-3 rounded-full bg-red-400" />
                  <div aria-hidden className="size-3 rounded-full bg-yellow-400" />
                  <div aria-hidden className="size-3 rounded-full bg-green-400" />
                  <div className="ml-3 text-xs text-neutral-500">Siparişler</div>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 text-sm font-medium bg-neutral-50 border-b border-neutral-200">Güncel Siparişler</div>
                    <table className="w-full text-sm" aria-label="Güncel sipariş tablosu">
                      <thead className="bg-white">
                        <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-neutral-500">
                          <th scope="col">#</th>
                          <th scope="col">Müşteri</th>
                          <th scope="col">Telefon</th>
                          <th scope="col" className="text-right">Tutar</th>
                          <th scope="col" className="text-right">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[
                          { no: 154, name: "Ayşe Yılmaz", tel: "05xx", tutar: "3.250,00", st: "İşlemde" },
                          { no: 153, name: "Mehmet Demir", tel: "05xx", tutar: "1.980,00", st: "Beklemede" },
                          { no: 152, name: "Olcay Şentürk", tel: "05xx", tutar: "5.420,00", st: "Tamamlandı" },
                        ].map((r) => (
                          <tr key={r.no} className="[&>td]:px-4 [&>td]:py-2">
                            <td className="font-medium">#{r.no}</td>
                            <td>{r.name}</td>
                            <td className="text-neutral-500">{r.tel}</td>
                            <td className="text-right">{r.tutar} ₺</td>
                            <td className="text-right">
                              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{r.st}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="text-xs text-neutral-500">Bu Ay</div>
                      <div className="text-2xl font-bold">64.350 ₺</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="text-xs text-neutral-500">Aylık Sipariş</div>
                      <div className="text-2xl font-bold">27</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow */}
              <div aria-hidden className="absolute -inset-6 rounded-[28px] bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ======= ÖZELLİKLER ======= */}
      <section id="ozellikler" className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center">İhtiyacın olan her şey</h2>
          <p className="mt-2 text-center text-neutral-600">Kategoriler, varyantlar, otomatik fiyat hesaplama ve tek tıkla yazdırma.</p>

          <div className="mt-8 grid md:grid-cols-3 gap-5">
            {[
              {
                title: "Esnek Katalog",
                desc: "Kategori & varyant ekle, birim fiyatı belirle, m² hesabı otomatik çalışsın.",
                icon: (
                  <svg viewBox="0 0 24 24" className="size-6" aria-hidden><path fill="currentColor" d="M4 4h16v4H4zM4 10h10v4H4zM4 16h16v4H4z"/></svg>
                ),
              },
              {
                title: "A4 Yazdırma",
                desc: "Terzi & müşteri için temiz, grid tabanlı çıktılar. Mobilde bile yazdır.",
                icon: (
                  <svg viewBox="0 0 24 24" className="size-6" aria-hidden><path fill="currentColor" d="M6 2h12v6H6zM4 8h16v10H4zM8 14h8v6H8z"/></svg>
                ),
              },
              {
                title: "Raporlama",
                desc: "Günlük/haftalık/aylık/yıllık toplam kazancı tek bakışta gör.",
                icon: (
                  <svg viewBox="0 0 24 24" className="size-6" aria-hidden><path fill="currentColor" d="M4 20h16v-2H4zM6 16h3V8H6zm5 0h3V4h-3zm5 0h3v-6h-3z"/></svg>
                ),
              },
            ].map((f) => (
              <div key={f.title} className="group rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-center justify-center size-10 rounded-lg bg-indigo-50 text-indigo-700">
                  {f.icon}
                </div>
                <div className="mt-3 font-semibold">{f.title}</div>
                <p className="text-sm text-neutral-600 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= NASIL ÇALIŞIR ======= */}
      <section id="ekran" className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6">
            <h3 className="text-xl font-semibold">Nasıl çalışır?</h3>
            <ol className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
              {[
                { t: "1) Katalog oluştur", d: "Kategori & varyantları tanımla. Fiyat gir." },
                { t: "2) Sipariş gir", d: "Müşteri bilgisi, ölçüler, file sıklığı. Sistem tutarı hesaplar." },
                { t: "3) Yazdır & paylaş", d: "A4 düzeniyle çıktıyı ver veya PDF paylaş." },
              ].map((s) => (
                <li key={s.t} className="rounded-xl border border-neutral-200 p-4">
                  <div className="font-medium">{s.t}</div>
                  <div className="text-neutral-600 mt-1">{s.d}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ======= FİYATLANDIRMA ======= */}
      <section id="fiyat" className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center">Fiyatlandırma</h2>
          <p className="mt-2 text-center text-neutral-600">Küçükten büyüğe tüm işletmeler için.</p>

          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {/* Başlangıç */}
            <div className="relative rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-indigo-700">Başlangıç</div>
              <div className="mt-2 text-3xl font-extrabold">0 ₺</div>
              <p className="text-neutral-600 mt-2 text-sm">Tek kullanıcı, sınırlı rapor, temel çıktılar.</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>✔ Ücretsiz Demo</li>
                <li>✔ Sipariş oluşturma</li>
                <li>✔ Yazdırılabilir A4</li>
              </ul>
              <Link prefetch={false} href="/register" className="mt-6 w-full text-center inline-flex items-center justify-center rounded-xl bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">Ücretsiz Başla</Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-3xl border-2 border-indigo-600 bg-white p-6 shadow-md">
              <div className="absolute -top-3 right-4 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">Popüler</div>
              <div className="text-sm font-semibold text-indigo-700">Pro</div>
              <div className="mt-2 text-3xl font-extrabold">2000 ₺/ay</div>
              <p className="text-neutral-600 mt-2 text-sm">Çoklu kullanıcı, gelişmiş raporlar, öncelikli destek.</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>✔ Çoklu kullanıcı</li>
                <li>✔ Gelişmiş raporlar</li>
                <li>✔ Net toplam & iskonto</li>
              </ul>
              <Link prefetch={false} href="/register" className="mt-6 w-full text-center inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">Pro’yu Deneyin</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
