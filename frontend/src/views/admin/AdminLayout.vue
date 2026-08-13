<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import http from '../../api/http'

const router = useRouter()
const route = useRoute()
const active = ref(route.path)
const me = ref(null)
const drawerVisible = ref(false)
const level = computed(() => me.value?.adminLevel || '')
const isStaff = computed(() => level.value === 'STAFF')
const isMengsuilianyun = computed(() => level.value === 'MENGSUILIANYUN')
const menuGroups = computed(() => {
  const base = [
    {
      title: '工作台',
      items: [
        { path: '/admin/dashboard', label: '仪表盘', icon: '●' },
        { path: '/admin/registrations', label: '活动报名管理', icon: '●' }
      ]
    },
    {
      title: '系统管理',
      items: [
        ...(!isStaff.value ? [{ path: '/admin/activities', label: '活动管理', icon: '●' }, { path: '/admin/announcements', label: '公告管理', icon: '●' }, { path: '/admin/users', label: '用户管理', icon: '●' }] : []),
        ...(isMengsuilianyun.value ? [{ path: '/admin/poster', label: '海报设置', icon: '●' }] : [])
      ]
    }
  ]
  return base.map(group => ({ ...group, items: group.items.filter(Boolean) })).filter(group => group.items.length)
})

async function fetchMe() {
  try {
    const { data } = await http.get('/users/me')
    me.value = data || null
  } catch {}
}

function go(path) {
  active.value = path
  drawerVisible.value = false
  router.push(path)
}

watch(() => route.path, (path) => {
  active.value = path
})

onMounted(fetchMe)
</script>

<template>
  <div class="admin-shell">
    <!-- 手机端顶部导航条 -->
    <header class="mobile-header">
      <button class="menu-btn" @click="drawerVisible = true">☰</button>
      <span>崇德书院 · 管理后台</span>
    </header>

    <!-- 手机端侧滑遮罩 -->
    <div class="sidebar-backdrop" :class="{ 'is-open': drawerVisible }" @click="drawerVisible = false"></div>

    <aside class="admin-sidebar" :class="{ 'is-open': drawerVisible }">
      <div class="sidebar-brand">
        <div class="sidebar-brand__eyebrow">Chongde Admin</div>
        <div class="brand">管理后台</div>
        <div class="sidebar-brand__sub">活动、报名、用户的一体化工作台</div>
      </div>

      <div class="sidebar-groups">
        <section v-for="group in menuGroups" :key="group.title" class="nav-group">
          <div class="nav-group__title">{{ group.title }}</div>
          <button
            v-for="item in group.items"
            :key="item.path"
            type="button"
            class="nav-item"
            :class="{ active: active === item.path }"
            @click="go(item.path)"
          >
            <span class="nav-item__dot"></span>
            <span>{{ item.label }}</span>
          </button>
        </section>
      </div>

    </aside>

    <main class="admin-main">
      <section class="admin-content">
        <router-view />
      </section>
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
  min-height: calc(100vh - 64px);
  gap: 20px;
  width: calc(100vw - 24px);
  margin-left: calc(50% - 50vw + 12px);
  margin-right: 12px;
  padding-bottom: 8px;
  box-sizing: border-box;
}

.admin-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 20px 18px;
  border-radius: 24px;
  background: linear-gradient(180deg, #fff7ed 0%, #ffffff 22%, #fffaf5 100%);
  border: 1px solid rgba(251, 191, 116, 0.24);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.sidebar-brand {
  padding: 6px 6px 18px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.sidebar-brand__eyebrow {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #94a3b8;
}

.brand {
  margin-top: 8px;
  margin-bottom: 6px;
  font-weight: 800;
  font-size: 28px;
}

.sidebar-brand__sub {
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.sidebar-groups {
  flex: 1;
  padding-top: 18px;
}

.nav-group + .nav-group {
  margin-top: 18px;
}

.nav-group__title {
  margin: 0 8px 10px;
  font-size: 12px;
  color: #94a3b8;
  letter-spacing: 0.08em;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 14px 14px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: #475569;
  font-size: 20px;
  font-weight: 600;
  box-shadow: none;
  text-align: left;
  appearance: none;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.nav-item:hover {
  background: rgba(255, 247, 237, 0.88);
  color: #1f2937;
}

.nav-item:focus,
.nav-item:focus-visible,
.nav-item:active {
  outline: none !important;
  border: none !important;
  box-shadow: none;
}

.nav-item.active {
  background: linear-gradient(135deg, rgba(255,125,115,0.14), rgba(253,186,116,0.18));
  color: #111827;
  box-shadow: 0 10px 24px rgba(255, 125, 115, 0.08);
}

.nav-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.55);
}

.nav-item.active .nav-item__dot {
  background: linear-gradient(135deg, var(--sunset-start), var(--sunset-end));
  box-shadow: 0 0 0 4px rgba(255,125,115,0.08);
}

.admin-main {
  min-width: 0;
}

.admin-content {
  min-width: 0;
  padding-top: 0;
}

.mobile-header {
  display: none;
  align-items: center;
  height: 60px;
  padding: 0 16px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 16px;
  position: sticky;
  top: 12px;
  z-index: 100;
}

.menu-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #475569;
  margin-right: 12px;
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-backdrop {
  display: none;
}

@media (max-width: 1200px) {
  .admin-shell {
    display: flex;
    flex-direction: column;
    margin: 12px;
    width: auto;
  }
  .mobile-header {
    display: flex;
  }
  .admin-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    margin: 0;
    border-radius: 0 24px 24px 0;
    z-index: 2000;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .admin-sidebar.is-open {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0,0,0,0.15);
  }
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 1999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  .sidebar-backdrop.is-open {
    opacity: 1;
    pointer-events: auto;
    backdrop-filter: blur(2px);
  }
}
</style>
