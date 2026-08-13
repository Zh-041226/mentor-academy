<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import HomeHeroCarousel from '../components/HomeHeroCarousel.vue'
import Timeline from '../components/Timeline.vue'
import { getUploadsFullUrl, getThumbUrl } from '../utils/config'
import { fetchMobileHomePayload } from '../services/mobileHomeData'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const announcements = ref([])
const activities = ref([])
const activityKeyword = ref('')
const reviewKeyword = ref('')
const browseMode = ref('square')

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatDateTime(d) {
  if (!d) return '待定'
  try {
    const dt = new Date(d)
    return `${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  } catch {
    return '待定'
  }
}

function getDisplayTime(item) {
  return formatDateTime(item.startAt) || item.timeText || '待定'
}

function getRemainingText(item) {
  const limit = Number(item.limit || 0)
  const registered = Number(item.registeredCount || 0)
  if (limit <= 0) return { text: '名额充足', type: 'success' }
  const current = Math.max(registered, 0)
  if (current >= limit) return { text: '名额已满', type: 'danger' }
  return { text: `余量：${limit - current}`, type: 'warning' }
}

function getStatusTag(item) {
  if (item._isReview) return { text: '往期回顾', type: 'success' }
  const closed = String(item.status || '').toUpperCase() === 'CLOSED'
  const limit = Number(item.limit || 0)
  const count = Number(item.registeredCount || 0)
  const dl = item.registerDeadline ? new Date(item.registerDeadline).getTime() : null
  const deadline = dl && Date.now() > dl
  if (closed || deadline) return { text: '已结束', type: 'info' }
  if (limit > 0 && count >= limit) return { text: '名额已满', type: 'danger' }
  return { text: `余量: ${limit > 0 ? limit - count : '不限'}`, type: 'primary', isRemain: true }
}

function isRegistered(it) {
  try { return !!myRegStatuses.value[String(it.id)] } catch { return false }
}
function regStatus(it) {
  try { return myRegStatuses.value[String(it.id)] || '' } catch { return '' }
}

function canRegister(item) {
  if (isRegistered(item)) return false
  const closed = String(item.status || '').toUpperCase() === 'CLOSED'
  const limit = Number(item.limit || 0)
  const count = Number(item.registeredCount || 0)
  const full = limit > 0 && count >= limit
  const dl = item.registerDeadline ? new Date(item.registerDeadline).getTime() : null
  const deadline = dl && Date.now() > dl
  return !closed && !full && !deadline
}

function actionLabel(item) {
  if (isRegistered(item)) {
    const status = regStatus(item)
    if (status === 'PENDING_CANCEL') return '取消待审'
    return '已报名'
  }
  if (!canRegister(item)) return '查看详情'
  return '立即报名'
}

function normalizeActivity(item) {
  return {
    id: item.id,
    title: item.title || '',
    category: item.category || '其他',
    place: item.place || '地点待定',
    mentorName: item.mentorName || '导师待定',
    startAt: item.startAt || null,
    timeText: item.timeText || '',
    limit: Number(item.limit ?? 0),
    registeredCount: Number(item.registeredCount ?? 0),
    status: item.status || 'PUBLISHED',
    registerDeadline: item.registerDeadline || null,
    posterUrl: item.posterUrl || '',
    promoLinkUrl: item.promoLinkUrl || '',
    promoImageUrl: item.promoImageUrl || '',
  }
}

async function fetchHomeData() {
  loading.value = true
  try {
    const payload = await fetchMobileHomePayload()
    activities.value = Array.isArray(payload?.activities) ? payload.activities.map(normalizeActivity) : []
    announcements.value = Array.isArray(payload?.announcements) ? payload.announcements : []
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取手机端首页数据失败')
  } finally {
    loading.value = false
  }
}

const latestAnnouncement = computed(() => announcements.value[0] || null)

const registerableActivities = computed(() => {
  return activities.value
    .filter((item) => canRegister(item))
    .sort((a, b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.startAt ? new Date(b.startAt).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })
})

const squareBaseActivities = computed(() => {
  return [...activities.value].sort((a, b) => {
    const aTime = a.startAt ? new Date(a.startAt).getTime() : 0
    const bTime = b.startAt ? new Date(b.startAt).getTime() : 0
    if (bTime !== aTime) return bTime - aTime
    const byHot = Number(b.registeredCount || 0) - Number(a.registeredCount || 0)
    return byHot
  })
})

const recommendedActivities = computed(() => {
  const latestActs = registerableActivities.value
  const latestReviews = activities.value.filter((item) => item.promoLinkUrl || item.promoImageUrl)

  const base = []
  let actIndex = 0
  let revIndex = 0
  const maxItems = 40 // 最多展示 40 条

  while (base.length < maxItems && (actIndex < latestActs.length || revIndex < latestReviews.length)) {
    // 拿 2 个新活动
    if (actIndex < latestActs.length) base.push(latestActs[actIndex++])
    if (actIndex < latestActs.length && base.length < maxItems) base.push(latestActs[actIndex++])
    
    // 穿插 1 个回顾
    if (revIndex < latestReviews.length && base.length < maxItems) {
      const reviewItem = { ...latestReviews[revIndex++], _isReview: true }
      base.push(reviewItem)
    }
  }

  if (base.length === 0) return []
  const result = [...base]
  for (let i = 0; i < loadMoreCount.value; i++) {
    result.push(...base.map(item => ({ ...item, id: String(item.id) + '_clone_' + i })))
  }
  return result
})

const activitySquareItems = computed(() => {
  const keyword = activityKeyword.value.trim().toLowerCase()
  let base = squareBaseActivities.value
  if (keyword) {
    base = base.filter((item) => {
      return [
        item.title,
        item.category,
        item.mentorName,
        item.place,
      ].some((field) => String(field || '').toLowerCase().includes(keyword))
    })
  }
  if (!base || base.length === 0) return []
  // 无限克隆补充
  const result = [...base]
  for (let i = 0; i < loadMoreCount.value; i++) {
    result.push(...base.map(item => ({ ...item, id: String(item.id) + '_clone_' + i })))
  }
  return result
})

const todayActivities = computed(() => {
  const now = Date.now()
  const nextWeek = now + 7 * 24 * 60 * 60 * 1000
  return registerableActivities.value
    .filter((item) => {
      const time = item.startAt ? new Date(item.startAt).getTime() : 0
      return time && time >= now && time <= nextWeek
    })
    .slice(0, 6)
})

const timelineActivities = computed(() => {
  return activities.value
    .filter((item) => !!item.startAt)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
})

const pastReviewItems = computed(() => {
  const now = Date.now()
  return activities.value
    .filter((item) => item.promoLinkUrl || item.promoImageUrl)
    .filter((item) => !item.startAt || new Date(item.startAt).getTime() <= now)
    .sort((a, b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : 0
      const bTime = b.startAt ? new Date(b.startAt).getTime() : 0
      return bTime - aTime
    })
})

const filteredPastReviewItems = computed(() => {
  const keyword = reviewKeyword.value.trim().toLowerCase()
  let base = pastReviewItems.value
  if (keyword) {
    base = base.filter((item) => {
      return [
        item.title,
        item.place,
        item.category,
        item.timeText,
      ].some((field) => String(field || '').toLowerCase().includes(keyword))
    })
  }
  if (!base || base.length === 0) return []
  const result = [...base]
  for (let i = 0; i < loadMoreCount.value; i++) {
    result.push(...base.map(item => ({ ...item, id: String(item.id) + '_clone_' + i })))
  }
  return result
})

function splitWaterfall(items) {
  const left = []
  const right = []
  let leftH = 0
  let rightH = 0
  items.forEach(item => {
    let h = 180 // base card height
    if (item.posterUrl || item.promoImageUrl) h += 160 // image height approx
    h += (item.title?.length || 0) * 2 // title length approx
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

const activitySquareWaterfall = computed(() => splitWaterfall(activitySquareItems.value))
const activitySquareItemsLeft = computed(() => activitySquareWaterfall.value.left)
const activitySquareItemsRight = computed(() => activitySquareWaterfall.value.right)

const recommendedWaterfall = computed(() => splitWaterfall(recommendedActivities.value))
const recommendedActivitiesLeft = computed(() => recommendedWaterfall.value.left)
const recommendedActivitiesRight = computed(() => recommendedWaterfall.value.right)

const pastReviewWaterfall = computed(() => splitWaterfall(filteredPastReviewItems.value))
const filteredPastReviewItemsLeft = computed(() => pastReviewWaterfall.value.left)
const filteredPastReviewItemsRight = computed(() => pastReviewWaterfall.value.right)

const browseModeOptions = computed(() => {
  return [
    { key: 'recommended', label: '智能推荐', visible: recommendedActivities.value.length > 0 },
    { key: 'square', label: '活动广场', visible: activitySquareItems.value.length > 0 || !!activityKeyword.value.trim() },
    { key: 'review', label: '往期回顾', visible: filteredPastReviewItems.value.length > 0 || !!reviewKeyword.value.trim() },
  ].filter((item) => item.visible)
})

const categorySections = computed(() => {
  const categoryOrder = ['崇德讲堂', '朋辈导师', '晨曦晨读']
  return categoryOrder
    .map((category) => ({
      category,
      items: registerableActivities.value.filter((item) => item.category === category).slice(0, 2),
    }))
    .filter((section) => section.items.length)
})

function openActivity(item) {
  // 如果是克隆出来的数据，需要提取出真实的原始 ID 进行跳转
  const realId = String(item.id).split('_clone_')[0]
  router.push(`/activities/${realId}`)
}

function openReview(item) {
  if (item.promoLinkUrl) {
    window.open(item.promoLinkUrl, '_blank')
    return
  }
  openActivity(item)
}

function handlePrimaryAction(item) {
  if (canRegister(item)) {
    router.push(`/activities/${item.id}/register`)
    return
  }
  openActivity(item)
}

function goCategory(category) {
  router.push({ path: '/activities', query: { category } })
}

async function scrollToSection(section) {
  if (route.path !== '/home') {
    await router.push({ path: '/home', query: { section } })
  }
  await nextTick()
  const target = document.getElementById(`mobile-home-${section}`)
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function syncSectionFromRoute() {
  const section = typeof route.query.section === 'string' ? route.query.section : ''
  if (section === 'activity-square') {
    browseMode.value = 'square'
  }
  if (section === 'recommended') {
    browseMode.value = 'recommended'
  }
  if (section === 'review') {
    browseMode.value = 'review'
  }
  if (section !== 'activity-square') return
  nextTick(() => {
    const target = document.getElementById('mobile-home-activity-square')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

watch(() => route.query.section, syncSectionFromRoute)
watch(browseModeOptions, (options) => {
  if (!options.length) return
  if (!options.some((item) => item.key === browseMode.value)) {
    browseMode.value = options.some((item) => item.key === 'square') ? 'square' : options[0].key
  }
}, { immediate: true })

const loadMoreCount = ref(0)
function handleScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const clientHeight = window.innerHeight || document.documentElement.clientHeight
  const scrollHeight = document.documentElement.scrollHeight
  if (scrollTop + clientHeight >= scrollHeight - 50) {
    loadMoreCount.value++
  }
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll)
  await fetchHomeData()
  syncSectionFromRoute()
  // 静默预加载高频页面 chunk，提升首次点击响应速度
  setTimeout(() => {
    try {
      const routesToPrefetch = ['Login', 'Register', 'UserCenter']
      routesToPrefetch.forEach(name => {
        const route = router.getRoutes().find(r => r.name === name)
        if (route && typeof route.components?.default === 'function') {
          route.components.default()
        }
      })
    } catch (e) {
      console.error('Prefetch error:', e)
    }
  }, 2000)
})

import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="mobile-home-page">
    <HomeHeroCarousel />

    <div class="mobile-home-page__content">
      <section v-if="latestAnnouncement" class="mobile-home-notice" @click="router.push('/announcements')">
        <div class="mobile-home-notice__label">最新公告</div>
        <div class="mobile-home-notice__text">{{ latestAnnouncement.title }}</div>
      </section>

      <el-skeleton :loading="loading" animated>
        <template #default>
          <section v-if="timelineActivities.length" class="mobile-home-section">
            <div class="mobile-home-timeline-card">
              <Timeline compact :activities="timelineActivities" @select="openActivity" />
            </div>
          </section>

          <section v-if="browseModeOptions.length" class="mobile-home-section">
            <div class="mobile-home-mode-switch">
              <button
                v-for="option in browseModeOptions"
                :key="option.key"
                type="button"
                class="mobile-home-mode-switch__item"
                :class="{ 'is-active': browseMode === option.key }"
                @click="browseMode = option.key"
              >
                {{ option.label }}
              </button>
            </div>
          </section>

          <section v-if="browseMode === 'recommended' && recommendedActivities.length" class="mobile-home-section">
            <div class="mobile-home-waterfall-list">
              <div class="waterfall-col">
                <article
                  v-for="(item, index) in recommendedActivitiesLeft"
                  :key="`rec-l-${item.id}`"
                  class="mobile-waterfall-card"
                  @click="openActivity(item)"
                >
                  <el-image
                    v-if="item._isReview && (item.promoImageUrl || item.posterUrl)"
                    :src="getThumbUrl(item.promoImageUrl || item.posterUrl)"
                    class="mobile-waterfall-card__poster"
                    :lazy="index >= 3"
                  >
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                  <el-image
                    v-else-if="!item._isReview && item.posterUrl"
                    :src="getThumbUrl(item.posterUrl)"
                    class="mobile-waterfall-card__poster"
                    :lazy="index >= 3"
                  >
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                  <div v-else class="mobile-waterfall-card__poster mobile-waterfall-card__poster--placeholder">活动海报</div>
                  <div class="mobile-waterfall-card__status">
                    <div v-if="getStatusTag(item).isRemain" class="mobile-tag--gradient">{{ getStatusTag(item).text }}</div>
                    <el-tag v-else :type="getStatusTag(item).type" size="small" effect="dark">{{ getStatusTag(item).text }}</el-tag>
                  </div>
                  <div class="mobile-activity-card__body">
                    <div class="mobile-waterfall-card__title">{{ item.title }}</div>
                    <div class="mobile-waterfall-card__meta">时间：{{ getDisplayTime(item) }}</div>
                    <div class="mobile-waterfall-card__meta">地点：{{ item.place || '地点待定' }}</div>
                  </div>
                </article>
              </div>
              <div class="waterfall-col">
                <article
                  v-for="(item, index) in recommendedActivitiesRight"
                  :key="`rec-r-${item.id}`"
                  class="mobile-waterfall-card"
                  @click="openActivity(item)"
                >
                  <el-image
                    v-if="item._isReview && (item.promoImageUrl || item.posterUrl)"
                    :src="getThumbUrl(item.promoImageUrl || item.posterUrl)"
                    class="mobile-waterfall-card__poster"
                    :lazy="index >= 3"
                  >
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                  <el-image
                    v-else-if="!item._isReview && item.posterUrl"
                    :src="getThumbUrl(item.posterUrl)"
                    class="mobile-waterfall-card__poster"
                    :lazy="index >= 3"
                  >
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                  <div v-else class="mobile-waterfall-card__poster mobile-waterfall-card__poster--placeholder">活动海报</div>
                  <div class="mobile-waterfall-card__status">
                    <div v-if="getStatusTag(item).isRemain" class="mobile-tag--gradient">{{ getStatusTag(item).text }}</div>
                    <el-tag v-else :type="getStatusTag(item).type" size="small" effect="dark">{{ getStatusTag(item).text }}</el-tag>
                  </div>
                  <div class="mobile-activity-card__body">
                    <div class="mobile-waterfall-card__title">{{ item.title }}</div>
                    <div class="mobile-waterfall-card__meta">时间：{{ getDisplayTime(item) }}</div>
                    <div class="mobile-waterfall-card__meta">地点：{{ item.place || '地点待定' }}</div>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section
            v-if="browseMode === 'square'"
            id="mobile-home-activity-square"
            class="mobile-home-section"
          >
            <div class="mobile-home-search">
              <el-input
                v-model="activityKeyword"
                :prefix-icon="Search"
                clearable
                placeholder="搜索活动标题 / 分类 / 导师 / 地点"
                class="mobile-home-search__input"
              />
            </div>
            <div v-if="activitySquareItems.length" class="mobile-home-waterfall-list">
              <div class="waterfall-col">
                <article
                  v-for="(item, index) in activitySquareItemsLeft"
                  :key="`square-l-${item.id}`"
                  class="mobile-waterfall-card"
                  @click="openActivity(item)"
                >
                  <el-image
                    v-if="item.posterUrl"
                    :src="getThumbUrl(item.posterUrl)"
                    class="mobile-waterfall-card__poster"
                    :lazy="index >= 3"
                  >
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                  <div v-else class="mobile-waterfall-card__poster mobile-waterfall-card__poster--placeholder">活动海报</div>
                  <div class="mobile-waterfall-card__status">
                    <div v-if="getStatusTag(item).isRemain" class="mobile-tag--gradient">{{ getStatusTag(item).text }}</div>
                    <el-tag v-else :type="getStatusTag(item).type" size="small" effect="dark">{{ getStatusTag(item).text }}</el-tag>
                  </div>
                  <div class="mobile-activity-card__body">
                    <div class="mobile-waterfall-card__title">{{ item.title }}</div>
                    <div class="mobile-waterfall-card__meta">时间：{{ getDisplayTime(item) }}</div>
                    <div class="mobile-waterfall-card__meta">地点：{{ item.place || '地点待定' }}</div>
                  </div>
                </article>
              </div>
              <div class="waterfall-col">
                <article
                  v-for="(item, index) in activitySquareItemsRight"
                  :key="`square-r-${item.id}`"
                  class="mobile-waterfall-card"
                  @click="openActivity(item)"
                >
                  <el-image
                    v-if="item.posterUrl"
                    :src="getThumbUrl(item.posterUrl)"
                    class="mobile-waterfall-card__poster"
                    :lazy="index >= 3"
                  >
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                  <div v-else class="mobile-waterfall-card__poster mobile-waterfall-card__poster--placeholder">活动海报</div>
                  <div class="mobile-waterfall-card__status">
                    <div v-if="getStatusTag(item).isRemain" class="mobile-tag--gradient">{{ getStatusTag(item).text }}</div>
                    <el-tag v-else :type="getStatusTag(item).type" size="small" effect="dark">{{ getStatusTag(item).text }}</el-tag>
                  </div>
                  <div class="mobile-activity-card__body">
                    <div class="mobile-waterfall-card__title">{{ item.title }}</div>
                    <div class="mobile-waterfall-card__meta">时间：{{ getDisplayTime(item) }}</div>
                    <div class="mobile-waterfall-card__meta">地点：{{ item.place || '地点待定' }}</div>
                  </div>
                </article>
              </div>
            </div>
            <el-empty v-else description="当前分类暂无可报名活动" :image-size="72" />
          </section>

          <section v-if="todayActivities.length" class="mobile-home-section">
            <div class="mobile-home-section__title">今日可报名</div>
            <div class="mobile-home-scroll">
              <article
                v-for="item in todayActivities"
                :key="`today-${item.id}`"
                class="mobile-mini-card"
                @click="openActivity(item)"
              >
                <div class="mobile-mini-card__title">{{ item.title }}</div>
                <div class="mobile-mini-card__meta">{{ formatDateTime(item.startAt) }}</div>
                <div class="mobile-mini-card__meta">{{ item.place }}</div>
              </article>
            </div>
          </section>

          <section v-for="section in categorySections" :key="section.category" class="mobile-home-section">
            <div class="mobile-home-section__head">
              <div class="mobile-home-section__title">{{ section.category }}</div>
              <button type="button" class="mobile-home-link" @click="goCategory(section.category)">查看更多</button>
            </div>
            <div class="mobile-home-stack">
              <article
                v-for="item in section.items"
                :key="`${section.category}-${item.id}`"
                class="mobile-category-card"
                @click="openActivity(item)"
              >
                <div class="mobile-category-card__main">
                  <div class="mobile-category-card__title">{{ item.title }}</div>
                  <div class="mobile-category-card__meta">{{ formatDateTime(item.startAt) }}</div>
                  <div class="mobile-category-card__meta">{{ item.place }}</div>
                </div>
                <button type="button" class="mobile-category-card__btn" @click.stop="handlePrimaryAction(item)">
                  {{ actionLabel(item) }}
                </button>
              </article>
            </div>
          </section>

          <section v-if="browseMode === 'review'" class="mobile-home-section">
            <div class="mobile-home-search">
              <el-input
                v-model="reviewKeyword"
                :prefix-icon="Search"
                clearable
                placeholder="搜索回顾标题 / 地点 / 分类"
                class="mobile-home-search__input"
              />
            </div>
            <div class="mobile-home-waterfall-list mobile-home-waterfall-list--review">
              <div class="waterfall-col">
                <article
                  v-for="(item, index) in filteredPastReviewItemsLeft"
                  :key="`review-l-${item.id}`"
                  class="mobile-waterfall-card"
                  @click="openActivity(item)"
                >
                  <el-image
                    v-if="item.promoImageUrl || item.posterUrl"
                    :src="getThumbUrl(item.promoImageUrl || item.posterUrl)"
                    class="mobile-waterfall-card__poster"
                    :lazy="index >= 3"
                  >
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                  <div v-else class="mobile-waterfall-card__poster mobile-waterfall-card__poster--placeholder">活动海报</div>
                  <div class="mobile-waterfall-card__status">
                    <div class="mobile-tag--gradient">往期回顾</div>
                  </div>
                  <div class="mobile-activity-card__body">
                    <div class="mobile-waterfall-card__title">{{ item.title }}</div>
                    <div class="mobile-waterfall-card__meta">时间：{{ getDisplayTime(item) }}</div>
                    <div class="mobile-waterfall-card__meta">地点：{{ item.place || '地点待定' }}</div>
                  </div>
                </article>
              </div>
              <div class="waterfall-col">
                <article
                  v-for="(item, index) in filteredPastReviewItemsRight"
                  :key="`review-r-${item.id}`"
                  class="mobile-waterfall-card"
                  @click="openActivity(item)"
                >
                  <el-image
                    v-if="item.promoImageUrl || item.posterUrl"
                    :src="getThumbUrl(item.promoImageUrl || item.posterUrl)"
                    class="mobile-waterfall-card__poster"
                    :lazy="index >= 3"
                  >
                    <template #placeholder><div class="image-skeleton"><div class="skeleton-shimmer"></div></div></template>
                  </el-image>
                  <div v-else class="mobile-waterfall-card__poster mobile-waterfall-card__poster--placeholder">活动海报</div>
                  <div class="mobile-waterfall-card__status">
                    <div class="mobile-tag--gradient">往期回顾</div>
                  </div>
                  <div class="mobile-activity-card__body">
                    <div class="mobile-waterfall-card__title">{{ item.title }}</div>
                    <div class="mobile-waterfall-card__meta">时间：{{ getDisplayTime(item) }}</div>
                    <div class="mobile-waterfall-card__meta">地点：{{ item.place || '地点待定' }}</div>
                  </div>
                </article>
              </div>
            </div>
            <el-empty v-if="!filteredPastReviewItems.length" description="暂无匹配的往期回顾" :image-size="72" />
          </section>
        </template>
      </el-skeleton>
    </div>
  </div>
</template>

<style scoped>
.mobile-home-page__content {
  padding: 18px 0 96px;
}

.mobile-home-notice,
.mobile-home-section {
  margin: 0 0 16px;
}

.mobile-home-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--mobile-radius-md);
  background: var(--mobile-surface-soft);
  box-shadow: var(--mobile-shadow-soft);
}

.mobile-home-notice__label {
  flex: 0 0 auto;
  color: #c2410c;
  font-size: 12px;
  font-weight: 800;
}

.mobile-home-notice__text {
  min-width: 0;
  color: #334155;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-home-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.mobile-home-section__title {
  color: #0f172a;
  font-size: 18px;
  font-weight: 800;
}

.mobile-home-section__desc {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.mobile-home-link {
  border: none;
  background: transparent;
  color: #f97316;
  font-size: 13px;
  font-weight: 700;
}

.mobile-home-card-list,
.mobile-home-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-home-waterfall-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.mobile-home-waterfall-list--review {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.mobile-home-waterfall-list--review .mobile-waterfall-card {
  width: 100%;
  margin: 0;
}

.mobile-home-timeline-card {
  padding: 0;
  border-radius: var(--mobile-radius-lg);
  background: transparent;
  box-shadow: none;
  overflow: hidden;
}

.mobile-home-mode-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.mobile-home-mode-switch__item {
  min-height: 40px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  box-shadow: var(--mobile-shadow-soft);
}

.mobile-home-mode-switch__item.is-active {
  background: linear-gradient(135deg, #ff7d73, #fdba74);
  color: #fff;
}

.mobile-home-search {
  margin-bottom: 12px;
}

.mobile-home-search__input :deep(.el-input__wrapper) {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 8px 20px rgba(253, 186, 116, 0.12),
    0 2px 8px rgba(255, 125, 115, 0.08);
}

.mobile-home-search__input :deep(.el-input__prefix-inner) {
  color: #f97316;
}

.mobile-activity-card,
.mobile-category-card,
.mobile-review-card {
  background: var(--mobile-surface);
  border-radius: var(--mobile-radius-lg);
  overflow: hidden;
  box-shadow: var(--mobile-shadow);
}

.mobile-waterfall-card {
  display: block;
  width: 100%;
  margin: 0;
  background: var(--mobile-surface);
  border-radius: var(--mobile-radius-lg);
  overflow: hidden;
  box-shadow: var(--mobile-shadow);
  position: relative;
}

.mobile-waterfall-card__status {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}

.mobile-tag--gradient {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 24px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  border-radius: 4px;
  background: linear-gradient(135deg, #ff7d73, #fdba74);
  box-shadow: 0 2px 6px rgba(255, 125, 115, 0.3);
}

.mobile-activity-card__poster {
  width: 100%;
  height: auto;
  background: transparent;
}

.mobile-waterfall-card__poster {
  display: block;
  width: 100%;
  height: auto;
  background: transparent;
}

.mobile-review-card__poster {
  width: 100%;
  height: auto;
  background: transparent;
}

.mobile-activity-card__poster :deep(.el-image__inner),
.mobile-waterfall-card__poster :deep(.el-image__inner),
.mobile-review-card__poster :deep(.el-image__inner) {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

.mobile-activity-card__poster--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 125, 115, 0.08), rgba(253, 186, 116, 0.14));
  color: #cbd5e1;
}

.mobile-waterfall-card__poster--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  background: linear-gradient(135deg, rgba(255, 125, 115, 0.08), rgba(253, 186, 116, 0.14));
  color: #cbd5e1;
}

.mobile-review-card__poster--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 125, 115, 0.08), rgba(253, 186, 116, 0.14));
  color: #cbd5e1;
}

.mobile-activity-card__body {
  padding: 16px;
}

.mobile-review-card__body {
  padding: 16px;
}

.mobile-activity-card__tag {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 125, 115, 0.1);
  color: #c2410c;
  font-size: 12px;
  font-weight: 700;
}

.mobile-waterfall-card__title {
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.mobile-waterfall-card__meta {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.mobile-waterfall-card__meta--remain {
  color: #ff4d4f;
  font-weight: 700;
}

.mobile-review-card__tag {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  font-size: 12px;
  font-weight: 700;
}

.mobile-activity-card__title,
.mobile-review-card__title,
.mobile-category-card__title,
.mobile-mini-card__title {
  margin-top: 10px;
  color: #0f172a;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.45;
}

.mobile-activity-card__meta,
.mobile-review-card__meta,
.mobile-category-card__meta,
.mobile-mini-card__meta {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.mobile-activity-card__action,
.mobile-review-card__action,
.mobile-category-card__btn {
  margin-top: 14px;
  width: 100%;
  min-height: 44px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #ff7d73, #fdba74);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.mobile-home-scroll {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 72%;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.mobile-mini-card {
  padding: 16px;
  border-radius: var(--mobile-radius-md);
  background: var(--mobile-surface);
  box-shadow: var(--mobile-shadow-soft);
}

.mobile-category-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
}

.mobile-category-card__main {
  min-width: 0;
  flex: 1;
}

.mobile-category-card__title {
  margin-top: 0;
}

.mobile-category-card__btn {
  width: 96px;
  margin-top: 0;
  flex: 0 0 auto;
}

@media (max-width: 768px) {
  .mobile-home-page__content {
    padding-top: 20px;
  }

  .mobile-home-waterfall-list {
    gap: 10px;
  }

  .mobile-home-waterfall-list--review {
    gap: 10px;
  }

  .mobile-waterfall-card {
    margin-bottom: 0;
  }
}
</style>
