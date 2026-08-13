<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import http from '../../api/http'
import { ElMessage, ElMessageBox } from 'element-plus'
import { exportSheetAsXlsx } from '../../utils/xlsxExport'

const loading = ref(false)
// 分页化列表（服务端驱动）
const students = ref([])
const studentsPage = ref(1)
const studentsPageSize = ref(20)
const studentsTotal = ref(0)
const admins = ref([])
const adminsPage = ref(1)
const adminsPageSize = ref(20)
const adminsTotal = ref(0)

// 筛选关键字（交由服务端处理）
const keyword = ref('')
// 当前管理员信息与可见性限制
const me = ref(null)
const myLevel = computed(() => me.value?.adminLevel || '')
const isStaff = computed(() => myLevel.value === 'STAFF')
function getRestrictedSet(level) {
  switch (level) {
    case 'SUPERVISOR': return new Set(['SUPER_ADMIN', 'SUPERVISOR'])
    case 'OWNER_PRIMARY': return new Set(['SUPER_ADMIN', 'SUPERVISOR', 'OWNER_PRIMARY'])
    case 'OWNER_SECONDARY': return new Set(['SUPER_ADMIN', 'SUPERVISOR', 'OWNER_PRIMARY', 'OWNER_SECONDARY'])
    case 'STAFF': return new Set(['SUPER_ADMIN', 'SUPERVISOR', 'OWNER_PRIMARY', 'OWNER_SECONDARY', 'STAFF'])
    default: return new Set()
  }
}
const viewerRestrictedLevels = computed(() => getRestrictedSet(myLevel.value))
const studentsFiltered = computed(() => students.value)
// 管理员列表遵循可见性限制：非最高权限看不到更高等级的管理员账号（服务端已限制，这里再次防护）
const adminsFiltered = computed(() =>
  admins.value
    .filter(u => (!adminLevelFilter.value || u.adminLevel === adminLevelFilter.value))
    .filter(u => !viewerRestrictedLevels.value.has(u.adminLevel))
)

// 选择与批量处理
const selectedStudents = ref([])
const selectedAdmins = ref([])
function onStudentsSelectionChange(rows) { selectedStudents.value = rows }
function onAdminsSelectionChange(rows) { selectedAdmins.value = rows }

// 批量删除
async function batchDelete(ctx) {
  let rows = ctx === 'student' ? selectedStudents.value : selectedAdmins.value
  if (ctx === 'admin') {
    rows = rows.filter(r => !viewerRestrictedLevels.value.has(r.adminLevel))
  }
  const ids = rows.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的用户')
  try {
    await ElMessageBox.confirm('确认删除选中的用户？此操作不可恢复', '提示', { type: 'warning' })
    await http.post('/admin/users/batch-delete', { ids })
    ElMessage.success('删除成功')
    await fetchUsers()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(e?.response?.data?.message || '删除失败')
    }
  }
}

// 批量修改
const updateDialogVisible = ref(false)
const updateContext = ref('student') // student/admin
const updateForm = ref({ role: '', adminLevel: '', contact: '', className: '', password: '' })
const roleOptions = [
  { label: '学生', value: 'STUDENT' },
  { label: '管理员', value: 'ADMIN' }
]
const adminLevelOptions = [
  { label: '超级管理员', value: 'SUPER_ADMIN' },
  { label: '主管老师', value: 'SUPERVISOR' },
  { label: '第一负责人', value: 'OWNER_PRIMARY' },
  { label: '第二负责人', value: 'OWNER_SECONDARY' },
  { label: '普通干事', value: 'STAFF' }
]
const adminLevelOptionsFiltered = computed(() => adminLevelOptions.filter(opt => !viewerRestrictedLevels.value.has(opt.value)))
// 创建管理员
const createDialogVisible = ref(false)
const createForm = ref({ adminLevel: '', studentId: '', password: '' })
function openCreateAdmin() {
  if (isStaff.value) { ElMessage.warning('普通干事无权创建管理员'); return }
  createForm.value = { adminLevel: '', studentId: '', password: '' }
  createDialogVisible.value = true
}
async function submitCreateAdmin() {
  const f = createForm.value
  const sid = String(f.studentId || '').trim()
  const pwd = String(f.password || '')
  const lvl = String(f.adminLevel || '').trim()
  if (!lvl) return ElMessage.warning('请选择管理员等级')
  if (!sid || !/^[A-Za-z0-9]{6,20}$/.test(sid)) return ElMessage.warning('用户名需为6-20位字母或数字')
  if (!pwd || !/^[A-Za-z0-9]{6,12}$/.test(pwd)) return ElMessage.warning('密码需为6-12位（只能数字或字母）')
  try {
    await http.post('/admin/users/create', { adminLevel: lvl, username: sid, password: pwd })
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    await fetchUsers()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '创建失败')
  }
}

// 创建学生用户
const createStudentDialogVisible = ref(false)
const createStudentForm = ref({ studentId: '', name: '', className: '', contact: '', password: '' })
// 智能提示：班级检索（与注册页一致）
function queryStudentClassSuggestions(queryString, cb) {
  const q = String(queryString || '').trim()
  http.get('/classes', { params: { keyword: q } })
    .then(({ data }) => {
      const items = Array.isArray(data?.items) ? data.items : []
      const suggestions = items.map(it => ({ value: it.name || it }))
      cb(suggestions)
    })
    .catch(() => cb([]))
}
function onSelectStudentClass(item) { createStudentForm.value.className = item?.value || '' }
function openCreateStudent() {
  createStudentForm.value = { studentId: '', name: '', className: '', contact: '', password: '' }
  createStudentDialogVisible.value = true
}
async function submitCreateStudent() {
  const f = createStudentForm.value
  const sid = String(f.studentId || '').trim()
  const name = String(f.name || '').trim()
  const cls = String(f.className || '').trim()
  const contact = String(f.contact || '').trim()
  const pwd = String(f.password || '')
  if (!sid || !/^\d{12}$/.test(sid)) return ElMessage.warning('学号需为12位数字')
  if (!pwd || !/^[A-Za-z0-9]{6,12}$/.test(pwd)) return ElMessage.warning('密码需为6-12位（数字或英文）')
  if (!name || !/^[\u4e00-\u9fa5]+$/.test(name)) return ElMessage.warning('姓名需为中文')
  if (!contact || !/^\d{11}$/.test(contact)) return ElMessage.warning('联系方式需为11位数字')
  if (!cls) return ElMessage.warning('请填写班级')
  try {
    await http.post('/admin/users/create-student', { studentId: sid, password: pwd, name, contact, className: cls })
    ElMessage.success('创建成功')
    createStudentDialogVisible.value = false
    await fetchUsers()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '创建失败')
  }
}
function openBatchUpdate(ctx) {
  updateContext.value = ctx
  updateForm.value = { role: '', adminLevel: '', contact: '', className: '', password: '' }
  updateDialogVisible.value = true
}
async function submitBatchUpdate() {
  let rows = updateContext.value === 'student' ? selectedStudents.value : selectedAdmins.value
  if (updateContext.value === 'admin') {
    rows = rows.filter(r => !viewerRestrictedLevels.value.has(r.adminLevel))
  }
  const ids = rows.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要修改的用户')
  const f = updateForm.value
  const payload = {}
  if (f.role) payload.role = f.role
  if (f.adminLevel) {
    if (viewerRestrictedLevels.value.has(f.adminLevel)) {
      ElMessage.error('无权将账号修改为该管理员等级')
      return
    }
    payload.adminLevel = f.adminLevel
  }
  if (f.contact) payload.contact = f.contact
  if (f.className) payload.className = f.className
  if (f.password) payload.password = f.password
  if (Object.keys(payload).length === 0) return ElMessage.warning('请选择要修改的字段')
  try {
    await http.post('/admin/users/batch-update', { ids, payload })
    ElMessage.success('修改成功')
    updateDialogVisible.value = false
    await fetchUsers()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '修改失败')
  }
}

// 导出 Excel（xlsx）
async function exportXlsx(ctx) {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')

  if (ctx === 'student') {
    const list = studentsFiltered.value
    if (!list.length) return ElMessage.warning('无可导出数据')
    await exportSheetAsXlsx({
      sheetName: '学生',
      headers: ['学号', '姓名', '班级', '联系方式', '密码（明文）'],
      rows: list.map((u) => [
        u.studentId,
        u.name,
        u.className,
        u.contact || '—',
        u.plainPassword || u.password || '—',
      ]),
      colWidths: [18, 14, 20, 16, 18],
      fileName: `学生名单-${yyyy}${mm}${dd}_${hh}${min}.xlsx`,
    })
  } else {
    const list = adminsFiltered.value
    if (!list.length) return ElMessage.warning('无可导出数据')
    await exportSheetAsXlsx({
      sheetName: '管理员',
      headers: ['角色', '管理员等级', '用户名', '密码（明文）', '注册时间'],
      rows: list.map((u) => [
        formatRoleCn(u.role),
        formatLevelCn(u.adminLevel),
        u.studentId,
        u.plainPassword || u.password || '—',
        formatDate(u.createdAt),
      ]),
      colWidths: [12, 16, 16, 18, 22],
      fileName: `管理员名单-${yyyy}${mm}${dd}_${hh}${min}.xlsx`,
    })
  }
  ElMessage.success('Excel 导出成功')
}

// 细粒度筛选：角色、管理员等级、时间范围
const roleFilter = ref('STUDENT') // STUDENT/ADMIN，作为顶部切换视图
const adminLevelFilter = ref('')
const dateRange = ref([])
const isStudentPanel = computed(() => roleFilter.value !== 'ADMIN')
const currentKeywordPlaceholder = computed(() => (
  isStudentPanel.value
    ? '筛选关键字：姓名/学号/班级/联系方式'
    : '筛选关键字：用户名/等级/联系'
))
const currentTotal = computed(() => isStudentPanel.value ? studentsTotal.value : adminsTotal.value)
const currentPageText = computed(() => isStudentPanel.value ? studentsPage.value : adminsPage.value)
const currentVisibleCount = computed(() => isStudentPanel.value ? studentsFiltered.value.length : adminsFiltered.value.length)
const bannedCount = computed(() => {
  const list = isStudentPanel.value ? studentsFiltered.value : adminsFiltered.value
  return list.filter(u => !!u.isBanned).length
})
const currentViewName = computed(() => isStudentPanel.value ? '用户管理' : '管理员管理')
const currentViewDesc = computed(() => (
  isStudentPanel.value
    ? '统一处理学生账号、禁报名状态和批量维护'
    : '统一维护管理员账号、等级和批量操作'
))

function formatDate(val) {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function formatRoleCn(role) {
  return role === 'ADMIN' ? '管理员' : '学生'
}

const levelMapCn = {
  SUPER_ADMIN: '超级管理员',
  SUPERVISOR: '主管老师',
  OWNER_PRIMARY: '第一负责人',
  OWNER_SECONDARY: '第二负责人',
  STAFF: '普通干事'
}
function formatLevelCn(level) {
  if (!level) return '—'
  return levelMapCn[level] || level
}

function formatDateOnly(val) {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
async function fetchStudents() {
  try {
    const [start, end] = Array.isArray(dateRange.value) && dateRange.value.length === 2
      ? [formatDateOnly(dateRange.value[0]), formatDateOnly(dateRange.value[1])]
      : ['', '']
    const { data } = await http.get('/admin/users', {
      params: {
        role: 'STUDENT',
        keyword: keyword.value.trim(),
        start,
        end,
        page: studentsPage.value,
        pageSize: studentsPageSize.value
      }
    })
    students.value = Array.isArray(data?.items) ? data.items : []
    studentsTotal.value = Number.isFinite(data?.total) ? data.total : students.value.length
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取用户列表失败')
  }
}
async function fetchAdmins() {
  try {
    const [start, end] = Array.isArray(dateRange.value) && dateRange.value.length === 2
      ? [formatDateOnly(dateRange.value[0]), formatDateOnly(dateRange.value[1])]
      : ['', '']
    const { data } = await http.get('/admin/users', {
      params: {
        role: 'ADMIN',
        adminLevel: adminLevelFilter.value || '',
        keyword: keyword.value.trim(),
        start,
        end,
        page: adminsPage.value,
        pageSize: adminsPageSize.value
      }
    })
    admins.value = Array.isArray(data?.items) ? data.items : []
    adminsTotal.value = Number.isFinite(data?.total) ? data.total : admins.value.length
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取管理员列表失败')
  }
}
async function fetchUsers() {
  loading.value = true
  try {
    await Promise.all([
      fetchStudents(),
      fetchAdmins()
    ])
  } finally {
    loading.value = false
  }
}
async function fetchMe() {
  try {
    const { data } = await http.get('/users/me')
    me.value = data || null
  } catch {}
}

onMounted(async () => {
  await fetchMe()
  await fetchUsers()
})

// 监听筛选条件变化，重置页码并刷新列表
watch([keyword, dateRange, adminLevelFilter], () => {
  studentsPage.value = 1
  adminsPage.value = 1
  fetchUsers()
})

// 禁报名/解除
async function banUser(id, days) {
  if (isStaff.value) return ElMessage.warning('普通干事无权禁报名用户')
  try {
    await http.post(`/admin/users/${id}/ban`, { days })
    ElMessage.success(`已禁报名 ${days} 天`)
    await fetchUsers()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '禁报名失败')
  }
}
async function unbanUser(id) {
  if (isStaff.value) return ElMessage.warning('普通干事无权解除禁报名')
  try {
    await http.post(`/admin/users/${id}/unban`, {})
    ElMessage.success('已解除禁报名')
    await fetchUsers()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '解除禁报名失败')
  }
}
</script>

<template>
  <div class="admin-page">
    <section class="admin-page-head">
      <div class="admin-page-head__main">
        <div class="admin-page-head__eyebrow">User Workspace</div>
        <div class="admin-page-head__title">{{ currentViewName }}</div>
        <p class="admin-page-head__desc">{{ currentViewDesc }}。顶部标题直接切换工作视图，减少上下滚动和来回定位。</p>
      </div>
      <div class="admin-page-head__side">
        <div class="admin-page-head__meta-label">当前视图总量</div>
        <div class="admin-page-head__meta-value">{{ currentTotal }}</div>
        <div class="admin-page-head__meta-note">当前第 {{ currentPageText }} 页，当前页展示 {{ currentVisibleCount }} 条</div>
      </div>
    </section>

    <section class="admin-metrics">
      <article class="admin-metric">
        <div class="admin-metric__label">学生总量</div>
        <div class="admin-metric__value">{{ studentsTotal }}</div>
        <div class="admin-metric__hint">普通用户账号总数</div>
      </article>
      <article class="admin-metric">
        <div class="admin-metric__label">管理员总量</div>
        <div class="admin-metric__value">{{ adminsTotal }}</div>
        <div class="admin-metric__hint">管理员账号总数</div>
      </article>
      <article class="admin-metric">
        <div class="admin-metric__label">当前页禁报名</div>
        <div class="admin-metric__value">{{ bannedCount }}</div>
        <div class="admin-metric__hint">当前视图页内处于禁报名状态的账号</div>
      </article>
      <article class="admin-metric">
        <div class="admin-metric__label">当前视图页码</div>
        <div class="admin-metric__value">{{ currentPageText }}</div>
        <div class="admin-metric__hint">支持分页切换，避免长列表下拉</div>
      </article>
    </section>

    <el-card class="admin-workspace-card">
      <template #header>
        <div class="admin-table-title">
          <div class="admin-table-title__main">
            <div class="title-switch">
            <span class="title-switch-item" :class="{ active: isStudentPanel }" @click="roleFilter = 'STUDENT'">用户管理</span>
            <span class="title-switch-item" :class="{ active: !isStudentPanel }" @click="roleFilter = 'ADMIN'">管理员管理</span>
          </div>
            <span class="admin-table-title__desc">同一张主卡片内切换不同账号视图，保持工具栏和表格区域稳定</span>
          </div>
          <div class="toolbar">
            <el-input v-model="keyword" :placeholder="currentKeywordPlaceholder" clearable style="width: 280px; margin-right: 8px;" />
            <template v-if="isStudentPanel">
              <el-button type="danger" plain @click="batchDelete('student')" :disabled="!selectedStudents.length">批量删除</el-button>
              <el-button type="primary" plain @click="openBatchUpdate('student')" :disabled="!selectedStudents.length">批量修改</el-button>
              <el-button type="warning" plain @click="openCreateStudent" style="margin-left: 8px;">创建用户</el-button>
              <el-button type="success" plain @click="exportXlsx('student')" :disabled="!studentsFiltered.length" style="margin-left: 8px;">
                <template #icon>
                  <svg class="excel-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M12 3a1 1 0 0 1 1 1v8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L11 12.586V4a1 1 0 0 1 1-1z"></path>
                    <path d="M4 18a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1z"></path>
                  </svg>
                </template>
                导出Excel
              </el-button>
            </template>
            <template v-else>
              <el-button type="danger" plain @click="batchDelete('admin')" :disabled="!selectedAdmins.length">批量删除</el-button>
              <el-button type="primary" plain @click="openBatchUpdate('admin')" :disabled="!selectedAdmins.length">批量修改</el-button>
              <el-button v-if="!isStaff" type="warning" plain @click="openCreateAdmin" style="margin-left: 8px;">创建管理员</el-button>
              <el-button type="success" plain @click="exportXlsx('admin')" :disabled="!adminsFiltered.length" style="margin-left: 8px;">
                <template #icon>
                  <svg class="excel-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M12 3a1 1 0 0 1 1 1v8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L11 12.586V4a1 1 0 0 1 1-1z"></path>
                    <path d="M4 18a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1z"></path>
                  </svg>
                </template>
                导出Excel
              </el-button>
            </template>
          </div>
        </div>
      </template>
      <el-skeleton :loading="loading" animated>
        <template #default>
          <div class="admin-toolbar-panel filter-panel">
            <div class="admin-toolbar-panel__row">
              <div class="admin-toolbar-panel__group">
                <span class="admin-toolbar-panel__label">筛选条件</span>
                <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 320px;" />
                <el-select v-if="!isStudentPanel" v-model="adminLevelFilter" placeholder="管理员等级" clearable style="width: 160px;">
                  <el-option v-for="opt in adminLevelOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </div>
              <div class="admin-toolbar-panel__group">
                <span class="admin-toolbar-panel__label">当前视图</span>
                <span class="toolbar-note">{{ currentViewName }}</span>
              </div>
            </div>
          </div>
          <div class="admin-table-shell">
          <template v-if="isStudentPanel">
            <el-table :data="studentsFiltered" size="small" stripe @selection-change="onStudentsSelectionChange">
              <el-table-column type="selection" width="48" />
              <el-table-column prop="studentId" label="学号" width="160" />
              <el-table-column prop="name" label="姓名" width="140" />
              <el-table-column prop="className" label="班级" min-width="280" show-overflow-tooltip />
              <el-table-column label="联系方式" width="160">
                <template #default="scope">{{ scope.row.contact || '—' }}</template>
              </el-table-column>
              <el-table-column label="密码（明文）" min-width="160">
                <template #default="scope">{{ scope.row.plainPassword || scope.row.password || '—' }}</template>
              </el-table-column>
              <el-table-column label="黑名单/禁至" min-width="220">
                <template #default="scope">
                  <div v-if="scope.row.isBanned">
                    <span class="tag-banned">禁至：{{ formatDate(scope.row.bannedUntil) || (scope.row.bannedUntil?.slice?.(0, 10) || '') }}</span>
                    <span style="margin-left: 8px; color: #999;">剩余：{{ scope.row.banRemainingDays }} 天</span>
                  </div>
                  <div v-else>—</div>
                </template>
              </el-table-column>
              <el-table-column label="禁报名操作" min-width="280">
                <template #default="scope">
                  <el-button size="small" type="danger" plain :disabled="isStaff" @click="banUser(scope.row.id, 7)">禁 7 天</el-button>
                  <el-button size="small" type="danger" plain :disabled="isStaff" @click="banUser(scope.row.id, 14)" style="margin-left: 8px;">禁 14 天</el-button>
                  <el-button size="small" type="danger" plain :disabled="isStaff" @click="banUser(scope.row.id, 28)" style="margin-left: 8px;">禁 28 天</el-button>
                  <el-button size="small" type="primary" plain :disabled="isStaff" @click="unbanUser(scope.row.id)" style="margin-left: 8px;">解除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
          <template v-else>
            <el-table :data="adminsFiltered" size="small" stripe :empty-text="'暂无管理员数据'" @selection-change="onAdminsSelectionChange">
              <el-table-column type="selection" width="48" />
              <el-table-column prop="role" label="角色" width="120" :formatter="(row) => formatRoleCn(row.role)" />
              <el-table-column prop="adminLevel" label="管理员等级" width="160" :formatter="(row) => formatLevelCn(row.adminLevel)" />
              <el-table-column prop="studentId" label="用户名" width="160" />
              <el-table-column label="密码（明文）" min-width="160">
                <template #default="scope">{{ scope.row.plainPassword || scope.row.password || '—' }}</template>
              </el-table-column>
              <el-table-column prop="createdAt" label="注册时间" width="180" :formatter="(row) => formatDate(row.createdAt)" />
              <el-table-column label="黑名单/禁至" min-width="220">
                <template #default="scope">
                  <div v-if="scope.row.isBanned">
                    <span class="tag-banned">禁至：{{ formatDate(scope.row.bannedUntil) || (scope.row.bannedUntil?.slice?.(0, 10) || '') }}</span>
                    <span style="margin-left: 8px; color: #999;">剩余：{{ scope.row.banRemainingDays }} 天</span>
                  </div>
                  <div v-else>—</div>
                </template>
              </el-table-column>
              <el-table-column label="禁报名操作" min-width="280">
                <template #default="scope">
                  <el-button size="small" type="danger" plain :disabled="isStaff" @click="banUser(scope.row.id, 7)">禁 7 天</el-button>
                  <el-button size="small" type="danger" plain :disabled="isStaff" @click="banUser(scope.row.id, 14)" style="margin-left: 8px;">禁 14 天</el-button>
                  <el-button size="small" type="danger" plain :disabled="isStaff" @click="banUser(scope.row.id, 28)" style="margin-left: 8px;">禁 28 天</el-button>
                  <el-button size="small" type="primary" plain :disabled="isStaff" @click="unbanUser(scope.row.id)" style="margin-left: 8px;">解除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
          </div>
        </template>
      </el-skeleton>
      <div class="table-footer">
        <template v-if="isStudentPanel">
          <el-pagination
            v-model:current-page="studentsPage"
            v-model:page-size="studentsPageSize"
            :page-sizes="[10,20,50,100]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="studentsTotal"
            @size-change="fetchStudents"
            @current-change="fetchStudents"
          />
        </template>
        <template v-else>
          <el-pagination
            v-model:current-page="adminsPage"
            v-model:page-size="adminsPageSize"
            :page-sizes="[10,20,50,100]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="adminsTotal"
            @size-change="fetchAdmins"
            @current-change="fetchAdmins"
          />
        </template>
      </div>
    </el-card>

    <!-- 批量修改弹窗 -->
    <el-dialog v-model="updateDialogVisible" title="批量修改" width="520px">
      <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
        <el-form label-width="96px">
          <el-form-item label="角色">
            <el-select v-model="updateForm.role" placeholder="不修改则留空" clearable style="width: 280px;">
              <el-option v-for="opt in roleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="updateContext === 'admin'" label="管理员等级">
            <el-select v-model="updateForm.adminLevel" placeholder="不修改则留空" clearable style="width: 280px;">
              <el-option v-for="opt in adminLevelOptionsFiltered" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="updateContext === 'student'" label="班级">
            <el-input v-model="updateForm.className" placeholder="不修改则留空" />
          </el-form-item>
          <el-form-item label="联系方式">
            <el-input v-model="updateForm.contact" placeholder="11位数字，不修改留空" />
          </el-form-item>
          <el-form-item label="新密码">
            <el-input v-model="updateForm.password" placeholder="6-12位数字或字母，不修改留空" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="updateDialogVisible = false">取消</el-button>
          <el-button type="primary" class="btn-sunset" @click="submitBatchUpdate">保存</el-button>
        </div>
      </template>
    </el-dialog>
    <!-- 创建学生用户弹窗 -->
    <el-dialog v-model="createStudentDialogVisible" title="创建用户" width="520px">
      <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
        <el-form label-width="96px">
          <el-form-item label="学号">
            <el-input v-model="createStudentForm.studentId" placeholder="12位数字" maxlength="12" />
          </el-form-item>
          <el-form-item label="姓名">
            <el-input v-model="createStudentForm.name" placeholder="中文姓名" />
          </el-form-item>
          <el-form-item label="班级">
            <el-autocomplete v-model="createStudentForm.className" clearable placeholder="如：物联网工程231班" :fetch-suggestions="queryStudentClassSuggestions" @select="onSelectStudentClass" />
          </el-form-item>
          <el-form-item label="联系方式">
            <el-input v-model="createStudentForm.contact" placeholder="11位手机号" maxlength="11" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="createStudentForm.password" type="password" show-password placeholder="6-12位数字或英文" maxlength="12" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createStudentDialogVisible = false">取消</el-button>
          <el-button type="primary" class="btn-sunset" @click="submitCreateStudent">创建</el-button>
        </div>
      </template>
    </el-dialog>
    <!-- 创建管理员弹窗 -->
    <el-dialog v-model="createDialogVisible" title="创建管理员" width="520px">
      <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
        <el-form label-width="96px">
          <el-form-item label="管理员等级">
            <el-select v-model="createForm.adminLevel" placeholder="请选择等级" style="width: 280px;">
              <el-option v-for="opt in adminLevelOptionsFiltered" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="createForm.studentId" placeholder="6-20位字母或数字" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="createForm.password" placeholder="6-12位数字或字母" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createDialogVisible = false">取消</el-button>
          <el-button type="primary" class="btn-sunset" @click="submitCreateAdmin">创建</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; }
.title-switch { display: flex; align-items: center; gap: 18px; }
.title-switch + .admin-table-title__desc { margin-top: 8px; }
.title-switch-item {
  position: relative;
  font-size: 20px;
  font-weight: 700;
  color: #6b7280;
  cursor: pointer;
  transition: color .18s ease;
}
.title-switch-item.active {
  background-image: linear-gradient(135deg, var(--sunset-start), var(--sunset-end));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 2px 12px rgba(253,186,116,0.24);
}
.title-switch-item.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -10px;
  height: 3px;
  border-radius: 999px;
  background-image: linear-gradient(90deg, var(--sunset-start), var(--sunset-end));
}
.excel-icon { color: inherit; margin-right: 4px; }
.tag-banned { color: #d03050; font-weight: 500; }
.table-footer { display: flex; justify-content: flex-end; padding: 8px 0; }
.filter-panel { margin-bottom: 14px; }
.toolbar-note { color: #64748b; font-size: 13px; }
</style>
