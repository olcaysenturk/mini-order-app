export const siteMetadata = {
  name: "Perdexa",
  shortName: "Perdexa",
  title: "Perdexa — Perde Siparişlerini Tek Yerden Yönetin",
  description:
    "Perdexa ile perde siparişlerinizi kategori, ürün, ölçü ve raporlama akışlarında tek panelden yönetin. Yazdırılabilir A4 formlar, otomatik fiyat hesaplama ve çok kullanıcılı yapı sunar.",
  siteUrl: "https://perdexa.com",
  locale: "tr_TR",
  contactEmail: "info@perdexa.com",
  keywords: [
    "Perdexa",
    "perde sipariş programı",
    "perdeciler için crm",
    "perde mağazası yazılımı",
    "perde sipariş yönetimi",
    "perde satış otomasyonu",
    "perde takip programı",
    "m2 hesaplama yazılımı",
    "perdexa perde sipariş",
    "tekstil sipariş sistemi"
  ],
  socialProfiles: {
    linkedin: "https://www.linkedin.com/company/perdexa",
    instagram: "https://www.instagram.com/perdexa",
  },
  ogImage: "/og/perdexa.png",
};

export const absoluteUrl = (path: string = "/") => {
  try {
    return new URL(path, siteMetadata.siteUrl).toString();
  } catch {
    return siteMetadata.siteUrl;
  }
};

export const getOgImage = (path?: string) => {
  if (path && path.startsWith("http")) return path;
  const imagePath = path || siteMetadata.ogImage;
  return absoluteUrl(imagePath);
};
