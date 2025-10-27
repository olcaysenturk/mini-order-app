// app/legal/privacy/page.tsx — LIGHT MODE · modern (landing referanslı)
import Link from "next/link";

/** ======= SEO ======= */
export const metadata = {
  title: "Gizlilik — Perdexa",
  description:
    "Perdexa gizlilik politikası: hangi verileri işlediğimiz, hukuki sebepler, saklama süreleri, üçüncü taraflar ve haklarınız.",
};

export default function PrivacyPage() {
  const lastUpdated = "19 Ekim 2025"; // gerektiğinde güncelle

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "PrivacyPolicy",
    name: "Perdexa Gizlilik Politikası",
    url: "/legal/privacy",
    dateModified: "2025-10-19",
    publisher: { "@type": "Organization", name: "Perdexa" },
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

      {/* ======= Dekoratif Arka Plan (landing ile aynı desen) ======= */}
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
            <span>Gizlilik</span>
          </nav>

          <div className="mt-3 grid gap-6 lg:grid-cols-3 items-end">
            <div className="lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/60 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur">
                <span aria-hidden className="size-2 rounded-full bg-indigo-600" />
                Gizlilik Politikası
              </div>
              <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
                Verileriniz <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">güvende</span>.
              </h1>
              <p className="mt-3 text-base sm:text-lg text-neutral-600 max-w-2xl">
                Bu sayfa, hangi verileri neden işlediğimizi, ne kadar süre sakladığımızı, üçüncü taraflarla nasıl
                paylaştığımızı ve KVKK/GDPR kapsamındaki haklarınızı açıklar.
              </p>
              <p className="mt-2 text-sm text-neutral-500">Son güncelleme: {lastUpdated}</p>
            </div>

            {/* Kısa özet kartı */}
            <div className="relative">
              <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-5 shadow-sm">
                <div className="text-sm font-medium">Kısa Özet</div>
                <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                  <li>• Hizmeti sağlamak için gerekli verileri işleriz.</li>
                  <li>• Hukuki dayanak: sözleşme, meşru menfaat, yükümlülük, gerektiğinde rıza.</li>
                  <li>• Verilerinize erişme, düzeltme, silme ve itiraz haklarınız vardır.</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">KVKK</span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">GDPR</span>
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">TLS</span>
                </div>
              </div>
              <div aria-hidden className="absolute -inset-4 rounded-[28px] bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ======= İÇİNDEKİLER ======= */}
      <section className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 text-sm">
            <div className="font-medium">İçindekiler</div>
            <ol className="mt-2 grid gap-1 sm:grid-cols-3">
              {[
                { href: "#kapsam", t: "1) Kapsam & Tanımlar" },
                { href: "#islenen", t: "2) İşlenen Veri Kategorileri" },
                { href: "#hukuki", t: "3) Hukuki Dayanaklar" },
                { href: "#amac", t: "4) Amaçlar & Saklama Süreleri" },
                { href: "#ucuncu", t: "5) Üçüncü Taraflar & Aktarımlar" },
                { href: "#haklar", t: "6) Haklarınız" },
                { href: "#guvenlik", t: "7) Güvenlik" },
                { href: "#cerez", t: "8) Çerezler & Analitik" },
                { href: "#degisiklik", t: "9) Değişiklikler" },
                { href: "#iletisim", t: "10) İletişim" },
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
            {/* 1 */}
            <div id="kapsam" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">1) Kapsam & Tanımlar</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Bu politika, Perdexa web uygulaması ve ilişkili servisleri (“Hizmet”) için geçerlidir.
                “Kullanıcı” Hizmeti kullanan gerçek/tüzel kişiyi ifade eder. Bu metin, KVKK ve GDPR ile uyumlu
                bir çerçeve sağlamayı hedefler.
              </p>
            </div>

            {/* 2 */}
            <div id="islenen" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">2) İşlenen Veri Kategorileri</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• Hesap verileri: ad, e-posta, telefon (opsiyonel), şirket/mağaza adı.</li>
                <li>• Kullanım verileri: oturum, cihaz/tarayıcı bilgileri, IP (güvenlik/log).</li>
                <li>• Sipariş verileri: müşteri adı/telefonu, ürün/kategori, ölçüler, tutarlar, notlar.</li>
                <li>• Ödeme verileri: yöntem ve durum; **kart bilgileri sistemimizde saklanmaz** (ödeme sağlayıcıda işlenir).</li>
                <li>• Destek içerikleri: form mesajları, ekler.</li>
              </ul>
            </div>

            {/* 3 */}
            <div id="hukuki" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">3) Hukuki Dayanaklar</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• Sözleşmenin kurulması/ifası (KVKK m.5/2-c; GDPR Art.6(1)(b))</li>
                <li>• Meşru menfaat (KVKK m.5/2-f; GDPR Art.6(1)(f)) — güvenlik, hata giderme, iyileştirme.</li>
                <li>• Hukuki yükümlülük (KVKK m.5/2-ç; GDPR Art.6(1)(c)) — mali/vergisel kayıtlar.</li>
                <li>• Açık rıza (gerekli olduğunda) — pazarlama iletileri vb. (GDPR Art.6(1)(a)).</li>
              </ul>
            </div>

            {/* 4 */}
            <div id="amac" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">4) Amaçlar & Saklama Süreleri</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• Hizmetin sunumu ve bakım — hesap/sipariş işlemleri (aktif sözleşme süresince).</li>
                <li>• Güvenlik, hata ayıklama, performans — makul süreli log saklama (örn. 12 ay).</li>
                <li>• Yasal yükümlülükler — muhasebe/vergisel kayıtlar (ülke mevzuatına göre 5–10 yıl).</li>
              </ul>
            </div>

            {/* 5 */}
            <div id="ucuncu" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">5) Üçüncü Taraflar & Veri Aktarımları</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Hizmeti yürütmek için barındırma, e-posta, hata izleme, analiz ve ödeme altyapısı gibi
                sağlayıcılarla çalışabiliriz. Paylaşımlar, ilgili amaçla sınırlı ve sözleşmeyle güvence altındadır.
                AB dışına aktarım gerekirse GDPR standart sözleşme maddeleri (SCC) veya eşdeğer mekanizmalar kullanılır.
              </p>
            </div>

            {/* 6 */}
            <div id="haklar" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">6) Haklarınız</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• Erişim — hakkınızda tuttuğumuz verilere erişim talep edebilirsiniz.</li>
                <li>• Düzeltme/Silme — yanlış verilerin düzeltilmesini veya silinmesini talep edebilirsiniz.</li>
                <li>• Taşınabilirlik — teknik olarak mümkün verileri yapılandırılmış biçimde talep edebilirsiniz.</li>
                <li>• İşlemeye itiraz/sınırlama — meşru menfaat temelli işlemlere itiraz edebilirsiniz.</li>
                <li>• Rızanın geri alınması — rızaya dayalı işlemede rızanızı geri alabilirsiniz.</li>
              </ul>
              <p className="mt-2 text-sm text-neutral-700">
                Talepler için <Link href="/contact" className="underline underline-offset-4">İletişim</Link> sayfasını kullanın.
              </p>
            </div>

            {/* 7 */}
            <div id="guvenlik" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">7) Güvenlik</h2>
              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• TLS ile şifreli aktarım, rol-bazlı erişim (RBAC).</li>
                <li>• Erişim kontrolü, en az ayrıcalık ilkesi.</li>
                <li>• Yedekleme ve felaket kurtarma prosedürlerine uygun mimari.</li>
              </ul>
            </div>

            {/* 8 */}
            <div id="cerez" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">8) Çerezler & Analitik</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Oturum yönetimi ve temel analiz için çerezler/kayıtlar kullanılabilir. Tarayıcı ayarlarından
                çerez tercihlerinizi yönetebilirsiniz. Gerekli olmayan çerezler için rıza mekanizması gösterilebilir.
              </p>
            </div>

            {/* 9 */}
            <div id="degisiklik" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">9) Değişiklikler</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Politikayı zaman zaman güncelleyebiliriz. Önemli değişikliklerde uygun yöntemlerle bilgilendirme yaparız.
              </p>
            </div>

            {/* 10 */}
            <div id="iletisim" className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h2 className="text-xl font-semibold">10) İletişim</h2>
              <p className="mt-2 text-sm text-neutral-700">
                Sorularınız ve talepleriniz için <Link href="/contact" className="underline underline-offset-4">İletişim</Link>{" "}
                sayfasını kullanın veya{" "}
                <a href="mailto:privacy@perdexa.app" className="underline underline-offset-4">
                  privacy@perdexa.app
                </a>{" "}
                adresine yazın.
              </p>
            </div>
          </article>

          {/* Sağ sütun: yardımcı kutular */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <div className="text-sm font-medium">Hızlı Bağlantılar</div>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li><Link href="/legal/terms" className="underline underline-offset-4">Kullanım Şartları</Link></li>
                <li><Link href="/contact" className="underline underline-offset-4">İletişim</Link></li>
              </ul>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <div className="text-sm font-medium">Veri Sahibi Talebi</div>
              <p className="mt-2 text-sm text-neutral-700">
                Erişim, düzeltme, silme ve itiraz gibi haklarınız için kısa formu doldurun.
              </p>
              <Link
                href="/contact"
                className="mt-3 inline-flex items-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Talep Gönder
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
              <h3 className="text-white text-xl sm:text-2xl font-extrabold">
                Gizlilik sorularınız mı var?
              </h3>
              <p className="mt-1 text-white/90 text-sm max-w-xl">
                Verileriniz üzerinde tam kontrol için bize yazın. Taleplere hızlı dönüş yapıyoruz.
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
