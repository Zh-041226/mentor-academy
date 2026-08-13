<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import http from '../api/http'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getBackendBaseUrl } from '../utils/config'

const isMobile = ref(window.innerWidth <= 768)
const handleResize = () => { isMobile.value = window.innerWidth <= 768 }
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

const formRef = ref()
const loading = ref(false)
const form = ref({ studentId: '', password: '' })

const rules = {
  studentId: [
    { required: true, message: '请输入学号', trigger: 'blur' },
    { pattern: /^\d{12}$/, message: '学号应为12位数字', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ]
}

const router = useRouter()
const route = useRoute()
// 仅保留页面顶部 logo，移除左侧品牌区及背景图相关逻辑
const base = getBackendBaseUrl()
const logoUrl = `${base}/logo/logo.png`
// 登录页顶部图片（你提供的文件）
const topImageUrl = `${base}/logo/denglu.png`

const onSubmit = async () => {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const { data } = await http.post('/auth/login', form.value)
      if (data?.token) {
        localStorage.setItem('token', data.token)
        ElMessage.success('登录成功')
        // 登录成功后默认跳转到活动广场；如有 redirect 参数则优先使用该参数
        const redirect = route.query.redirect || '/activities'
        router.push(String(redirect))
      } else {
        ElMessage.error('登录失败，请稍后再试')
      }
    } catch (err) {
      const msg = err?.response?.data?.message || '登录失败，请检查学号或密码'
      ElMessage.error(msg)
    } finally {
      loading.value = false
    }
  })
}
</script>

<template>
  <div class="login-page">
    <!-- 顶部图片区域 -->
    <div class="top-section">
      <img :src="topImageUrl" alt="登录顶部图片" class="top-image" />
    </div>
    <!-- 底部原有表单区域 -->
    <div class="bottom-section">
      <div class="login-layout">
        <div class="form-side">
          <el-card class="box-card">
            <template #header>
              <div class="card-header">
                <img class="page-logo" :src="logoUrl" alt="崇德书院 Logo" />
                <span>导师进书院系统 · 登录</span>
              </div>
            </template>
            <!-- 使用原生 form 包裹以支持 Enter 提交 -->
          <form @submit.prevent="onSubmit">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" :label-position="isMobile ? 'top' : 'right'">
            <el-form-item label="学号" prop="studentId">
              <el-input v-model="form.studentId" clearable placeholder="请输入12位学号" :size="isMobile ? 'large' : 'default'" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" :size="isMobile ? 'large' : 'default'" />
            </el-form-item>
            <div class="form-actions" style="margin-top: 24px;">
              <el-button class="main-btn" type="primary" :loading="loading" native-type="submit" @click="onSubmit" :size="isMobile ? 'large' : 'default'">登录</el-button>
              <div class="action-links">
                <el-button class="link-btn" link @click="() => router.push('/register')" :size="isMobile ? 'large' : 'default'">还没有账号？去注册</el-button>
                <el-button class="link-btn" link @click="() => router.push('/admin/login')" :size="isMobile ? 'large' : 'default'">管理员登录</el-button>
              </div>
            </div>
          </el-form>
          </form>
          </el-card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page { min-height: calc(100vh - 60px); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; }
.top-section { width: 100%; display: flex; justify-content: center; margin-top: 24px; }
.top-image { width: 80%; max-width: 400px; height: auto; display: block; }
.bottom-section { width: 100%; display: flex; justify-content: center; }
.login-layout { width: 100%; max-width: 560px; margin: 0 auto; padding: 24px; }
.form-side { display: flex; justify-content: center; }
.box-card { width: 100%; }
.card-header { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.page-logo { height: 24px; width: auto; }

/* 按钮与文字在手机端对齐并拉大上下间距 */
.form-actions { display: flex; align-items: center; justify-content: center; gap: 24px; width: 100%; }
.main-btn { height: 40px; font-size: 14px; min-width: 120px; }
.action-links { display: flex; gap: 12px; align-items: center; }

@media (max-width: 480px) {
  .form-actions { flex-direction: column; align-items: stretch; gap: 16px; width: 100%; }
  .main-btn { width: 100%; height: 44px; font-size: 16px; }
  .action-links { justify-content: center; gap: 24px; width: 100%; padding: 0; }
  .form-actions .link-btn { width: auto; text-align: center; margin-top: 0; }
}

@media (max-width: 992px) {
  .top-image { width: 85%; }
  .login-layout { padding: 16px; }
}
</style>