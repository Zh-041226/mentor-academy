import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const rows = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { studentId: true, adminLevel: true } })
console.log(JSON.stringify(rows))
await prisma.$disconnect()
