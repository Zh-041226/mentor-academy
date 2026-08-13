<template>
  <div class="user-center-page" :class="{ 'is-mobile': isMobile }">
    <!-- ==================== MOBILE VIEW ==================== -->
    <template v-if="isMobile">
      <!-- Top Micro Header -->
      <header class="mobile-uc-header">
        <div class="mobile-uc-user">
          <div class="mobile-uc-avatar">
            <el-icon><UserFilled /></el-icon>
          </div>
          <div class="mobile-uc-info">
            <div class="mobile-uc-name">{{ profileName }}</div>
            <div class="mobile-uc-meta">
              <span>{{ profileRole }}</span>
              <span v-if="me.className">· {{ me.className }}</span>
            </div>
          </div>
          <div class="mobile-uc-status">
            <el-tag v-if="me.isBanned" type="danger" size="small" round>禁报名</el-tag>
            <el-tag v-else type="success" size="small" round>正常</el-tag>
          </div>
        </div>
        <button type="button" class="mobile-uc-settings-btn" @click="settingsVisible = true">
          <el-icon><Setting /></el-icon>
        </button>
      </header>

      <!-- Warning Alert -->
      <div v-if="me.isBanned" class="mobile-uc-alert">
        <el-alert
          type="error"
          show-icon
          :closable="false"
          :title="`禁至 ${me.bannedUntil ? new Date(me.bannedUntil).toLocaleDateString() : '—'}（余 ${me.banRemainingDays} 天）`"
        />
      </div>

      <!-- Activity Tabs -->
      <div class="mobile-uc-tabs">
        <div class="mobile-uc-tab" :class="{ 'is-active': activityTab === 'upcoming' }" @click="switchTab('upcoming')">
          待参加 <span class="count" v-if="summary.upcoming">{{ summary.upcoming }}</span>
        </div>
        <div class="mobile-uc-tab" :class="{ 'is-active': activityTab === 'registered' }" @click="switchTab('registered')">
          已报名 <span class="count" v-if="summary.registered">{{ summary.registered }}</span>
        </div>
        <div class="mobile-uc-tab" :class="{ 'is-active': activityTab === 'history' }" @click="switchTab('history')">
          历史记录
        </div>
      </div>

      <!-- Activity List -->
      <div class="mobile-uc-list" v-loading="activitiesLoading">
        <el-empty v-if="!currentActivities.length" description="暂无相关活动" :image-size="80" />
        <div v-else class="mobile-activity-cards">
          <article v-for="it in currentActivities" :key="it.id" class="mobile-activity-card" @click="goDetail(it.id)">
            <div class="mobile-activity-card__main">
              <div class="mobile-activity-card__title">{{ it.title || '未命名活动' }}</div>
              <div class="mobile-activity-card__meta">时间：{{ it.timeText || '待定' }}</div>
              <div class="mobile-activity-card__meta">地点：{{ it.place || '待定' }}</div>
              
              <div class="mobile-activity-card__reason" v-if="activityTab === 'registered'">
                {{ it.status === 'PENDING_CANCEL' ? '状态：取消审核中' : '状态：报名成功' }}
              </div>
              <div class="mobile-activity-card__reason" v-if="activityTab === 'history'">
                {{ it.reason ? `取消事由：${it.reason}` : '已归档' }}
              </div>
            </div>
            
            <div class="mobile-activity-card__actions">
              <div class="status-tag">
                <el-tag v-if="activityTab === 'registered'" :type="it.status === 'PENDING_CANCEL' ? 'warning' : 'success'" size="small" effect="light">
                  {{ it.status === 'PENDING_CANCEL' ? '待审核' : '已报名' }}
                </el-tag>
                <el-tag v-else-if="activityTab === 'upcoming'" type="primary" size="small" effect="light">待参加</el-tag>
                <el-tag v-else type="info" size="small" effect="light">历史</el-tag>
              </div>
              
              <el-button 
                v-if="activityTab === 'registered'" 
                type="danger" 
                size="small" 
                plain
                class="cancel-btn"
                :disabled="it.status === 'PENDING_CANCEL'" 
                @click.stop="openCancel(it.id)">
                取消报名
              </el-button>
            </div>
          </article>
          
          <div class="mobile-uc-pager" v-if="currentPager.total > 0">
            <el-pagination
              v-model:current-page="currentPager.page"
              :page-size="currentPager.pageSize"
              layout="prev, pager, next"
              :total="currentPager.total"
              small
              background
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </div>

      <!-- Settings Bottom Drawer -->
      <el-drawer
        v-model="settingsVisible"
        title="账号设置"
        direction="btt"
        size="85%"
        class="mobile-settings-drawer"
        :with-header="true"
        append-to-body
      >
        <div class="drawer-inner">
          <div class="drawer-header-actions" v-if="!editable">
            <el-button type="primary" link size="small" @click="fetchMe" :loading="loading">刷新</el-button>
          </div>
          
          <el-skeleton :loading="loading" animated>
            <template #default>
              <!-- Info Display (iOS List Style) -->
              <template v-if="!editable">
                <div class="ios-list-group">
                  <div class="ios-list-item">
                    <span class="ios-list-label">账号</span>
                    <span class="ios-list-value">{{ me.studentId }}</span>
                  </div>
                  <div class="ios-list-item" v-if="!isAdmin">
                    <span class="ios-list-label">姓名</span>
                    <span class="ios-list-value">{{ me.name }}</span>
                  </div>
                  <div class="ios-list-item" v-if="!isAdmin">
                    <span class="ios-list-label">班级</span>
                    <span class="ios-list-value">{{ me.className }}</span>
                  </div>
                  <div class="ios-list-item" v-if="!isAdmin">
                    <span class="ios-list-label">联系方式</span>
                    <span class="ios-list-value">{{ me.contact }}</span>
                  </div>
                  <div class="ios-list-item">
                    <span class="ios-list-label">角色</span>
                    <span class="ios-list-value">{{ roleText(me.role) }}</span>
                  </div>
                  <div class="ios-list-item" v-if="isAdmin">
                    <span class="ios-list-label">等级</span>
                    <span class="ios-list-value">{{ formatLevelCn(me.adminLevel) }}</span>
                  </div>
                  <div class="ios-list-item">
                    <span class="ios-list-label">密码</span>
                    <div class="ios-list-value pwd-inline">
                      <span>{{ showPwd ? (me.plainPassword || '******') : '******' }}</span>
                      <el-button link type="primary" size="small" class="icon-button pwd-toggle-btn" :title="showPwd ? '隐藏密码' : '显示密码'" @click="togglePwd">
                        <svg v-if="showPwd" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                          <path d="M1 12c3-5 8-8 11-8s8 3 11 8c-3 5-8 8-11 8s-8-3-11-8z" stroke="currentColor" stroke-width="2" fill="none"/>
                          <circle cx="12" cy="12" r="3" fill="currentColor"/>
                          <path d="M3 3L21 21" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                          <path d="M1 12c3-5 8-8 11-8s8 3 11 8c-3 5-8 8-11 8s-8-3-11-8z" stroke="currentColor" stroke-width="2" fill="none"/>
                          <circle cx="12" cy="12" r="3" fill="currentColor"/>
                        </svg>
                      </el-button>
                    </div>
                  </div>
                </div>
                
                <div class="ios-tips">仅允许修改联系方式与密码，其他信息如需修改请联系管理员（电话：00000000000）。</div>
                
                <div class="ios-actions-group">
                  <button type="button" class="ios-action-btn primary" @click="startEdit" :disabled="loading">
                    编辑资料
                  </button>
                  <button type="button" class="ios-action-btn danger" @click="logout">
                    退出登录
                  </button>
                </div>
              </template>

              <!-- Edit Form -->
              <template v-else>
                <div class="ios-list-group edit-mode">
                  <el-form label-position="top" size="large" class="ios-form">
                    <el-form-item label="联系方式" v-if="!isAdmin">
                      <el-input v-model="form.contact" placeholder="11位数字" />
                    </el-form-item>
                    <el-form-item label="原密码">
                      <el-input v-model="form.currentPassword" type="password" show-password placeholder="请输入原密码以确认" />
                    </el-form-item>
                    <el-form-item label="新密码">
                      <el-input v-model="form.password" type="password" show-password placeholder="6-12位数字或字母，不修改可留空" />
                    </el-form-item>
                  </el-form>
                </div>
                
                <div class="ios-actions-group">
                  <button type="button" class="ios-action-btn primary" @click="save" :disabled="saving">
                    保存修改
                  </button>
                  <button type="button" class="ios-action-btn default" @click="cancelEdit" :disabled="saving">
                    取消
                  </button>
                </div>
              </template>
            </template>
          </el-skeleton>
        </div>
      </el-drawer>
    </template>

    <!-- ==================== PC VIEW ==================== -->
    <template v-else>
      <el-card class="pc-info-card">
        <template #header>
          <div class="card-header">
            <span>我的信息</span>
            <div class="header-actions">
              <el-button type="primary" link @click="fetchMe" :loading="loading">刷新</el-button>
              <el-divider direction="vertical" />
              <el-button v-if="!editable" type="primary" @click="startEdit" :disabled="loading">编辑</el-button>
              <template v-else>
                <el-button @click="cancelEdit" :disabled="saving">取消</el-button>
                <el-button type="primary" @click="save" :loading="saving">保存</el-button>
              </template>
            </div>
          </div>
        </template>

        <el-skeleton :loading="loading" animated>
          <template #default>
            <template v-if="!editable">
              <template v-if="isAdmin">
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="角色">{{ roleText(me.role) }}</el-descriptions-item>
                  <el-descriptions-item label="等级">{{ formatLevelCn(me.adminLevel) }}</el-descriptions-item>
                  <el-descriptions-item label="用户名">{{ me.studentId }}</el-descriptions-item>
                  <el-descriptions-item label="密码">
                    <div class="pwd-row">
                      <span>{{ showPwd ? (me.plainPassword || '******') : '******' }}</span>
                      <el-button link type="primary" size="small" class="icon-button" :title="showPwd ? '隐藏密码' : '显示密码'" @click="togglePwd">
                        <svg v-if="showPwd" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 12c3-5 8-8 11-8s8 3 11 8c-3 5-8 8-11 8s-8-3-11-8z" stroke="currentColor" stroke-width="2" fill="none"/>
                          <circle cx="12" cy="12" r="3" fill="currentColor"/>
                          <path d="M3 3L21 21" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 12c3-5 8-8 11-8s8 3 11 8c-3 5-8 8-11 8s-8-3-11-8z" stroke="currentColor" stroke-width="2" fill="none"/>
                          <circle cx="12" cy="12" r="3" fill="currentColor"/>
                        </svg>
                      </el-button>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">{{ formatDate(me.createdAt) }}</el-descriptions-item>
                </el-descriptions>
              </template>
              <template v-else>
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="学号">{{ me.studentId }}</el-descriptions-item>
                  <el-descriptions-item label="姓名">{{ me.name }}</el-descriptions-item>
                  <el-descriptions-item label="班级">{{ me.className }}</el-descriptions-item>
                  <el-descriptions-item label="联系方式">{{ me.contact }}</el-descriptions-item>
                  <el-descriptions-item label="角色">{{ roleText(me.role) }}</el-descriptions-item>
                  <el-descriptions-item label="密码">
                    <div class="pwd-row">
                      <span>{{ showPwd ? (me.plainPassword || '******') : '******' }}</span>
                      <el-button link type="primary" size="small" class="icon-button" :title="showPwd ? '隐藏密码' : '显示密码'" @click="togglePwd">
                        <svg v-if="showPwd" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 12c3-5 8-8 11-8s8 3 11 8c-3 5-8 8-11 8s-8-3-11-8z" stroke="currentColor" stroke-width="2" fill="none"/>
                          <circle cx="12" cy="12" r="3" fill="currentColor"/>
                          <path d="M3 3L21 21" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 12c3-5 8-8 11-8s8 3 11 8c-3 5-8 8-11 8s-8-3-11-8z" stroke="currentColor" stroke-width="2" fill="none"/>
                          <circle cx="12" cy="12" r="3" fill="currentColor"/>
                        </svg>
                      </el-button>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">{{ formatDate(me.createdAt) }}</el-descriptions-item>
                  <el-descriptions-item label="禁报名状态">
                    <template v-if="me.isBanned">
                      <el-tag type="danger">禁至 {{ me.bannedUntil ? new Date(me.bannedUntil).toLocaleDateString() : '—' }}（剩余 {{ me.banRemainingDays }} 天）</el-tag>
                    </template>
                    <template v-else>
                      <el-tag type="success">正常</el-tag>
                    </template>
                  </el-descriptions-item>
                </el-descriptions>
              </template>
              <div class="tips">仅允许修改联系方式与密码，其他信息不可修改。如需修改其他信息请联系管理员（电话：00000000000）。</div>
              <div v-if="me.isBanned" style="margin-top:8px;">
                <el-alert type="error" :title="`当前处于禁报名期，禁至 ${me.bannedUntil?new Date(me.bannedUntil).toLocaleDateString():'—'}（剩余 ${me.banRemainingDays} 天）。如有疑问请联系管理员（电话：00000000000）。`" show-icon />
              </div>
              <div style="margin-top:20px;">
                <el-button type="danger" @click="logout">退出登录</el-button>
              </div>
            </template>
            <template v-else>
              <el-form label-width="120px">
                <el-form-item label="联系方式" v-if="!isAdmin">
                  <el-input v-model="form.contact" placeholder="11位数字" />
                </el-form-item>
                <el-form-item label="原密码">
                  <el-input v-model="form.currentPassword" type="password" show-password placeholder="请输入原密码以确认修改" />
                </el-form-item>
                <el-form-item label="新密码">
                  <el-input v-model="form.password" type="password" show-password placeholder="6-12位数字或字母，不修改可留空" />
                </el-form-item>
                <div class="tips">仅允许修改联系方式与密码，其他信息不可修改。</div>
              </el-form>
            </template>
          </template>
        </el-skeleton>
      </el-card>
    </template>

    <!-- Global Cancel Dialog -->
    <el-dialog v-model="cancelDialogVisible" title="取消报名" width="90%" max-width="520px" append-to-body>
      <div class="cancel-label" style="margin-bottom: 8px; font-weight: 500;">请填写取消事由（5-200字）：</div>
      <el-input
        v-model="cancelReason"
        type="textarea"
        :maxlength="200"
        show-word-limit
        :rows="4"
        placeholder="如：课程冲突，无法准时参加"
      />
      <div class="cancel-hint" style="margin-top: 8px; color: #f59e0b; font-size: 13px;">提示：三日内连续取消报名三次，15日内不能报名参加任何活动。</div>
      <template #footer>
        <el-button :disabled="cancelSubmitting" @click="cancelDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="cancelSubmitting" @click="submitCancel">提交</el-button>
      </template>
    </el-dialog>

    <!-- Mobile Custom Logout Dialog -->
    <div v-if="logoutDialogVisible" class="custom-confirm-overlay">
      <div class="custom-confirm-box">
        <div class="custom-confirm-box__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>
        <div class="custom-confirm-box__title">确定要退出登录吗？</div>
        <div class="custom-confirm-box__actions">
          <el-button class="custom-confirm-btn" plain @click="logoutDialogVisible = false">取消</el-button>
          <el-button class="custom-confirm-btn" type="danger" @click="performLogout">退出</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { Setting, UserFilled } from '@element-plus/icons-vue'
import http from '../api/http'
import { useMobile } from '../composables/useMobile'

const router = useRouter()
const route = useRoute()
const { isMobile } = useMobile()

// ========== User Profile State ==========
const me = reactive({ id: '', studentId: '', name: '', className: '', contact: '', role: '', adminLevel: '', createdAt: '', bannedUntil: null, bannedNote: '', bannedCount: 0, banRemainingDays: 0, isBanned: false })
const loading = ref(false)
const editable = ref(false)
const saving = ref(false)
const form = reactive({ contact: '', currentPassword: '', password: '' })
const showPwd = ref(false)
const summary = reactive({ registered: 0, upcoming: 0, history: 0 })
const settingsVisible = ref(false)

const isAdmin = computed(() => me.role === 'ADMIN')
const profileName = computed(() => me.name || me.studentId || '当前用户')
const profileRole = computed(() => {
  if (isAdmin.value) return `管理员 · ${formatLevelCn(me.adminLevel)}`
  return roleText(me.role)
})

function formatDate(v) {
  if (!v) return ''
  try {
    const d = new Date(v)
    return d.toLocaleString()
  } catch {
    return String(v)
  }
}

function roleText(role) {
  if (!role) return ''
  if (role === 'STUDENT') return '学生'
  if (role === 'ADMIN') return '管理员'
  return String(role)
}

function formatLevelCn(level) {
  if (!level) return '—'
  const map = { SUPER_ADMIN: '超级管理员', SUPERVISOR: '主管老师', OWNER_PRIMARY: '第一负责人', OWNER_SECONDARY: '第二负责人', STAFF: '普通干事' }
  return map[level] || level
}

async function fetchMe() {
  loading.value = true
  try {
    const { data } = await http.get('/users/me')
    Object.assign(me, data || {})
    if (editable.value) {
      Object.assign(form, { contact: me.contact || '', currentPassword: '', password: '' })
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取信息失败')
  } finally {
    loading.value = false
  }
}

async function fetchSummary() {
  try {
    const [registeredRes, upcomingRes, historyRes] = await Promise.all([
      http.get('/users/me/registrations', { params: { tab: 'registered', page: 1, pageSize: 1 } }),
      http.get('/users/me/registrations', { params: { tab: 'upcoming', page: 1, pageSize: 1 } }),
      http.get('/users/me/registrations', { params: { tab: 'history', page: 1, pageSize: 1 } }),
    ])
    summary.registered = Number(registeredRes?.data?.total || 0)
    summary.upcoming = Number(upcomingRes?.data?.total || 0)
    summary.history = Number(historyRes?.data?.total || 0)
  } catch {
    summary.registered = 0
    summary.upcoming = 0
    summary.history = 0
  }
}

function startEdit() {
  Object.assign(form, { contact: me.contact || '', currentPassword: '', password: '' })
  editable.value = true
}

function cancelEdit() {
  editable.value = false
  form.password = ''
  form.currentPassword = ''
}

async function save() {
  const payload = {}
  if (form.contact && form.contact !== me.contact) payload.contact = form.contact.trim()
  if (form.password) payload.password = form.password

  if (Object.keys(payload).length === 0) {
    ElMessage.warning('未检测到修改内容')
    return
  }

  if (!form.currentPassword) {
    ElMessage.warning('请先输入原密码以确认修改')
    return
  }
  payload.currentPassword = form.currentPassword
  saving.value = true
  try {
    const { data } = await http.put('/users/me', payload)
    Object.assign(me, data || {})
    ElMessage.success('保存成功')
    editable.value = false
    form.password = ''
    form.currentPassword = ''
    showPwd.value = false
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function togglePwd() {
  showPwd.value = !showPwd.value
}

function logout() {
  if (isMobile.value) {
    // 手机端如果使用 Element Plus 的 MessageBox 容易出现布局、居中和遮罩问题，直接用更原生的 custom DOM 方案或者确认对话框
    // 为了保持一致性，我们在模板中加入一个自定义的居中确认框（类似 ActivityRegisterConfirm.vue）
    logoutDialogVisible.value = true
  } else {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(performLogout).catch(() => {})
  }
}

function performLogout() {
  logoutDialogVisible.value = false
  localStorage.removeItem('token')
  router.push('/login')
}

// ========== Activity List State (Mobile Integrated) ==========
const activityTab = ref('upcoming')
const activitiesLoading = ref(false)
const activitiesCache = reactive({
  upcoming: [],
  registered: [],
  history: []
})
const pager = reactive({
  upcoming: { page: 1, pageSize: 10, total: 0 },
  registered: { page: 1, pageSize: 10, total: 0 },
  history: { page: 1, pageSize: 10, total: 0 }
})

const currentActivities = computed(() => activitiesCache[activityTab.value] || [])
const currentPager = computed(() => pager[activityTab.value])

async function fetchActivities(name = activityTab.value) {
  activitiesLoading.value = true
  try {
    const p = pager[name]
    const { data } = await http.get('/users/me/registrations', {
      params: { tab: name, page: p.page, pageSize: p.pageSize }
    })
    activitiesCache[name] = Array.isArray(data?.items) ? data.items : []
    p.total = Number(data?.total || 0)
    // Also update summary stats implicitly
    if (name === 'upcoming') summary.upcoming = p.total
    if (name === 'registered') summary.registered = p.total
    if (name === 'history') summary.history = p.total
  } catch (e) {
    ElMessage.error('获取活动列表失败')
  } finally {
    activitiesLoading.value = false
  }
}

function switchTab(tabName) {
  if (activityTab.value === tabName) return
  activityTab.value = tabName
  pager[tabName].page = 1
  fetchActivities(tabName)
}

function handlePageChange(page) {
  pager[activityTab.value].page = page
  fetchActivities(activityTab.value)
}

function goDetail(id) {
  router.push(`/activities/${id}`)
}

// ========== Cancel Activity State ==========
const cancelDialogVisible = ref(false)
const cancelReason = ref('')
const cancelTargetId = ref(null)
const cancelSubmitting = ref(false)

const logoutDialogVisible = ref(false)

function openCancel(id) {
  cancelTargetId.value = id
  cancelReason.value = ''
  cancelDialogVisible.value = true
}

async function submitCancel() {
  const reason = cancelReason.value.trim()
  if (reason.length < 5 || reason.length > 200) {
    ElMessage.warning('请填写5-200字的取消事由')
    return
  }
  cancelSubmitting.value = true
  try {
    const { data } = await http.post(`/activities/${cancelTargetId.value}/cancel`, { reason })
    ElMessage.success(data?.message || '已提交取消申请，待管理员审核')
    cancelDialogVisible.value = false
    
    // Refresh both registered and upcoming to reflect changes
    await fetchActivities('registered')
    if (activityTab.value === 'upcoming') {
      await fetchActivities('upcoming')
    }
  } catch (e) {
    const msg = e?.response?.data?.message || '取消失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    cancelSubmitting.value = false
  }
}

// Ensure tab sync with URL for deep linking if needed
watch(() => route.query.tab, (newTab) => {
  if (isMobile.value && ['upcoming', 'registered', 'history'].includes(newTab)) {
    switchTab(newTab)
  }
})

onMounted(() => {
  fetchMe()
  if (isMobile.value) {
    const initTab = route.query.tab || 'upcoming'
    if (['upcoming', 'registered', 'history'].includes(initTab)) {
      activityTab.value = initTab
    }
    fetchSummary()
    fetchActivities(activityTab.value)
  } else {
    fetchSummary()
  }
})
</script>

<style scoped>
/* ==================== GLOBAL ==================== */
.user-center-page {
  max-width: 960px;
  margin: 40px auto;
}
.user-center-page.is-mobile {
  margin: 0;
  padding: 0;
  background: #f8fafc;
  min-height: 100vh;
}

/* ==================== MOBILE VIEW ==================== */
.mobile-uc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px;
  background: #fff;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.03);
  position: sticky;
  top: 0;
  z-index: 20;
}

.mobile-uc-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-uc-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff7e5f, #feb47b);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 10px rgba(255, 126, 95, 0.3);
}

.mobile-uc-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-uc-name {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}

.mobile-uc-meta {
  font-size: 12px;
  color: #64748b;
}

.mobile-uc-status {
  margin-left: 6px;
}

.mobile-uc-settings-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: #fff;
  color: #475569;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}
.mobile-uc-settings-btn:active {
  background: #f1f5f9;
}

.mobile-uc-alert {
  padding: 12px 16px 0;
}

.mobile-uc-tabs {
  display: flex;
  background: #fff;
  padding: 0 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.04);
  position: sticky;
  top: 84px;
  z-index: 10;
}

.mobile-uc-tab {
  flex: 1;
  text-align: center;
  padding: 16px 0;
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
  position: relative;
  cursor: pointer;
  transition: color 0.2s;
}

.mobile-uc-tab.is-active {
  color: #f97316;
  font-weight: 800;
}

.mobile-uc-tab.is-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  background: linear-gradient(90deg, #ff7e5f, #feb47b);
  border-radius: 4px 4px 0 0;
}

.mobile-uc-tab .count {
  display: inline-block;
  margin-left: 4px;
  padding: 2px 6px;
  border-radius: 99px;
  background: rgba(249, 115, 22, 0.1);
  color: #f97316;
  font-size: 11px;
  font-weight: 800;
  vertical-align: middle;
}

.mobile-uc-list {
  padding: 16px;
  padding-bottom: 120px;
}

.mobile-activity-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mobile-activity-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
  border: 1px solid rgba(15, 23, 42, 0.02);
}

.mobile-activity-card__title {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 8px;
  line-height: 1.4;
}

.mobile-activity-card__meta {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.mobile-activity-card__reason {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(15, 23, 42, 0.06);
  font-size: 13px;
  color: #c2410c;
  line-height: 1.5;
}

.mobile-activity-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
}

.mobile-uc-pager {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

/* Settings Drawer Inner */
.drawer-inner {
  padding: 0 16px 24px;
}

.drawer-header-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}

.settings-desc :deep(.el-descriptions__label) {
  width: 90px;
  color: #64748b;
}

.mobile-settings-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 16px 20px;
  font-weight: 800;
  color: #0f172a;
  border-bottom: 1px solid rgba(15, 23, 42, 0.04);
}

/* ==================== iOS Style List (Mobile Settings) ==================== */
.ios-list-group {
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
}
.ios-list-group.edit-mode {
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.04);
}

.ios-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.04);
}
.ios-list-item:last-child {
  border-bottom: none;
}
.ios-list-label {
  color: #0f172a;
  font-weight: 500;
  font-size: 15px;
}
.ios-list-value {
  color: #64748b;
  font-size: 15px;
}

.ios-tips {
  font-size: 12px;
  color: #94a3b8;
  padding: 0 12px;
  margin-bottom: 24px;
  line-height: 1.5;
}

.ios-actions-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ios-action-btn {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  background: #fff;
  cursor: pointer;
  transition: background 0.2s;
}
.ios-action-btn:active {
  background: #f1f5f9;
}
.ios-action-btn.primary {
  color: #f97316;
}
.ios-action-btn.danger {
  color: #ef4444;
}
.ios-action-btn.default {
  color: #64748b;
}

.pwd-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pwd-toggle-btn {
  padding: 0;
  height: auto;
}

/* ==================== PC VIEW ==================== */
.pc-info-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tips {
  color: #94a3b8;
  font-size: 12px;
  margin-top: 12px;
  line-height: 1.6;
}

.pwd-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.icon-button {
  margin-left: auto;
  padding: 0;
}

/* 自定义居中确认框（移动端专用） */
.custom-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.custom-confirm-box {
  background: #fff;
  border-radius: 24px;
  width: 100%;
  max-width: 320px;
  padding: 32px 24px 24px;
  text-align: center;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  animation: modal-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.custom-confirm-box__icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 20px;
  background: rgba(239, 68, 64, 0.1);
  color: #ef4440;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-confirm-box__icon svg {
  width: 28px;
  height: 28px;
}

.custom-confirm-box__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 28px;
}

.custom-confirm-box__actions {
  display: flex;
  gap: 12px;
}

.custom-confirm-btn {
  flex: 1;
  height: 48px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  margin: 0 !important;
}

@keyframes modal-pop {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
