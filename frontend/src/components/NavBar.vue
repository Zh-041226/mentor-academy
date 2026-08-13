<template>
  <div class="nav">
    <div class="left">
      <img class="logo" :src="logoUrl" alt="崇德书院 Logo" @click="go('/home')" />
      <img class="brand-image" :src="brandUrl" alt="崇德书院 题字" @click="go('/home')" />
    </div>
    <div class="right">
      <el-link :underline="false" :class="{ active: isActive('/home') }" @click="go('/home')">首页</el-link>
      <el-link :underline="false" :class="{ active: isActive('/announcements') }" @click="go('/announcements')">公告</el-link>
      <template v-if="!isLoggedIn">
        <el-link :underline="false" :class="{ active: isActive('/register') }" @click="go('/register')">注册</el-link>
        <el-link :underline="false" :class="{ active: isActive('/login') }" @click="go('/login')">登录</el-link>
        <el-link :underline="false" :class="{ active: isActive('/admin/login') }" @click="go('/admin/login')">管理员登录</el-link>
      </template>
      <template v-else>
        <el-link :underline="false" :class="{ active: isActive('/my-activities') }" @click="go('/my-activities')">我的活动</el-link>
        <el-link :underline="false" :class="{ active: isActive('/me') }" @click="go('/me')">我的信息</el-link>
        <el-link v-if="isAdmin" :underline="false" :class="{ active: isActive('/admin') }" @click="go('/admin')">管理员</el-link>
      </template>
      <el-button v-if="isLoggedIn" size="small" @click="logout" type="danger" plain class="btn-sunset">退出登录</el-button>
    </div>
  </div>
  
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { ref, computed, watch, onMounted } from 'vue'
import http from '../api/http'
import { getBackendBaseUrl } from '../utils/config'

const router = useRouter()
const isLoggedIn = ref(!!localStorage.getItem('token'))
const isAdmin = ref(false)
const activePath = computed(() => router.currentRoute.value?.path || '/')
// 开发环境走相对路径，交由 Vite 代理到后端；生产使用 VITE_BACKEND_URL 明确后端地址
const base = getBackendBaseUrl()
const logoUrl = `${base}/logo/logo.png`
const brandUrl = `${base}/logo/logo2.png`

function isActive(p) { return activePath.value === p || activePath.value.startsWith(p + '/') }

watch(() => router.currentRoute.value?.fullPath, () => {
  // 路由变化时更新登录态（登录/退出后页面都会发生跳转）
  isLoggedIn.value = !!localStorage.getItem('token')
  if (isLoggedIn.value) ensureAdminRole()
  else isAdmin.value = false
})

function go(path) {
  router.push(path)
}

function logout() {
  localStorage.removeItem('token')
  ElMessage.success('已退出登录')
  router.push('/login')
}

async function ensureAdminRole() {
  try {
    const { data } = await http.get('/users/me')
    isAdmin.value = data?.role === 'ADMIN'
  } catch {
    isAdmin.value = false
  }
}

onMounted(() => { if (isLoggedIn.value) ensureAdminRole() })
</script>

<style scoped>
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px; /* 默认更大一点，提高整体高度与气场 */
    position: fixed; /* 贴顶且铺满左右两端 */
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    z-index: 1000;
    /* 更淡的金色渐变：整体亮度提升、透明度更高 */
    /* 末端再透明一些，让与页面衔接更柔和 */
    background: linear-gradient(
      180deg,
      rgba(190, 150, 90, 0.80) 0%,   /* 顶部较实 */
      rgba(214, 186, 132, 0.50) 50%, /* 中段过渡更柔 */
      rgba(231, 210, 168, 0.15) 100% /* 底部更透明 */
    );
    color: #fff;
    /* 去掉边框/阴影痕迹，改用更柔的渐变本身来衔接 */
    box-shadow: none;
  }
.left {
  display: flex;
  gap: 10px;
  align-items: center;
}
.right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap; /* 窄屏时自动换行 */
  padding-right: 30px; /* 调整为 24px，整体再向左一点 */
}
.brand-image {
  height: 60px; /* 默认更大：提升品牌题字的可视性 */
  width: auto;
  display: block;
  max-width: 30vw; /* 防止过宽影响导航链接布局 */
}
.logo { height: 50px; width: auto; cursor: pointer; }
.active {
  font-weight: 700;
  color: #fff;
  /* 统一金色下划线（更明确的视觉反馈） */
  --nav-underline-color: #D4AF37; /* 典雅金色，可按需改为 #FFD700 更亮的金色 */
  background-image: linear-gradient(
    to right,
    var(--nav-underline-color) 0%,
    var(--nav-underline-color) 100%
  );
  background-repeat: no-repeat;
  background-size: 100% 3px; /* 稍厚的 3px 更像导航高亮 */
  background-position: 0 100%;
  padding-bottom: 2px;
}
/* 导航中的 el-link 文本颜色覆盖（Element Plus 深度选择器） */
.nav :deep(.el-link .el-link__inner) { color: #fff; font-size: 16px; }
.nav :deep(.el-link:hover .el-link__inner) { opacity: 0.9; }
@media (max-width: 768px) {
  .nav { padding: 10px 12px; } /* 移动端也稍微加大，但保持紧凑 */
  .brand-image { display: none; }
  .left { flex-wrap: wrap; gap: 8px; }
}
.btn-sunset {
  /* 基础质感：轻微的立体与细腻过渡 */
  border: 1px solid #ff8a6b; /* 边界带暖橙色调 */
  background: linear-gradient(180deg, #ffffff 0%, #f7f7f7 100%);
  color: #d25555; /* 文本略偏暖，与 danger 保持家族感 */
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  transition: background 0.25s ease, transform 0.12s ease, box-shadow 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.btn-sunset:hover {
  /* 悬停展示「落日色」渐变 */
  background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%);
  color: #fff;
  border-color: #ff7e5f;
  box-shadow: 0 6px 14px rgba(255, 126, 95, 0.35);
  transform: translateY(-1px);
}
.btn-sunset:active {
  /* 按下状态：略微压低与加深色调 */
  background: linear-gradient(135deg, #f96c4c 0%, #fea768 100%);
  box-shadow: 0 4px 10px rgba(255, 126, 95, 0.30);
  transform: translateY(0);
}
.btn-sunset:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 126, 95, 0.30), 0 6px 14px rgba(255, 126, 95, 0.35);
}
</style>
