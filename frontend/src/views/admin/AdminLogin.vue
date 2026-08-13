<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import http from '../../api/http'
import { getBackendBaseUrl } from '../../utils/config'

const isMobile = ref(window.innerWidth <= 768)
const handleResize = () => { isMobile.value = window.innerWidth <= 768 }
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

const router = useRouter()
const route = useRoute()
const formRef = ref()
const loading = ref(false)
const form = ref({ level: '', username: '', password: '' })

const levels = [
  '超级管理员',
  '主管老师',
  '第一负责人',
  '第二负责人',
  '普通干事'
]

const rules = {
  level: [ { required: true, message: '请选择管理员等级', trigger: 'change' } ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9]{6,20}$/, message: '6-20位字母或数字', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9]{6,12}$/, message: '密码要求6-12位（只能由数字和英文组成）', trigger: 'blur' }
  ]
}

const onSubmit = async () => {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const payload = { studentId: form.value.username, password: form.value.password, level: form.value.level }
      const { data } = await http.post('/admin/auth/login', payload)
      if (data?.token) {
        localStorage.setItem('token', data.token)
        ElMessage.success('管理员登录成功')
        const redirect = route.query.redirect || '/admin/dashboard'
        router.push(String(redirect))
      } else {
        ElMessage.error('登录失败，请稍后再试')
      }
    } catch (err) {
      const msg = err?.response?.data?.message || '登录失败，请检查账号、密码与等级'
      ElMessage.error(msg)
    } finally {
      loading.value = false
    }
  })
}

// 开发环境使用相对路径，交由 Vite 代理到后端；生产使用 VITE_BACKEND_URL 明确后端地址
const base = getBackendBaseUrl()
// 左侧展示图片（占位，后续你可替换为更合适的图片路径）
const leftImageUrl = `${base}/logo/guanliyuan.png`
// 手机端顶部展示图片
const topImageUrl = `${base}/logo/denglu.png`
</script>

<template>
  <div class="admin-login-page">
    <!-- 手机端顶部图片区域 -->
    <div class="top-section mobile-only">
      <img :src="topImageUrl" alt="管理员登录顶部图片" class="top-image" />
    </div>
    <div class="admin-login-layout">
      <div class="left-image">
        <img :src="leftImageUrl" alt="管理后台配图" class="left-img" />
      </div>
      <el-card class="box-card">
        <template #header>
          <div class="card-header">管理后台 · 等级登录</div>
        </template>
        <!-- 使用原生 form 包裹以支持 Enter 提交 -->
        <form @submit.prevent="onSubmit">
        <el-form ref="formRef" :model="form" :rules="rules" :label-width="isMobile ? '70px' : '120px'" :label-position="isMobile ? 'top' : 'right'">
          <el-form-item label="管理员等级" prop="level">
            <el-select v-model="form.level" placeholder="请选择等级" style="width:100%" :size="isMobile ? 'large' : 'default'">
              <el-option v-for="lv in levels" :key="lv" :label="lv" :value="lv" />
            </el-select>
          </el-form-item>
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" clearable placeholder="请输入6-20位字母或数字" :size="isMobile ? 'large' : 'default'" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" :size="isMobile ? 'large' : 'default'" />
          </el-form-item>
          <!-- 设置原生 submit，支持 Enter 提交；保留 @click 以兼容鼠标点击 -->
          <div class="form-actions" style="margin-top: 24px;">
            <el-button class="main-btn" type="primary" :loading="loading" native-type="submit" @click="onSubmit" :size="isMobile ? 'large' : 'default'">管理员登录</el-button>
            <div class="action-links">
              <el-button class="link-btn" link @click="() => router.push('/login')" :size="isMobile ? 'large' : 'default'">普通用户登录</el-button>
              <el-button class="link-btn" link @click="() => router.push('/')" :size="isMobile ? 'large' : 'default'">返回首页</el-button>
            </div>
          </div>
        </el-form>
        </form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.admin-login-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #f5f7fa;
}
.top-section { width: 100%; display: flex; justify-content: center; margin-bottom: 24px; }
.top-image { width: 80%; max-width: 400px; height: auto; display: block; }
.mobile-only { display: none; }
.admin-login-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  /* 整体上移一点（需要更多或更少可调整此值） */
  transform: translateY(-96px);
  width: 100%;
}
.left-image { display: flex; align-items: center; }
.left-img {
  width: 98px; /* 在 50% 基础上再缩小 30%（140px * 0.7 ≈ 98px） */
  max-width: 11.2vw; /* 同步缩小最大宽度约束（16vw * 0.7 ≈ 11.2vw） */
  height: auto;
  border-radius: 8px;
  /* 去边框化：移除边框 */
  /* 透明背景与页面无缝衔接：移除阴影并设置透明背景 */
  background-color: transparent;
  box-shadow: none;
  object-fit: contain;
}
.box-card { width: 100%; max-width: 480px; }
.card-header { font-weight: 600; }

/* 按钮与文字在手机端对齐并拉大上下间距 */
.form-actions { display: flex; align-items: center; justify-content: center; gap: 24px; width: 100%; }
.main-btn { height: 40px; font-size: 14px; min-width: 120px; }
.action-links { display: flex; gap: 12px; align-items: center; }

/* 移动端：显示顶部图片，隐藏左侧图片，卡片居中适配 */
@media (max-width: 768px) {
  .admin-login-page { justify-content: flex-start; padding-top: 48px; }
  .admin-login-layout { transform: none; padding: 0 16px; }
  .mobile-only { display: flex; }
  .left-image { display: none; }
  .form-actions { flex-direction: column; align-items: stretch; gap: 16px; margin-left: 0; width: 100%; }
  .main-btn { width: 100%; height: 44px; font-size: 16px; }
  .action-links { justify-content: center; gap: 24px; width: 100%; padding: 0; }
  .form-actions .link-btn { width: auto; text-align: center; margin-top: 0; }
}
</style>