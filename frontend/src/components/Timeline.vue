<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'

const props = defineProps({
  activities: { type: Array, default: () => [] },
  groupBy: { type: String, default: 'month' },
  onlyRegisterable: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

function pad(n) { return String(n).padStart(2, '0') }

function formatDate(d) {
  try {
    const dt = new Date(d)
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
  } catch {
    return ''
  }
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

function canRegister(it) {
  const closed = String(it.status || '').toUpperCase() === 'CLOSED'
  return !(isFull(it) || isDeadline(it) || closed)
}

function getTimeStatus(it) {
  const ts = new Date(it.startAt).getTime()
  if (!Number.isFinite(ts)) return 'future'
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const endOfToday = startOfToday + 24 * 3600 * 1000
  if (ts < startOfToday) return 'past'
  if (ts < endOfToday) return 'current'
  return 'future'
}

const filtered = computed(() => {
  const base = (props.activities || []).filter(it => !!it.startAt)
  return props.onlyRegisterable ? base.filter(canRegister) : base
})

const flatItems = computed(() => (
  filtered.value
    .map(it => ({ ...it, timeStatus: getTimeStatus(it) }))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
))

const summary = computed(() => {
  const base = { past: 0, current: 0, future: 0 }
  flatItems.value.forEach((it) => {
    base[it.timeStatus] += 1
  })
  return base
})

const focusId = computed(() => {
  const currentItem = flatItems.value.find(it => it.timeStatus === 'current')
  if (currentItem) return currentItem.id
  const futureItem = flatItems.value.find(it => it.timeStatus === 'future')
  if (futureItem) return futureItem.id
  return flatItems.value.length ? flatItems.value[flatItems.value.length - 1].id : null
})

const activeIndex = ref(0)

const activeItem = computed(() => flatItems.value[activeIndex.value] || null)

function clampIndex(index) {
  if (!flatItems.value.length) return 0
  return Math.min(flatItems.value.length - 1, Math.max(0, index))
}

function syncActiveIndex() {
  if (!flatItems.value.length) {
    activeIndex.value = 0
    return
  }
  const idx = flatItems.value.findIndex(it => it.id === focusId.value)
  activeIndex.value = idx >= 0 ? idx : clampIndex(activeIndex.value)
}

function step(delta) {
  activeIndex.value = clampIndex(activeIndex.value + delta)
}

function locateNearest() {
  syncActiveIndex()
}

function jumpTo(index) {
  activeIndex.value = clampIndex(index)
}

function onWheel(event) {
  if (!flatItems.value.length) return
  if (Math.abs(event.deltaY) < 8) return
  step(event.deltaY > 0 ? 1 : -1)
}

// === 移动端滑动逻辑 (Touch Events) ===
const touchStartY = ref(0)
const touchCurrentY = ref(0)
const isTouching = ref(false)

function onTouchStart(e) {
  if (!flatItems.value.length) return
  touchStartY.value = e.touches[0].clientY
  touchCurrentY.value = touchStartY.value
  isTouching.value = true
}

function onTouchMove(e) {
  if (!isTouching.value) return
  touchCurrentY.value = e.touches[0].clientY
  const deltaY = touchStartY.value - touchCurrentY.value
  
  // 增加阻尼感，滑动距离超过一定阈值才切换
  if (Math.abs(deltaY) > 40) {
    step(deltaY > 0 ? 1 : -1)
    // 重置起点，允许连续滑动切换多个
    touchStartY.value = touchCurrentY.value
  }
}

function onTouchEnd() {
  isTouching.value = false
}

function onSelect(it) {
  emit('select', it)
}

const ARC = {
  width: 188,
  height: 320,
  centerX: 43.02,
  centerY: 180,
  radius: 132,
  startDeg: -77.76,
  endDeg: 77.76,
}

const RAIL = {
  width: 118,
  height: 200,
}

const railMetrics = computed(() => {
  if (props.compact) {
    return { width: 96, height: 164 }
  }
  return RAIL
})

function getCurvePoint(t) {
  const angle = (ARC.startDeg + (ARC.endDeg - ARC.startDeg) * t) * Math.PI / 180
  const x = (ARC.centerX + ARC.radius * Math.cos(angle)) * (railMetrics.value.width / ARC.width)
  const y = (ARC.centerY + ARC.radius * Math.sin(angle)) * (railMetrics.value.height / ARC.height)
  return { x, y }
}

function getMarkerLabelStyle(marker) {
  return {
    left: `${parseFloat(marker.x) + 28}px`,
    top: marker.y,
  }
}

function getActiveFocusStyle() {
  if (!activeMarker.value) return {}
  return {
    top: activeMarker.value.y,
  }
}

const axisMarkers = computed(() => {
  if (!flatItems.value.length) return []
  const offsets = [-2, -1, 0, 1, 2]
  return offsets
    .map((offset, i) => {
      const index = activeIndex.value + offset
      if (index < 0 || index >= flatItems.value.length) return null
      const item = flatItems.value[index]
      const ratio = offsets.length === 1 ? 0.5 : i / (offsets.length - 1)
      const point = getCurvePoint(ratio)
      return {
        index,
        item,
        offset,
        x: `${point.x}px`,
        y: `${point.y}px`,
      }
    })
    .filter(Boolean)
})

const activeMarker = computed(() => axisMarkers.value.find(marker => marker.offset === 0) || null)

onMounted(() => {
  nextTick(syncActiveIndex)
})

watch([flatItems, focusId], () => nextTick(syncActiveIndex), { immediate: true })
</script>

<template>
  <div class="timeline-wrap" :class="{ 'is-compact': compact }">
    <div v-if="!compact" class="tl-header">
      <div>
        <div class="title">活动时间轴</div>
      </div>
    </div>

    <div 
      class="curve-stage" 
      @wheel.prevent="onWheel"
      @touchstart="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend="onTouchEnd"
    >
      <div v-if="activeItem" class="curve-rail">
        <svg class="curve-svg" :viewBox="`0 0 ${ARC.width} ${ARC.height}`" aria-hidden="true">
          <defs>
            <linearGradient id="curveTrackGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="rgba(255, 125, 115, 0.18)" />
              <stop offset="50%" stop-color="rgba(253, 186, 116, 0.38)" />
              <stop offset="100%" stop-color="rgba(255, 125, 115, 0.18)" />
            </linearGradient>
            <linearGradient id="curveTrackEdge" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FF7D73" />
              <stop offset="50%" stop-color="#FDBA74" />
              <stop offset="100%" stop-color="#FF7D73" />
            </linearGradient>
            <linearGradient id="curveTrackMid" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FF8A7F" />
              <stop offset="50%" stop-color="#FDBA74" />
              <stop offset="100%" stop-color="#FF8A7F" />
            </linearGradient>
            <filter id="curveSoftGlow" x="-30%" y="-20%" width="160%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d="M 71 51 A 132 132 0 0 1 71 309" pathLength="100" class="curve-path curve-path--glow" />
          <path d="M 71 51 A 132 132 0 0 1 71 309" pathLength="100" class="curve-path curve-path--top" />
          <path d="M 71 51 A 132 132 0 0 1 71 309" pathLength="100" class="curve-path curve-path--mid" />
          <path d="M 71 51 A 132 132 0 0 1 71 309" pathLength="100" class="curve-path curve-path--bottom" />
        </svg>

        <div
          v-for="marker in axisMarkers"
          :key="`marker-${marker.index}`"
          class="curve-marker"
          :class="[
            `is-${marker.item.timeStatus}`,
            `depth-${Math.abs(marker.offset)}`,
            { active: marker.offset === 0, 'is-upper': marker.offset < 0, 'is-lower': marker.offset > 0 }
          ]"
          :style="{ left: marker.x, top: marker.y }"
          @click="jumpTo(marker.index)"
        >
          <span v-if="marker.offset === 0" class="curve-date" :class="{ active: marker.offset === 0 }">
            {{ formatDate(marker.item.startAt) }}
          </span>
          <span class="curve-marker__dot"></span>
        </div>
        <div
          v-for="marker in axisMarkers.filter(item => Math.abs(item.offset) === 1)"
          :key="`marker-label-${marker.index}`"
          class="curve-side-label"
          :class="[`is-${marker.item.timeStatus}`, { 'is-upper': marker.offset < 0, 'is-lower': marker.offset > 0 }]"
          :style="getMarkerLabelStyle(marker)"
          @click="jumpTo(marker.index)"
        >
          {{ marker.item.title }}
        </div>
      </div>

      <div v-if="activeItem" class="focus-panel">
        <div class="focus-list">
          <button
            type="button"
            class="focus-name is-active-focus"
            :class="`is-${activeItem.timeStatus}`"
            :style="getActiveFocusStyle()"
            @click="onSelect(activeItem)"
          >
            <span class="focus-name__index">{{ activeIndex + 1 }} / {{ flatItems.length }}</span>
            <span class="focus-name__title">{{ activeItem.title }}</span>
          </button>
        </div>
      </div>

      <div v-else class="empty-wrap">
        <div class="empty-text">暂无可展示的活动时间轴数据</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-wrap { padding: 6px 0 12px; }
.tl-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 2px 6px 8px; flex-wrap: wrap; }
.tl-header .title { font-weight: 700; font-size: 16px; color: #0f172a; }
.subtitle { margin-top: 3px; font-size: 11px; color: #64748b; }
.legend { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.legend-pill {
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid transparent;
}
.legend-pill.past { color: #64748b; background: rgba(148, 163, 184, 0.12); border-color: rgba(148, 163, 184, 0.16); }
.legend-pill.current { color: #9a3412; background: rgba(255, 125, 115, 0.14); border-color: rgba(255, 125, 115, 0.2); }
.legend-pill.future { color: #b45309; background: rgba(253, 186, 116, 0.16); border-color: rgba(253, 186, 116, 0.24); }
.controls { display: flex; gap: 8px; }
.neo-icon-btn {
  padding: 5px 9px;
  border-radius: 9px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  color: #334155;
  font-size: 11px;
}
.neo-icon-btn:hover { background: rgba(255, 255, 255, 0.95); }

.curve-stage {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 208px;
  padding: 2px 4px 4px;
}
.curve-rail {
  position: relative;
  width: 118px;
  height: 200px;
}
.curve-svg {
  width: auto;
  height: 200px;
  display: grid;
  flex-direction: column;
  overflow: visible;
}
.curve-path {
  fill: none;
  stroke-linecap: round;
}
.curve-path--glow {
  stroke: url(#curveTrackGlow);
  stroke-width: 7;
  opacity: 0.48;
  filter: url(#curveSoftGlow);
}
.curve-path--top {
  stroke: url(#curveTrackEdge);
  stroke-width: 1.15;
  stroke-dasharray: 30 70;
  opacity: 0.72;
}
.curve-path--mid {
  stroke: url(#curveTrackMid);
  stroke-width: 3.3;
  stroke-dasharray: 40 60;
  stroke-dashoffset: -30;
  opacity: 0.96;
}
.curve-path--bottom {
  stroke: url(#curveTrackEdge);
  stroke-width: 1.15;
  stroke-dasharray: 30 70;
  stroke-dashoffset: -70;
  opacity: 0.72;
}
.curve-rail__hint {
  position: absolute;
  left: 4px;
  font-size: 9px;
  color: #94a3b8;
  letter-spacing: 0.04em;
}
.curve-rail__hint--top { top: 4px; }
.curve-rail__hint--bottom { bottom: 4px; }
.curve-marker {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transform: translate(-50%, -50%);
  z-index: 10;
}
.curve-marker__dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(180deg, #ffb2a6 0%, #ff7d73 100%);
  border: 1px solid rgba(255, 249, 246, 0.9);
  box-shadow:
    0 0 0 3px rgba(255, 226, 220, 0.34),
    0 8px 16px rgba(255, 125, 115, 0.24);
  transition: all 0.3s;
}
.curve-marker.depth-2 .curve-marker__dot {
  width: 6px;
  height: 6px;
}
.curve-marker.depth-1 .curve-marker__dot {
  width: 9px;
  height: 9px;
}
.curve-marker.depth-0 .curve-marker__dot {
  width: 14px;
  height: 14px;
}
.curve-marker.is-upper .curve-marker__dot {
  background: linear-gradient(180deg, #ffb8ad 0%, #ff8f84 100%);
  box-shadow:
    0 0 0 3px rgba(255, 232, 227, 0.34),
    0 7px 14px rgba(255, 143, 132, 0.22);
}
.curve-marker.is-lower .curve-marker__dot {
  background: linear-gradient(180deg, #ffd08a 0%, #f59e0b 100%);
  box-shadow:
    0 0 0 3px rgba(255, 241, 213, 0.3),
    0 7px 14px rgba(245, 158, 11, 0.24);
}
.curve-marker.is-current .curve-marker__dot,
.curve-marker.depth-0 .curve-marker__dot {
  background: linear-gradient(180deg, #ff9b7f 0%, #ff6b57 100%);
  border-color: rgba(255, 249, 246, 0.96);
  box-shadow:
    0 0 0 5px rgba(255, 214, 199, 0.42),
    0 12px 24px rgba(255, 107, 87, 0.3);
}
.curve-date {
  position: absolute;
  right: 30px;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 500;
  color: #94a3b8;
  pointer-events: none;
  transition: all 0.3s;
}
.curve-date.active {
  font-weight: 700;
  color: #475569;
  font-size: 18px;
}
.curve-side-label {
  position: absolute;
  transform: translateY(-50%);
  max-width: 180px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transform-origin: left center;
  transition: opacity 0.25s ease, transform 0.25s ease, color 0.25s ease;
}
.curve-side-label.is-upper {
  opacity: 0.82;
}
.curve-side-label.is-lower {
  opacity: 0.56;
  font-style: italic;
}
.curve-side-label:hover {
  opacity: 0.92;
  color: #64748b;
}

.focus-panel {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  position: relative;
  height: 200px;
}
.focus-list {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 0;
  width: 100%;
  height: 100%;
  position: relative;
  perspective: 600px;
}
.focus-name {
  position: absolute;
  top: 50%;
  left: 0;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 14px;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
  padding: 14px 18px;
  border-radius: 999px;
  border: none;
  background-image: linear-gradient(135deg, #ff7d73, #fdba74);
  color: #fff;
  box-shadow:
    0 6px 16px rgba(253, 186, 116, 0.26),
    0 2px 6px rgba(255, 125, 115, 0.26);
  cursor: pointer;
  text-align: left;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
  transform: translateY(-50%);
}
.focus-name.is-active-focus {
  z-index: 2;
  transform: translateY(-50%);
}
.focus-name.is-active-focus.is-current {
  background-image: linear-gradient(135deg, #ff7d73, #fdba74);
}
.focus-name.is-active-focus.is-future {
  background-image: linear-gradient(135deg, #ff7d73, #fdba74);
  border-width: 0;
  border-style: solid;
  border-color: #000000;
  border-radius: 20px;
}
.focus-name.is-active-focus.is-past {
  background-image: linear-gradient(135deg, #ff8f84, #fdc48b);
}
.focus-name.is-active-focus:hover {
  transform: translateY(calc(-50% - 1px));
  box-shadow:
    0 10px 24px rgba(253, 186, 116, 0.3),
    0 4px 12px rgba(255, 125, 115, 0.32);
  filter: brightness(1.05);
}
.focus-name__index {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.82);
  font-weight: 600;
  flex: 0 0 auto;
}
.focus-name__title {
  display: block;
  min-width: 0;
  flex: 1 1 auto;
  font-size: 20px;
  line-height: 1.4;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.timeline-wrap.is-compact .tl-header {
  margin: 0 4px 6px;
}
.timeline-wrap.is-compact .tl-header .title {
  font-size: 15px;
}
.timeline-wrap.is-compact .curve-stage {
  grid-template-columns: 96px minmax(0, 1fr);
  min-height: 172px;
  gap: 4px;
}
.timeline-wrap.is-compact .curve-rail,
.timeline-wrap.is-compact .focus-panel {
  height: 164px;
}
.timeline-wrap.is-compact .curve-rail {
  width: 96px;
}
.timeline-wrap.is-compact .curve-svg {
  height: 164px;
}
.timeline-wrap.is-compact .curve-marker {
  width: 20px;
  height: 20px;
}
.timeline-wrap.is-compact .curve-date {
  right: 24px;
  font-size: 12px;
}
.timeline-wrap.is-compact .curve-date.active {
  font-size: 14px;
}
.timeline-wrap.is-compact .curve-side-label {
  max-width: 128px;
  font-size: 11px;
}
.timeline-wrap.is-compact .focus-name {
  gap: 10px;
  padding: 10px 14px;
}
.timeline-wrap.is-compact .focus-name__index {
  font-size: 12px;
}
.timeline-wrap.is-compact .focus-name__title {
  font-size: 15px;
}

.empty-wrap {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}
.empty-text {
  color: #94a3b8;
  font-size: 14px;
}

@media (max-width: 768px) {
  .curve-stage {
    grid-template-columns: 1fr;
    min-height: auto;
    gap: 10px;
  }
  .curve-rail {
    margin: 0 auto;
  }
  .focus-panel {
    justify-content: center;
  }
  .focus-name {
    min-width: 0;
    width: 100%;
  }
  .focus-name__title {
    font-size: 12px;
  }
}
</style>
