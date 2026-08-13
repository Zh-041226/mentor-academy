import { isRestrictedWebView } from './config'
import { ElMessage } from 'element-plus'

let xlsxModulePromise = null

async function getXLSX() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx').then((mod) => mod.default || mod)
  }
  return xlsxModulePromise
}

function normalizeSheetName(name) {
  return String(name || 'Sheet1')
    .replace(/[\\/?*[\]:]/g, '')
    .slice(0, 31) || 'Sheet1'
}

export async function exportSheetAsXlsx({ sheetName, headers, rows, colWidths, fileName }) {
  const XLSX = await getXLSX()
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  if (Array.isArray(colWidths) && colWidths.length) {
    worksheet['!cols'] = colWidths.map((width) => ({ wch: width }))
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, normalizeSheetName(sheetName))
  
  // 使用手动创建 Blob + 延迟撤销的方式，兼容手机端浏览器的下载
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true })
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  
  // 延迟移除，防止部分手机浏览器（如 Safari/微信）过早回收导致下载失败或无反应
  setTimeout(() => {
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }, 500)

  if (isRestrictedWebView()) {
    ElMessage.warning('微信/钉钉内可能无法导出表格，建议点击右上角【在浏览器打开】', { duration: 5000 })
  }
}
