// 统一的API配置
export function getBackendBaseUrl() {
  const isDev = import.meta.env.DEV
  const backendBase = import.meta.env.VITE_BACKEND_URL
  
  // 开发环境统一走前端同源代理，避免电脑/真机直连 localhost 导致接口与静态资源失效
  if (isDev) return ''

  // 如果设置了VITE_BACKEND_URL且不为空，使用它
  if (backendBase && backendBase.trim()) {
    return backendBase.replace(/\/+$/, '')
  }
  
  // 否则使用空字符串（相对路径，由Nginx代理）
  return ''
}

// 获取完整的上传文件URL
export function getUploadsFullUrl(url) {
  if (!url) return ''
  
  // 如果已经是绝对URL，直接返回
  const isAbs = /^https?:\/\//i.test(url)
  if (isAbs) return url
  
  const isDev = import.meta.env.DEV
  if (isDev) return url // 开发环境使用相对路径，由 Vite 代理或静态目录提供
  
  const backendBase = getBackendBaseUrl()
  return backendBase ? `${backendBase}${url}` : url
}

// 获取真低画质缩略图的 URL（列表页专用）
export function getThumbUrl(url) {
  if (!url) return ''
  const fullUrl = getUploadsFullUrl(url)
  // 如果是外部绝对链接（非 /uploads/ 结尾），无法走本地缩略图，直接返回原图
  if (!fullUrl.includes('/uploads/')) return fullUrl
  // 将扩展名替换为 _thumb.webp
  return fullUrl.replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '_thumb.webp')
}

// 检查是否在受限的WebView中（如微信/QQ/钉钉），这类环境经常拦截 Blob 下载
export function isRestrictedWebView() {
  const ua = navigator.userAgent.toLowerCase()
  return /micromessenger|mqqbrowser|dingtalk|aliapp/.test(ua)
}
