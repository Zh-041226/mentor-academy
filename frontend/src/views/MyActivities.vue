<script setup>
import { ref, onMounted, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import http from '../api/http'
import { getUploadsFullUrl } from '../utils/config'

const route = useRoute()
const router = useRouter()
const tab = ref('registered')
const loading = ref(false)
const registered = ref([])
const upcoming = ref([])
const history = ref([])
const pager = reactive({
  registered: { page: 1, pageSize: 10, total: 0 },
  upcoming: { page: 1, pageSize: 10, total: 0 },
  history: { page: 1, pageSize: 10, total: 0 }
})

const cancelDialogVisible = ref(false)
const cancelReason = ref('')
const cancelTargetId = ref(null)
const cancelSubmitting = ref(false)

function setTabItems(name, items) {
  if (name === 'registered') registered.value = items
  else if (name === 'upcoming') upcoming.value = items
  else history.value = items
}

async function fetchMine(name = tab.value) {
  const currentPager = pager[name]
  if (!currentPager) return
  loading.value = true
  try {
    const { data } = await http.get('/users/me/registrations', {
      params: {
        tab: name,
        page: currentPager.page,
        pageSize: currentPager.pageSize
      }
    })
    setTabItems(name, Array.isArray(data?.items) ? data.items : [])
    currentPager.total = Number(data?.total || 0)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取我的活动失败')
  } finally {
    loading.value = false
  }
}

function handlePageChange(name, page) {
  pager[name].page = page
  fetchMine(name)
}

function handlePageSizeChange(name, size) {
  pager[name].pageSize = size
  pager[name].page = 1
  fetchMine(name)
}

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
    tab.value = 'registered'
    await fetchMine('registered')
  } catch (e) {
    const msg = e?.response?.data?.message || '取消失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    cancelSubmitting.value = false
  }
}

function syncTabFromRoute() {
  const nextTab = typeof route.query.tab === 'string' ? route.query.tab : ''
  if (['registered', 'upcoming', 'history'].includes(nextTab) && tab.value !== nextTab) {
    tab.value = nextTab
  }
}

watch(tab, (name) => {
  router.replace({ query: { ...route.query, tab: name } })
  fetchMine(name)
})

watch(() => route.query.tab, () => {
  syncTabFromRoute()
})

onMounted(() => {
  syncTabFromRoute()
  fetchMine(tab.value)
})

// 将后端 /uploads 相对路径转换为完整可预览 URL
// 已移至 utils/config.js 统一管理
</script>

<template>
  <div class="my-activities-page">
    <el-card>
      <template #header>
        <div class="card-header"><span>我的活动</span></div>
      </template>

      <el-tabs v-model="tab">
        <el-tab-pane label="已报名" name="registered">
          <el-empty v-if="!registered.length" description="暂无数据" />
          <div v-else>
            <div v-for="it in registered" :key="it.id" class="item" style="cursor: pointer" @click="router.push(`/activities/${it.id}`)">
              <el-image
                v-if="it.posterUrl"
                :src="getUploadsFullUrl(it.posterUrl)"
                :preview-src-list="[getUploadsFullUrl(it.posterUrl)]"
                :preview-teleported="true"
                @click.stop
                class="poster"
                lazy
              />
              <div class="left">
                <div class="title">{{ it.title || '未命名活动' }}</div>
                <div class="meta-row">
                  <span class="meta-pill"><span class="meta-pill__label">导师</span><span class="meta-pill__value">{{ it.mentorName || '待定' }}</span></span>
                  <span class="meta-pill"><span class="meta-pill__label">时间</span><span class="meta-pill__value">{{ it.timeText || '待定' }}</span></span>
                  <span class="meta-pill"><span class="meta-pill__label">地点</span><span class="meta-pill__value">{{ it.place || '待定' }}</span></span>
                </div>
                <div class="reason subtle">
                  {{ it.status === 'PENDING_CANCEL' ? '当前状态：取消申请已提交，正在等待管理员审核。' : '当前状态：报名成功，请按时参加活动。' }}
                </div>
              </div>
              <div class="right">
                <el-tag :type="it.status === 'PENDING_CANCEL' ? 'warning' : 'success'" effect="light">
                  {{ it.status === 'PENDING_CANCEL' ? '待审核' : '已报名' }}
                </el-tag>
                <div style="display: flex; gap: 8px;">
                  <el-button v-if="it.status !== 'PENDING_CANCEL'" type="success" size="small" plain @click.stop="router.push(`/activities/${it.id}`)">扫码进群</el-button>
                  <el-button type="danger" size="small" :disabled="it.status==='PENDING_CANCEL'" @click.stop="openCancel(it.id)">取消报名</el-button>
                </div>
              </div>
            </div>
            <div class="pager-row">
              <el-pagination
                v-model:current-page="pager.registered.page"
                v-model:page-size="pager.registered.pageSize"
                :page-sizes="[10, 20, 50]"
                layout="total, sizes, prev, pager, next, jumper"
                :total="pager.registered.total"
                @current-change="(page) => handlePageChange('registered', page)"
                @size-change="(size) => handlePageSizeChange('registered', size)"
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="待参加" name="upcoming">
          <el-empty v-if="!upcoming.length" description="暂无数据" />
          <div v-else>
            <div v-for="it in upcoming" :key="it.id" class="item" style="cursor: pointer" @click="router.push(`/activities/${it.id}`)">
              <el-image
                v-if="it.posterUrl"
                :src="getUploadsFullUrl(it.posterUrl)"
                :preview-src-list="[getUploadsFullUrl(it.posterUrl)]"
                :preview-teleported="true"
                @click.stop
                class="poster"
                lazy
              />
              <div class="left">
                <div class="title">{{ it.title || '未命名活动' }}</div>
                <div class="meta-row">
                  <span class="meta-pill"><span class="meta-pill__label">导师</span><span class="meta-pill__value">{{ it.mentorName || '待定' }}</span></span>
                  <span class="meta-pill"><span class="meta-pill__label">时间</span><span class="meta-pill__value">{{ it.timeText || '待定' }}</span></span>
                  <span class="meta-pill"><span class="meta-pill__label">地点</span><span class="meta-pill__value">{{ it.place || '待定' }}</span></span>
                </div>
                <div class="reason subtle">当前状态：即将参加，请留意活动开始时间与通知。</div>
              </div>
              <div class="right">
                <el-tag type="primary" effect="light">待参加</el-tag>
                <el-button type="success" size="small" plain @click.stop="router.push(`/activities/${it.id}`)">扫码进群</el-button>
              </div>
            </div>
            <div class="pager-row">
              <el-pagination
                v-model:current-page="pager.upcoming.page"
                v-model:page-size="pager.upcoming.pageSize"
                :page-sizes="[10, 20, 50]"
                layout="total, sizes, prev, pager, next, jumper"
                :total="pager.upcoming.total"
                @current-change="(page) => handlePageChange('upcoming', page)"
                @size-change="(size) => handlePageSizeChange('upcoming', size)"
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="历史" name="history">
          <el-empty v-if="!history.length" description="暂无数据" />
          <div v-else>
            <div v-for="it in history" :key="it.id" class="item" style="cursor: pointer" @click="router.push(`/activities/${it.id}`)">
              <el-image
                v-if="it.posterUrl"
                :src="getUploadsFullUrl(it.posterUrl)"
                :preview-src-list="[getUploadsFullUrl(it.posterUrl)]"
                :preview-teleported="true"
                @click.stop
                class="poster"
                lazy
              />
              <div class="left">
                <div class="title">{{ it.title || '未命名活动' }}</div>
                <div class="meta-row">
                  <span class="meta-pill"><span class="meta-pill__label">导师</span><span class="meta-pill__value">{{ it.mentorName || '待定' }}</span></span>
                  <span class="meta-pill"><span class="meta-pill__label">时间</span><span class="meta-pill__value">{{ it.timeText || '待定' }}</span></span>
                  <span class="meta-pill"><span class="meta-pill__label">地点</span><span class="meta-pill__value">{{ it.place || '待定' }}</span></span>
                </div>
                <div class="reason">{{ it.reason ? `取消事由：${it.reason}` : '取消事由：未填写' }}</div>
              </div>
              <div class="right">
                <el-tag type="info" effect="light">历史</el-tag>
                <div class="history-time" style="text-align: right">{{ it.canceledAt ? `取消于 ${String(it.canceledAt).slice(0, 10)}` : '已归档' }}</div>
              </div>
            </div>
            <div class="pager-row">
              <el-pagination
                v-model:current-page="pager.history.page"
                v-model:page-size="pager.history.pageSize"
                :page-sizes="[10, 20, 50]"
                layout="total, sizes, prev, pager, next, jumper"
                :total="pager.history.total"
                @current-change="(page) => handlePageChange('history', page)"
                @size-change="(size) => handlePageSizeChange('history', size)"
              />
            </div>
          </div>
        </el-tab-pane>
  </el-tabs>
    </el-card>

    <!-- 二次提醒：未到场处罚说明 -->
    <el-alert
      title="提醒"
      type="warning"
      :closable="false"
      show-icon
      class="bottom-reminder"
      description="如果在报名后无故不参加活动，将对用户账号进行14日封禁的处罚"
    />

    <el-dialog v-model="cancelDialogVisible" title="取消报名" width="520px">
      <div class="cancel-label">请填写取消事由（5-200字）：</div>
      <el-input
        v-model="cancelReason"
        type="textarea"
        :maxlength="200"
        show-word-limit
        :rows="5"
        placeholder="如：课程冲突，无法准时参加"
      />
      <div class="cancel-hint">提示：三日内连续取消报名三次，15日内不能报名参加任何活动。</div>
      <template #footer>
        <el-button :disabled="cancelSubmitting" @click="cancelDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="cancelSubmitting" @click="submitCancel">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.my-activities-page {
  max-width: 960px;
  margin: 24px auto;
}

.card-header { font-weight: 600; }
.item {
  display: grid;
  grid-template-columns: 136px minmax(0, 1fr) 132px;
  align-items: start;
  gap: 16px;
  padding: 18px 0;
  border-bottom: 1px solid #eee;
}
.poster {
  width: 136px;
  height: 96px;
  border-radius: 14px;
  border: 1px solid #eee;
  background: #fff;
}
.poster :deep(.el-image__inner) {
  object-fit: cover;
  height: 100%;
}
.left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.title {
  font-size: 18px;
  line-height: 1.4;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.meta-pill {
  min-width: 0;
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.16);
}
.meta-pill__label {
  flex: 0 0 auto;
  font-size: 12px;
  color: #94a3b8;
}
.meta-pill__value {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 13px;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.reason {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 13px;
  line-height: 1.5;
  color: #7c2d12;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.reason.subtle {
  color: #475569;
}
.right {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding-top: 2px;
}
.history-time {
  font-size: 12px;
  line-height: 1.5;
  color: #94a3b8;
}
.pager-row { display: flex; justify-content: flex-end; margin-top: 16px; }
.cancel-label { margin-bottom: 8px; font-weight: 500; }
.cancel-hint { margin-top: 8px; color: #f59e0b; font-size: 13px; }
.bottom-reminder { margin-top: 16px; }

@media (max-width: 900px) {
  .item {
    grid-template-columns: 1fr;
  }

  .poster {
    width: 100%;
    height: auto;
    display: block;
  }
  
  .poster :deep(.el-image__inner) {
    height: auto;
    object-fit: cover;
  }

  .meta-row {
    flex-direction: column;
    align-items: stretch;
  }

  .right {
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {
  .my-activities-page {
    margin: 12px auto;
    padding-bottom: 96px;
  }

  .title {
    font-size: 16px;
    white-space: normal;
  }

  .pager-row {
    justify-content: center;
  }

  .pager-row :deep(.el-pagination) {
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
