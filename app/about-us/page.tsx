// app/about/page.tsx — LIGHT MODE · modern (landing referanslı)
import Image from "next/image";
import Link from "next/link";

/** ======= SEO ======= */
export const metadata = {
  title: "Hakkımızda — Perdexa",
  description:
    "Perdexa ekibini, misyonumuzu ve perde sipariş yönetimini nasıl daha hızlı ve hatasız hale getirdiğimizi keşfedin.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "Hakkımızda — Perdexa",
    description:
      "Perdexa’nın hikayesi, değerleri ve perde işinizi büyütmenize yardımcı olan ürün vizyonu.",
    url: "/about",
    siteName: "Perdexa",
    images: [{ url: "/og/perdexa.png", width: 1200, height: 630, alt: "Perdexa Önizleme" }],
    locale: "tr_TR",
    type: "website",
  },
};

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Hakkımızda — Perdexa",
    url: "/about",
    mainEntity: {
      "@type": "Organization",
      name: "Perdexa",
      url: "/",
      brand: "Perdexa",
      sameAs: ["https://www.linkedin.com/company/perdexa"],
    },
  };

  const values = [
    {
      title: "Basitlik",
      desc: "Karmaşık iş akışlarını yalın, anlaşılır ekranlara indirgeriz.",
      chip: "UX",
    },
    {
      title: "Güven",
      desc: "Veri güvenliği, erişim kontrolü ve yedekleme ilk önceliğimiz.",
      chip: "Security",
    },
    {
      title: "Hız",
      desc: "Milisaniyeler önemlidir: performans ölçer, sürekli optimize ederiz.",
      chip: "Performance",
    },
    {
      title: "Müşteri Odaklılık",
      desc: "Sizi dinler, yol haritamızı gerçek ihtiyaçlara göre şekillendiririz.",
      chip: "Customer-first",
    },
  ];

  const timeline = [
    { date: "2024 Q4", title: "Fikir & İlk Prototip", desc: "Perde işindeki tekrar eden süreçler için PoC." },
    { date: "2025 Q1", title: "MVP", desc: "Kategori, varyant, m² hesabı ve A4 çıktılar yayında." },
    { date: "2025 Q2", title: "Takım & Bayi", desc: "Çok kullanıcılı yapı, rol & yetkiler, şube/bayi kavramı." },
    { date: "2025 Q3", title: "Raporlama", desc: "Günlük/aylık ciro, tahsilat ve sipariş durum raporları." },
    { date: "2025 Q4", title: "Ölçeklenme", desc: "Altyapı iyileştirmeleri, performans ve güvenlik yükseltmeleri." },
  ];

  const stats = [
    { k: "Ortalama Kurulum", v: "< 10 dk" },
    { k: "Aylık Aktif Kullanıcı", v: "100+" },
    { k: "Sipariş İşl.", v: "10.000+" },
    { k: "Uptime", v: "99.9%" },
  ];

  const team = [
    {
      name: "Olcay Şentürk",
      role: "Founder · Product & Frontend",
      img: "/images/team/olcay.jpg", // proje içinde uygun bir görsel koyabilirsiniz
      links: [{ href: "mailto:info@codeadd.net", label: "E-posta" }],
    },
    // { name: "…", role: "Backend", img: "/images/team/…", links: [{ href: "#", label: "LinkedIn" }] },
  ];

  return (
    <main id="main" className="relative min-h-screen overflow-hidden bg-white text-neutral-900">
      {/* Skip link */}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-black focus:px-3 focus:py-2 focus:text-white"
      >
        İçeriğe atla
      </a>

      {/* ======= Dekoratif Arka Plan (privacy ile aynı) ======= */}
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
            <span>Hakkımızda</span>
          </nav>

          <div className="mt-3 grid gap-6 lg:grid-cols-3 items-end">
            <div className="lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/60 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur">
                <span aria-hidden className="size-2 rounded-full bg-indigo-600" />
                Hakkımızda
              </div>
              <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
                Perde siparişleri <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">zahmetsiz</span> olsun diye.
              </h1>
              <p className="mt-3 text-base sm:text-lg text-neutral-600 max-w-2xl">
                Perdexa, perde ve tekstil sektöründe teklif, ölçü ve üretim süreçlerini hızlandırmak için tasarlanmış
                modern bir sipariş yönetimi uygulamasıdır. Kategori & varyant, m² ve file sıklığı, yazdırılabilir A4
                ve güçlü raporlar — hepsi tek yerde.
              </p>
            </div>

            {/* Öne çıkan kart */}
            <div className="relative">
              <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-5 shadow-sm">
                <div className="text-sm font-medium">Rakamlarla</div>
                <dl className="mt-2 grid grid-cols-2 gap-4 text-sm text-neutral-700">
                  {stats.map((s) => (
                    <div key={s.k} className="rounded-xl border border-neutral-200 p-3 bg-white">
                      <dt className="text-neutral-500">{s.k}</dt>
                      <dd className="mt-1 font-semibold">{s.v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/contact"
                    className="inline-flex items-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Demo İste
                  </Link>
                  <Link
                    href="/legal/privacy"
                    className="inline-flex items-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Gizlilik
                  </Link>
                </div>
              </div>
              <div aria-hidden className="absolute -inset-4 rounded-[28px] bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ======= İÇİNDEKİLER (opsiyonel kısa gezinme) ======= */}
      <section className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 text-sm">
            <div className="font-medium">İçindekiler</div>
            <ol className="mt-2 grid gap-1 sm:grid-cols-3">
              {[
                { href: "#hikaye", t: "1) Hikayemiz" },
                { href: "#misyon", t: "2) Misyon & Vizyon" },
                { href: "#degerler", t: "3) Değerler" },
                { href: "#zaman", t: "4) Zaman Çizelgesi" },
                { href: "#kariyer", t: "6) Kariyer & İletişim" },
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
          {/* Sol sütun */}
          <article className="md:col-span-2 space-y-6">
            {/* 1) Hikaye */}
            <div id="hikaye" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">1) Hikayemiz</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Perdexa, perde işinde tekliflendirme, ölçü ve varyant takibinin karmaşasını azaltmak için doğdu.
                Kağıt, WhatsApp, Excel arasında kaybolan bilgileri tek bir akışta toplamayı hedefledik.
                Bugün; tekliften üretime, tahsilattan raporlamaya kadar uçtan uca bir deneyim sunuyoruz.
              </p>
            </div>

            {/* 2) Misyon & Vizyon */}
            <div id="misyon" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">2) Misyon & Vizyon</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• <span className="font-medium">Misyon:</span> Perde sipariş süreçlerini herkes için hızlı, hatasız ve ölçülebilir kılmak.</li>
                <li>• <span className="font-medium">Vizyon:</span> Tekstil & perde dikeyinde en sevilen sipariş yönetim platformu olmak.</li>
                <li>• <span className="font-medium">Odak:</span> Kategori & varyant, m² ve file sıklığı hesapları, A4 çıktı ve raporlar.</li>
              </ul>
            </div>

            {/* 3) Değerler */}
            <div id="degerler" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">3) Değerler</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {values.map((v) => (
                  <div key={v.title} className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                      {v.chip}
                    </div>
                    <div className="mt-2 font-medium">{v.title}</div>
                    <p className="mt-1 text-sm text-neutral-700">{v.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4) Zaman Çizelgesi */}
            <div id="zaman" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">4) Zaman Çizelgesi</h2>
              <ol className="mt-3 relative">
                {timeline.map((t, i) => (
                  <li key={t.title} className="grid grid-cols-[auto_1fr] gap-4 py-3">
                    <div className="relative">
                      <span className="mt-1 inline-block size-2 rounded-full bg-indigo-600" />
                      {i !== timeline.length - 1 && (
                        <span aria-hidden className="absolute left-0 top-4 h-full w-px bg-neutral-200" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-neutral-500">{t.date}</div>
                      <div className="font-medium">{t.title}</div>
                      <p className="text-sm text-neutral-700">{t.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

    
          </article>

          {/* Sağ sütun: yardımcı kutular */}
          <aside className="space-y-6">
            {/* Güven kutusu */}
            <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <div className="text-sm font-medium">Neden Perdexa?</div>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li>• m² ve file sıklığına göre otomatik hesaplama</li>
                <li>• Yazdırılabilir A4 çıktılar ve imza alanları</li>
                <li>• Şube/bayi yönetimi ve rol tabanlı erişim</li>
                <li>• Raporlama: ciro, tahsilat, durum kırılımları</li>
              </ul>
            </div>

            {/* İletişim kutusu */}
            <div id="kariyer" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <div className="text-sm font-medium">Kariyer & İletişim</div>
              <p className="mt-2 text-sm text-neutral-700">
                Perde işini birlikte büyütelim. Deneyiminizi ve ilginizi bize yazın.
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/contact"
                  className="inline-flex items-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Bize Ulaşın
                </Link>
                <a
                  href="mailto:info@perdexa.app"
                  className="inline-flex items-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  E-posta Gönder
                </a>
              </div>
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
              <h3 className="text-white text-xl sm:text-2xl font-extrabold">
                Hadi işlerinizi hızlandıralım.
              </h3>
              <p className="mt-1 text-white/90 text-sm max-w-xl">
                Perdexa ile tekliften teslimata tüm akışlarınız tek yerde. 10 dakikada kurun, bugün deneyin.
              </p>
              <div className="mt-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-100"
                >
                  Demo Talep Et
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
