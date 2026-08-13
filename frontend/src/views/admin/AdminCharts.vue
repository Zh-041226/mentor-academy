<script setup>
import { ref, reactive, computed, onMounted, watch, defineAsyncComponent } from 'vue'
import http from '../../api/http'
import { ElMessage } from 'element-plus'
import { ensureSunsetTheme, sunsetPalette } from '../../utils/echartsSunset'
const AdminPieChart = defineAsyncComponent(() => import('./AdminPieChart.vue'))
let adminChartsEchartsPromise = null

async function getEcharts() {
  if (!adminChartsEchartsPromise) {
    adminChartsEchartsPromise = import('../../utils/echartsAdmin').then((mod) => mod.getAdminChartsEcharts())
  }
  return adminChartsEchartsPromise
}

// 控件状态
const period = ref('90') // 折线/柱状/热力图周期：'90' | '30' | '7' | '1'
const calPeriod = ref('90') // 日历热力图周期：'90' | '30'
const oneDayDate = ref(new Date()) // 当 period==='1' 时使用
const valueType = ref('registrations') // 指标：'registrations' | 'activities'
const barDimension = ref('category') // 'category' | 'mentor'
const barOrientation = ref('horizontal') // 'horizontal' | 'vertical'
const lineAccumulated = ref(false) // 折线是否显示累计面积图

// 原始数据
const loading = ref(false)
const activities = ref([])
const regCountMap = ref(Object.create(null)) // activityId -> registeredCount

// 取值帮助
function pad(n){ return String(n).padStart(2,'0') }
function dateStr(d){ try { const dt=new Date(d); return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}` } catch { return '' } }
function hourOf(d){ try { return new Date(d).getHours() } catch { return 0 } }
function weekdayOf(d){ try { return new Date(d).getDay() } catch { return 0 } } // 0-6 (周日到周六)
function ts(d){ try { return new Date(d).getTime() } catch { return 0 } }

// 过滤范围
const filtered = computed(() => {
  const list = activities.value || []
  const ty = valueType.value
  const p = period.value
  if (p === '1') { // 当天 24h
    const base = new Date(oneDayDate.value)
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0,0,0).getTime()
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23,59,59).getTime()
    return list.filter(it => it.startAt && ts(it.startAt) >= start && ts(it.startAt) <= end)
  }
  const days = Number(p)
  const end = Date.now()
  const start = end - days*86400000
  return list.filter(it => it.startAt && ts(it.startAt) >= start && ts(it.startAt) <= end)
})

function getValueFor(it){
  if (valueType.value === 'activities') return 1
  const m = regCountMap.value
  const rc = m[it.id] || 0
  return Number(rc)
}

// 聚合：折线图（天/小时）
function buildLineSeries(){
  const p = period.value
  const dataMap = Object.create(null)
  const items = filtered.value
  if (p === '1') {
    // 按小时 0-23
    for (let h=0; h<24; h++) dataMap[h] = 0
    for (const it of items){
      const h = hourOf(it.startAt)
      dataMap[h] += getValueFor(it)
    }
    const x = Array.from({length:24}, (_,i)=> i)
    const y = x.map(h => dataMap[h] || 0)
    return { xAxis: x.map(h => `${h}:00`), series: y }
  } else {
    // 按天：生成日期数组（最近 N 天）
    const days = Number(p)
    const today = new Date()
    const labels = []
    for (let i=days-1; i>=0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()-i)
      labels.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`)
      dataMap[labels[labels.length-1]] = 0
    }
    for (const it of items){
      const key = dateStr(it.startAt)
      if (key in dataMap) dataMap[key] += getValueFor(it)
    }
    const series = labels.map(k => dataMap[k] || 0)
    return { xAxis: labels, series }
  }
}

// 聚合：柱状图（类别/导师Top10）
function buildBarSeries(){
  const dim = barDimension.value
  const m = Object.create(null)
  for (const it of filtered.value){
    const key = dim === 'category' ? (it.category || '未分类') : (it.mentorName || '未知导师')
    m[key] = (m[key] || 0) + getValueFor(it)
  }
  const entries = Object.entries(m)
  entries.sort((A,B) => B[1] - A[1])
  const top = entries.slice(0,10)
  return {
    labels: top.map(([k]) => k),
    values: top.map(([,v]) => v)
  }
}

// 聚合：周-时热力图
function buildWeekHourHeat(){
  const grid = []
  const counts = Array.from({length:7},()=>Array.from({length:24},()=>0))
  for (const it of filtered.value){
    const w = weekdayOf(it.startAt) // 0-6
    const h = hourOf(it.startAt)
    counts[w][h] += getValueFor(it)
  }
  for (let w=0; w<7; w++){
    for (let h=0; h<24; h++){
      grid.push([h, w, counts[w][h]])
    }
  }
  return grid
}

// 聚合：日历热力图（近30/90天，按日聚合）
function buildCalendarHeat(){
  const days = Number(calPeriod.value)
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1))
  // ECharts Calendar 的 range 推荐使用 [start,end] 数组，而非单字符串
  const startStr = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`
  const endStr = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}`
  const range = [startStr, endStr]
  const map = Object.create(null)
  const labels = []
  for (let i=0; i<days; i++){
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i)
    const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    labels.push(key)
    map[key] = 0
  }
  for (const it of (activities.value || [])){
    const key = dateStr(it.startAt)
    if (key && (key in map)) map[key] += getValueFor(it)
  }
  const data = labels.map(k => [k, map[k] || 0])
  const max = Math.max(1, Math.max(...data.map(d => d[1])))
  return { range, data, max }
}

// 聚合：累计面积图（近30/90/7天，按日聚合后 cumulative sum）
function buildCumulativeSeries(){
  const p = period.value
  if (p === '1') {
    return buildLineSeries()
  }
  const l = buildLineSeries()
  const series = []
  let acc = 0
  for (const v of l.series){ acc += Number(v||0); series.push(acc) }
  return { xAxis: l.xAxis, series }
}

// 聚合：容量利用率散点
function buildScatterSeries(){
  const points = []
  for (const it of filtered.value){
    const limit = Number(it.limit || 0)
    const rc = Number(regCountMap.value[it.id] || 0)
    const rate = limit > 0 ? Math.min(rc/limit, 1) : 0
    const size = 12 + Math.round(28 * rate)
    points.push({ name: it.title, value: [limit, rc, rate], symbolSize: size })
  }
  return points
}

// ECharts 实例
const lineRef = ref(null)
const barRef = ref(null)
const heatRef = ref(null)
const scatterRef = ref(null)
const calendarRef = ref(null)
const cumRef = ref(null)
let lineChart, barChart, heatChart, scatterChart, calendarChart, cumChart

async function renderCharts(){
  try {
    const echarts = await getEcharts()
    // 折线
    const l = buildLineSeries()
    const baseLineOpt = {
      title: { text: lineAccumulated.value ? '累计报名趋势' : '报名趋势' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: l.xAxis, axisLabel: { color: '#7A6A64' } },
      yAxis: { type: 'value', axisLabel: { color: '#7A6A64' } },
      grid: { left: 48, right: 24, top: 48, bottom: 40, containLabel: true },
      color: sunsetPalette,
      series: [{
        type: 'line',
        data: l.series,
        smooth: true,
        lineStyle: { width: 2, color: '#FF7E5F' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255,126,95,0.28)' },
            { offset: 1, color: 'rgba(255,126,95,0.06)' }
          ])
        }
      }]
    }
    if (lineAccumulated.value && period.value !== '1') {
      const c = buildCumulativeSeries()
      baseLineOpt.xAxis.data = c.xAxis
      baseLineOpt.series[0].data = c.series
    }
    lineChart && lineChart.setOption(baseLineOpt)
    // 柱状
    const b = buildBarSeries()
    const barOpt = {
      title: { text: barDimension.value === 'category' ? '类别Top10' : '导师Top10' },
      tooltip: {},
      color: sunsetPalette,
    }
    if (barOrientation.value === 'horizontal') {
      Object.assign(barOpt, {
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: b.labels, axisLabel: { color: '#7A6A64' } },
        grid: { left: 132, right: 24, top: 48, bottom: 48, containLabel: true },
        series: [{ type: 'bar', data: b.values }]
      })
    } else {
      Object.assign(barOpt, {
        xAxis: { type: 'category', data: b.labels, axisLabel: { interval: 0, rotate: 15, color: '#7A6A64' } },
        yAxis: { type: 'value', axisLabel: { color: '#7A6A64' } },
        grid: { left: 72, right: 24, top: 48, bottom: 72, containLabel: true },
        series: [{ type: 'bar', data: b.values }]
      })
    }
    barChart && barChart.setOption(barOpt)
    // 热力图（周-时）
    const hdata = buildWeekHourHeat()
    heatChart && heatChart.setOption({
      title: { text: '周-时热力图' },
      tooltip: { position: 'top' },
      grid: { left: 72, right: 24, top: 56, bottom: 64, containLabel: true },
      xAxis: { type: 'category', data: Array.from({length:24},(_,i)=> `${i}:00`), axisLabel: { color: '#7A6A64' } },
      yAxis: { type: 'category', data: ['周日','周一','周二','周三','周四','周五','周六'], axisLabel: { color: '#7A6A64' } },
      visualMap: {
        min: 0,
        max: Math.max(1, Math.max(...hdata.map(d=>d[2]))),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        inRange: { color: ['#FFD1A1','#FFB86B','#FF7E5F','#C13A38'] }
      },
      series: [{ name: '热度', type: 'heatmap', data: hdata, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }]
    })
    // 散点（容量利用率）
    const sdata = buildScatterSeries()
    scatterChart && scatterChart.setOption({
      title: { text: '容量利用率', left: 8, top: 8 },
      tooltip: { formatter: (p) => {
        const [limit, rc, rate] = p.value
        return `${p.name}<br/>容量: ${limit}<br/>已报名: ${rc}<br/>填充率: ${(rate*100).toFixed(1)}%`
      } },
      visualMap: {
        min: 0,
        max: 1,
        dimension: 2,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        inRange: { color: ['#FFD1A1','#FFB86B','#FF7E5F','#C13A38'] }
      },
      xAxis: {
        type: 'value',
        name: '容量',
        nameLocation: 'middle',
        nameGap: 32,
        axisLabel: { color: '#7A6A64', margin: 8 },
        nameTextStyle: { color: '#7A6A64', fontWeight: 500 }
      },
      yAxis: {
        type: 'value',
        name: '已报名',
        nameLocation: 'middle',
        nameGap: 40,
        axisLabel: { color: '#7A6A64', margin: 8 },
        nameTextStyle: { color: '#7A6A64', fontWeight: 500 }
      },
      grid: { left: 72, right: 32, top: 56, bottom: 64, containLabel: true },
      series: [{ type: 'scatter', data: sdata, emphasis: { scale: 1.08 } }]
    })
    // 日历热力图
    const cal = buildCalendarHeat()
    calendarChart && calendarChart.setOption({
      title: { text: '日历热力图' },
      tooltip: { position: 'top' },
      visualMap: { min: 0, max: cal.max, orient: 'horizontal', left: 'center', bottom: 8, inRange: { color: ['#FFD1A1','#FFB86B','#FF7E5F','#C13A38'] } },
      calendar: { range: cal.range, cellSize: ['auto', 24] },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: cal.data }]
    })
    // 累计面积图
    const cdata = buildCumulativeSeries()
    cumChart && cumChart.setOption({
      title: { text: '累计报名曲线' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: cdata.xAxis, axisLabel: { color: '#7A6A64' } },
      yAxis: { type: 'value', axisLabel: { color: '#7A6A64' } },
      grid: { left: 48, right: 24, top: 48, bottom: 40, containLabel: true },
      series: [{
        type: 'line',
        data: cdata.series,
        smooth: true,
        lineStyle: { width: 2, color: '#FF7E5F' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255,126,95,0.28)' },
            { offset: 1, color: 'rgba(255,126,95,0.06)' }
          ])
        }
      }]
    })
  } catch (e) {}
}

async function fetchData(){
  loading.value = true
  try {
    const [actRes, sumRes] = await Promise.all([
      http.get('/admin/activities'),
      http.get('/admin/activities/summary')
    ])
    const items = Array.isArray(actRes?.data?.items) ? actRes.data.items : []
    activities.value = items.map(it => ({
      id: it.id,
      title: it.title,
      category: it.category || '',
      mentorName: it.mentorName || '',
      startAt: it.startAt || null,
      limit: it.limit || 0
    }))
    const m = Object.create(null)
    const sums = Array.isArray(sumRes?.data?.items) ? sumRes.data.items : []
    for (const s of sums){ m[s.id] = Number(s.registeredCount || 0) }
    regCountMap.value = m
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取图表数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchData()
  // 初始化实例
  const echarts = await getEcharts()
  ensureSunsetTheme(echarts)
  if (lineRef.value) lineChart = echarts.init(lineRef.value, 'sunset')
  if (barRef.value) barChart = echarts.init(barRef.value, 'sunset')
  if (heatRef.value) heatChart = echarts.init(heatRef.value, 'sunset')
  if (scatterRef.value) scatterChart = echarts.init(scatterRef.value, 'sunset')
  if (calendarRef.value) calendarChart = echarts.init(calendarRef.value, 'sunset')
  if (cumRef.value) cumChart = echarts.init(cumRef.value, 'sunset')
  renderCharts()
  window.addEventListener('resize', () => {
    lineChart && lineChart.resize(); barChart && barChart.resize(); heatChart && heatChart.resize(); scatterChart && scatterChart.resize(); calendarChart && calendarChart.resize(); cumChart && cumChart.resize()
  })
})

watch([period, oneDayDate, valueType, barDimension, barOrientation, calPeriod, lineAccumulated, activities, regCountMap], () => {
  renderCharts()
})
</script>

<template>
  <div class="charts-wrap">
    <el-card class="controls-card">
      <template #header>
        <div class="card-header">数据分析图表</div>
      </template>
      <div class="controls">
        <div class="ctl">
          <span class="label">周期：</span>
          <el-select v-model="period" style="width:140px">
            <el-option label="近90天" value="90" />
            <el-option label="近30天" value="30" />
            <el-option label="近7天" value="7" />
            <el-option label="一天(24h)" value="1" />
          </el-select>
          <el-date-picker v-if="period==='1'" v-model="oneDayDate" type="date" class="ctl-date" />
        </div>
        <div class="ctl">
          <span class="label">指标：</span>
          <el-radio-group v-model="valueType" class="toolbar-radio-group">
            <el-radio-button label="registrations">报名人次</el-radio-button>
            <el-radio-button label="activities">活动场次</el-radio-button>
          </el-radio-group>
        </div>
        <div class="ctl">
          <span class="label">柱状维度：</span>
          <el-radio-group v-model="barDimension" class="toolbar-radio-group">
            <el-radio-button label="category">类别</el-radio-button>
            <el-radio-button label="mentor">导师</el-radio-button>
          </el-radio-group>
        </div>
        <div class="ctl">
          <span class="label">柱状方向：</span>
          <el-radio-group v-model="barOrientation" class="toolbar-radio-group">
            <el-radio-button label="horizontal">横向</el-radio-button>
            <el-radio-button label="vertical">纵向</el-radio-button>
          </el-radio-group>
        </div>
        <div class="ctl">
          <span class="label">累计趋势：</span>
          <el-switch v-model="lineAccumulated" active-text="开启" inactive-text="关闭" />
        </div>
        <div class="ctl">
          <span class="label">日历周期：</span>
          <el-select v-model="calPeriod" style="width:120px">
            <el-option label="近90天" value="90" />
            <el-option label="近30天" value="30" />
          </el-select>
        </div>
      </div>
    </el-card>

    <div class="grid">
      <el-card class="chart-card"><div ref="lineRef" class="chart"></div></el-card>
      <el-card class="chart-card"><div ref="barRef" class="chart"></div></el-card>
      <el-card class="chart-card wide"><div ref="heatRef" class="chart"></div></el-card>
      <el-card class="chart-card"><div ref="scatterRef" class="chart"></div></el-card>
      <el-card class="chart-card"><AdminPieChart :activities="activities" /></el-card>
      <el-card class="chart-card wide"><div ref="calendarRef" class="chart"></div></el-card>
      <el-card class="chart-card wide"><div ref="cumRef" class="chart"></div></el-card>
    </div>
  </div>
  
</template>

<style scoped>
.card-header { font-weight: 600; }
.charts-wrap { margin-top: 12px; }
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  align-items: center;
}
.ctl {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
}
.ctl .label {
  width: 72px;
  flex: 0 0 72px;
  color: #909399;
  text-align: right;
  font-size: 13px;
}
.ctl-date { width: 150px; }
.toolbar-radio-group {
  display: inline-flex;
  align-items: center;
}
:deep(.toolbar-radio-group .el-radio-button__inner) {
  min-width: 78px;
  height: 40px;
  padding: 0 18px;
  line-height: 38px;
  font-size: 13px;
}
:deep(.controls .el-select__wrapper),
:deep(.controls .el-input__wrapper),
:deep(.controls .el-date-editor.el-input__wrapper),
:deep(.controls .el-range-editor.el-input__wrapper) {
  min-height: 40px;
}
:deep(.controls .el-switch) {
  min-height: 40px;
}
.card-header { font-weight: 600; }
.grid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.chart-card { min-height: 320px; }
.chart-card.wide { grid-column: span 2; }
.chart { width: 100%; height: 280px; }
.chart-card .chart { position: relative; z-index: 1; }
@media (max-width: 768px) {
  .grid { grid-template-columns: 1fr; }
  .chart-card.wide { grid-column: span 1; }
  .ctl .label {
    width: auto;
    flex-basis: auto;
    text-align: left;
  }
}
</style>
