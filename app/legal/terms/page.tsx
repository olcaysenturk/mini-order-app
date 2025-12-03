// app/legal/terms/page.tsx — LIGHT MODE · modern (landing referanslı)
import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, getOgImage, siteMetadata } from "@/app/lib/seo";

/** ======= SEO ======= */
export const metadata: Metadata = {
  title: "Kullanım Şartları — Perdexa",
  description:
    "Perdexa kullanım şartları: hizmet kapsamı, hesap, ücretlendirme, kullanım kuralları, fikri mülkiyet, sorumluluk, fesih ve diğer hukuki koşullar.",
  keywords: [...siteMetadata.keywords, "perdexa kullanım şartları", "perdexa sözleşme"],
  alternates: { canonical: absoluteUrl("/legal/terms") },
  openGraph: {
    title: "Kullanım Şartları — Perdexa",
    description: "Perdexa hizmetini kullanırken kabul ettiğiniz tüm koşullar ve sorumluluklar.",
    url: absoluteUrl("/legal/terms"),
    siteName: siteMetadata.shortName,
    images: [{ url: getOgImage(), width: 1200, height: 630, alt: "Perdexa kullanım şartları" }],
    locale: siteMetadata.locale,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kullanım Şartları — Perdexa",
    description: "Hesap, ücretlendirme ve kullanım kurallarına dair güncel Perdexa şartları.",
    images: [getOgImage()],
  },
};

export default function TermsPage() {
  const lastUpdated = "19 Ekim 2025"; // gerektiğinde güncelle
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Kullanım Şartları",
    url: absoluteUrl("/legal/terms"),
    dateModified: "2025-10-19",
    isPartOf: { "@type": "WebSite", name: siteMetadata.name, url: absoluteUrl("/") },
  };

  return (
    <main id="main" className="relative min-h-screen overflow-hidden bg-white text-neutral-900">
      {/* Skip link */}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-black focus:px-3 focus:py-2 focus:text-white"
      >
        İçeriğe atla
      </a>

      {/* ======= Dekoratif Arka Plan (landing ile aynı) ======= */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_30%,#000,transparent)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(79,70,229,.18),transparent)] blur-2xl" />
        <div className="absolute -bottom-48 right-1/2 h-[520px] w-[980px] translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,.14),transparent)] blur-2xl" />
      </div>

      {/* ======= HERO ======= */}
      <section className="relative z-10 pt-8 sm:pt-12 pb-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="breadcrumb" className="text-xs sm:text-sm text-neutral-500">
            <Link href="/" className="hover:underline underline-offset-4">Ana sayfa</Link>
            <span aria-hidden className="mx-2">/</span>
            <span>Şartlar</span>
          </nav>

          <div className="mt-3 grid gap-6 lg:grid-cols-3 items-end">
            <div className="lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/60 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur">
                <span aria-hidden className="size-2 rounded-full bg-indigo-600" />
                Kullanım Şartları
              </div>
              <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
                Hizmet <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">koşulları</span>.
              </h1>
              <p className="mt-3 text-base sm:text-lg text-neutral-600 max-w-2xl">
                Perdexa’yı kullanarak aşağıdaki şartları kabul etmiş olursunuz. Lütfen dikkatle okuyun.
              </p>
              <p className="mt-2 text-sm text-neutral-500">Son güncelleme: {lastUpdated}</p>
            </div>

            {/* Kısa özet kartı */}
            <div className="relative">
              <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-5 shadow-sm">
                <div className="text-sm font-medium">Kısa Özet</div>
                <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                  <li>• Hesap güvenliğinden siz sorumlusunuz.</li>
                  <li>• Yasaklı kullanım yok; mevzuata aykırı içerik yasaktır.</li>
                  <li>• Ücret ve planlar bildirimle değişebilir.</li>
                  <li>• Sorumluluk makul ölçüde sınırlandırılmıştır.</li>
                </ul>
              </div>
              <div aria-hidden className="absolute -inset-4 rounded-[28px] bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ======= İÇİNDekiler ======= */}
      <section className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 text-sm">
            <div className="font-medium">İçindekiler</div>
            <ol className="mt-2 grid gap-1 sm:grid-cols-3">
              {[
                { href: "#kapsam", t: "1) Kapsam & Taraflar" },
                { href: "#tanimlar", t: "2) Tanımlar" },
                { href: "#hesap", t: "3) Hesap & Güvenlik" },
                { href: "#ucret", t: "4) Ücretlendirme & Faturalandırma" },
                { href: "#kurallar", t: "5) Kullanım Kuralları & Yasaklar" },
                { href: "#ip", t: "6) Fikri Mülkiyet" },
                { href: "#gizlilik", t: "7) Veri Koruma & Gizlilik" },
                { href: "#ucuncu", t: "8) Üçüncü Taraflar" },
                { href: "#garanti", t: "9) Garanti Reddi & Sorumluluk" },
                { href: "#mucbir", t: "10) Mücbir Sebep" },
                { href: "#fesih", t: "11) Fesih" },
                { href: "#hukuk", t: "12) Uygulanacak Hukuk & Uyuşmazlık" },
                { href: "#degisiklik", t: "13) Değişiklikler" },
                { href: "#iletisim", t: "14) İletişim" },
              ].map((i) => (
                <li key={i.href}>
                  <a href={i.href} className="text-neutral-700 hover:text-neutral-900 underline underline-offset-4">
                    {i.t}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ======= ANA İÇERİK ======= */}
      <section id="icerik" className="relative z-10 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-6 md:grid-cols-3">
          {/* Sol sütun: makale */}
          <article className="md:col-span-2 space-y-6">
            <div id="kapsam" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">1) Kapsam & Taraflar</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Bu Şartlar, Perdexa web uygulaması ve ilişkili servisler (“Hizmet”) için geçerlidir.
                Hizmeti kullanan gerçek/tüzel kişi “Kullanıcı”, Hizmeti işleten teşebbüs “Perdexa” olarak anılır.
              </p>
            </div>

            <div id="tanimlar" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">2) Tanımlar</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• “Hesap”: Kullanıcının kimliği ve yetkileri ile ilişkili profil.</li>
                <li>• “İçerik”: Kullanıcı tarafından girilen tüm veriler (müşteri/sipariş vb.).</li>
                <li>• “Plan”: Ücretli/ücretsiz paket ve özellik seti.</li>
              </ul>
            </div>

            <div id="hesap" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">3) Hesap & Güvenlik</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• Hesap bilgilerinin doğruluğu ve gizliliği Kullanıcı sorumluluğundadır.</li>
                <li>• Yetkisiz kullanım şüphesinde derhal bildirim yapılmalıdır.</li>
                <li>• RBAC/rol dağılımı işveren/sistem yöneticisinin sorumluluğundadır.</li>
              </ul>
            </div>

            <div id="ucret" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">4) Ücretlendirme & Faturalandırma</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• Plan ücretleri, vergi ve yasal kesintiler hariç/ dahil olarak ayrıca belirtilebilir.</li>
                <li>• Abonelikler dönemsel olarak yenilenir; iptal edilene kadar devam eder.</li>
                <li>• İadeler, yürürlükteki tüketici mevzuatı saklı kalmak kaydıyla plan politikasına tabidir.</li>
                <li>• Ödemeler, yetkili ödeme sağlayıcıları üzerinden alınır; kart verileri sistemimizde saklanmaz.</li>
              </ul>
            </div>

            <div id="kurallar" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">5) Kullanım Kuralları & Yasaklar</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• Mevzuata aykırı, zararlı, hak ihlali oluşturan içerik ve faaliyetler yasaktır.</li>
                <li>• Hizmeti kötüye kullanma, tersine mühendislik, yetkisiz erişim girişimleri yasaktır.</li>
                <li>• Altyapıya aşırı yük bindiren otomasyonlar/robotik trafik kısıtlanabilir.</li>
              </ul>
            </div>

            <div id="ip" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">6) Fikri Mülkiyet</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Yazılım, marka, logo, tasarım ve belgeler üzerindeki tüm haklar Perdexa’ya veya lisans verenlerine aittir.
                Kullanıcıya yalnızca sözleşme kapsamındaki sınırlı, devredilemez kullanım hakkı tanınır.
              </p>
            </div>

            <div id="gizlilik" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">7) Veri Koruma & Gizlilik</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Kişisel veriler, <Link href="/legal/privacy" className="underline underline-offset-4">Gizlilik Politikası</Link>’na uygun olarak işlenir.
                Politikada belirtilen haklar (erişim, düzeltme, silme, itiraz) geçerlidir.
              </p>
            </div>

            <div id="ucuncu" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">8) Üçüncü Taraflar</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Barındırma, e-posta, analiz, hata izleme ve ödeme gibi sağlayıcılar kullanılabilir. İlgili paylaşım ve
                işleme, sözleşmesel ve teknik önlemlerle sınırlandırılır.
              </p>
            </div>

            <div id="garanti" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">9) Garanti Reddi & Sorumluluk Sınırı</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• Hizmet “olduğu gibi” sağlanır; kesintisiz ve hatasız çalışma garanti edilmez.</li>
                <li>• Yasal olarak izin verilen ölçüde, dolaylı/sonuçsal kayıplardan sorumlu olmayız.</li>
                <li>• Toplam sorumluluk, ilgili dönemde Hizmet için ödenen tutarla sınırlıdır.</li>
              </ul>
            </div>

            <div id="mucbir" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">10) Mücbir Sebep</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Doğal afet, savaş, afet, elektrik/İnternet kesintileri gibi kontrol dışı olaylarda yükümlülükler askıya alınabilir.
              </p>
            </div>

            <div id="fesih" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">11) Fesih</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Kullanıcı dilediğinde aboneliğini sonlandırabilir. Şartların ihlalinde, Hizmet’e erişim uyarı olmaksızın
                durdurulabilir. Yasal saklama yükümlülükleri saklıdır.
              </p>
            </div>

            <div id="hukuk" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">12) Uygulanacak Hukuk & Uyuşmazlık</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Aksi kararlaştırılmadıkça Türkiye Cumhuriyeti kanunları uygulanır; uyuşmazlıklarda İstanbul (TR)
                mahkemeleri ve icra daireleri yetkilidir. Zorunlu tüketici mevzuatı hükümleri saklıdır.
              </p>
            </div>

            <div id="degisiklik" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">13) Değişiklikler</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Şartlar zaman zaman güncellenebilir. Önemli değişikliklerde makul bildirim yöntemleri kullanılır.
                Güncel metin sitede yayımlandığı anda yürürlüğe girer.
              </p>
            </div>

            <div id="iletisim" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">14) İletişim</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Sorular ve talepler için <Link href="/contact" className="underline underline-offset-4">İletişim</Link>{" "}
                sayfasını kullanın veya{" "}
                <a href="mailto:legal@perdexa.app" className="underline underline-offset-4">legal@perdexa.app</a>{" "}
                adresine yazın.
              </p>
            </div>
          </article>

          {/* Sağ sütun: yardımcı kutular */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <div className="text-sm font-medium">Hızlı Bağlantılar</div>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li><Link href="/legal/privacy" className="underline underline-offset-4">Gizlilik Politikası</Link></li>
                <li><Link href="/contact" className="underline underline-offset-4">İletişim</Link></li>
              </ul>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <div className="text-sm font-medium">Plan & Faturalandırma</div>
              <p className="mt-2 text-sm text-neutral-700">
                Ücretler ve faturalandırma hakkında daha fazla bilgiye mi ihtiyacınız var?
              </p>
              <Link
                href="/#fiyat"
                className="mt-3 inline-flex items-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Fiyatlandırmayı Gör
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ======= Alt CTA (landing ile tutarlı degrade) ======= */}
      <section className="relative z-10 pb-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-r from-indigo-600 to-emerald-500">
            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <h3 className="text-white text-xl sm:text-2xl font-extrabold">Sorunuz mu var?</h3>
              <p className="mt-1 text-white/90 text-sm max-w-xl">
                Şartlar hakkında açıklama isterseniz bize yazın; hızlıca yardımcı olalım.
              </p>
              <div className="mt-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-100"
                >
                  İletişime Geç
                </Link>
              </div>
            </div>
            <div aria-hidden className="absolute right-[-10%] top-[-20%] h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          </div>
        </div>
      </section>
    </main>
  );
}
