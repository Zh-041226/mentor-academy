import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
try {
  const rows = await prisma.activity.findMany({ select: { category: true }, where: { category: { not: null } }, orderBy: { id: 'desc' } })
  console.log(JSON.stringify({ ok: true, count: rows.length }).slice(0, 200))
} catch (e) {
  console.error(e.message)
}
await prisma.$disconnect()
