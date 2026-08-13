<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { fetchHeroSlides, getDefaultHeroSlides } from '../services/mobileHomeData'

// 默认海报（用于后端 hero 目录为空或接口异常时的兜底）
// 改为使用前端静态目录 /hero（frontend/public/hero 下的 01~04.jpg），避免开发环境代理不可用导致的请求中止
// 动态海报：优先读取后端 /api/hero-slides 列表
const slides = ref(getDefaultHeroSlides())
const autoplay = computed(() => (Array.isArray(slides.value) ? slides.value.length > 1 : false))
const currentSlide = ref(0)
const totalSlides = computed(() => (Array.isArray(slides.value) ? slides.value.length : 0))
const loadedSlideIndexes = ref(new Set([0]))
async function loadSlides() {
  // 默认先显示前端内置海报，然后尝试请求后端列表，成功则替换
  slides.value = getDefaultHeroSlides()
  try {
    slides.value = await fetchHeroSlides()
  } catch (e) {
    // 忽略错误，保持默认海报
  }
}

// 动态计算导航高度，确保刚好铺满第一屏（不下拉）
const navHeight = ref(64)
const appPaddingTop = ref(0)
const appPaddingBottom = ref(0)
// 设备尺寸检测：手机端行为控制（隐藏向下提示/外圈，仅保留圆点）
const isMobile = ref(false)
const heroHeight = computed(() => {
  // 直接填满视窗高度，让导航条覆盖在上层（fixed + z-index）
  return '100vh'
})
// 为了实现“顶到最上面”，需要把组件整体上移 #app 的 paddingTop，避免出现顶部空隙
const offsetTop = computed(() => `-${Math.max(0, appPaddingTop.value)}px`)
// 为了让底部也无空隙，使用负的 margin-bottom 抵消 #app 的 paddingBottom
const offsetBottom = computed(() => `-${Math.max(0, appPaddingBottom.value)}px`)

function updateNavHeight() {
  try {
    const el = document.querySelector('.nav')
    if (el) navHeight.value = el.offsetHeight || 64
  } catch {}
}

function updateAppPadding() {
  try {
    const app = document.getElementById('app')
    if (!app) { appPaddingTop.value = 0; appPaddingBottom.value = 0; return }
    const cs = getComputedStyle(app)
    const pt = parseInt(cs.paddingTop || '0', 10)
    const pb = parseInt(cs.paddingBottom || '0', 10)
    appPaddingTop.value = Number.isFinite(pt) ? pt : 0
    appPaddingBottom.value = Number.isFinite(pb) ? pb : 0
  } catch { appPaddingTop.value = 0; appPaddingBottom.value = 0 }
}

function onResize() { updateNavHeight() }
function handleWindowResize() { onResize(); updateAppPadding(); updateIsMobile() }
function updateIsMobile() {
  try {
    isMobile.value = window.matchMedia('(max-width: 768px)').matches
  } catch { isMobile.value = false }
}

onMounted(() => {
  updateNavHeight()
  updateAppPadding()
  updateIsMobile()
  window.addEventListener('resize', handleWindowResize)
  // 加载动态海报
  loadSlides()
})
onBeforeUnmount(() => { window.removeEventListener('resize', handleWindowResize) })

// ========== 触摸滑动：在手机端支持左右滑动切换幻灯片 ==========
// 自定义淡入淡出轮播，不再使用 Element Plus 的 el-carousel
const touchAreaRef = ref(null)
let startX = 0
let startY = 0
let swiping = false
const SWIPE_THRESHOLD = 40 // 横向滑动触发阈值（px）
const SLOPE_TOLERANCE = 1.5 // 水平位移需显著大于垂直位移，避免与页面滚动冲突

function onTouchStart(e) {
  try {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    startX = t.clientX
    startY = t.clientY
    swiping = true
  } catch {}
}
function onTouchMove(e) {
  if (!swiping) return
  try {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    // 当判断为水平滑动意图时，阻止浏览器默认的水平滚动（保留垂直滚动）
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * SLOPE_TOLERANCE) {
      try { e.preventDefault() } catch {}
    }
  } catch {}
}
function onTouchEnd(e) {
  if (!swiping) return
  swiping = false
  try {
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0])
    if (!t) return
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    const isHorizontal = Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * SLOPE_TOLERANCE
    if (isHorizontal) {
      if (dx < 0) nextSlide()
      else prevSlide()
    }
  } catch {}
}

// 导航：上一张/下一张
function nextSlide() {
  try {
    const total = totalSlides.value || 0
    if (total <= 0) return
    currentSlide.value = (currentSlide.value + 1) % total
    restartAutoplay()
  } catch {}
}
function prevSlide() {
  try {
    const total = totalSlides.value || 0
    if (total <= 0) return
    currentSlide.value = (currentSlide.value - 1 + total) % total
    restartAutoplay()
  } catch {}
}

// 点击（触控）圆点跳转到指定幻灯片
function goToSlide(index) {
  try {
    const total = totalSlides.value || 0
    if (index < 0 || index >= total) return
    currentSlide.value = index
    restartAutoplay()
  } catch {}
}

function ensureSlideLoaded(index) {
  if (index < 0 || index >= totalSlides.value) return
  if (loadedSlideIndexes.value.has(index)) return
  loadedSlideIndexes.value = new Set([...loadedSlideIndexes.value, index])
}

function shouldRenderImage(index) {
  return loadedSlideIndexes.value.has(index)
}

// 点击提示圈触发页面向下滚动（滚动一个 Hero 的高度）
function scrollDownFromHero() {
  try {
    const el = touchAreaRef.value
    const delta = (el && Number.isFinite(el.offsetHeight) && el.offsetHeight > 0)
      ? el.offsetHeight
      : (window.innerHeight || 600)
    // 使用 scrollBy 简化偏移量计算，兼容移动端
    window.scrollBy({ top: delta, behavior: 'smooth' })
  } catch {}
}
function onHintAction() {
  // 手机端不再触发“向下滚动”提示行为，仅保留圆点
  if (isMobile.value) return
  scrollDownFromHero()
}

// 自动轮播：淡入淡出间隔
let autoplayTimer = null
function startAutoplay() {
  try {
    stopAutoplay()
    if (!autoplay.value) return
    autoplayTimer = setInterval(() => { nextSlide() }, 5000)
  } catch {}
}
function stopAutoplay() { try { if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null } } catch {} }
function restartAutoplay() { startAutoplay() }

onMounted(() => {
  const el = touchAreaRef.value
  if (el) {
    // 在容器上注册触摸事件（move 需 passive: false 才能 preventDefault）
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
  }
  // 动态海报列表更新后，统一重置到第 0 页，保持圆点与图片对齐
  watch(slides, async () => {
    currentSlide.value = 0
    loadedSlideIndexes.value = new Set([0])
    ensureSlideLoaded(1)
    await nextTick()
    startAutoplay()
  })
  // 根据是否可自动轮播启动/停止
  watch(autoplay, () => { startAutoplay() })
  watch(currentSlide, (value) => {
    ensureSlideLoaded(value)
    ensureSlideLoaded((value + 1) % Math.max(totalSlides.value, 1))
  }, { immediate: true })
  startAutoplay()
})
onBeforeUnmount(() => {
  const el = touchAreaRef.value
  if (el) {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchEnd)
  }
  stopAutoplay()
})

// ========== 向下滑动提示（圆形描边 + 下箭头 + 文案），始终可见；滚动时做上抬与缩放 ==========
const showScrollHint = ref(true) // 始终显示，不再自动隐藏
const scrollProgress = ref(0) // 0~1，滚动前 400px 的进度
function updateScrollProgress() {
  try {
    const y = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
    const limit = 400 // 前 400px 用于“上抬缩放”动画
    scrollProgress.value = Math.min(1, Math.max(0, y / limit))
  } catch {}
}
onMounted(() => {
  updateScrollProgress()
  window.addEventListener('scroll', updateScrollProgress, { passive: true })
})
onBeforeUnmount(() => { window.removeEventListener('scroll', updateScrollProgress) })
const hintStyle = computed(() => {
  const p = scrollProgress.value
  const translateY = (-8 - 18 * p).toFixed(2) + 'vmin' // 越往下滚，提示越往上抬
  const scale = (1 - 0.15 * p).toFixed(3)             // 同时轻微缩小
  return { transform: `translateX(-50%) translateY(${translateY}) scale(${scale})` }
})

// 立体感：根据滚动进度为海报添加 3D 翻转与轻微视差
const tiltStyle = computed(() => {
  const p = scrollProgress.value
  const deg = Math.min(12, Math.max(0, p * 12))
  const translateY = (-p * 18).toFixed(2) + 'px'
  return {
    '--tilt-rotate': `${deg}deg`,
    '--tilt-translateY': translateY,
    '--tilt-shadow': `${(0.10 + 0.20 * p).toFixed(3)}`
  }
})
</script>

<template>
  <div ref="touchAreaRef" class="home-hero full-bleed" :style="{ height: heroHeight, marginTop: offsetTop, marginBottom: offsetBottom }">
    <!-- 自定义淡入淡出轮播（替代左右滑动效果） -->
    <div class="fade-carousel" :style="tiltStyle">
      <div
        v-for="(s, i) in slides"
        :key="i"
        class="fade-slide"
        :class="{ active: i === currentSlide }"
        :aria-label="s.alt"
      >
        <img
          class="fade-slide__image"
          :src="s.src"
          :alt="s.alt || `海报${i + 1}`"
          loading="eager"
          fetchpriority="high"
          decoding="async"
        >
        <div class="overlay"></div>
        <div class="bottom-mask"></div>
      </div>

      <!-- 左右导航箭头（样式沿用原主题） -->
      <button class="nav-arrow left" aria-label="上一张" @click="prevSlide">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button class="nav-arrow right" aria-label="下一张" @click="nextSlide">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>

    <!-- 向下滚动提示（叠加在轮播顶部，指示用户下滑查看更多内容） -->
    <div v-if="showScrollHint && totalSlides > 0" class="scroll-hint" :style="isMobile ? null : hintStyle" aria-hidden="false">
      <div class="hint-circle" role="button" tabindex="0" aria-label="向下滑动查看更多内容" @pointerdown.stop="onHintAction" @click.stop="onHintAction" @keydown.enter.prevent.stop="onHintAction" @keydown.space.prevent.stop="onHintAction">
        <svg class="hint-arrow" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6v8"/>
          <path d="M6 12l6 6 6-6"/>
        </svg>
        <div class="hint-text">向下滑动</div>
        <div class="hint-dots">
          <span
            v-for="n in totalSlides"
            :key="n"
            class="dot"
            :class="{ active: (n - 1) === currentSlide }"
            role="button"
            tabindex="0"
            aria-label="切换到第{{ n }}张"
            @pointerdown.stop.prevent="goToSlide(n - 1)"
            @click.stop.prevent="goToSlide(n - 1)"
            @keydown.enter.prevent.stop="goToSlide(n - 1)"
            @keydown.space.prevent.stop="goToSlide(n - 1)"
          ></span>
        </div>
      </div>
    </div>
  </div>
  
</template>

<style scoped>
.home-hero {
  width: 100%;
  position: relative;
  /* 允许垂直滚动，禁用水平默认手势，便于自定义左右滑动 */
  touch-action: pan-y;
  /* 主题色变量（可按需调整为你们的品牌色） */
  /* 模仿导航条渐变的主色：取中段 D6BA84 作为不透明主题色 */
  --theme-primary: #D6BA84; /* RGB(214,186,132) */
  --theme-primary-20: rgba(214, 186, 132, 0.20);
  --theme-primary-35: rgba(214, 186, 132, 0.35);
  --theme-primary-60: rgba(214, 186, 132, 0.60);
}
.full-bleed {
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
}
.hero-carousel {
  width: 100%;
  height: 100%;
}
.hero-carousel :deep(.el-carousel__container) {
  height: 100% !important;
}
.slide {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}
.overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.10), rgba(0,0,0,0.25));
}
.bottom-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: clamp(64px, 18vmin, 220px); /* 自适应高度：手机更柔和，桌面不突兀 */
  pointer-events: none; /* 不遮挡交互 */
  /* 仿照导航条的金色渐变，但从透明到金色过渡，避免遮挡过强 */
  background: linear-gradient(
    180deg,
    rgba(231, 210, 168, 0.00) 0%,  /* 顶部透明，避免明显分界线 */
    rgba(231, 210, 168, 0.20) 30%,
    rgba(214, 186, 132, 0.40) 65%,
    rgba(190, 150, 90, 0.65) 100%
  );
  z-index: 1;
}
.caption {
  position: absolute;
  left: 50%;
  bottom: 8%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 42px;
  font-weight: 800;
  text-shadow: 0 6px 16px rgba(0,0,0,0.35);
}

/* 移动端高度适配，视觉更舒适 */
@media (max-width: 768px) {
  /* 手机端采用 16:9 海报比例，高度随屏幕宽度变化 */
  .home-hero { height: 56.25vw !important; }
}

/* 向下滚动提示样式 */
.scroll-hint {
  position: absolute;
  left: 50%;
  bottom: -13vmin; /* 大胆再小一档，保持半圆视觉 */
  transform: translateX(-50%);
  width: 26vmin;
  height: 26vmin;
  border-radius: 50%;
  /* 恢复为原来的白色圆圈样式（边框+内阴影） */
  border: 1.4px solid rgba(255,255,255,0.65);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.25) inset;
  z-index: 10;
  pointer-events: auto; /* 允许点击圆点控制海报切换 */
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}
/* 自定义淡入淡出轮播样式 */
.fade-carousel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  perspective: 1000px;
  transform-style: preserve-3d;
}
.fade-slide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: scale(0.98) rotateX(var(--tilt-rotate, 0deg)) translateY(var(--tilt-translateY, 0px));
  transition: opacity .5s ease, transform .5s ease, box-shadow .5s ease;
  pointer-events: none; /* 避免非激活页拦截事件 */
  will-change: transform;
  box-shadow: 0 30px 60px rgba(0,0,0, calc(var(--tilt-shadow, 0.12)));
}
.fade-slide__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}
.fade-slide.active {
  opacity: 1;
  transform: scale(1) rotateX(var(--tilt-rotate, 0deg)) translateY(var(--tilt-translateY, 0px));
  pointer-events: auto;
}
.hint-circle { position: relative; text-align: center; }
.hint-circle { cursor: pointer; }
.hint-text {
  margin-top: 6px;
  color: rgba(255,255,255,0.92);
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 2px 8px rgba(0,0,0,0.35);
}
.hint-dots {
  margin-top: 8px;
  display: inline-flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  pointer-events: auto; /* 允许点击/触控 */
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.35);
  box-shadow: 0 1px 3px rgba(0,0,0,0.35);
  transition: background-color .25s ease;
  cursor: pointer;
  outline: none;
  /* 让点击更响应，避免 300ms 点击延迟 */
  touch-action: manipulation;
}
.dot:focus { box-shadow: 0 0 0 2px var(--theme-primary-35); }
.dot.active { background: var(--theme-primary); }
.hint-arrow {
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
  animation: hintBounce 1.6s ease-in-out infinite;
  color: #fff; /* 箭头为纯白色 */
}
@keyframes hintBounce {
  0%, 100% { transform: translateY(-4px); opacity: 0.9; }
  50% { transform: translateY(6px); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { .hint-arrow { animation: none; } }

/* 左右导航箭头（自定义） */
.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--theme-primary-20);
  border: 1px solid var(--theme-primary-60);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.nav-arrow.left { left: 16px; }
.nav-arrow.right { right: 16px; }
.nav-arrow:hover { background-color: var(--theme-primary-35); }

/* 移动端过渡稍微更快一些 */
@media (max-width: 768px) {
  .fade-slide { transition: opacity .4s ease, transform .4s ease; }
  /* 手机端仅保留触碰滑动，隐藏左右按键 */
  .nav-arrow { display: none; }
}

/* 手机端：移除向下滑动提示与外圈，仅保留圆点，并将圆点上移 */
@media (max-width: 768px) {
  .scroll-hint {
    bottom: 10vmin; /* 从半圆位置提升到画面内部，向上移动 */
    width: auto;
    height: auto;
    border: none;
    box-shadow: none;
  }
  .hint-circle { width: auto; height: auto; }
  .hint-arrow, .hint-text { display: none; }
  .hint-dots { margin-top: 0; }
}

/* 无障碍：用户偏好减少动画时，禁用过渡 */
@media (prefers-reduced-motion: reduce) {
  .fade-slide { transition: none; }
}
</style>
