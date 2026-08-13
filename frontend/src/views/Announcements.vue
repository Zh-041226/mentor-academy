<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import http from '../api/http'
import { isRestrictedWebView } from '../utils/config'

const router = useRouter()
const loading = ref(false)
import { getBackendBaseUrl } from '../utils/config'

const items = ref([])
const downloadingId = ref(null)
const isLoggedIn = computed(() => !!localStorage.getItem('token'))
const inRestrictedWebView = computed(() => isRestrictedWebView())

function formatDateTime(value) {
  if (!value) return '待发布'
  try {
    const dt = new Date(value)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function formatSize(size) {
  const num = Number(size || 0)
  if (!num) return ''
  if (num >= 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`
  if (num >= 1024) return `${(num / 1024).toFixed(1)} KB`
  return `${num} B`
}

async function fetchList() {
  loading.value = true
  try {
    const { data } = await http.get('/announcements')
    items.value = Array.isArray(data?.items) ? data.items : []
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取公告列表失败')
  } finally {
    loading.value = false
  }
}

function goLogin() {
  router.push({ path: '/login', query: { redirect: '/announcements' } })
}

async function openDownload(item) {
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录后再下载公告附件')
    goLogin()
    return
  }
  if (isRestrictedWebView()) {
    ElMessage.warning('当前环境（如微信/QQ）不支持直接下载附件，请点击右上角【在浏览器打开】再试。', { duration: 5000 })
    // 有些情况下继续执行也会失败，但用户如果能长按或跳转还是有机会的，先提示一下
  }
  downloadingId.value = item.id
  try {
    // 手机端优先使用 URL 直链下载，避免 Blob 下载被 WebView 拦截
    if (isRestrictedWebView() || window.innerWidth <= 768) {
      const token = localStorage.getItem('token') || ''
      if (!token) {
        ElMessage.error('登录状态已失效，请重新登录后下载')
        goLogin()
        return
      }
      const backendBase = getBackendBaseUrl() || ''
      const apiUrl = `${backendBase}/api/announcements/${item.id}/download?token=${encodeURIComponent(token)}&_t=${Date.now()}`
      console.info('[announcements] mobile download start', { id: item.id, apiUrl })
      const link = document.createElement('a')
      link.href = apiUrl
      link.rel = 'noopener'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        try { document.body.removeChild(link) } catch {}
      }, 800)
      setTimeout(() => { downloadingId.value = null }, 1000)
      return
    }

    const response = await http.get(`/announcements/${item.id}/download`, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: item.attachmentMimeType || 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.attachmentOriginalName || `announcement_${item.id}`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    
    // 延迟移除，防止部分手机浏览器（如 Safari/微信）过早回收导致下载失败
    setTimeout(() => {
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }, 500)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '下载公告附件失败')
  } finally {
    downloadingId.value = null
  }
}

onMounted(fetchList)
</script>

<template>
  <div class="announcement-page">
    <section class="announcement-hero">
      <h1 class="announcement-hero__title">公告中心</h1>
      <p class="announcement-hero__desc">集中发布活动变更、综测证明、通知附件和后续资料。已登录用户可直接下载对应文档。</p>
    </section>

    <section class="announcement-list">
      <el-skeleton v-if="loading" :rows="5" animated />

      <div v-else-if="!items.length" class="announcement-empty">
        <div class="announcement-empty__title">暂无公告</div>
        <div class="announcement-empty__desc">后续综测证明、补充通知和附件会统一发布在这里。</div>
      </div>

      <article v-for="item in items" :key="item.id" class="announcement-card">
        <div class="announcement-card__main">
          <div class="announcement-card__meta">
            <el-tag type="warning" effect="light" round>公告</el-tag>
            <span>{{ formatDateTime(item.publishedAt || item.createdAt) }}</span>
          </div>
          <h2 class="announcement-card__title">{{ item.title }}</h2>
          <p v-if="item.summary" class="announcement-card__summary">{{ item.summary }}</p>
          <div class="announcement-card__content">{{ item.content }}</div>
          <div v-if="item.hasAttachment" class="announcement-card__attachment">
            <span class="attachment-name">{{ item.attachmentOriginalName }}</span>
            <span class="attachment-meta">{{ item.attachmentMimeType || '附件' }}<template v-if="item.attachmentSizeBytes"> · {{ formatSize(item.attachmentSizeBytes) }}</template></span>
            <span v-if="inRestrictedWebView" class="attachment-tip">微信/QQ 内下载受限，建议点右上角在浏览器打开</span>
          </div>
        </div>

        <div class="announcement-card__actions">
          <el-button v-if="item.hasAttachment" type="primary" class="btn-sunset" :loading="downloadingId === item.id" @click="openDownload(item)">下载附件</el-button>
          <el-button v-else plain disabled>暂无附件</el-button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.announcement-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: 112px 20px 40px;
}

.announcement-hero {
  padding: 28px 30px;
  border-radius: 28px;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.98), rgba(255, 255, 255, 0.98));
  border: 1px solid rgba(255, 125, 115, 0.14);
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.06);
}

.announcement-hero__eyebrow {
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #f97316;
}

.announcement-hero__title {
  margin: 10px 0 8px;
  font-size: 34px;
  line-height: 1.2;
  color: #0f172a;
}

.announcement-hero__desc {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: #64748b;
}

.announcement-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 22px;
}

.announcement-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 24px 24px 22px;
  border-radius: 24px;
  background: #fff;
  border: 1px solid rgba(226, 232, 240, 0.92);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.05);
}

.announcement-card__main {
  min-width: 0;
  flex: 1;
}

.announcement-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #94a3b8;
  font-size: 13px;
}

.announcement-card__title {
  margin: 14px 0 10px;
  font-size: 24px;
  line-height: 1.35;
  color: #111827;
}

.announcement-card__summary {
  margin: 0 0 10px;
  color: #475569;
  font-size: 15px;
  line-height: 1.8;
}

.announcement-card__content {
  white-space: pre-wrap;
  color: #334155;
  line-height: 1.85;
  font-size: 14px;
}

.announcement-card__attachment {
  margin-top: 16px;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 247, 237, 0.8);
  border: 1px solid rgba(255, 125, 115, 0.14);
}

.attachment-name {
  color: #111827;
  font-weight: 600;
  word-break: break-all;
}

.attachment-meta {
  color: #94a3b8;
  font-size: 12px;
}

.attachment-tip {
  color: #f97316;
  font-size: 12px;
}

.announcement-card__actions {
  width: 176px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.announcement-empty {
  padding: 56px 20px;
  border-radius: 24px;
  text-align: center;
  background: #fff;
  color: #64748b;
  border: 1px dashed rgba(148, 163, 184, 0.35);
}

.announcement-empty__title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.announcement-empty__desc {
  margin-top: 8px;
}

@media (max-width: 900px) {
  .announcement-card {
    flex-direction: column;
  }

  .announcement-card__actions {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .announcement-page {
    padding: 8px 0 96px;
  }

  .announcement-hero {
    padding: 20px 18px;
    border-radius: var(--mobile-radius-lg);
    box-shadow: var(--mobile-shadow);
  }

  .announcement-hero__title {
    font-size: 26px;
  }

  .announcement-hero__desc {
    font-size: 14px;
    line-height: 1.7;
  }

  .announcement-card {
    padding: 18px 16px;
    border-radius: var(--mobile-radius-md);
    box-shadow: var(--mobile-shadow-soft);
  }

  .announcement-card__title {
    font-size: 18px;
    margin: 12px 0 8px;
  }

  .announcement-card__content {
    font-size: 13px;
    line-height: 1.8;
  }
}
</style>
