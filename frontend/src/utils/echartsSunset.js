// 注册统一的 ECharts “sunset（日落）”主题
// 目的：将默认的蓝色系切换为暖色（落日）色盘，并统一标题/坐标轴/视觉映射样式
// 使用方式：
// import * as echarts from 'echarts'
// import { ensureSunsetTheme } from '../utils/echartsSunset'
// ensureSunsetTheme(echarts)
// const chart = echarts.init(dom, 'sunset')

export const sunsetPalette = [
  '#FF7E5F', // sunset 主色（橙红）
  '#FFB86B', // amber
  '#FCA17D', // peach
  '#FFD1A1', // light amber
  '#EC6D62', // coral
  '#C13A38', // dark red
  '#FF9A8B', // pink
  '#FDA085'  // lighter peach
]

export function ensureSunsetTheme(echarts) {
  if (!echarts || typeof echarts.registerTheme !== 'function') return
  // 避免重复注册
  if (window.__ECHARTS_SUNSET_REGISTERED__) return

  const theme = {
    color: sunsetPalette,
    backgroundColor: 'transparent',
    textStyle: { color: '#4B3B39' },
    title: {
      textStyle: { color: '#4B3B39', fontWeight: 600 },
      subtextStyle: { color: '#7A6A64' }
    },
    grid: { containLabel: true },
    tooltip: {
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#FF7E5F', width: 1 }
      }
    },
    axisPointer: { lineStyle: { color: '#FF7E5F' } },
    legend: { textStyle: { color: '#5F4C46' } },
    xAxis: [{
      axisLine: { lineStyle: { color: '#E4D3C8' } },
      axisTick: { lineStyle: { color: '#E4D3C8' } },
      axisLabel: { color: '#7A6A64' },
      splitLine: { lineStyle: { color: '#F1E5DD' } }
    }],
    yAxis: [{
      axisLine: { lineStyle: { color: '#E4D3C8' } },
      axisTick: { lineStyle: { color: '#E4D3C8' } },
      axisLabel: { color: '#7A6A64' },
      splitLine: { lineStyle: { color: '#F1E5DD' } }
    }],
    visualMap: {
      inRange: {
        color: ['#FFD1A1', '#FFB86B', '#FF7E5F', '#C13A38']
      }
    },
    line: {
      itemStyle: { borderWidth: 2 },
      lineStyle: { width: 2 },
      symbolSize: 6,
      smooth: true
    },
    bar: {
      itemStyle: {
        borderRadius: [4, 4, 0, 0]
      }
    },
    scatter: {
      itemStyle: {
        shadowBlur: 6,
        shadowColor: 'rgba(255,126,95,0.25)'
      }
    }
  }

  echarts.registerTheme('sunset', theme)
  window.__ECHARTS_SUNSET_REGISTERED__ = true
}