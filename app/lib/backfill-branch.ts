import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } })
  for (const t of tenants) {
    let branch = await prisma.branch.findFirst({ where: { tenantId: t.id } })
    if (!branch) {
      branch = await prisma.branch.create({ data: { tenantId: t.id, name: 'Merkez (Otomatik)' } })
      console.log(`Tenant ${t.name}: şube oluşturuldu -> ${branch.id}`)
    }
    const upd = await prisma.order.updateMany({
      where: { tenantId: t.id, branchId: { equals: undefined } },
      data: { branchId: branch.id },
    })
    if (upd.count) console.log(`Tenant ${t.name}: ${upd.count} sipariş bağlandı`)
  }
}
main().finally(() => prisma.$disconnect())
