import * as echarts from 'echarts/core'
import {
  LineChart,
  BarChart,
  HeatmapChart,
  ScatterChart,
  PieChart,
} from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  CalendarComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  ScatterChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  CalendarComponent,
  LegendComponent,
  CanvasRenderer,
])

export function getAdminChartsEcharts() {
  return echarts
}
