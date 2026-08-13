import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const activities = [
  {
    title: '崇德讲堂：人工智能与未来社会',
    mentorName: '张教授',
    timeText: '2024年1月15日 19:00-21:00',
    place: '学术报告厅',
    limit: 100,
    description: '探讨人工智能技术的发展趋势及其对未来社会的深远影响，包括就业、教育、伦理等多个维度的思考。',
    status: 'PUBLISHED',
    category: '崇德讲堂',
    startAt: new Date('2024-01-15T19:00:00Z'),
    registerDeadline: new Date('2024-01-14T23:59:59Z')
  },
  {
    title: '朋辈导师：学习方法分享会',
    mentorName: '李学长',
    timeText: '2024年1月20日 14:00-16:00',
    place: '图书馆研讨室',
    limit: 30,
    description: '优秀学长学姐分享高效学习方法，包括时间管理、笔记技巧、考试策略等实用技能。',
    status: 'PUBLISHED',
    category: '朋辈导师',
    startAt: new Date('2024-01-20T14:00:00Z'),
    registerDeadline: new Date('2024-01-19T23:59:59Z')
  },
  {
    title: '晨曦晨读：经典文学赏析',
    mentorName: '王老师',
    timeText: '2024年1月25日 07:00-08:00',
    place: '梧桐大道',
    limit: 50,
    description: '在清晨的阳光下，一起朗读经典文学作品，感受文字的魅力，提升文学素养。',
    status: 'PUBLISHED',
    category: '晨曦晨读',
    startAt: new Date('2024-01-25T07:00:00Z'),
    registerDeadline: new Date('2024-01-24T23:59:59Z')
  },
  {
    title: '创新创业讲座：从想法到实践',
    mentorName: '陈导师',
    timeText: '2024年2月1日 15:00-17:00',
    place: '创新创业中心',
    limit: 80,
    description: '邀请成功创业者分享创业经验，从项目孵化到市场推广的全流程指导。',
    status: 'PUBLISHED',
    category: '其他',
    startAt: new Date('2024-02-01T15:00:00Z'),
    registerDeadline: new Date('2024-01-31T23:59:59Z')
  },
  {
    title: '心理健康工作坊：压力管理技巧',
    mentorName: '刘心理师',
    timeText: '2024年2月5日 16:00-18:00',
    place: '心理咨询中心',
    limit: 25,
    description: '学习科学的压力管理方法，提升心理韧性，建立健康的生活方式。',
    status: 'PUBLISHED',
    category: '其他',
    startAt: new Date('2024-02-05T16:00:00Z'),
    registerDeadline: new Date('2024-02-04T23:59:59Z')
  },
  {
    title: '社交礼仪培训：职场沟通艺术',
    mentorName: '赵老师',
    timeText: '2024年2月10日 13:30-15:30',
    place: '多功能会议室',
    limit: 40,
    description: '掌握职场社交礼仪，提升沟通技巧，为未来职业发展打下良好基础。',
    status: 'PUBLISHED',
    category: '其他',
    startAt: new Date('2024-02-10T13:30:00Z'),
    registerDeadline: new Date('2024-02-09T23:59:59Z')
  }
]

async function main() {
  console.log('开始插入活动数据...')
  
  for (const activity of activities) {
    try {
      const result = await prisma.activity.create({
        data: {
          ...activity,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      console.log(`✓ 插入活动: ${result.title}`)
    } catch (error) {
      console.error(`✗ 插入活动失败: ${activity.title}`, error.message)
    }
  }
  
  console.log('活动数据插入完成！')
}

main()
  .catch((e) => {
    console.error('脚本执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })