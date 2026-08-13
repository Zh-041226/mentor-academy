<script setup>
import { ref, watch, onMounted } from 'vue'
import { ensureSunsetTheme, sunsetPalette } from '../../utils/echartsSunset'
let adminChartsEchartsPromise = null

async function getEcharts() {
  if (!adminChartsEchartsPromise) {
    adminChartsEchartsPromise = import('../../utils/echartsAdmin').then((mod) => mod.getAdminChartsEcharts())
  }
  return adminChartsEchartsPromise
}

const props = defineProps({
  activities: { type: Array, default: () => [] }
})

const pieRef = ref(null)
let chart
const pieDimension = ref('category') // 'category' | 'mentor' | 'month' | 'scale'

function buildPieSeries(){
  const dim = pieDimension.value
  const m = Object.create(null)
  const list = props.activities || []
  function scaleBucket(limit){
    const n = Number(limit || 0)
    if (n === 0) return '不限'
    if (n <= 20) return '≤20(小型)'
    if (n <= 40) return '21-40(中型)'
    if (n <= 80) return '41-80(大型)'
    return '80+(超大)'
  }
  for (const it of list){
    let key = ''
    if (dim === 'category') key = it.category || '未分类'
    else if (dim === 'mentor') key = it.mentorName || '未知导师'
    else if (dim === 'month') {
      if (!it.startAt) continue
      const d = new Date(it.startAt)
      key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    } else if (dim === 'scale') key = scaleBucket(it.limit)
    else key = '未知'
    m[key] = (m[key] || 0) + 1
  }
  const data = Object.entries(m).map(([name, value]) => ({ name, value }))
  data.sort((A,B) => B.value - A.value)
  return data
}

function render(){
  const pdata = buildPieSeries()
  chart && chart.setOption({
    title: { text: '活动分布', subtext: pieDimension.value==='category'?'按类别': pieDimension.value==='mentor'?'按导师': pieDimension.value==='month'?'按月份':'按规模', left: 8, top: 8 },
    tooltip: { trigger: 'item', formatter: '{b}: {c} 场 ({d}%)' },
    legend: { type: 'scroll', orient: 'vertical', right: 8, top: 24, bottom: 8, textStyle: { color: '#7A6A64' } },
    series: [{
      type: 'pie',
      radius: ['36%','68%'],
      center: ['40%','50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1 },
      label: { show: true, formatter: '{b}\n{c}场', color: '#7A6A64' },
      labelLine: { show: true },
      data: pdata,
      color: sunsetPalette
    }]
  })
}

onMounted(async () => {
  const echarts = await getEcharts()
  ensureSunsetTheme(echarts)
  if (pieRef.value) chart = echarts.init(pieRef.value, 'sunset')
  render()
  window.addEventListener('resize', () => { chart && chart.resize() })
})

watch([pieDimension, () => props.activities], () => { render() })
</script>

<template>
  <div class="pie-wrap">
    <div class="pie-controls">
      <span class="label">分组：</span>
      <el-select v-model="pieDimension" size="small" style="width:140px">
        <el-option label="按类别" value="category" />
        <el-option label="按导师" value="mentor" />
        <el-option label="按月份" value="month" />
        <el-option label="按规模" value="scale" />
      </el-select>
    </div>
    <div ref="pieRef" class="chart"></div>
  </div>
 </template>

<style scoped>
.pie-wrap { position: relative; width: 100%; height: 280px; }
.chart { width: 100%; height: 100%; }
.pie-controls { position: absolute; right: 12px; top: 8px; z-index: 2; display: flex; align-items: center; gap: 6px; }
.pie-controls .label { color:#909399; }
</style>
