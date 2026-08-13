<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import http from '../api/http'
import HomeHeroCarousel from '../components/HomeHeroCarousel.vue'
import Timeline from '../components/Timeline.vue'
import { Search } from '@element-plus/icons-vue'
import { getUploadsFullUrl, getThumbUrl } from '../utils/config'
import { useMobile } from '../composables/useMobile'

const router = useRouter()
const route = useRoute()
const { isMobile } = useMobile()
const loading = ref(false)
const keyword = ref('')
const items = ref([])
// 智能筛选/分类
const selectedCategories = ref([])
const onlyAvailable = ref(false)
const sortKey = ref('default') // default|time|popular
// 智能搜索：支持同义词（简单版）
const synonyms = {
  '崇德讲堂': ['讲堂', '讲座', '讲学'],
  '朋辈导师': ['朋辈', '导师', 'mentor'],
  '晨曦晨读': ['晨读', '早读'],
  '其他': ['其他', '其它'],
}
const CATEGORY_TONE_MAP = {
  '崇德讲堂': 'sunset',
  '朋辈导师': 'amber',
  '晨曦晨读': 'apricot',
  '其他': 'cocoa',
}
const CATEGORY_TONE_FALLBACKS = ['sunset', 'amber', 'apricot', 'coral', 'peach', 'cocoa', 'rose', 'bronze']
const registeringId = ref(null)
const isLoggedIn = ref(!!localStorage.getItem('token'))
// 当前用户对各活动的报名状态：{ [activityId]: 'REGISTERED' | 'PENDING_CANCEL' }
const myRegStatuses = ref({})
const cancelDialogVisible = ref(false)
const cancelReason = ref('')
const cancelId = ref(null)
const actionLoading = ref(false)
const ACTIVITY_PAGE_SIZE = 5
const REVIEW_PAGE_SIZE = 5
const activityPage = ref(1)
const reviewPage = ref(1)

// 自定义原图预览：点击海报后在页面正中央显示原图
const previewVisible = ref(false)
const previewSrc = ref('')
function openImage(src) {
  previewSrc.value = src
  previewVisible.value = true
}
function closePreview() {
  previewVisible.value = false
}

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
function formatDate(d) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    const y = dt.getFullYear()
    const m = pad(dt.getMonth() + 1)
    const day = pad(dt.getDate())
    return `${y}-${m}-${day}`
  } catch { return '' }
}
function formatTime(d) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    const h = pad(dt.getHours())
    const min = pad(dt.getMinutes())
    return `${h}:${min}`
  } catch { return '' }
}

function sliceByPage(list, page, pageSize) {
  const safePage = Math.max(1, Number(page) || 1)
  const safeSize = Math.max(1, Number(pageSize) || 1)
  const start = (safePage - 1) * safeSize
  return list.slice(start, start + safeSize)
}

function getCategoryLabel(category) {
  return category || '其他'
}

function getCategoryTone(category) {
  const label = getCategoryLabel(category)
  if (CATEGORY_TONE_MAP[label]) return CATEGORY_TONE_MAP[label]
  const hash = [...label].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return CATEGORY_TONE_FALLBACKS[hash % CATEGORY_TONE_FALLBACKS.length]
}

// 把后端 /uploads 相对路径转换为完整可预览 URL
// 已移至 utils/config.js 统一管理

// （旧）顶部横幅背景已替换为全屏轮播模块

async function fetchList() {
  loading.value = true
  try {
    const { data } = await http.get('/activities', { params: { keyword: keyword.value } })
    const raw = Array.isArray(data?.items) ? data.items.map(it => ({
      id: it.id,
      category: it.category || '',
      title: it.title || '',
      mentorName: it.mentorName || '',
      startAt: it.startAt || null,
      timeText: it.timeText || '',
      place: it.place || '',
      limit: Number(it.limit ?? 0),
      registerDeadline: it.registerDeadline || null,
      status: it.status || 'PUBLISHED',
      posterUrl: it.posterUrl || '',
      promoLinkUrl: it.promoLinkUrl || '',
      promoImageUrl: it.promoImageUrl || '',
      registeredCount: Number(it.registeredCount ?? 0)
    })) : []
    // 隐藏/删除指定活动（ID=2）
    items.value = raw.filter(it => Number(it.id) !== 2)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取活动失败')
  } finally {
    loading.value = false
  }
}

function search() { fetchList() }
function openDetail(id) {
  const realId = String(id).split('_clone_')[0]
  router.push(`/activities/${realId}`)
}

function isFull(it) {
  const lim = Number(it.limit || 0)
  const reg = Number(it.registeredCount || 0)
  return lim > 0 && reg >= lim
}
function isDeadline(it) {
  const dl = it.registerDeadline ? new Date(it.registerDeadline) : null
  return !!(dl && Date.now() > dl.getTime())
}
function actionLabel(it) {
  if (isRegistered(it)) {
    const status = regStatus(it)
    if (status === 'PENDING_CANCEL') return '取消待审'
    return '已报名'
  }
  if (String(it.status || '').toUpperCase() === 'CLOSED') return '报名已关闭'
  if (isDeadline(it)) return '报名截止'
  if (isFull(it)) return '名额已满'
  return '立即报名'
}
function getStatusTag(item) {
  if (item.startAt && new Date(item.startAt).getTime() < Date.now()) {
    return { text: '已结束', type: 'info' }
  }
  const limit = Number(item.limit || 0)
  const registered = Number(item.registeredCount || 0)
  if (limit <= 0) return { text: '名额充足', type: 'success' }
  const current = Math.max(registered, 0)
  if (current >= limit) return { text: '名额已满', type: 'danger' }
  return { text: `余量：${limit - current}`, type: 'warning' }
}

function canRegister(it) { 
  if (isRegistered(it)) return false
  return String(it.status || '').toUpperCase() !== 'CLOSED' && actionLabel(it) === '立即报名' 
}

function isRegistered(it) {
  try { return !!myRegStatuses.value[String(it.id)] } catch { return false }
}
function regStatus(it) {
  try { return myRegStatuses.value[String(it.id)] || '' } catch { return '' }
}

// 分类集合（用于渲染筛选）
const categoryOptions = computed(() => {
  const set = new Set()
  items.value.forEach(it => { if (it.category) set.add(it.category) })
  // 预设类型优先展示，同时保留后端自定义类型
  const presets = ['崇德讲堂', '朋辈导师', '晨曦晨读', '其他']
  const result = [...presets.filter(p => set.has(p)), ...[...set].filter(x => !presets.includes(x))]
  return result
})

// 智能搜索匹配：标题/导师 + 同义词匹配类别
function matchKeyword(it, kw) {
  if (!kw) return true
  const k = kw.trim().toLowerCase()
  if (!k) return true
  const title = (it.title || '').toLowerCase()
  const mentor = (it.mentorName || '').toLowerCase()
  if (title.includes(k) || mentor.includes(k)) return true
  // 同义词匹配类别
  for (const [cat, arr] of Object.entries(synonyms)) {
    if (cat.toLowerCase().includes(k)) { if ((it.category || '') === cat) return true }
    const ok = arr.some(w => w.toLowerCase().includes(k))
    if (ok && (it.category || '') === cat) return true
  }
  return false
}

// 是否满足“可报名”筛选
function availableFilter(it) {
  if (!onlyAvailable.value) return true
  return canRegister(it)
}

// 分类筛选
function categoryFilter(it) {
  if (!selectedCategories.value || selectedCategories.value.length === 0) return true
  return selectedCategories.value.includes(it.category || '')
}

// 综合排序：时间优先 or 热度优先 or 默认（后端顺序）
function sortItems(list) {
  const key = sortKey.value
  const arr = [...list]
  if (key === 'time') {
    arr.sort((a,b) => {
      const ta = a.startAt ? new Date(a.startAt).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.startAt ? new Date(b.startAt).getTime() : Number.MAX_SAFE_INTEGER
      return ta - tb
    })
  } else if (key === 'popular') {
    arr.sort((a,b) => (Number(b.registeredCount||0) - Number(a.registeredCount||0)))
  }
  return arr
}

// 过滤后的展示列表
const displayItems = computed(() => {
  const kw = keyword.value
  const filtered = items.value.filter(it => matchKeyword(it, kw)).filter(availableFilter).filter(categoryFilter)
  return sortItems(filtered)
})

const displayItemsTotal = computed(() => displayItems.value.length)
const pagedDisplayItems = computed(() => sliceByPage(displayItems.value, activityPage.value, ACTIVITY_PAGE_SIZE))
const availableItemsTotal = computed(() => items.value.filter(it => canRegister(it)).length)
const activeCategoryText = computed(() => {
  if (!selectedCategories.value.length) return '全部类型'
  return selectedCategories.value.join(' / ')
})
const quickCategoryOptions = computed(() => categoryOptions.value.slice(0, 4))

function handleActivityPageChange(page) {
  activityPage.value = page
}

// 智能推荐：基于“过往参加的活动类型”进行偏好加权（取消收藏权重）
// 智能推荐（合并）：近期热门活动 + 往期回顾（用户曾参加的、且有推文）最多 5 条
const myRegCats = ref(new Set())
function updateMyRegCatsFromStatuses() {
  const cats = new Set()
  items.value.forEach(it => { if (isRegistered(it) && it.category) cats.add(it.category) })
  myRegCats.value = cats
}

const recommendedUpcoming = computed(() => {
  const prefs = new Set([...myRegCats.value])
  const now = Date.now()
  const base = items.value.filter(it => canRegister(it))
  const scored = base.map(it => {
    let score = 0
    score += Math.min(20, Number(it.registeredCount || 0))
    if (it.startAt) {
      const dt = new Date(it.startAt).getTime()
      const days = Math.max(0, (dt - now) / (24 * 3600 * 1000))
      score += Math.max(0, 20 - days)
    }
    if (prefs.has(it.category || '')) score += 35
    return { it, score }
  })
  return scored.sort((a,b) => b.score - a.score).map(x => x.it)
})

const pastReviewItems = computed(() => {
  const now = Date.now()
  return items.value
    // 放宽条件：只要有推文链接或宣传图片即可纳入“往期回顾”
    .filter(it => !!it.promoLinkUrl || !!it.promoImageUrl)
    .filter(it => !it.startAt || new Date(it.startAt).getTime() <= now) // 有开始时间则要求已过期，无开始时间也允许作为回顾
    .sort((a,b) => {
      const ta = a.startAt ? new Date(a.startAt).getTime() : 0
      const tb = b.startAt ? new Date(b.startAt).getTime() : 0
      return tb - ta // 时间晚的排前
    })
})

const reviewItemsTotal = computed(() => pastReviewItems.value.length)
const pagedPastReviewItems = computed(() => sliceByPage(pastReviewItems.value, reviewPage.value, REVIEW_PAGE_SIZE))

function handleReviewPageChange(page) {
  reviewPage.value = page
}

const myReviewItems = computed(() => {
  const set = myRegStatuses.value || {}
  return pastReviewItems.value.filter(it => !!set[String(it.id)])
})

// 远端推荐（后端计算，最多5：3个可报名活动 + 2个推文）
const recommendedRemote = ref([])
async function fetchRecommendations() {
  try {
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const { data } = await http.get('/activities/recommendations', { headers })
    const list = Array.isArray(data?.items) ? data.items : []
    recommendedRemote.value = list
  } catch (e) {
    // 远端失败不影响本地兜底
    recommendedRemote.value = []
  }
}

const recommendedCombined = computed(() => {
  // 优先使用后端推荐结果；若空则使用本地兜底逻辑
  if (recommendedRemote.value && recommendedRemote.value.length) {
    return recommendedRemote.value
  }
  const result = []
  let upcomingIndex = 0
  let reviewIndex = 0
  const maxItems = 40

  const upcomingList = [...recommendedUpcoming.value]
  
  // 混合所有的往期回顾，并去重
  const mixedReviews = [...myReviewItems.value]
  for (const it of pastReviewItems.value) {
    if (!mixedReviews.find(x => x.id === it.id)) {
      mixedReviews.push(it)
    }
  }

  // 严格执行 2:1 比例穿插
  while (result.length < maxItems && (upcomingIndex < upcomingList.length || reviewIndex < mixedReviews.length)) {
    if (upcomingIndex < upcomingList.length) result.push({ kind: 'UPCOMING', it: upcomingList[upcomingIndex++] })
    if (upcomingIndex < upcomingList.length && result.length < maxItems) result.push({ kind: 'UPCOMING', it: upcomingList[upcomingIndex++] })
    
    if (reviewIndex < mixedReviews.length && result.length < maxItems) result.push({ kind: 'REVIEW', it: mixedReviews[reviewIndex++] })
  }

  return result
})

// 时间轴数据：展示全部有开始时间的活动，并将 posterUrl 转为完整地址
const timelineActivities = computed(() => {
  return items.value
    .filter(it => !!it.startAt)
    .map(it => ({
      ...it,
      posterUrl: it.posterUrl ? getUploadsFullUrl(it.posterUrl) : '',
    }))
    .sort((a,b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
})
function onTimelineSelect(it) { if (it && it.id) openDetail(it.id) }

async function fetchMyRegistrations() {
  if (!isLoggedIn.value) return
  try {
    const { data } = await http.get('/users/me/registrations')
    const list = Array.isArray(data?.registered) ? data.registered : []
    const map = {}
    list.forEach(x => { map[String(x.id)] = x.status || 'REGISTERED' })
    myRegStatuses.value = map
    // 同时提取历史参加过的活动类型，用于偏好加权
    const cats = new Set()
    list.forEach(x => { if (x.category) cats.add(x.category) })
    myRegCats.value = cats
  } catch (e) {
    // 静默失败，不影响列表展示
  }
}

function openPromo(it) {
  const url = it?.promoLinkUrl
  if (url) {
    window.open(url, '_blank')
  } else {
    ElMessage.warning('暂无推文链接')
  }
}

function handleRegister(it) {
  if (!canRegister(it)) return
  const token = localStorage.getItem('token')
  if (!token) {
    ElMessage.warning('请先登录')
    router.push({ path: '/login', query: { redirect: `/activities/${it.id}/register` } })
    return
  }
  // PC端将确认报名逻辑和详情页聚合，所以列表点击“报名”也跳转到详情页进行确认
  router.push(`/activities/${it.id}/register`)
}

function openCancelDialog(it) {
  const token = localStorage.getItem('token')
  if (!token) {
    ElMessage.warning('请先登录')
    router.push({ path: '/login', query: { redirect: `/activities/${it.id}` } })
    return
  }
  cancelId.value = Number(it.id)
  cancelReason.value = ''
  cancelDialogVisible.value = true
}

async function submitCancel() {
  if (!cancelId.value) return
  if (!cancelReason.value || cancelReason.value.trim().length < 5) {
    ElMessage.warning('请填写至少5字的取消事由')
    return
  }
  actionLoading.value = true
  try {
    const { data } = await http.post(`/activities/${cancelId.value}/cancel`, { reason: cancelReason.value.trim() })
    ElMessage.success(data?.message || '已提交取消申请，待管理员审核')
    // 更新状态为待审核（仍占用名额）
    const next = { ...myRegStatuses.value }
    next[String(cancelId.value)] = 'PENDING_CANCEL'
    myRegStatuses.value = next
    cancelDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '取消失败，请稍后再试')
  } finally {
    actionLoading.value = false
  }
}

// 分类模块：预设模块（崇德讲堂/朋辈导师/晨曦晨读）展示各类型热门/最新，并提供“更多”跳转
const moduleCategories = ['崇德讲堂', '朋辈导师', '晨曦晨读']
function splitWaterfall(items) {
  const left = []
  const right = []
  let leftH = 0
  let rightH = 0
  items.forEach(item => {
    let h = 180
    // Activities.vue 的 items 结构有时是 { kind, it }，有时是原始 it
    const obj = item.it || item
    if (obj.posterUrl || obj.promoImageUrl) h += 160
    h += (obj.title?.length || 0) * 2
    if (leftH <= rightH) {
      left.push(item)
      leftH += h
    } else {
      right.push(item)
      rightH += h
    }
  })
  return { left, right }
}

const recommendedCombinedWaterfall = computed(() => splitWaterfall(recommendedCombined.value))
const recommendedCombinedLeft = computed(() => recommendedCombinedWaterfall.value.left)
const recommendedCombinedRight = computed(() => recommendedCombinedWaterfall.value.right)

function getCategoryPopularLeft(cat) {
  return splitWaterfall(categoryPopular(cat).slice(0, 20)).left
}
function getCategoryPopularRight(cat) {
  return splitWaterfall(categoryPopular(cat).slice(0, 20)).right
}

function categoryItems(cat) {
  return items.value.filter(it => (it.category || '') === cat)
}
function categoryPopular(cat) {
  return categoryItems(cat)
    .filter(it => canRegister(it))
    .sort((a,b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : 0
      const bTime = b.startAt ? new Date(b.startAt).getTime() : 0
      if (bTime !== aTime) return bTime - aTime
      return Number(b.registeredCount||0) - Number(a.registeredCount||0)
    })
}
function categoryLatest(cat) {
  return categoryItems(cat)
    .filter(it => canRegister(it))
    .sort((a,b) => {
      const ta = a.startAt ? new Date(a.startAt).getTime() : 0
      const tb = b.startAt ? new Date(b.startAt).getTime() : 0
      return tb - ta
    })
}
function gotoCategory(cat, sort) {
  selectedCategories.value = [cat]
  sortKey.value = sort || 'default'
  onlyAvailable.value = true
  setTimeout(() => {
    const el = document.getElementById('all-activities')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 0)
}

function pickCategory(cat) {
  selectedCategories.value = cat ? [cat] : []
}

function setMobileSort(value) {
  sortKey.value = value
}

function resetMobileFilters() {
  selectedCategories.value = []
  onlyAvailable.value = false
  sortKey.value = 'default'
  keyword.value = ''
}

function syncFiltersFromRoute() {
  const category = typeof route.query.category === 'string' ? route.query.category.trim() : ''
  if (category) {
    selectedCategories.value = [category]
    onlyAvailable.value = true
  }
}

watch([keyword, selectedCategories, onlyAvailable, sortKey], () => {
  activityPage.value = 1
})

watch(displayItemsTotal, (total) => {
  const maxPage = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE))
  if (activityPage.value > maxPage) activityPage.value = maxPage
}, { immediate: true })

watch(reviewItemsTotal, (total) => {
  const maxPage = Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE))
  if (reviewPage.value > maxPage) reviewPage.value = maxPage
}, { immediate: true })

onMounted(async () => {
  await Promise.all([fetchList(), fetchMyRegistrations(), fetchRecommendations()])
  syncFiltersFromRoute()
  document.addEventListener('visibilitychange', handleVisibilityRefresh)
  window.addEventListener('focus', handleVisibilityRefresh)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityRefresh)
  window.removeEventListener('focus', handleVisibilityRefresh)
})

function handleVisibilityRefresh() {
  if (document.visibilityState === 'visible') {
    fetchMyRegistrations()
    fetchList()
  }
}

watch(() => route.query.category, () => {
  syncFiltersFromRoute()
})
</script>

<template>
  <div class="activity-page">
    <!-- 居中原图预览层：使用轻蒙板 + 独立卡片，效果与编辑时更接近 -->
    <div v-if="previewVisible" class="image-overlay" @click.self="closePreview">
      <div class="preview-panel">
        <button class="overlay-close" @click="closePreview" aria-label="关闭预览">×</button>
        <img :src="previewSrc" class="overlay-img" alt="预览图" />
      </div>
    </div>
    <!-- 新增：首页四张海报全屏轮播模块（导航条下，刚好铺满第一屏） -->
    <HomeHeroCarousel />
    <!-- 让内容区紧贴轮播底部，去掉顶部 24px 间距 -->
    <div class="activity-shell">
    <el-card>
      <template #header>
        <div class="card-header">活动广场</div>
      </template>
      <!-- 活动时间轴：置于智能推荐上方，作为导览入口 -->
      <Timeline :activities="timelineActivities" :onlyRegisterable="onlyAvailable" group-by="month" @select="onTimelineSelect" />
      <!-- 智能推荐模块：基于偏好与热度 -->
  <template v-if="recommendedCombined.length">
<div class="section-title" style="margin-top: 4px;">智能推荐</div>
        <div class="desktop-only">
          <div v-for="(x, i) in recommendedCombined.slice(0, 5)" :key="'rec-' + i" class="desktop-item">
            <template v-if="x.kind==='UPCOMING'">
              <el-image v-if="x.it.posterUrl" :src="getThumbUrl(x.it.posterUrl)" fit="cover" class="poster-desktop" :lazy="i >= 3" @click="openImage(getUploadsFullUrl(x.it.posterUrl))">
                <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
              </el-image>
              <div v-else class="poster-desktop placeholder">无海报</div>
              <div class="info">
                <div class="top-row">
                  <div class="title">{{ x.it.title }}<el-tag size="small" style="margin-left:8px" class="category-tag" :class="`category-tag--${getCategoryTone(x.it.category)}`">{{ getCategoryLabel(x.it.category) }}</el-tag></div>
                  <div class="right-stats">已报名：<b>{{ Number(x.it.registeredCount) || 0 }}</b><span class="sep">/</span><b>{{ Number(x.it.limit) > 0 ? x.it.limit : '不限' }}</b></div>
                </div>
                <div class="lines">
                  <div class="line"><span class="label">活动地点：</span>{{ x.it.place || '待定' }}</div>
                  <div class="line"><span class="label">活动开始时间：</span>{{ formatDateTime(x.it.startAt) || x.it.timeText || '待定' }}</div>
                </div>
                <div class="actions">
                  <el-button :type="canRegister(x.it) ? 'primary' : 'default'" :disabled="!canRegister(x.it)" @click="canRegister(x.it) && handleRegister(x.it)">{{ actionLabel(x.it) }}</el-button>
                  <el-button type="default" @click="openDetail(x.it.id)" style="margin-left:8px">查看详情</el-button>
                </div>
              </div>
            </template>
            <template v-else>
              <el-image v-if="x.it.promoImageUrl" :src="getThumbUrl(x.it.promoImageUrl)" fit="cover" class="poster-desktop" :lazy="i >= 3" @click="openImage(getUploadsFullUrl(x.it.promoImageUrl))">
                <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
              </el-image>
              <div v-else class="poster-desktop placeholder">无推文图片</div>
              <div class="info">
                <div class="top-row">
                  <div class="title">{{ x.it.title }}<el-tag size="small" style="margin-left:8px" type="success">往期回顾</el-tag></div>
                  <div class="right-stats">导师：{{ x.it.mentorName || '—' }}</div>
                </div>
                <div class="lines">
                  <div class="line"><span class="label">活动时间：</span>{{ formatDateTime(x.it.startAt) || x.it.timeText || '—' }}</div>
                  <div class="line"><span class="label">活动地点：</span>{{ x.it.place || '—' }}</div>
                </div>
                <div class="actions">
                  <el-button type="primary" @click="openPromo(x.it)">查看推文</el-button>
                  <el-button type="default" @click="openDetail(x.it.id)" style="margin-left:8px">查看详情</el-button>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="mobile-only">
          <div class="mobile-waterfall-grid">
            <div class="waterfall-col">
              <el-card v-for="(x, i) in recommendedCombinedLeft" :key="'mrec-l-' + i" shadow="hover" class="mobile-card">
                <template v-if="x.kind==='UPCOMING'">
                  <div class="poster-container-mobile">
                    <el-image v-if="x.it.posterUrl" :src="getThumbUrl(x.it.posterUrl)" class="poster-mobile" :lazy="i >= 3" @click="openImage(getUploadsFullUrl(x.it.posterUrl))">
                      <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                    </el-image>
                    <div v-else class="poster-mobile placeholder">无海报</div>
                    <div class="mobile-waterfall-card__status">
                      <el-tag :type="getStatusTag(x.it).type" size="small" effect="dark">{{ getStatusTag(x.it).text }}</el-tag>
                    </div>
                  </div>
                  <div class="mobile-content">
                    <div class="mobile-top">
                      <div class="mobile-title">{{ x.it.title }} <el-tag size="small" class="category-tag" :class="`category-tag--${getCategoryTone(x.it.category)}`">{{ getCategoryLabel(x.it.category) }}</el-tag></div>
                    </div>
                    <div class="line"><span class="label">活动地点：</span>{{ x.it.place || '待定' }}</div>
                    <div class="line"><span class="label">活动开始时间：</span>{{ formatDateTime(x.it.startAt) || x.it.timeText || '待定' }}</div>
                    <div class="mobile-actions">
                      <el-button :type="canRegister(x.it) ? 'primary' : 'default'" size="large" class="full-btn" :disabled="!canRegister(x.it)" @click="canRegister(x.it) && handleRegister(x.it)">{{ actionLabel(x.it) }}</el-button>
                      <el-button type="default" size="large" class="full-btn" @click="openDetail(x.it.id)">查看详情</el-button>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="poster-container-mobile">
                    <el-image v-if="x.it.promoImageUrl" :src="getThumbUrl(x.it.promoImageUrl)" class="poster-mobile" :lazy="i >= 3" @click="openImage(getUploadsFullUrl(x.it.promoImageUrl))">
                      <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                    </el-image>
                    <div v-else class="poster-mobile placeholder">无推文图片</div>
                    <div class="mobile-waterfall-card__status">
                      <el-tag type="success" size="small" effect="dark">往期回顾</el-tag>
                    </div>
                  </div>
                  <div class="mobile-content">
                    <div class="mobile-top">
                      <div class="mobile-title">{{ x.it.title }} <el-tag size="small" type="success">往期回顾</el-tag></div>
                    </div>
                    <div class="line"><span class="label">活动时间：</span>{{ formatDateTime(x.it.startAt) || x.it.timeText || '—' }}</div>
                    <div class="line"><span class="label">活动地点：</span>{{ x.it.place || '—' }}</div>
                    <div class="mobile-actions">
                      <el-button type="primary" size="large" class="full-btn" @click="openPromo(x.it)">查看推文</el-button>
                      <el-button type="default" size="large" class="full-btn" @click="openDetail(x.it.id)">查看详情</el-button>
                    </div>
                  </div>
                </template>
              </el-card>
            </div>
            <div class="waterfall-col">
              <el-card v-for="(x, i) in recommendedCombinedRight" :key="'mrec-r-' + i" shadow="hover" class="mobile-card">
                <template v-if="x.kind==='UPCOMING'">
                  <el-image v-if="x.it.posterUrl" :src="getThumbUrl(x.it.posterUrl)" class="poster-mobile" :lazy="i >= 3" @click="openImage(getUploadsFullUrl(x.it.posterUrl))">
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                  <div v-else class="poster-mobile placeholder">无海报</div>
                  <div class="mobile-content">
                    <div class="mobile-top">
                      <div class="mobile-title">{{ x.it.title }} <el-tag size="small" class="category-tag" :class="`category-tag--${getCategoryTone(x.it.category)}`">{{ getCategoryLabel(x.it.category) }}</el-tag></div>
                    </div>
                    <div class="line"><span class="label">活动地点：</span>{{ x.it.place || '待定' }}</div>
                    <div class="line"><span class="label">活动开始时间：</span>{{ formatDateTime(x.it.startAt) || x.it.timeText || '待定' }}</div>
                    <div class="mobile-actions">
                      <el-button :type="canRegister(x.it) ? 'primary' : 'default'" size="large" class="full-btn" :disabled="!canRegister(x.it)" @click="canRegister(x.it) && handleRegister(x.it)">{{ actionLabel(x.it) }}</el-button>
                      <el-button type="default" size="large" class="full-btn" @click="openDetail(x.it.id)">查看详情</el-button>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="poster-container-mobile">
                    <el-image v-if="x.it.promoImageUrl" :src="getThumbUrl(x.it.promoImageUrl)" class="poster-mobile" :lazy="i >= 3" @click="openImage(getUploadsFullUrl(x.it.promoImageUrl))">
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                    <div v-else class="poster-mobile placeholder">无推文图片</div>
                    <div class="mobile-waterfall-card__status">
                      <el-tag type="success" size="small" effect="dark">往期回顾</el-tag>
                    </div>
                  </div>
                  <div class="mobile-content">
                    <div class="mobile-top">
                      <div class="mobile-title">{{ x.it.title }} <el-tag size="small" type="success">往期回顾</el-tag></div>
                    </div>
                    <div class="line"><span class="label">活动时间：</span>{{ formatDateTime(x.it.startAt) || x.it.timeText || '—' }}</div>
                    <div class="line"><span class="label">活动地点：</span>{{ x.it.place || '—' }}</div>
                    <div class="mobile-actions">
                      <el-button type="primary" size="large" class="full-btn" @click="openPromo(x.it)">查看推文</el-button>
                      <el-button type="default" size="large" class="full-btn" @click="openDetail(x.it.id)">查看详情</el-button>
                    </div>
                  </div>
                </template>
              </el-card>
            </div>
          </div>
        </div>
      </template>
      <!-- 类别导航模块化：预设类型分区，展示热门/最新，并提供“更多”跳转 -->
      <div v-for="cat in moduleCategories" :key="'mod-' + cat" v-if="!isMobile && categoryItems(cat).length" style="margin: 16px 0;">
        <div class="section-title" style="display:flex; align-items:center; justify-content:space-between;">
          <span>{{ cat }}模块</span>
          <div>
            <el-button type="primary" text @click="gotoCategory(cat, 'popular')">更多热门</el-button>
            <el-button type="primary" text @click="gotoCategory(cat, 'time')">更多最新</el-button>
          </div>
        </div>
        <!-- 电脑端：横向卡片，分成热门/最新两行（手机端已隐藏） -->
        <div class="category-subtitle">热门</div>
        <div v-for="(it, i) in categoryPopular(cat).slice(0, 20)" :key="'cp-' + cat + '-' + i" class="desktop-item neo-card">
            <el-image v-if="it.posterUrl" :src="getUploadsFullUrl(it.posterUrl)" fit="cover" class="poster-desktop" lazy @click="openImage(getUploadsFullUrl(it.posterUrl))" />
            <div v-else class="poster-desktop placeholder">无海报</div>
            <div class="info">
              <div class="top-row">
                <div class="title">{{ it.title }}<el-tag size="small" style="margin-left:8px" class="category-tag" :class="`category-tag--${getCategoryTone(it.category)}`">{{ getCategoryLabel(it.category) }}</el-tag></div>
                <div class="right-stats">已报名：<b>{{ Number(it.registeredCount) || 0 }}</b><span class="sep">/</span><b>{{ Number(it.limit) > 0 ? it.limit : '不限' }}</b></div>
              </div>
              <div class="lines">
                <div class="line"><span class="label">活动地点：</span>{{ it.place || '待定' }}</div>
                <div class="line"><span class="label">活动开始时间：</span>{{ formatDateTime(it.startAt) || it.timeText || '待定' }}</div>
              </div>
              <div class="actions">
                <el-button :type="canRegister(it) ? 'primary' : 'default'" :class="canRegister(it) ? 'neo-btn-gradient' : 'neo-btn-ghost'" :disabled="!canRegister(it)" @click="canRegister(it) && handleRegister(it)">{{ actionLabel(it) }}</el-button>
                <el-button type="default" class="neo-btn-ghost" @click="openDetail(it.id)" style="margin-left:8px">查看详情</el-button>
              </div>
            </div>
          </div>
          <div class="category-subtitle">最新</div>
          <div v-for="(it, i) in categoryLatest(cat).slice(0, 20)" :key="'cl-' + cat + '-' + i" class="desktop-item neo-card">
            <el-image v-if="it.posterUrl" :src="getUploadsFullUrl(it.posterUrl)" fit="cover" class="poster-desktop" lazy @click="openImage(getUploadsFullUrl(it.posterUrl))" />
            <div v-else class="poster-desktop placeholder">无海报</div>
            <div class="info">
              <div class="top-row">
                <div class="title">{{ it.title }}<el-tag size="small" style="margin-left:8px" class="category-tag" :class="`category-tag--${getCategoryTone(it.category)}`">{{ getCategoryLabel(it.category) }}</el-tag></div>
                <div class="right-stats">已报名：<b>{{ Number(it.registeredCount) || 0 }}</b><span class="sep">/</span><b>{{ Number(it.limit) > 0 ? it.limit : '不限' }}</b></div>
              </div>
              <div class="lines">
                <div class="line"><span class="label">活动地点：</span>{{ it.place || '待定' }}</div>
                <div class="line"><span class="label">活动开始时间：</span>{{ formatDateTime(it.startAt) || it.timeText || '待定' }}</div>
              </div>
              <div class="actions">
                <el-button :type="canRegister(it) ? 'primary' : 'default'" :class="canRegister(it) ? 'neo-btn-gradient' : 'neo-btn-ghost'" :disabled="!canRegister(it)" @click="canRegister(it) && handleRegister(it)">{{ actionLabel(it) }}</el-button>
                <el-button type="default" class="neo-btn-ghost" @click="openDetail(it.id)" style="margin-left:8px">查看详情</el-button>
              </div>
            </div>
          </div>
      </div>
      <!-- 活动报名 -->
<div class="section-title" style="margin-top: 12px;">活动报名</div>
      <!-- 活动报名区筛选：类别/仅看可报名/排序 -->
      <div class="filter-bar" style="margin-bottom:8px;">
        <el-select v-model="selectedCategories" multiple collapse-tags placeholder="选择活动类型" class="filter-select neo-select" :max-collapse-tags="2">
          <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
        </el-select>
        <el-checkbox v-model="onlyAvailable">只看当前可报名</el-checkbox>
        <el-select v-model="sortKey" placeholder="排序" class="filter-sort neo-select">
          <el-option label="默认" value="default" />
          <el-option label="按时间" value="time" />
          <el-option label="按热度" value="popular" />
        </el-select>
      </div>
      <!-- 锚点：用于“更多”跳转滚动到活动列表 -->
      <div id="all-activities"></div>
      <el-skeleton :loading="loading" animated>
        <template #default>
          <template v-if="displayItems.length">
            <!-- 电脑端：横向图文卡片 -->
              <div v-for="(it, i) in pagedDisplayItems" :key="i" class="desktop-item neo-card">
                <el-image v-if="it.posterUrl" :src="getUploadsFullUrl(it.posterUrl)" fit="cover" class="poster-desktop" lazy @click="openImage(getUploadsFullUrl(it.posterUrl))" />
                <div v-else class="poster-desktop placeholder">无海报</div>
                <div class="info">
                  <div class="top-row">
                    <div class="title">{{ it.title }}<el-tag size="small" style="margin-left:8px" class="category-tag" :class="`category-tag--${getCategoryTone(it.category)}`">{{ getCategoryLabel(it.category) }}</el-tag></div>
                    <div class="right-stats">已报名：<b>{{ Number(it.registeredCount) || 0 }}</b><span class="sep">/</span><b>{{ Number(it.limit) > 0 ? it.limit : '不限' }}</b></div>
                  </div>
                  <div class="lines">
                    <div class="line"><span class="label">活动地点：</span>{{ it.place || '待定' }}</div>
                    <div class="line"><span class="label">活动限制人数：</span>{{ Number(it.limit) > 0 ? it.limit : '不限' }}</div>
                    <div class="line"><span class="label">活动开始时间：</span>{{ formatDateTime(it.startAt) || it.timeText || '待定' }}</div>
                    <div class="line"><span class="label">活动报名截止时间：</span>{{ formatDateTime(it.registerDeadline) || '—' }}</div>
                  </div>
                  <div class="actions">
                    <template v-if="!isRegistered(it)">
                      <el-button :type="canRegister(it) ? 'primary' : 'default'" :class="canRegister(it) ? 'neo-btn-gradient' : 'neo-btn-ghost'" :disabled="!canRegister(it)" :loading="registeringId===it.id" @click="canRegister(it) && handleRegister(it)">{{ actionLabel(it) }}</el-button>
                      <el-button type="default" class="neo-btn-ghost" style="margin-left:8px" @click="openDetail(it.id)">查看详情</el-button>
                    </template>
                    <template v-else>
                      <el-tag v-if="regStatus(it)==='REGISTERED'" type="success">报名成功</el-tag>
                      <el-tag v-else type="warning">取消申请待审核</el-tag>
                      <el-button v-if="regStatus(it)==='REGISTERED'" type="danger" plain class="neo-btn-ghost" :loading="registeringId===it.id" style="margin-left:8px" @click="openCancelDialog(it)">取消报名</el-button>
                      <el-button type="default" class="neo-btn-ghost" style="margin-left:8px" @click="openDetail(it.id)">查看详情</el-button>
                    </template>
                  </div>
                </div>
              </div>

            <div v-if="displayItemsTotal > ACTIVITY_PAGE_SIZE" class="list-pagination">
              <el-pagination
                background
                layout="prev, pager, next"
                :current-page="activityPage"
                :page-size="ACTIVITY_PAGE_SIZE"
                :total="displayItemsTotal"
                @current-change="handleActivityPageChange"
              />
            </div>
          </template>
          <el-empty description="暂无活动" v-else />
        </template>
      </el-skeleton>
    </el-card>
    <!-- 往期回顾：展示所有具备推文的活动，点击打开外链 -->
    <el-card v-if="!isMobile" style="margin-top: 16px;">
      <template #header>
<div class="card-header" style="margin-top: 16px;">往期回顾</div>
      </template>
      <template v-if="pastReviewItems.length">
          <div v-for="(it, i) in pagedPastReviewItems" :key="'rev-' + i" class="desktop-item">
            <el-image v-if="it.promoImageUrl" :src="getUploadsFullUrl(it.promoImageUrl)" fit="cover" class="poster-desktop" lazy @click="openImage(getUploadsFullUrl(it.promoImageUrl))" />
            <div v-else class="poster-desktop placeholder">无推文图片</div>
            <div class="info">
              <div class="top-row">
                <div class="title">{{ it.title }}<el-tag size="small" style="margin-left:8px" type="success">往期回顾</el-tag></div>
              </div>
              <div class="lines">
                <div class="line"><span class="label">活动时间：</span>{{ formatDateTime(it.startAt) || it.timeText || '—' }}</div>
                <div class="line"><span class="label">活动地点：</span>{{ it.place || '—' }}</div>
              </div>
              <div class="actions">
                <el-button type="primary" class="neo-btn-gradient" @click="openPromo(it)">查看推文</el-button>
                <el-button type="default" class="neo-btn-ghost" @click="openDetail(it.id)" style="margin-left:8px">查看详情</el-button>
              </div>
            </div>
          </div>
        <div v-if="reviewItemsTotal > REVIEW_PAGE_SIZE" class="list-pagination">
          <el-pagination
            background
            layout="prev, pager, next"
            :current-page="reviewPage"
            :page-size="REVIEW_PAGE_SIZE"
            :total="reviewItemsTotal"
            @current-change="handleReviewPageChange"
          />
        </div>
      </template>
      <el-empty description="暂无往期推文" v-else />
    </el-card>
    <!-- 取消报名弹窗 -->
    <el-dialog v-model="cancelDialogVisible" title="取消报名" width="480px">
      <div style="margin-bottom:8px;">请填写取消事由（5-200字）：</div>
      <el-input type="textarea" v-model="cancelReason" :rows="4" maxlength="200" show-word-limit placeholder="如：课程冲突，无法准时参加" />
      <div style="margin-top:10px; color:#E6A23C;">提示：三日内连续取消报名三次，15日内不能报名参加任何活动。</div>
      <template #footer>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <el-button @click="cancelDialogVisible=false">关闭</el-button>
          <el-button type="primary" :loading="actionLoading" @click="submitCancel">提交</el-button>
        </div>
      </template>
    </el-dialog>
    </div>
  </div>
  
</template>

<style scoped>
.activity-page {
  /* 主题色：日落渐变（更温暖的年轻化氛围） */
  --neo-primary-start: #FF7D73; /* 日落橙红 */
  --neo-primary-end: #FDBA74;   /* 柔和金色 */
}
.activity-shell {
  max-width: 1200px;
  margin: 0 auto 24px;
}
.card-header {
  font-weight: 800;
  font-size: 26px;
  letter-spacing: 0.3px;
  /* 质感：使用日落渐变作文字填充 + 轻微暖色阴影 */
  background-image: linear-gradient(135deg, var(--neo-primary-start), var(--neo-primary-end));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 2px 12px rgba(253,186,116,0.24);
  display: inline-block;
}
.card-header::after {
  content: '';
  display: block;
  margin-top: 6px;
  width: 48px;
  height: 3px;
  border-radius: 999px;
  background-image: linear-gradient(90deg, var(--neo-primary-start), var(--neo-primary-end));
  box-shadow: 0 4px 10px rgba(253,186,116,0.22);
}
.search-bar { display: flex; gap: 12px; margin-bottom: 12px; }
.search-input { max-width: 320px; }
/* 筛选条 */
.filter-bar { display:flex; gap: 12px; align-items:center; margin: 8px 0 0; flex-wrap: wrap; }
.filter-select { min-width: 240px; }
.filter-sort { width: 120px; }
.section-title { font-weight: 700; font-size: 18px; margin: 8px 0 12px; }
.category-subtitle { font-weight: 600; font-size: 16px; margin: 8px 0; color: #606266; }
.el-tag.category-tag {
  --category-tag-bg: rgba(245, 247, 255, 0.96);
  --category-tag-border: rgba(99, 102, 241, 0.16);
  --category-tag-text: #4f46e5;
  background: var(--category-tag-bg) !important;
  border-color: var(--category-tag-border) !important;
  color: var(--category-tag-text) !important;
  border-radius: 999px;
  font-weight: 700;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 1px 2px rgba(15, 23, 42, 0.04);
}
.el-tag.category-tag.category-tag--sunset {
  --category-tag-bg: rgba(255, 242, 240, 0.96);
  --category-tag-border: rgba(255, 105, 97, 0.18);
  --category-tag-text: #ff5a52;
}
.el-tag.category-tag.category-tag--amber {
  --category-tag-bg: rgba(255, 248, 230, 0.96);
  --category-tag-border: rgba(255, 179, 64, 0.18);
  --category-tag-text: #ff9f0a;
}
.el-tag.category-tag.category-tag--apricot {
  --category-tag-bg: rgba(255, 244, 233, 0.96);
  --category-tag-border: rgba(255, 149, 61, 0.18);
  --category-tag-text: #ff8c42;
}
.el-tag.category-tag.category-tag--coral {
  --category-tag-bg: rgba(255, 240, 236, 0.96);
  --category-tag-border: rgba(255, 105, 135, 0.18);
  --category-tag-text: #ff6482;
}
.el-tag.category-tag.category-tag--peach {
  --category-tag-bg: rgba(255, 238, 243, 0.96);
  --category-tag-border: rgba(255, 86, 145, 0.18);
  --category-tag-text: #ff4d8d;
}
.el-tag.category-tag.category-tag--cocoa {
  --category-tag-bg: rgba(242, 245, 255, 0.96);
  --category-tag-border: rgba(90, 110, 255, 0.16);
  --category-tag-text: #5b6cff;
}
.el-tag.category-tag.category-tag--rose {
  --category-tag-bg: rgba(245, 239, 255, 0.96);
  --category-tag-border: rgba(191, 90, 242, 0.18);
  --category-tag-text: #bf5af2;
}
.el-tag.category-tag.category-tag--bronze {
  --category-tag-bg: rgba(237, 250, 244, 0.96);
  --category-tag-border: rgba(48, 209, 88, 0.16);
  --category-tag-text: #28c840;
}

/* 顶部横幅（已替换为全屏轮播组件） */

/* 玻璃拟态工具栏 */
.neo-toolbar {
  padding: 12px;
  border-radius: 16px;
  background: rgba(255,255,255,0.65);
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 8px 24px rgba(253,186,116,0.14), 0 2px 8px rgba(255,125,115,0.12);
  backdrop-filter: saturate(160%) blur(10px);
  margin-bottom: 16px;
}
.mobile-list-hero {
  margin-bottom: 14px;
  padding: 18px;
  border-radius: var(--mobile-radius-lg);
  background: var(--mobile-surface-soft);
  border: 1px solid rgba(255,125,115,0.12);
  box-shadow: var(--mobile-shadow);
}
.mobile-list-hero__eyebrow {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #f97316;
}
.mobile-list-hero__title {
  margin-top: 6px;
  color: #0f172a;
  font-size: 24px;
  font-weight: 800;
}
.mobile-list-hero__desc {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}
.mobile-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.mobile-stat-card {
  padding: 12px;
  border-radius: var(--mobile-radius-md);
  background: rgba(255,255,255,0.92);
  border: 1px solid rgba(255,125,115,0.08);
}
.mobile-stat-card__label {
  font-size: 11px;
  color: #94a3b8;
}
.mobile-stat-card__value {
  margin-top: 8px;
  color: #0f172a;
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
}
.mobile-stat-card__value--text {
  font-size: 13px;
  line-height: 1.4;
}
.mobile-chip-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.mobile-chip-row + .mobile-chip-row {
  margin-top: 10px;
}
.mobile-chip {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(255,125,115,0.12);
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}
.mobile-chip.is-active {
  border-color: transparent;
  background: linear-gradient(135deg, var(--neo-primary-start), var(--neo-primary-end));
  color: #fff;
}
.mobile-chip--soft {
  background: rgba(248,250,252,0.96);
  border-color: rgba(148,163,184,0.14);
}
.mobile-chip--soft.is-active {
  background: linear-gradient(135deg, rgba(255,125,115,0.12), rgba(253,186,116,0.2));
  border-color: rgba(255,125,115,0.18);
  color: #c2410c;
}

/* Input 年轻化：圆角 + 玻璃背景 + 聚焦光晕 */
.neo-input :deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.9);
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.03);
  transition: all .2s ease;
}
.neo-input :deep(.el-input__wrapper.is-focus) {
  border-color: transparent;
  box-shadow: 0 0 0 2px rgba(255,125,115,0.18), 0 8px 22px rgba(253,186,116,0.18);
}
.neo-input :deep(.el-input__prefix) {
  color: var(--neo-primary-start);
}

/* 渐变主按钮与胶囊次按钮 - 使用更强的选择器确保样式优先级 */
.el-button.neo-btn-gradient {
  background-image: linear-gradient(135deg, var(--neo-primary-start), var(--neo-primary-end)) !important;
  background-color: transparent !important;
  color: #fff !important;
  border: none !important;
  border-radius: 999px !important;
  box-shadow: 0 6px 16px rgba(253,186,116,0.26), 0 2px 6px rgba(255,125,115,0.26) !important;
  transition: transform .2s ease, box-shadow .2s ease, filter .2s ease !important;
}
.el-button.neo-btn-gradient:hover {
  transform: translateY(-1px) !important;
  box-shadow: 0 10px 24px rgba(253,186,116,0.3), 0 4px 12px rgba(255,125,115,0.32) !important;
  filter: brightness(1.05) !important;
  background-image: linear-gradient(135deg, var(--neo-primary-start), var(--neo-primary-end)) !important;
}
.el-button.neo-btn-gradient:active { 
  transform: translateY(0) !important; 
  filter: brightness(0.98) !important; 
  background-image: linear-gradient(135deg, var(--neo-primary-start), var(--neo-primary-end)) !important;
}

.el-button.neo-btn-ghost {
  background: rgba(255,255,255,0.75) !important;
  border-radius: 999px !important;
  color: #374151 !important;
  border: 1px solid rgba(0,0,0,0.08) !important;
  backdrop-filter: blur(6px);
  transition: all .2s ease !important;
}
.el-button.neo-btn-ghost:hover { 
  border-color: rgba(255,125,115,0.4) !important; 
  color: #1f2937 !important; 
  box-shadow: 0 6px 16px rgba(253,186,116,0.12) !important;
  background: rgba(255,255,255,0.85) !important;
}

/* 电脑端布局 */
.desktop-item { display: flex; gap: 16px; padding: 12px; border-radius: 12px; margin-bottom: 12px; background: #fff; align-items: flex-start; }
.neo-card { 
  border: 1px solid rgba(0,0,0,0.06);
  background: radial-gradient(800px circle at 10% 10%, rgba(255,125,115,0.06), transparent), #fff; 
  box-shadow: 0 10px 28px rgba(253,186,116,0.12), 0 2px 8px rgba(255,125,115,0.1);
}
.poster-desktop { max-width: 200px; width: 100%; height: 240px; border-radius: 6px; border: 1px solid #ebeef5; overflow: hidden; }
.poster-desktop :deep(.el-image__inner) { width: 100%; height: 100%; object-fit: cover; }
.poster-desktop { border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.06); transition: transform .25s ease, box-shadow .25s ease; cursor: zoom-in; }
.poster-desktop:hover { transform: scale(1.18); box-shadow: 0 14px 32px rgba(0,0,0,0.14); }
.poster-desktop.placeholder { display:flex; align-items:center; justify-content:center; color:#bbb; background:#f5f7fa; }
.info { flex: 1; text-align: left; }
.top-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.title { font-weight: 600; font-size: 18px; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; color: #606266; }
.label { color: #909399; margin-right: 6px; }
.actions { margin-top: 8px; }
.lines { display: flex; flex-direction: column; gap: 6px; color:#606266; }
.right-stats { color:#606266; display:flex; align-items:center; gap:4px; }
.right-stats .sep { color:#c0c4cc; margin: 0 4px; }

/* 手机端布局 */
.mobile-waterfall-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}
.mobile-waterfall-grid .mobile-card {
  display: block;
  width: 100%;
  margin: 0;
}
.mobile-card { margin-bottom: 16px; }
.poster-mobile { width: 100%; height: auto; display: block; border-radius: 6px; border: 1px solid #ebeef5; overflow: hidden; }
.poster-mobile :deep(.el-image__inner) { height: auto; display: block; object-fit: cover; }
.poster-mobile { border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.poster-mobile.placeholder { display:flex; align-items:center; justify-content:center; color:#bbb; background:#f5f7fa; }
.mobile-content { padding-top: 8px; text-align: left; }
.mobile-title { font-weight: 600; font-size: 16px; margin-bottom: 6px; }
.mobile-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.mobile-stats { color:#606266; }
.mobile-actions { 
  display: flex; 
  flex-direction: column; 
  gap: 12px; 
  margin-top: 16px;
}
.line { margin: 4px 0; color: #606266; }
.full-btn { 
  width: 100%; 
  margin: 0 !important; /* 移除所有 margin，使用 gap 控制间距 */
  box-sizing: border-box;
}
.list-pagination {
  display: flex;
  justify-content: center;
  margin-top: 18px;
}

/* 响应式控制 */
.desktop-only { display: block; }
.mobile-only { display: none; }
@media (max-width: 768px) {
  .desktop-only { display: none; }
  .mobile-only { display: block; }
  .activity-shell {
    margin: 0 auto 12px;
  }
  .mobile-list-card {
    border-radius: var(--mobile-radius-lg);
    box-shadow: var(--mobile-shadow);
  }
  .neo-toolbar--mobile {
    padding: 14px;
    border-radius: 20px;
  }
  .search-bar {
    flex-direction: column;
    gap: 10px;
    margin-bottom: 0;
  }
  .search-input {
    max-width: none;
  }
  .filter-bar--mobile {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-select,
  .filter-sort {
    width: 100%;
    min-width: 0;
  }
  .mobile-top {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
  .mobile-title {
    line-height: 1.5;
  }
  .mobile-stats {
    font-size: 12px;
  }
  .line {
    font-size: 13px;
    line-height: 1.6;
  }
  .list-pagination {
    margin-top: 10px;
    padding-bottom: 6px;
  }
  .list-pagination :deep(.el-pagination) {
    justify-content: center;
    flex-wrap: wrap;
  }
}
/* 居中原图预览层样式 */
.image-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4000;
  padding: 24px;
  box-sizing: border-box;
}
.preview-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: min(92vw, 980px);
  max-height: 92vh;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.55);
  background: rgba(255,255,255,0.96);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(6px);
}
.overlay-img {
  display: block;
  max-width: min(88vw, 920px);
  max-height: calc(92vh - 36px);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  background: #fff;
}
.overlay-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  font-size: 24px;
  line-height: 1;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: #475569;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.overlay-close:hover {
  background: rgba(15, 23, 42, 0.14);
  color: #0f172a;
}

/* 保留悬浮缩放交互以增强吸引力 */
</style>
