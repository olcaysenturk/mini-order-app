// app/contact/page.tsx — LIGHT MODE · modern (landing referanslı)
import Link from "next/link";
import { redirect } from "next/navigation";

/** ======= SEO / OpenGraph ======= */
export const metadata = {
  title: "İletişim — Perdexa",
  description:
    "Perdexa ekibiyle iletişime geçin. Destek, satış ve iş ortaklıkları için formu doldurun.",
  openGraph: {
    title: "İletişim — Perdexa",
    description:
      "Perdexa ile ilgili destek, satış ve iş birlikleri için bize yazın.",
    url: "https://your-domain.example/contact",
    siteName: "Perdexa",
    images: [{ url: "/og/perdexa.png", width: 1200, height: 630, alt: "Perdexa Önizleme" }],
    locale: "tr_TR",
    type: "website",
  },
  alternates: { canonical: "/contact" },
};

/** ======= Server Action ======= */
async function sendContact(formData: FormData) {
  "use server";

  // Honeypot (botları yakala)
  const website = (formData.get("website") as string) || "";
  if (website.trim()) redirect("/contact?sent=1");

  const name = ((formData.get("name") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const subject = ((formData.get("subject") as string) || "").trim();
  const message = ((formData.get("message") as string) || "").trim();

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !validEmail || message.length < 10) {
    redirect("/contact?error=1");
  }

  // TODO: Burada e-posta/DB entegrasyonunu ekleyin (Resend/Nodemailer/Prisma vb.)
  console.log("CONTACT_FORM", { name, email, phone, subject, message, ts: new Date().toISOString() });

  redirect("/contact?sent=1");
}

export default function ContactPage({
  searchParams,
}: { searchParams?: { sent?: string; error?: string } }) {
  const sent = searchParams?.sent === "1";
  const error = searchParams?.error === "1";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Perdexa İletişim",
    url: "/contact",
    publisher: { "@type": "Organization", name: "Perdexa" },
    contactPoint: [{
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@perdexa.app",
      availableLanguage: ["tr", "en"],
      areaServed: "TR"
    }]
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
            <span>İletişim</span>
          </nav>

          <div className="mt-3 grid gap-6 lg:grid-cols-3 items-end">
            <div className="lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/60 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur">
                <span aria-hidden className="size-2 rounded-full bg-indigo-600" />
                İletişim
              </div>
              <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
                Bizimle <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">iletişime geçin</span>.
              </h1>
              <p className="mt-3 text-base sm:text-lg text-neutral-600 max-w-2xl">
                Destek, satış ve iş ortaklıkları için formu doldurun. Genellikle 1 iş günü içinde dönüş yapıyoruz (10:00–18:00, TR).
              </p>
            </div>

            {/* Bildirim bantları */}
            <div className="relative">
              {(sent || error) && (
                <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-5 shadow-sm">
                  {sent && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Teşekkürler! Mesajın bize ulaştı. En kısa sürede dönüş yapacağız.
                    </div>
                  )}
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      Formda eksik/hatalı bilgi var. Lütfen geçerli e-posta girin ve mesajınızı biraz detaylandırın.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======= İÇERİK ======= */}
      <section id="icerik" className="relative z-10 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-6 md:grid-cols-5">
          {/* Form */}
          <div className="md:col-span-3">
            <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur shadow-sm">
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="text-sm font-medium">Bize yazın</h2>
              </div>

              <form action={sendContact} className="p-5 sm:p-6 text-sm">
                {/* Honeypot */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />

                <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-xs text-neutral-700">Ad Soyad</label>
                    <input
                      id="name" name="name" required maxLength={120}
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-neutral-900/5"
                      placeholder="Adınız Soyadınız"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-xs text-neutral-700">E-posta</label>
                    <input
                      id="email" name="email" type="email" required maxLength={120}
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-neutral-900/5"
                      placeholder="ornek@domen.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-xs text-neutral-700">Telefon (opsiyonel)</label>
                    <input
                      id="phone" name="phone" maxLength={30}
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-neutral-900/5"
                      placeholder="+90 5xx xxx xx xx"
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-xs text-neutral-700">Konu (opsiyonel)</label>
                    <input
                      id="subject" name="subject" maxLength={140}
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-neutral-900/5"
                      placeholder="Kısa başlık"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="message" className="block text-xs text-neutral-700">Mesaj</label>
                    <textarea
                      id="message" name="message" required minLength={10} maxLength={4000} rows={6}
                      className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-neutral-900/5"
                      placeholder="İhtiyacınızı mümkün olduğunca net anlatın. Örn: 'Pro plana geçmek istiyorum, şu özellikler lazım…'"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-neutral-500">
                    Gönder’e basarak{" "}
                    <Link href="/legal/privacy" className="underline underline-offset-4">gizlilik politikamızı</Link>{" "}
                    kabul etmiş olursunuz.
                  </p>

                  <SubmitButton className="inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed">
                    Mesajı Gönder
                  </SubmitButton>
                </div>
              </form>
            </div>
          </div>

          {/* Bilgi kutuları */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Destek</h3>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li>
                  E-posta:{" "}
                  <a href="mailto:support@perdexa.app" className="underline underline-offset-4">
                    support@perdexa.app
                  </a>
                </li>
                <li>Çalışma saatleri: Hafta içi 10:00–18:00 (TR)</li>
                <li>Yanıt süresi: Genellikle 1 iş günü</li>
              </ul>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Satış</h3>
                <p className="mt-2 text-sm text-neutral-700">
                  Pro plan ve ekip lisansları için bize ulaşın.
                </p>
                <a
                  href="mailto:sales@perdexa.app"
                  className="mt-3 inline-flex rounded-xl bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-black"
                >
                  sales@perdexa.app
                </a>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Adres</h3>
                <address className="mt-2 not-italic text-sm text-neutral-700">
                  Burgas, BG (EU) <br />
                  İstanbul, TR
                </address>
                <p className="mt-2 text-xs text-neutral-500">
                  Randevu ile ziyaret kabul edilir.
                </p>
              </div>
            </div>

            {/* Harita placeholder */}
            <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 p-10 text-center text-xs text-neutral-500">
              Harita bileşeni için yer ayrıldı.
            </div>
          </div>
        </div>
      </section>

      {/* ======= Alt CTA (landing ile tutarlı degrade) ======= */}
      <section className="relative z-10 pb-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-r from-indigo-600 to-emerald-500">
            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <h3 className="text-white text-xl sm:text-2xl font-extrabold">Hızlı destek mi lazım?</h3>
              <p className="mt-1 text-white/90 text-sm max-w-xl">
                Formu gönderin; uygun ekip arkadaşımız doğrudan sizinle iletişime geçsin.
              </p>
              <div className="mt-4">
                <a
                  href="mailto:support@perdexa.app"
                  className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-100"
                >
                  support@perdexa.app
                </a>
              </div>
            </div>
            <div aria-hidden className="absolute right-[-10%] top-[-20%] h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          </div>
        </div>
      </section>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}

/* Client submit button */
import { SubmitButton } from "../components/SubmitButton";
