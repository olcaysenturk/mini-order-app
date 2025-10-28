import { prisma } from '@/app/lib/db'
import { DEFAULT_CATEGORIES } from './categories';

export async function ensureDefaultCategoriesForTenant(tenantId: string) {
  if (!tenantId) return;

  // Hızlı kontrol: zaten varsa kısa devre
  const existing = await prisma.category.findMany({
    where: { tenantId },
    select: { name: true },
  });
  const existingSet = new Set(existing.map(c => c.name.toUpperCase()));

  const toCreate = DEFAULT_CATEGORIES
    .filter(n => !existingSet.has(n.toUpperCase()))
    .map(name => ({ tenantId, name }));

  if (toCreate.length === 0) return;

  await prisma.category.createMany({
    data: toCreate,
    skipDuplicates: true, // eşzamanlı yarışlarda güvenlik
  });
}
