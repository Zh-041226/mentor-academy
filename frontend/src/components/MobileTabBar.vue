<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, User } from '@element-plus/icons-vue'
import logo10 from '../assets/logo/logo.png'

const route = useRoute()
const router = useRouter()

const tabs = [
  { label: '公告', path: '/announcements', icon: Bell },
  { label: '首页', path: '/home', isCenter: true },
  { label: '我的', path: '/me', icon: User },
]

const currentPath = computed(() => route.path || '/')

function isActive(path) {
  if (path === '/home') {
    return [
      '/home',
      '/activities',
    ].some((item) => currentPath.value === item || currentPath.value.startsWith(`${item}/`))
  }
  if (path === '/me') return currentPath.value === '/me' || currentPath.value === '/my-activities'
  return currentPath.value === path || currentPath.value.startsWith(`${path}/`)
}

function go(path) {
  if (currentPath.value === path) return
  router.push(path)
}
</script>

<template>
  <nav class="mobile-tab-bar" aria-label="手机端底部导航">
    <button
      v-for="tab in tabs"
      :key="tab.path"
      type="button"
      class="mobile-tab-bar__item"
      :class="{ 
        'is-active': isActive(tab.path),
        'is-center-btn': tab.isCenter 
      }"
      @click="go(tab.path)"
    >
      <div class="item-content">
        <template v-if="tab.isCenter">
          <img :src="logo10" alt="首页" class="tab-icon center-logo" />
        </template>
        <template v-else>
          <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
        </template>
        <span class="tab-label">{{ tab.label }}</span>
      </div>
    </button>
  </nav>
</template>

<style scoped>
.mobile-tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1200;
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  height: 64px; /* 高度极大幅度压缩 */
  padding: 0 12px calc(env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.94);
  border-top: 1px solid var(--mobile-border);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(14px);
}

.mobile-tab-bar__item {
  border: none !important;
  outline: none !important; /* 确保去掉所有 focus 或 active 时的 outline */
  background: transparent !important;
  box-shadow: none !important;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.mobile-tab-bar__item:focus,
.mobile-tab-bar__item:active,
.mobile-tab-bar__item:focus-visible {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}

.item-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 16px; /* 未选中时的留白 */
  color: #64748b;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 60px;
  background: transparent !important; /* 强制去背景，包括选中状态 */
  border: none !important; /* 强制去边框 */
  outline: none !important;
  box-shadow: none !important;
}

.mobile-tab-bar__item.is-active .item-content {
  color: #ff7d73; /* 主题色 */
  padding: 6px 16px;
}

/* 中间 Logo 的特殊处理 */
.mobile-tab-bar__item.is-center-btn.is-active .item-content {
  color: #f97316;
}

.tab-icon {
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 50%;
  position: relative; /* 为光晕做准备 */
}

/* 核心：选中时的图标光晕效果 */
.mobile-tab-bar__item.is-active .tab-icon {
  transform: translateY(-2px); /* 稍微上浮一点，让光晕更有空间 */
}

/* 普通图标的光晕（伪元素实现） */
.mobile-tab-bar__item:not(.is-center-btn).is-active .tab-icon::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 32px;
  height: 32px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 125, 115, 0.4) 0%, rgba(255, 125, 115, 0) 70%);
  border-radius: 50%;
  z-index: -1; /* 放在图标下面 */
  animation: pulse-glow 2s infinite ease-in-out; /* 增加呼吸感动画 */
}

/* 中心 Logo 本身的光晕 */
.mobile-tab-bar__item.is-center-btn.is-active .center-logo {
  box-shadow: 0 0 16px rgba(253, 186, 116, 0.5), 0 0 8px rgba(255, 125, 115, 0.4);
  transform: scale(1.05); /* 选中时稍微放大一丢丢 */
}

.center-logo {
  width: 36px; /* 进一步放大首页图标，形成显著反差 */
  height: 36px;
  object-fit: cover;
  border-radius: 50%;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(253, 186, 116, 0.2); /* 微微增加光影让其更有立体感 */
}

.tab-label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  /* 动画核心逻辑：平时垂直收缩 */
  max-height: 0;
  opacity: 0;
  margin-top: 0;
  transform: translateY(-4px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-tab-bar__item.is-active .tab-label {
  /* 选中时垂直展开 */
  max-height: 20px;
  opacity: 1;
  margin-top: 4px;
  transform: translateY(0);
}
@keyframes pulse-glow {
  0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
  50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
}
</style>
