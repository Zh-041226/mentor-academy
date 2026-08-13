import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const sid = process.argv[2] || 'mengsuilianyun'

async function main() {
  const u = await prisma.user.findUnique({ where: { studentId: sid } })
  console.log('[print_user]', sid, u)
}

main().finally(async () => { await prisma.$disconnect() })