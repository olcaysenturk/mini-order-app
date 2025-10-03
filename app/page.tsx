// app/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/orders");

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white via-[#f7f7fb] to-white">
      {/* arka plan süsleri */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,_rgba(79,70,229,0.20),_transparent)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-40 right-1/2 h-[420px] w-[780px] translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,_rgba(16,185,129,0.18),_transparent)] blur-2xl" />

      {/* HERO (header yok) */}
      <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24 sm:pb-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight mt-5">
              Perde siparişlerini <span className="text-indigo-600">tek yerden</span> yönetin.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600">
              Kategori & varyant tanımla, m² ve file sıklığına göre tutarı otomatik hesapla,
              yazdırılabilir formla işini hızlandır. Çok kullanıcılı, çok cihazlı, bulutta.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register" className="btn text-base">Ücretsiz Kaydol</Link>
              <Link href="/login" className="btn-secondary text-base">Zaten hesabım var</Link>
            </div>

            <div className="mt-6 flex items-center gap-4 text-sm text-gray-500">
              <span>• Mobil uyumlu</span>
              <span>• Yazdırılabilir A4</span>
              <span>• Raporlama</span>
            </div>
          </div>

          {/* vitrin mockup */}
          <div
            aria-hidden
            className="relative rounded-3xl border border-black/10 bg-white/60 backdrop-blur-md shadow-xl"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-black/10">
              <div className="size-3 rounded-full bg-red-400" />
              <div className="size-3 rounded-full bg-yellow-400" />
              <div className="size-3 rounded-full bg-green-400" />
              <div className="ml-3 text-xs text-gray-500">Siparişler</div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 text-sm font-medium bg-gray-50 border-b border-black/10">
                  Güncel Siparişler
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-white">
                    <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-gray-500">
                      <th>#</th>
                      <th>Müşteri</th>
                      <th>Telefon</th>
                      <th className="text-right">Tutar</th>
                      <th className="text-right">Durum</th>
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
                        <td className="text-gray-500">{r.tel}</td>
                        <td className="text-right">{r.tutar} ₺</td>
                        <td className="text-right">
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                            {r.st}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <div className="text-xs text-gray-500">Bu Ay</div>
                  <div className="text-2xl font-bold">64.350 ₺</div>
                </div>
                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <div className="text-xs text-gray-500">Aylık Sipariş</div>
                  <div className="text-2xl font-bold">27</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ÖZELLİKLER */}
      <section id="ozellikler" className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center">İhtiyacın olan her şey</h2>
        <p className="mt-2 text-center text-gray-600">
          Kategoriler, varyantlar, otomatik fiyat hesaplama ve tek tıkla yazdırma.
        </p>

        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {[
            {
              title: "Esnek Katalog",
              desc: "Kategori & varyant ekle, birim fiyatı belirle, m² hesabı otomatik çalışsın.",
              icon: (
                <svg viewBox="0 0 24 24" className="size-6"><path fill="currentColor" d="M4 4h16v4H4zM4 10h10v4H4zM4 16h16v4H4z"/></svg>
              ),
            },
            {
              title: "A4 Yazdırma",
              desc: "Terzi & müşteri için temiz, grid tabanlı çıktılar. Mobilde bile yazdır.",
              icon: (
                <svg viewBox="0 0 24 24" className="size-6"><path fill="currentColor" d="M6 2h12v6H6zM4 8h16v10H4zM8 14h8v6H8z"/></svg>
              ),
            },
            {
              title: "Raporlama",
              desc: "Günlük/haftalık/aylık/yıllık toplam kazancı tek bakışta gör.",
              icon: (
                <svg viewBox="0 0 24 24" className="size-6"><path fill="currentColor" d="M4 20h16v-2H4zM6 16h3V8H6zm5 0h3V4h-3zm5 0h3v-6h-3z"/></svg>
              ),
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-black/10 bg-white/70 backdrop-blur p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-center size-10 rounded-lg bg-indigo-50 text-indigo-700">
                {f.icon}
              </div>
              <div className="mt-3 font-semibold">{f.title}</div>
              <p className="text-sm text-gray-600 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EKRAN GÖRÜNTÜSÜ / NASIL ÇALIŞIR */}
      <section id="ekran" className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
        <div className="rounded-3xl border border-black/10 bg-white/70 backdrop-blur p-6">
          <h3 className="text-xl font-semibold">Nasıl çalışır?</h3>
          <ol className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
            <li className="rounded-xl border border-black/10 p-4">
              <div className="font-medium">1) Katalog oluştur</div>
              <div className="text-gray-600 mt-1">Kategori & varyantları tanımla. Fiyat gir.</div>
            </li>
            <li className="rounded-xl border border-black/10 p-4">
              <div className="font-medium">2) Sipariş gir</div>
              <div className="text-gray-600 mt-1">Müşteri bilgisi, ölçüler, file sıklığı. Sistem tutarı hesaplar.</div>
            </li>
            <li className="rounded-xl border border-black/10 p-4">
              <div className="font-medium">3) Yazdır & paylaş</div>
              <div className="text-gray-600 mt-1">A4 düzeniyle çıktıyı ver veya PDF paylaş.</div>
            </li>
          </ol>
        </div>
      </section>

      {/* FİYATLANDIRMA */}
      <section id="fiyat" className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center">Basit fiyatlandırma</h2>
        <p className="mt-2 text-center text-gray-600">Küçükten büyüğe tüm işletmeler için.</p>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-indigo-700">Başlangıç</div>
            <div className="mt-2 text-3xl font-extrabold">0 ₺</div>
            <p className="text-gray-600 mt-2 text-sm">Tek kullanıcı, sınırlı rapor, temel çıktılar.</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>✔ Kategori & Varyant</li>
              <li>✔ Sipariş oluşturma</li>
              <li>✔ Yazdırılabilir A4</li>
            </ul>
            <Link href="/register" className="btn mt-6 w-full text-center">Ücretsiz Başla</Link>
          </div>

          <div className="rounded-3xl border-2 border-indigo-600 bg-white p-6 shadow-md">
            <div className="text-sm font-semibold text-indigo-700">Pro</div>
            <div className="mt-2 text-3xl font-extrabold">— ₺/ay</div>
            <p className="text-gray-600 mt-2 text-sm">Çoklu kullanıcı, gelişmiş raporlar, öncelikli destek.</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>✔ Çoklu kullanıcı</li>
              <li>✔ Gelişmiş raporlar</li>
              <li>✔ Net toplam & iskonto</li>
            </ul>
            <Link href="/register" className="btn mt-6 w-full text-center">Pro’yu Deneyin</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/5">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} Perde Konağı</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-indigo-600">Giriş</Link>
            <Link href="/register" className="hover:text-indigo-600">Kaydol</Link>
            <a className="hover:text-indigo-600" href="#ozellikler">Özellikler</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
