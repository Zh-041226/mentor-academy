import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// 初始管理员数据（studentId 作为用户名；password 将进行哈希；adminLevel 枚举）
const admins = [
  { studentId: 'admin1', password: 'CHANGE_ME', adminLevel: 'SUPER_ADMIN' },
  { studentId: 'admin2',     password: 'CHANGE_ME',   adminLevel: 'SUPERVISOR' },
  { studentId: 'admin3',        password: 'CHANGE_ME',   adminLevel: 'OWNER_PRIMARY' },
  { studentId: 'admin4',       password: 'CHANGE_ME',   adminLevel: 'OWNER_SECONDARY' },
  { studentId: 'admin5',   password: 'CHANGE_ME',   adminLevel: 'OWNER_SECONDARY' },
  { studentId: 'admin6',      password: 'CHANGE_ME',   adminLevel: 'STAFF' }
]

async function seed() {
  console.log('[seed] start seeding admins...')
  for (const a of admins) {
    const hashed = await bcrypt.hash(String(a.password), 10)
    await prisma.user.upsert({
      where: { studentId: a.studentId },
      update: { password: hashed, plainPassword: a.password, role: 'ADMIN', adminLevel: a.adminLevel },
      create: { studentId: a.studentId, password: hashed, plainPassword: a.password, role: 'ADMIN', adminLevel: a.adminLevel }
    })
    console.log(`[seed] upserted admin: ${a.studentId} (${a.adminLevel})`)
  }
  console.log('[seed] all admins upserted.')
}

seed()
  .catch((e) => { console.error('[seed] error:', e) })
  .finally(async () => { await prisma.$disconnect() })