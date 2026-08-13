<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import http from '../api/http'

const route = useRoute()
const router = useRouter()
const id = route.params.id

const loading = ref(false)
const userLoading = ref(false)
const activity = ref({ id, title: '', startAt: null, timeText: '', place: '', limit: 0, registerDeadline: null, registeredCount: 0, status: 'PUBLISHED' })
const user = ref({ name: '', studentId: '', contact: '', isBanned: false, banRemainingDays: 0, bannedUntil: null })
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
const confirmDialogVisible = ref(false)

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

const timeDisplay = computed(() => {
  const it = activity.value
  if (it.startAt) return formatDateTime(it.startAt)
  return String(it.timeText || '')
})

function updateViewportState() {
  isMobile.value = window.innerWidth <= 768
}

function isFull() {
  const lim = Number(activity.value.limit || 0)
  const reg = Number(activity.value.registeredCount || 0)
  return lim > 0 && reg >= lim
}
function isDeadline() {
  const dl = activity.value.registerDeadline ? new Date(activity.value.registerDeadline) : null
  return !!(dl && Date.now() > dl.getTime())
}

async function fetchActivity() {
  loading.value = true
  try {
    const [{ data: detailRes }, { data: listRes }] = await Promise.all([
      http.get(`/activities/${id}`),
      http.get('/activities')
    ])
    const it = detailRes?.item || {}
    activity.value.title = it.title || `活动 #${id}`
    activity.value.place = it.place || ''
    activity.value.limit = Number(it.limit ?? 0)
    activity.value.registerDeadline = it.registerDeadline || null
    activity.value.startAt = it.startAt || null
    activity.value.timeText = it.timeText || ''
    activity.value.status = it.status || 'PUBLISHED'
    const listItems = Array.isArray(listRes?.items) ? listRes.items : []
    const matched = listItems.find(x => String(x.id) === String(id))
    activity.value.registeredCount = Number(matched?.registeredCount ?? 0)
    if (matched && matched.status) activity.value.status = matched.status
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取活动信息失败')
  } finally {
    loading.value = false
  }
}

async function fetchUser() {
  userLoading.value = true
  try {
    const { data } = await http.get('/users/me')
    user.value.name = data?.name || ''
    user.value.studentId = data?.studentId || ''
    user.value.contact = data?.contact || ''
    user.value.isBanned = !!data?.isBanned
    user.value.banRemainingDays = Number(data?.banRemainingDays || 0)
    user.value.bannedUntil = data?.bannedUntil || null
  } catch (e) {
    // 若未登录，http 拦截器会跳转到登录页
    ElMessage.error(e?.response?.data?.message || '获取个人信息失败，请先登录')
  } finally {
    userLoading.value = false
  }
}

function goBack() { router.back() }

async function submitRegister() {
  if (user.value.isBanned) {
    const untilText = user.value.bannedUntil ? new Date(user.value.bannedUntil).toLocaleDateString() : '禁期未定'
    ElMessage.warning(`你当前处于禁报名期，禁至 ${untilText}（剩余 ${user.value.banRemainingDays} 天）。如有疑问，请联系管理员。`)
    return
  }
  if (isDeadline()) {
    ElMessage.warning('报名截止，无法报名')
    return
  }
  if (isFull()) {
    ElMessage.warning('名额已满，无法报名')
    return
  }
  if (String(activity.value.status || '').toUpperCase() === 'CLOSED') {
    ElMessage.warning('该活动报名已关闭')
    return
  }
  // 唤起自定义的二次确认弹窗
  confirmDialogVisible.value = true
}

async function handleConfirmRegister() {
  confirmDialogVisible.value = false
  try {
    loading.value = true
    const { data } = await http.post(`/activities/${id}/register`)
    ElMessage.success(data?.message || '报名成功')
    // 通过 query 参数 `showQr=1` 告知详情页报名成功，要求其打开二维码
    router.push({ path: `/activities/${id}`, query: { showQr: '1' } })
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '报名失败，请稍后再试')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchActivity(), fetchUser()])
  window.addEventListener('resize', updateViewportState)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportState)
})
</script>

<template>
  <div class="register-confirm-page">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">活动信息</div>
      </template>
      <el-skeleton :loading="loading" animated>
        <template #default>
          <div class="fields">
            <div class="field"><span class="label">活动名称：</span><span class="value">{{ activity.title }}</span></div>
            <div class="field"><span class="label">活动时间：</span><span class="value">{{ timeDisplay }}</span></div>
            <div class="field"><span class="label">活动地点：</span><span class="value">{{ activity.place || '待定' }}</span></div>
          </div>
        </template>
      </el-skeleton>
    </el-card>

    <el-card class="box-card" style="margin-top: 16px;">
      <template #header>
        <div class="card-header">个人信息</div>
      </template>
      <el-skeleton :loading="userLoading" animated>
        <template #default>
          <div class="fields">
            <div class="field"><span class="label">姓名：</span><span class="value">{{ user.name }}</span></div>
            <div class="field"><span class="label">学号：</span><span class="value">{{ user.studentId }}</span></div>
            <div class="field"><span class="label">联系方式：</span><span class="value">{{ user.contact }}</span></div>
          </div>
        </template>
      </el-skeleton>
    </el-card>

    <div class="actions">
      <el-button @click="goBack">返回</el-button>
      <el-button type="primary" :disabled="user.isBanned || isDeadline() || isFull() || (String(activity.status||'').toUpperCase()==='CLOSED')" @click="submitRegister">确认报名</el-button>
      <div class="hints">
        <span v-if="user.isBanned" class="hint">当前处于禁报名期，禁至 {{ user.bannedUntil?new Date(user.bannedUntil).toLocaleDateString():'—' }}（剩余 {{ user.banRemainingDays }} 天）。</span>
        <span v-else-if="isDeadline()" class="hint">报名已截止</span>
        <span v-else-if="isFull()" class="hint">名额已满</span>
        <span v-else-if="String(activity.status||'').toUpperCase()==='CLOSED'" class="hint">报名已关闭</span>
      </div>
    </div>
  </div>
  <el-divider style="margin: 0" />

  <!-- 自定义居中确认弹窗 -->
  <div v-if="confirmDialogVisible" class="custom-confirm-overlay">
    <div class="custom-confirm-dialog">
      <div class="custom-confirm-header">
        <el-icon class="custom-confirm-icon"><WarningFilled /></el-icon>
        <span class="custom-confirm-title">提示</span>
      </div>
      <div class="custom-confirm-body">
        <p class="custom-confirm-text">如果在报名后无故不参加活动，将对用户账号进行14日封禁的处罚。是否继续报名？</p>
      </div>
      <div class="custom-confirm-footer">
        <el-button class="custom-confirm-btn custom-confirm-btn--primary" @click="handleConfirmRegister">我已知晓并报名</el-button>
        <el-button class="custom-confirm-btn" @click="confirmDialogVisible = false">取消</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { WarningFilled } from '@element-plus/icons-vue'
export default {
  components: { WarningFilled }
}
</script>

<style scoped>
.register-confirm-page { padding: 16px; max-width: 860px; margin: 0 auto; }
.box-card { width: 100%; }
.card-header { font-weight: 600; }
.fields { display: flex; flex-direction: column; gap: 8px; }
.field { display: flex; align-items: flex-start; }
.label { width: 120px; color: #606266; text-align: left; }
.value { flex: 1; text-align: left; }
.actions { margin-top: 18px; display: flex; align-items: center; gap: 12px; }
.actions :deep(.el-button) {
  height: 48px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  padding: 0 32px;
}
.hints { color: #f56c6c; }
@media (max-width: 768px) {
  .register-confirm-page { padding: 12px 12px 112px; }
  .actions { flex-direction: column; align-items: stretch; }
  .actions :deep(.el-button--primary) { order: 1; }
  .actions :deep(.el-button:not(.el-button--primary)) { order: 2; }
  .hints { order: 3; }
  .actions :deep(.el-button) { width: 100%; margin-left: 0; }
  .hints { font-size: 13px; line-height: 1.6; }
  .label { width: 96px; }
}

/* 自定义确认弹窗样式 */
.custom-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-confirm-dialog {
  background: #ffffff;
  width: 400px;
  max-width: 92vw;
  border-radius: 20px;
  padding: 32px 24px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
  box-sizing: border-box;
}

.custom-confirm-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
}

.custom-confirm-icon {
  font-size: 32px;
  color: #f97316;
}

.custom-confirm-title {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
}

.custom-confirm-body {
  text-align: center;
  margin-bottom: 32px;
}

.custom-confirm-text {
  font-size: 18px;
  color: #334155;
  line-height: 1.6;
  margin: 0;
}

.custom-confirm-footer {
  display: flex;
  gap: 16px;
}

.custom-confirm-btn {
  flex: 1;
  height: 48px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  margin: 0 !important;
}

.custom-confirm-btn--primary {
  background: linear-gradient(135deg, #ff7d73, #fdba74);
  border: none;
  color: #fff;
}

@media (max-width: 768px) {
  .custom-confirm-dialog {
    padding: 28px 20px;
    border-radius: 18px;
  }
  .custom-confirm-footer {
    flex-direction: column-reverse;
    gap: 12px;
  }
}
</style>
