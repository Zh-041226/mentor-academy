<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import http from '../../api/http'
import { exportSheetAsXlsx } from '../../utils/xlsxExport'
import { getBackendBaseUrl, isRestrictedWebView } from '../../utils/config'

const loading = ref(false)
const items = ref([])
const summaryPage = ref(1)
const summaryPageSize = ref(10)
const summaryTotal = ref(0)
const filters = reactive({ keyword: '', category: '' })
const drawerVisible = ref(false)
const currentActivity = ref({ id: null, title: '' })
const regsLoading = ref(false)
const regs = ref([])
const regsStatusFilter = ref('')
const regsPage = ref(1)
const regsPageSize = ref(10)
const regsTotal = ref(0)
const totalRegistered = computed(() => items.value.reduce((sum, it) => sum + Number(it.registeredCount || 0), 0))
const limitedCount = computed(() => items.value.filter(it => Number(it.limit) > 0).length)
const currentRegsPending = computed(() => regs.value.filter(it => it.status === 'PENDING_CANCEL').length)

async function fetchSummary(resetPage = false) {
  if (resetPage) summaryPage.value = 1
  loading.value = true
  try {
    const { data } = await http.get('/admin/activities/summary', {
      params: {
        keyword: filters.keyword,
        category: filters.category,
        page: summaryPage.value,
        pageSize: summaryPageSize.value
      }
    })
    items.value = Array.isArray(data?.items) ? data.items : []
    summaryTotal.value = Number(data?.total || 0)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取报名汇总失败')
  } finally {
    loading.value = false
  }
}

function search() { fetchSummary(true) }

async function openRegs(it) {
  currentActivity.value = { id: it.id, title: it.title }
  regsStatusFilter.value = ''
  regsPage.value = 1
  await fetchRegs()
  drawerVisible.value = true
}

async function fetchRegs() {
  if (!currentActivity.value.id) return
  regsLoading.value = true
  try {
    const { data } = await http.get(`/admin/activities/${currentActivity.value.id}/registrations`, {
      params: {
        status: regsStatusFilter.value || undefined,
        page: regsPage.value,
        pageSize: regsPageSize.value
      }
    })
    regs.value = Array.isArray(data?.items) ? data.items : []
    regsTotal.value = Number(data?.total || 0)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取报名列表失败')
  } finally {
    regsLoading.value = false
  }
}

function handleSummaryPageChange(page) {
  summaryPage.value = page
  fetchSummary()
}

function handleSummaryPageSizeChange(size) {
  summaryPageSize.value = size
  summaryPage.value = 1
  fetchSummary()
}

function handleRegsPageChange(page) {
  regsPage.value = page
  fetchRegs()
}

function handleRegsPageSizeChange(size) {
  regsPageSize.value = size
  regsPage.value = 1
  fetchRegs()
}

function onRegsStatusChange() {
  regsPage.value = 1
  fetchRegs()
}

async function markAttendance(reg, type) {
  if (!currentActivity.value.id || !reg?.id) return
  try {
    if (type === 'attended') {
      await ElMessageBox.confirm(`确认将【${reg.name || ''}】标记为已签到？`, '签到确认', { type: 'warning' })
    } else {
      await ElMessageBox.confirm(`确认将【${reg.name || ''}】标记为未到？未到将触发禁报名惩罚。`, '未到确认', { type: 'warning' })
    }
  } catch { return }
  try {
    const body = type === 'attended' ? { attended: true } : { noShow: true }
    const { data } = await http.post(`/admin/activities/${currentActivity.value.id}/registrations/${reg.id}/attendance`, body)
    ElMessage.success(data?.message || (type === 'attended' ? '已标记签到' : '已标记未到并触发禁报名'))
    await fetchRegs()
    await fetchSummary()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '标记失败')
  }
}

async function review(reg, decision) {
  try {
    if (decision === 'approve') {
      await ElMessageBox.confirm('确认通过该用户的取消申请？通过后该名额将释放。', '审核确认', { type: 'warning' })
    } else {
      await ElMessageBox.confirm('确认驳回该用户的取消申请？驳回后该用户仍占用名额。', '审核确认', { type: 'warning' })
    }
  } catch { return }
  try {
    await http.post(`/admin/activities/${currentActivity.value.id}/registrations/review`, { registrationId: reg.id, decision })
    ElMessage.success(decision === 'approve' ? '已通过取消申请' : '已驳回取消申请')
    await fetchSummary()
    await fetchRegs()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '审核失败')
  }
}

async function exportRegistered(it) {
  try {
    // 手机端优先使用后端直接导出的 CSV 接口（避免浏览器不支持前端生成并下载 Blob 文件）
    if (isRestrictedWebView() || window.innerWidth <= 768) {
      const backendBase = getBackendBaseUrl() || ''
      const token = localStorage.getItem('token') || ''
      if (!token) {
        ElMessage.error('登录状态已失效，请重新登录后导出')
        return
      }
      const apiUrl = `${backendBase}/api/admin/activities/${it.id}/registrations/export?token=${encodeURIComponent(token)}&status=REGISTERED&_t=${Date.now()}`
      console.info('[admin registrations] mobile export start', { activityId: it.id, apiUrl })
      const link = document.createElement('a')
      link.href = apiUrl
      link.rel = 'noopener'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        try { document.body.removeChild(link) } catch {}
      }, 800)
      return
    }

    // PC 端保留原有的前端 XLSX 生成
    const { data } = await http.get(`/admin/activities/${it.id}/registrations`, { params: { status: 'REGISTERED', page: 1, pageSize: 10000 } })
    const list = Array.isArray(data?.items) ? data.items : []
    const safeTitle = String(it.title || '活动报名').replace(/[\\/:*?"<>|]/g, '').trim() || '活动报名'
    await exportSheetAsXlsx({
      sheetName: '报名名单',
      headers: ['活动名称', '学号', '姓名', '班级', '联系方式'],
      rows: list.map((r) => [
        it.title || '',
        r.studentId || '',
        r.name || '',
        r.className || '',
        r.contact || '',
      ]),
      colWidths: [28, 16, 14, 18, 20],
      fileName: `${safeTitle}_报名名单.xlsx`,
    })
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '导出失败')
  }
}

onMounted(fetchSummary)
</script>

<template>
  <div class="admin-page">
    <section class="admin-page-head">
      <div class="admin-page-head__main">
        <div class="admin-page-head__eyebrow">Registration Workspace</div>
        <div class="admin-page-head__title">活动报名管理</div>
        <p class="admin-page-head__desc">在一个工作区里处理活动报名汇总、取消审核、签到标记和导出，适合持续增长后的高频运营场景。</p>
      </div>
      <div class="admin-page-head__side">
        <div class="admin-page-head__meta-label">当前汇总</div>
        <div class="admin-page-head__meta-value">{{ summaryTotal }}</div>
        <div class="admin-page-head__meta-note">共 {{ summaryTotal }} 个活动汇总，当前第 {{ summaryPage }} 页</div>
      </div>
    </section>

    <section class="admin-metrics">
      <article class="admin-metric">
        <div class="admin-metric__label">汇总活动数</div>
        <div class="admin-metric__value">{{ summaryTotal }}</div>
        <div class="admin-metric__hint">当前筛选条件下的活动总数</div>
      </article>
      <article class="admin-metric">
        <div class="admin-metric__label">当前页报名人次</div>
        <div class="admin-metric__value">{{ totalRegistered }}</div>
        <div class="admin-metric__hint">当前页活动的累计报名占用</div>
      </article>
      <article class="admin-metric">
        <div class="admin-metric__label">当前页有限额活动</div>
        <div class="admin-metric__value">{{ limitedCount }}</div>
        <div class="admin-metric__hint">设置了人数上限的活动数量</div>
      </article>
      <article class="admin-metric">
        <div class="admin-metric__label">抽屉待审核</div>
        <div class="admin-metric__value">{{ currentRegsPending }}</div>
        <div class="admin-metric__hint">当前报名详情中的待审核取消</div>
      </article>
    </section>

    <section class="admin-toolbar-panel">
      <div class="admin-toolbar-panel__row">
        <div class="admin-toolbar-panel__group">
          <span class="admin-toolbar-panel__label">快速筛选</span>
          <el-input v-model="filters.keyword" placeholder="按活动名称/类别搜索" clearable style="width: 240px" v-enter="search" />
          <el-input v-model="filters.category" placeholder="按类别筛选" clearable style="width: 180px" v-enter="search" />
          <el-button type="primary" class="btn-sunset" @click="search">搜索</el-button>
        </div>
        <div class="admin-toolbar-panel__group">
          <span class="admin-toolbar-panel__label">当前工作流</span>
          <span class="toolbar-tip">查看报名、审核取消和签到标记都在当前页完成</span>
        </div>
      </div>
    </section>

    <el-card class="admin-workspace-card">
      <template #header>
        <div class="admin-table-title">
          <div class="admin-table-title__main">
            <span class="admin-table-title__label">报名汇总列表</span>
            <span class="admin-table-title__desc">优先在这里筛出目标活动，再进入右侧报名详情抽屉继续处理</span>
          </div>
        </div>
      </template>
      <el-skeleton :loading="loading" animated>
        <template #default>
          <div class="admin-table-shell">
            <el-table :data="items" border style="width: 100%">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="category" label="活动类型" width="140" />
              <el-table-column prop="title" label="活动名称" min-width="200" />
              <el-table-column label="已报名/上限" width="160">
                <template #default="scope">
                  {{ Number(scope.row.registeredCount)||0 }} / {{ Number(scope.row.limit)>0?scope.row.limit:'不限' }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="260" fixed="right">
                <template #default="scope">
                  <el-button size="small" type="primary" class="btn-view" @click="openRegs(scope.row)">查看报名</el-button>
                  <el-button size="small" type="success" class="btn-premium" plain @click="exportRegistered(scope.row)">导出报名Excel</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <el-empty v-if="!items.length" description="暂无活动数据" />
          <div class="table-footer">
            <el-pagination
              v-model:current-page="summaryPage"
              v-model:page-size="summaryPageSize"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              :total="summaryTotal"
              @size-change="handleSummaryPageSizeChange"
              @current-change="handleSummaryPageChange"
            />
          </div>
        </template>
      </el-skeleton>
    </el-card>

    <el-drawer
      v-model="drawerVisible"
      :with-header="true"
      size="100%"
      class="full-screen-regs-drawer"
      :title="`报名详情 · ${currentActivity.title || ''}`"
    >
      <div class="drawer-toolbar">
        <span class="admin-toolbar-panel__label">状态筛选</span>
        <el-select v-model="regsStatusFilter" placeholder="全部" clearable style="width: 200px" @change="onRegsStatusChange">
          <el-option label="全部" value="" />
          <el-option label="已报名" value="REGISTERED" />
          <el-option label="待审核" value="PENDING_CANCEL" />
          <el-option label="已取消" value="CANCELED" />
        </el-select>
      </div>
      <el-skeleton :loading="regsLoading" animated>
        <template #default>
          <div class="admin-table-shell">
            <el-table :data="regs" border style="width: 100%">
              <el-table-column prop="studentId" label="学号" width="140" />
              <el-table-column prop="name" label="姓名" width="140" />
              <el-table-column prop="className" label="班级" width="160" />
              <el-table-column prop="contact" label="联系方式" width="160" />
              <el-table-column prop="status" label="状态" width="120">
                <template #default="scope">
                  <el-tag v-if="scope.row.status==='REGISTERED'" type="success">已报名</el-tag>
                  <el-tag v-else-if="scope.row.status==='PENDING_CANCEL'" type="warning">待审核</el-tag>
                  <el-tag v-else type="info">已取消</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="到场状态" width="160">
                <template #default="scope">
                  <el-tag v-if="scope.row.attended" type="success">已签到</el-tag>
                  <el-tag v-else-if="scope.row.noShow" type="danger">未到</el-tag>
                  <el-tag v-else type="info">未标记</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="markedAt" label="标记时间" width="180">
                <template #default="scope">
                  <span v-if="scope.row.markedAt">{{ new Date(scope.row.markedAt).toLocaleString() }}</span>
                  <span v-else style="color:#bbb">—</span>
                </template>
              </el-table-column>
              <el-table-column prop="reason" label="取消事由" min-width="240" show-overflow-tooltip>
                <template #default="scope">
                  <span v-if="scope.row.reason">{{ scope.row.reason }}</span>
                  <span v-else style="color:#bbb">—</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="380" fixed="right">
                <template #default="scope">
                  <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <el-button v-if="scope.row.status==='PENDING_CANCEL'" size="small" type="primary" class="btn-sunset" @click="review(scope.row, 'approve')">通过</el-button>
                    <el-button v-if="scope.row.status==='PENDING_CANCEL'" size="small" type="danger" plain @click="review(scope.row, 'reject')">驳回</el-button>
                    <el-button v-if="scope.row.status==='REGISTERED' && !scope.row.attended && !scope.row.noShow" size="small" type="success" class="btn-premium" @click="markAttendance(scope.row, 'attended')">签到</el-button>
                    <el-button v-if="scope.row.status==='REGISTERED' && !scope.row.attended && !scope.row.noShow" size="small" type="danger" plain @click="markAttendance(scope.row, 'noShow')">未到</el-button>
                    <span v-if="scope.row.status!=='PENDING_CANCEL' && (scope.row.attended || scope.row.noShow)" style="color:#bbb">—</span>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <el-empty v-if="!regs.length" description="暂无报名数据" />
          <div class="table-footer">
            <el-pagination
              v-model:current-page="regsPage"
              v-model:page-size="regsPageSize"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              :total="regsTotal"
              @size-change="handleRegsPageSizeChange"
              @current-change="handleRegsPageChange"
            />
          </div>
        </template>
      </el-skeleton>
    </el-drawer>
  </div>
  
</template>

<style scoped>
.table-footer { display:flex; justify-content:flex-end; margin-top:16px; }
.toolbar-tip { color: #64748b; font-size: 13px; }
.drawer-toolbar { margin-bottom: 12px; display:flex; gap:8px; align-items:center; }
:deep(.full-screen-regs-drawer) {
  width: 100vw !important;
  max-width: 100vw !important;
}
:deep(.full-screen-regs-drawer .el-drawer__header) {
  margin-bottom: 0;
  padding: 20px 24px 12px;
}
:deep(.full-screen-regs-drawer .el-drawer__body) {
  padding: 16px 24px 20px;
  overflow: auto;
}
</style>
