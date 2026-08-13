<script setup>
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import http from '../api/http'
import { getUploadsFullUrl, isRestrictedWebView } from '../utils/config'

const route = useRoute()
const router = useRouter()
const id = route.params.id
const loading = ref(false)
const detail = ref({
  title: '',
  mentor: '',
  time: '',
  startAt: null,
  registerDeadline: null,
  place: '',
  limit: 0,
  registeredCount: 0,
  status: 'PUBLISHED',
  intro: '',
  posterUrl: '',
  qqGroupQrUrl: '',
  promoLinkUrl: '',
  promoImageUrl: '',
})
const isLoggedIn = ref(!!localStorage.getItem('token'))
const registered = ref(false)
const regStatus = ref('')
const cancelDialogVisible = ref(false)
const cancelReason = ref('')
const actionLoading = ref(false)
const qrDialogVisible = ref(false)
const me = ref(null)
const isBanned = ref(false)
const banRemainingDays = ref(0)
const bannedUntil = ref(null)
const bannedNote = ref('')
const introExpanded = ref(false)
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
let realtimeTimer = null

// 把后端 /uploads 相对路径转换为完整可预览 URL
// 已移至 utils/config.js 统一管理

function pad(n) { return String(n).padStart(2, '0') }
function formatDateTime(d) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    const y = dt.getFullYear()
    const m = pad(dt.getMonth() + 1)
    const day = pad(dt.getDate())
    const h = pad(dt.getHours())
    const min = pad(dt.getMinutes())
    return `${y}-${m}-${day} ${h}:${min}`
  } catch { return '' }
}

const detailTimeText = computed(() => detail.value.startAt ? formatDateTime(detail.value.startAt) : (detail.value.time || '待定'))
const deadlineText = computed(() => detail.value.registerDeadline ? formatDateTime(detail.value.registerDeadline) : '—')
const quotaText = computed(() => {
  const limit = Number(detail.value.limit || 0)
  const regCount = Math.max(Number(detail.value.registeredCount || 0), 0)
  if (limit <= 0) return `${regCount} / 不限`
  return `${regCount} / ${limit}`
})
const showIntroToggle = computed(() => String(detail.value.intro || '').length > 120)
const displayIntro = computed(() => {
  const text = String(detail.value.intro || '暂无活动介绍')
  if (introExpanded.value || !showIntroToggle.value) return text
  return `${text.slice(0, 120)}...`
})
const statusText = computed(() => {
  if (registered.value && regStatus.value === 'PENDING_CANCEL') return '取消申请待审核'
  if (registered.value) return '已报名'
  if (isBanned.value) return '禁报名'
  if (String(detail.value.status || '').toUpperCase() === 'CLOSED') return '报名已截止'
  return '报名中'
})
const cancelDialogWidth = computed(() => isMobile.value ? '92%' : '480px')
const qrDialogWidth = computed(() => isMobile.value ? '92%' : '520px')

async function fetchDetail() {
  loading.value = true
  try {
    const { data } = await http.get(`/activities/${id}`)
    const it = data?.item || {}
    detail.value = {
      title: it.title || `活动 #${id}`,
      mentor: it.mentorName || '',
      time: it.timeText || '',
      startAt: it.startAt || null,
      registerDeadline: it.registerDeadline || null,
      place: it.place || '',
      limit: it.limit ?? 0,
      registeredCount: it.registeredCount ?? 0,
      status: it.status || 'PUBLISHED',
      intro: it.description || '详情开发中',
      posterUrl: it.posterUrl || '',
      qqGroupQrUrl: it.qqGroupQrUrl || '',
      promoLinkUrl: it.promoLinkUrl || '',
      promoImageUrl: it.promoImageUrl || ''
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取活动详情失败')
  } finally {
    loading.value = false
  }
}

async function refreshRealtimeState() {
  await Promise.all([fetchDetail(), fetchMyStates()])
}

function requireLogin(action) {
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return false
  }
  return true
}

async function fetchMyStates() {
  if (!isLoggedIn.value) return
  try {
    const regsRes = await http.get('/users/me/registrations')
    const regs = Array.isArray(regsRes?.data?.registered) ? regsRes.data.registered : []
    const mine = regs.find(x => String(x.id) === String(id))
    if (mine) {
      registered.value = true
      regStatus.value = mine.status || 'REGISTERED'
      
      // 取消自动打开二维码
      // if (route.query.showQr === '1' && regStatus.value === 'REGISTERED') {
      //   setTimeout(() => {
      //     openQrDialog()
      //   }, 300)
      //   // 移除 query 参数避免刷新后再次弹窗
      //   const query = { ...route.query }
      //   delete query.showQr
      //   router.replace({ query })
      // }
    } else {
      registered.value = false
      regStatus.value = ''
    }
  } catch (e) {
    // 静默失败，不影响详情展示
  }
}

async function fetchMe() {
  if (!isLoggedIn.value) return
  try {
    const { data } = await http.get('/users/me')
    me.value = data
    isBanned.value = !!data?.isBanned
    banRemainingDays.value = Number(data?.banRemainingDays || 0)
    bannedUntil.value = data?.bannedUntil || null
    bannedNote.value = data?.bannedNote || ''
  } catch (_) {
    // 忽略错误（未登录会被重定向）
  }
}

async function handleRegister() {
  if (!requireLogin('register')) return
  if (isBanned.value) {
    const untilText = bannedUntil.value ? new Date(bannedUntil.value).toLocaleDateString() : '禁期未定'
    ElMessage.warning(`你当前处于禁报名期，禁至 ${untilText}（剩余 ${banRemainingDays.value} 天）。如有疑问，请联系管理员。`)
    return
  }
  if (String(detail.value.status || '').toUpperCase() === 'CLOSED') {
    ElMessage.warning('该活动报名已关闭')
    return
  }
  router.push(`/activities/${id}/register`)
}

function openCancelDialog() {
  if (!requireLogin('cancel')) return
  cancelReason.value = ''
  cancelDialogVisible.value = true
}

async function submitCancel() {
  if (!requireLogin('cancel')) return
  if (!cancelReason.value || cancelReason.value.trim().length < 5) {
    ElMessage.warning('请填写至少5字的取消事由')
    return
  }
  actionLoading.value = true
  try {
    const { data } = await http.post(`/activities/${id}/cancel`, { reason: cancelReason.value.trim() })
    ElMessage.success(data?.message || '已提交取消申请，待管理员审核')
    registered.value = true
    regStatus.value = 'PENDING_CANCEL'
    cancelDialogVisible.value = false
    await refreshRealtimeState()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '取消失败，请稍后再试')
  } finally {
    actionLoading.value = false
  }
}



function openQrDialog() {
  if (!registered.value) return
  if (!detail.value.qqGroupQrUrl) {
    ElMessage.warning('暂无QQ群二维码，请稍后再试')
    return
  }
  qrDialogVisible.value = true
}

function downloadQrImage() {
  if (!detail.value.qqGroupQrUrl) return
  if (isRestrictedWebView()) {
    ElMessage.warning('微信/QQ中可直接长按图片保存，或点击右上角【在浏览器打开】下载')
    return
  }
  const url = getUploadsFullUrl(detail.value.qqGroupQrUrl)
  const link = document.createElement('a')
  link.href = url
  link.download = `${detail.value.title || '活动'}-入群二维码.png`
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  
  // 延迟移除
  setTimeout(() => {
    document.body.removeChild(link)
  }, 500)
}

function handleVisibilityRefresh() {
  if (document.visibilityState === 'visible') {
    refreshRealtimeState()
  }
}

function updateViewportState() {
  isMobile.value = window.innerWidth <= 768
}

onMounted(async () => {
  // 强制详情页加载时置顶
  window.scrollTo({ top: 0, behavior: 'instant' })
  
  await fetchDetail()
  await Promise.all([fetchMyStates(), fetchMe()])
  realtimeTimer = window.setInterval(() => {
    refreshRealtimeState()
  }, 15000)
  window.addEventListener('focus', refreshRealtimeState)
  window.addEventListener('resize', updateViewportState)
  document.addEventListener('visibilitychange', handleVisibilityRefresh)
})

onBeforeUnmount(() => {
  if (realtimeTimer) {
    window.clearInterval(realtimeTimer)
    realtimeTimer = null
  }
  window.removeEventListener('focus', refreshRealtimeState)
  window.removeEventListener('resize', updateViewportState)
  document.removeEventListener('visibilitychange', handleVisibilityRefresh)
})
</script>

<template>
  <div class="activity-detail-page">
    <el-card class="activity-detail-card">
      <div class="activity-detail-hero">
        <el-image
          v-if="detail.posterUrl"
          :src="getUploadsFullUrl(detail.posterUrl)"
          class="activity-detail-hero__poster"
          :alt="detail.title"
          lazy
        />
        <div v-else class="activity-detail-hero__poster activity-detail-hero__poster--placeholder">活动海报</div>
      </div>

      <section class="activity-detail-section activity-detail-section--intro">
        <div class="activity-detail-section__title">{{ detail.title }}</div>
        <div class="activity-detail-intro">{{ displayIntro }}</div>
        <button
          v-if="showIntroToggle"
          type="button"
          class="activity-detail-text-btn"
          @click="introExpanded = !introExpanded"
        >
          {{ introExpanded ? '收起内容' : '展开更多' }}
        </button>
      </section>

      <section class="activity-detail-section activity-detail-info-card">
        <div class="activity-detail-info-card__row">
          <span class="activity-detail-info-card__label">时间</span>
          <span class="activity-detail-info-card__value">{{ detailTimeText }}</span>
        </div>
        <div class="activity-detail-info-card__row">
          <span class="activity-detail-info-card__label">地点</span>
          <span class="activity-detail-info-card__value">{{ detail.place || '待定' }}</span>
        </div>
        <div v-if="detail.mentor" class="activity-detail-info-card__row">
          <span class="activity-detail-info-card__label">导师</span>
          <span class="activity-detail-info-card__value">{{ detail.mentor }}</span>
        </div>
        <div class="activity-detail-info-card__row">
          <span class="activity-detail-info-card__label">报名</span>
          <span class="activity-detail-info-card__value activity-detail-info-card__value--hot">{{ quotaText }}</span>
        </div>
        <div class="activity-detail-info-card__row">
          <span class="activity-detail-info-card__label">截止</span>
          <span class="activity-detail-info-card__value">{{ deadlineText }}</span>
        </div>
        <div class="activity-detail-info-card__row">
          <span class="activity-detail-info-card__label">状态</span>
          <span class="activity-detail-info-card__value">{{ statusText }}</span>
        </div>
      </section>

      <div v-if="isBanned" class="activity-detail-alert">
        <el-alert type="error" :title="`当前处于禁报名期，禁至 ${bannedUntil?new Date(bannedUntil).toLocaleDateString():'—'}（剩余 ${banRemainingDays} 天）。`" show-icon />
      </div>

      <section v-if="detail.promoLinkUrl && detail.promoImageUrl" class="activity-detail-section">
        <div class="activity-detail-section__title">活动资料</div>
        <a :href="detail.promoLinkUrl" target="_blank" rel="noopener noreferrer" class="activity-detail-link-card">
          <el-image
            :src="getUploadsFullUrl(detail.promoImageUrl)"
            class="activity-detail-link-card__poster"
            :alt="detail.title"
            lazy
          />
          <div class="activity-detail-link-card__body">
            <div class="activity-detail-link-card__title">活动推文</div>
            <div class="activity-detail-link-card__desc">点击查看活动推文、通知附件和相关资料</div>
          </div>
        </a>
      </section>

      <div class="detail-actions">
        <template v-if="!registered">
          <el-button type="primary" :disabled="isBanned || (String(detail.status||'').toUpperCase()==='CLOSED')" :loading="actionLoading" @click="handleRegister">立即报名</el-button>
          <el-button type="default" plain @click="router.push('/activities')">返回首页</el-button>
        </template>
        <template v-else>
          <template v-if="regStatus==='REGISTERED'">
            <el-button type="success" @click="openQrDialog">扫码入群</el-button>
            <el-button type="danger" :loading="actionLoading" @click="openCancelDialog">取消报名</el-button>
          </template>
          <template v-else>
            <el-tag type="warning">取消申请待审核</el-tag>
            <el-button type="danger" plain @click="openQrDialog">扫码入群</el-button>
          </template>
          <el-button type="default" plain @click="router.push('/activities')">返回首页</el-button>
        </template>
      </div>
    </el-card>


    <el-dialog
      v-model="cancelDialogVisible"
      title="取消报名"
      :width="cancelDialogWidth"
      class="activity-detail-dialog"
      modal-class="activity-detail-dialog-overlay"
      :show-close="false"
      :close-on-click-modal="false"
      align-center
    >
      <div class="activity-detail-dialog__text">请填写取消事由（5-200字）：</div>
      <el-input type="textarea" v-model="cancelReason" :rows="isMobile ? 5 : 4" maxlength="200" show-word-limit placeholder="如：课程冲突，无法准时参加" />
      <div class="activity-detail-dialog__tips">提示：三日内连续取消报名三次，15日内不能报名参加任何活动。</div>
      <template #footer>
        <div class="activity-detail-dialog__footer">
          <el-button @click="cancelDialogVisible=false">取消</el-button>
          <el-button type="primary" :loading="actionLoading" @click="submitCancel">提交</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="qrDialogVisible"
      title="扫码入群"
      :width="qrDialogWidth"
      class="activity-detail-dialog"
      modal-class="activity-detail-dialog-overlay"
      :show-close="false"
      :close-on-click-modal="false"
      align-center
    >
      <div v-if="detail.qqGroupQrUrl" class="activity-detail-qr">
        <el-image
          :src="getUploadsFullUrl(detail.qqGroupQrUrl)"
          class="activity-detail-qr__image"
          :preview-src-list="[getUploadsFullUrl(detail.qqGroupQrUrl)]"
          :preview-teleported="true"
        />
        <div class="activity-detail-qr__tips">请及时扫码入群，后续详细安排将在QQ群中通知。</div>
      </div>
      <div v-else class="activity-detail-dialog__empty">暂无QQ群二维码，请稍后再试或联系管理员。</div>
      <template #footer>
        <div class="activity-detail-dialog__footer">
          <el-button v-if="detail.qqGroupQrUrl" type="primary" plain @click="downloadQrImage">下载原图</el-button>
          <el-button type="primary" @click="qrDialogVisible=false">我已入群 / 关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.activity-detail-page {
  max-width: 800px;
  margin: 24px auto;
  padding-bottom: 160px;
}

.activity-detail-card {
  overflow: hidden;
}

.activity-detail-hero {
  margin: -20px -20px 0;
  background: linear-gradient(180deg, rgba(255, 247, 237, 0.95), rgba(255, 255, 255, 0));
}

.activity-detail-hero__poster {
  display: block;
  max-width: 640px;
  width: 100%;
  height: 360px;
  background: #fff7ed;
  margin: 0 auto;
}

.activity-detail-hero__poster :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.activity-detail-hero__poster--placeholder {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
  font-size: 18px;
  font-weight: 700;
}

.activity-detail-section {
  margin-top: 18px;
  padding: 18px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.activity-detail-section--intro {
  margin-top: 16px;
}

.activity-detail-section__title {
  color: #0f172a;
  font-size: 18px;
  font-weight: 800;
}

.activity-detail-info-card {
  display: grid;
  gap: 14px;
}

.activity-detail-info-card__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.activity-detail-info-card__label {
  flex: 0 0 auto;
  color: #64748b;
  font-size: 14px;
}

.activity-detail-info-card__value {
  text-align: right;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
  word-break: break-word;
}

.activity-detail-info-card__value--hot {
  color: #ff4d4f;
}

.activity-detail-alert {
  margin-top: 14px;
}

.activity-detail-intro {
  margin-top: 12px;
  color: #334155;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.activity-detail-text-btn {
  margin-top: 10px;
  padding: 0;
  border: none;
  background: transparent;
  color: #f97316;
  font-size: 14px;
  font-weight: 700;
}

.activity-detail-link-card {
  margin-top: 12px;
  display: block;
  overflow: hidden;
  border-radius: 18px;
  background: #f8fafc;
  text-decoration: none;
}

.activity-detail-link-card--button {
  width: 100%;
  border: none;
  text-align: left;
  padding: 0;
}

.activity-detail-link-card__poster {
  display: block;
  width: 100%;
  height: 200px;
  background: #fff;
}

.activity-detail-link-card__poster :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.activity-detail-link-card__body {
  padding: 14px 16px 16px;
}

.activity-detail-link-card__title {
  color: #0f172a;
  font-size: 16px;
  font-weight: 800;
}

.activity-detail-link-card__desc {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.activity-detail-link-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  margin: 16px 16px 0;
  border-radius: 16px;
  background: linear-gradient(135deg, #ff7d73, #fdba74);
  color: #fff;
  font-size: 20px;
  font-weight: 800;
}

.detail-actions {
  margin-top: 18px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.detail-actions :deep(.el-button) {
  height: 48px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  padding: 0 24px;
}

.activity-detail-dialog__text {
  margin-bottom: 8px;
  color: #334155;
  font-size: 14px;
}

.activity-detail-dialog__tips {
  margin-top: 10px;
  color: #d97706;
  font-size: 13px;
  line-height: 1.6;
}

.activity-detail-dialog__empty {
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.7;
}

.activity-detail-dialog__footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.activity-detail-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.activity-detail-qr__image {
  width: min(100%, 320px);
  margin: 0 auto;
  border-radius: 18px;
  background: #fff;
}

.activity-detail-qr__image :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.activity-detail-qr__tips {
  margin-top: 12px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
  text-align: center;
}

@media (max-width: 768px) {
  .activity-detail-page {
    margin: 12px auto 0;
    padding-bottom: 224px;
  }

  .activity-detail-card {
    border-radius: var(--mobile-radius-lg);
    box-shadow: var(--mobile-shadow);
    border: none;
  }

  .detail-actions {
    position: sticky;
    bottom: calc(48px + env(safe-area-inset-bottom, 0px));
    padding: 12px;
    border-radius: var(--mobile-radius-md);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: var(--mobile-shadow-soft);
  }

  .detail-actions :deep(.el-button),
  .detail-actions :deep(.el-tag) {
    width: 100%;
    margin-left: 0 !important;
    justify-content: center;
  }

  .activity-detail-hero {
    margin: -20px -20px 0;
  }

  .activity-detail-hero__poster {
    height: auto !important;
  }
  
  .activity-detail-hero__poster :deep(.el-image__inner) {
    height: auto !important;
    position: relative !important;
    object-fit: cover;
  }

  .activity-detail-section {
    padding: 16px;
    border-radius: 18px;
  }

  .activity-detail-info-card__row {
    align-items: center;
  }

  .activity-detail-info-card__value {
    max-width: 66%;
  }

  .activity-detail-dialog__footer {
    flex-direction: column;
  }

  .activity-detail-dialog__footer :deep(.el-button) {
    width: 100%;
    margin-left: 0;
  }

  .activity-detail-qr__image {
    width: min(100%, 280px);
  }
  .activity-detail-qr__image :deep(.el-image__inner) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .activity-detail-link-card__poster {
    height: auto !important;
  }
  .activity-detail-link-card__poster :deep(.el-image__inner) {
    height: auto !important;
    position: relative !important;
    object-fit: cover;
  }
}
</style>

<style>
.activity-detail-dialog {
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(249, 115, 22, 0.1);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.18);
}

.activity-detail-dialog-overlay {
  background: rgba(15, 23, 42, 0.62) !important;
  backdrop-filter: blur(4px);
}

.activity-detail-dialog .el-dialog__header {
  padding: 20px 22px 10px;
  margin-right: 0;
}

.activity-detail-dialog .el-dialog__title {
  color: #0f172a;
  font-size: 20px;
  font-weight: 800;
}

.activity-detail-dialog .el-dialog__body {
  padding: 14px 22px 18px;
}

.activity-detail-dialog .el-dialog__footer {
  padding: 0 22px 22px;
}

.activity-detail-dialog .el-textarea__inner {
  min-height: 132px !important;
  border-radius: 18px;
  padding: 14px 16px;
  line-height: 1.75;
}

.activity-detail-dialog .el-button {
  min-width: 124px;
  height: 48px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
}

.activity-detail-dialog .el-button--primary:not(.is-plain) {
  background: linear-gradient(135deg, #ff7d73, #fdba74);
  border: none;
}

.activity-detail-dialog .el-button--primary.is-plain {
  border-color: rgba(249, 115, 22, 0.28);
  color: #ea580c;
}

.activity-detail-dialog .el-button--default {
  border-color: rgba(148, 163, 184, 0.36);
}

.activity-detail-dialog .el-dialog__headerbtn {
  top: 18px;
  right: 18px;
}

.activity-detail-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #94a3b8;
}

.activity-detail-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: #f97316;
}

@media (max-width: 768px) {
  .activity-detail-dialog {
    width: 92vw !important;
    max-width: none !important;
    border-radius: 18px;
  }

  .activity-detail-dialog .el-dialog__header {
    padding: 16px 16px 8px;
  }

  .activity-detail-dialog .el-dialog__body {
    padding: 12px 16px 16px;
  }

  .activity-detail-dialog .el-dialog__footer {
    padding: 0 16px 16px;
  }
}
</style>
