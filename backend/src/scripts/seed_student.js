import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const student = {
  studentId: '202511080001',
  password: 'CHANGE_ME',
  name: '王五',
  contact: '13800000000',
  className: '计科25-1班'
}

async function main() {
  const hashed = await bcrypt.hash(student.password, 10)
  const u = await prisma.user.upsert({
    where: { studentId: student.studentId },
    update: { password: hashed, plainPassword: student.password, role: 'STUDENT', name: student.name, contact: student.contact, className: student.className },
    create: { studentId: student.studentId, password: hashed, plainPassword: student.password, role: 'STUDENT', name: student.name, contact: student.contact, className: student.className }
  })
  console.log('[seed_student] upserted:', u.studentId)
}

main().catch(console.error).finally(async () => { await prisma.$disconnect() })