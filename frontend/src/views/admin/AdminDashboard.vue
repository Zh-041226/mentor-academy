<script setup>
import { ref, onMounted, watch, defineAsyncComponent } from 'vue'
import http from '../../api/http'
import { ElMessage } from 'element-plus'
import { ensureSunsetTheme } from '../../utils/echartsSunset'

const AdminCharts = defineAsyncComponent(() => import('./AdminCharts.vue'))
let sparklineEchartsPromise = null

async function getEcharts() {
  if (!sparklineEchartsPromise) {
    sparklineEchartsPromise = import('../../utils/echartsSparkline').then((mod) => mod.getSparklineEcharts())
  }
  return sparklineEchartsPromise
}

const loading = ref(false)
const stats = ref({ activities: 0, registrations: 0, users: 0, admins: 0 })
// KPI 火花线周期：'ALL' | '180' | '90' | '30' | '7' | '1'(24h)
const sparkPeriod = ref('7')
const sparkActRef = ref(null)
const sparkRegRef = ref(null)
const sparkUserRef = ref(null)
const sparkAdminRef = ref(null)
let sparkActChart, sparkRegChart, sparkUserChart, sparkAdminChart

async function fetchStats() {
  loading.value = true
  try {
    const res = await http.get('/admin/analytics/overview')
    const d = res.data || {}
    stats.value.activities = Number(d.activities || 0)
    stats.value.registrations = Number(d.registrations || 0)
    stats.value.users = Number(d.users || 0)
    stats.value.admins = Number(d.admins || 0)
  } catch (e) {
    // 兼容后端暂不可用：降级为现有公开接口统计
    try {
      const actRes = await http.get('/activities')
      stats.value.activities = Array.isArray(actRes.data?.items) ? actRes.data.items.length : 0
    } catch (e2) {
      ElMessage.error(e2?.response?.data?.message || '获取仪表盘数据失败')
    }
  } finally {
    loading.value = false
  }
}

async function fetchTrends() {
  try {
    const echarts = await getEcharts()
    // 活动：按 startAt 日期聚合最近7天
    const actRes = await http.get('/admin/activities')
    const items = Array.isArray(actRes.data?.items) ? actRes.data.items : []
    const period = sparkPeriod.value
    let labels = []
    if (period === '1') {
      // 24h 按小时
      labels = Array.from({length:24},(_,i)=> `${String(i).padStart(2,'0')}:00`)
    } else {
      const today = new Date()
      const days = period === 'ALL' ? Math.min(365, Math.max(1, Math.ceil((today - earliestDate(items)) / 86400000))) : Number(period)
      for (let i=days-1; i>=0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()-i)
        labels.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
      }
    }
    const seriesAct = aggregateActivities(items, labels)

    // 用户与管理员：按 createdAt 聚合最近7天
    const userRes = await http.get('/admin/users')
    const users = Array.isArray(userRes.data?.items) ? userRes.data.items : []
    const { seriesUser, seriesAdmin } = aggregateUsers(users, labels)

    // 报名：近7天注册记录（按 registration.createdAt 聚合）
    // 轻量实现：遍历活动的报名记录，筛选近7天；如数据量较大建议后端聚合接口
    const seriesReg = await aggregateRegistrations(items, labels)

    // 渲染火花线（极简样式，落日配色）
    const common = (data) => ({
      grid: { left: 0, right: 0, top: 10, bottom: 0, containLabel: true },
      xAxis: { type: 'category', data: labels, show: false },
      yAxis: { type: 'value', show: false },
      tooltip: { trigger: 'axis' },
      series: [{
        type: 'line',
        data,
        smooth: true,
        lineStyle: { width: 2, color: '#FF7E5F' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255,126,95,0.30)' },
            { offset: 1, color: 'rgba(255,126,95,0.06)' }
          ])
        }
      }]
    })
    if (sparkActRef.value) { sparkActChart = echarts.init(sparkActRef.value, 'sunset'); sparkActChart.setOption(common(seriesAct)) }
    if (sparkRegRef.value) { sparkRegChart = echarts.init(sparkRegRef.value, 'sunset'); sparkRegChart.setOption(common(seriesReg)) }
    if (sparkUserRef.value) { sparkUserChart = echarts.init(sparkUserRef.value, 'sunset'); sparkUserChart.setOption(common(seriesUser)) }
    if (sparkAdminRef.value) { sparkAdminChart = echarts.init(sparkAdminRef.value, 'sunset'); sparkAdminChart.setOption(common(seriesAdmin)) }
  } catch (e) {
    // 静默失败，避免影响仪表盘主数据
  }
}

// 辅助：获取活动最早日期
function earliestDate(items){
  let earliest = new Date()
  for (const it of items){
    if (!it.startAt) continue
    const dt = new Date(it.startAt)
    if (dt < earliest) earliest = dt
  }
  return earliest
}

// 活动聚合：按 labels 的刻度（日或小时）统计活动数
function aggregateActivities(items, labels){
  const map = Object.create(null)
  for (const k of labels) map[k] = 0
  const isHour = labels.length === 24 && labels[0].includes(':')
  for (const it of items){
    if (!it.startAt) continue
    const dt = new Date(it.startAt)
    const key = isHour ? `${String(dt.getHours()).padStart(2,'0')}:00` : `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
    if (key in map) map[key]++
  }
  return labels.map(k => map[k] || 0)
}

// 用户聚合：按 labels 的刻度统计新增用户与管理员
function aggregateUsers(users, labels){
  const userMap = Object.create(null)
  const adminMap = Object.create(null)
  for (const k of labels){ userMap[k] = 0; adminMap[k] = 0 }
  const isHour = labels.length === 24 && labels[0].includes(':')
  for (const u of users){
    const dt = u.createdAt ? new Date(u.createdAt) : null
    if (!dt) continue
    const key = isHour ? `${String(dt.getHours()).padStart(2,'0')}:00` : `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
    if (!(key in userMap)) continue
    if (u.role === 'ADMIN') adminMap[key]++
    else userMap[key]++
  }
  return { seriesUser: labels.map(k => userMap[k]||0), seriesAdmin: labels.map(k => adminMap[k]||0) }
}

// 报名聚合：按 labels 的刻度统计报名人次（按 registration.createdAt）
async function aggregateRegistrations(items, labels){
  const regMap = Object.create(null)
  for (const k of labels) regMap[k] = 0
  const isHour = labels.length === 24 && labels[0].includes(':')
  // 注意：若活动很多，这里会产生较多请求；建议后端提供聚合接口
  for (const it of items){
    try {
      const rr = await http.get(`/admin/activities/${it.id}/registrations`)
      const regs = Array.isArray(rr.data?.items) ? rr.data.items : []
      for (const r of regs){
        if (!['REGISTERED','PENDING_CANCEL'].includes(String(r.status))) continue
        const dt = r.createdAt ? new Date(r.createdAt) : null
        if (!dt) continue
        const key = isHour ? `${String(dt.getHours()).padStart(2,'0')}:00` : `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
        if (key in regMap) regMap[key]++
      }
    } catch {}
  }
  return labels.map(k => regMap[k] || 0)
}

onMounted(async () => {
  const echarts = await getEcharts()
  ensureSunsetTheme(echarts)
  await fetchStats()
  await fetchTrends()
})

watch(sparkPeriod, async () => {
  await fetchTrends()
})
</script>

<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据总览</span>
          <div class="period-ctl">
            <span class="label">周期：</span>
            <el-select v-model="sparkPeriod" style="width:140px">
              <el-option label="所有" value="ALL" />
              <el-option label="半年(180天)" value="180" />
              <el-option label="近90天" value="90" />
              <el-option label="近30天" value="30" />
              <el-option label="近7天" value="7" />
              <el-option label="一天(24h)" value="1" />
            </el-select>
          </div>
        </div>
      </template>
      <el-skeleton :loading="loading" animated>
        <template #default>
          <div class="grid">
            <el-card class="kpi">
              <div class="kpi-title">活动数</div>
              <div class="kpi-value">{{ stats.activities }}</div>
              <div class="spark" ref="sparkActRef"></div>
            </el-card>
            <el-card class="kpi">
              <div class="kpi-title">报名人次</div>
              <div class="kpi-value">{{ stats.registrations }}</div>
              <div class="spark" ref="sparkRegRef"></div>
            </el-card>
            <el-card class="kpi">
              <div class="kpi-title">普通用户数</div>
              <div class="kpi-value">{{ stats.users }}</div>
              <div class="spark" ref="sparkUserRef"></div>
            </el-card>
            <el-card class="kpi">
              <div class="kpi-title">管理员数</div>
              <div class="kpi-value">{{ stats.admins }}</div>
              <div class="spark" ref="sparkAdminRef"></div>
            </el-card>
          </div>
        </template>
      </el-skeleton>
    </el-card>
    <AdminCharts />
  </div>
</template>

<style scoped>
.card-header { font-weight: 600; }
.card-header > span { font-weight: 800; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.period-ctl { display: flex; align-items: center; gap: 8px; }
.period-ctl .label { color: #909399; font-size: 13px; }
:deep(.period-ctl .el-select__wrapper) { min-height: 40px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { text-align: center; }
.kpi-title { color: #909399; }
.kpi-value { font-size: 24px; font-weight: 600; }
.spark { width: 100%; height: 96px; }
</style>
