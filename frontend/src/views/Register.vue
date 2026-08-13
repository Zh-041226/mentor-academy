<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import http from '../api/http'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getBackendBaseUrl } from '../utils/config'

const isMobile = ref(window.innerWidth <= 768)
const handleResize = () => { isMobile.value = window.innerWidth <= 768 }
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

const formRef = ref()
const loading = ref(false)
const form = ref({
  studentId: '',
  name: '',
  className: '',
  contact: '',
  password: '',
  confirmPassword: ''
})

const rules = {
  studentId: [
    { required: true, message: '请输入学号', trigger: 'blur' },
    { pattern: /^\d{12}$/, message: '学号需为12位数字', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' },
    { pattern: /^[\u4e00-\u9fa5]+$/, message: '姓名（只能为中文）', trigger: 'blur' }
  ],
  className: [
    { required: true, message: '请输入班级', trigger: 'blur' }
  ],
  contact: [
    { required: true, message: '请输入联系方式', trigger: 'blur' },
    { pattern: /^\d{11}$/, message: '联系方式（11位数字）', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9]{6,12}$/, message: '密码要求6-12位（只能由数字和英文组成）', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.value.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

const router = useRouter()
// 仅保留页面顶部 logo，移除左侧品牌区及背景图相关逻辑
const base = getBackendBaseUrl()
const logoUrl = `${base}/logo/logo.png`
// 左侧默认占位图片（后续可替换为你喜欢的图片路径）
const leftImageUrl = `${base}/logo/zhuce.png`
// 手机端顶部展示图片
const topImageUrl = `${base}/logo/denglu.png`

// 智能提示：班级检索
function queryClassSuggestions(queryString, cb) {
  const q = String(queryString || '').trim()
  http.get('/classes', { params: { keyword: q } })
    .then(({ data }) => {
      const items = Array.isArray(data?.items) ? data.items : []
      const suggestions = items.map(it => ({ value: it.name || it }))
      cb(suggestions)
    })
    .catch(() => cb([]))
}
function onSelectClass(item) { form.value.className = item?.value || '' }
const onSubmit = async () => {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const payload = { 
        studentId: form.value.studentId,
        password: form.value.password,
        name: form.value.name,
        contact: form.value.contact,
        className: form.value.className
      }
      const { data } = await http.post('/auth/register', payload)
      ElMessage.success(data?.message || '注册成功')
      router.push('/login')
    } catch (err) {
      const msg = err?.response?.data?.message || '注册失败，请稍后再试'
      ElMessage.error(msg)
    } finally {
      loading.value = false
    }
  })
}
</script>

<template>
  <div class="register-page">
    <!-- 手机端顶部图片区域 -->
    <div class="top-section mobile-only">
      <img :src="topImageUrl" alt="注册顶部图片" class="top-image" />
    </div>
    <div class="register-layout">
      <div class="brand-side">
        <img class="brand-img" :src="leftImageUrl" alt="注册左侧图片" />
      </div>
      <div class="form-side">
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <img class="page-logo" :src="logoUrl" alt="崇德书院 Logo" />
              <span>导师进书院系统 · 注册</span>
            </div>
          </template>
          <!-- 使用原生 form 包裹以支持 Enter 提交 -->
          <form @submit.prevent="onSubmit">
          <el-form ref="formRef" :model="form" :rules="rules" :label-width="isMobile ? '70px' : '100px'" :label-position="isMobile ? 'top' : 'right'">
            <el-form-item label="学号" prop="studentId">
              <el-input v-model="form.studentId" clearable placeholder="请输入学号" :size="isMobile ? 'large' : 'default'" />
            </el-form-item>
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" clearable placeholder="请输入中文姓名" :size="isMobile ? 'large' : 'default'" />
            </el-form-item>
            <el-form-item label="班级" prop="className">
              <el-autocomplete v-model="form.className" clearable placeholder="如：物联网工程231班" :fetch-suggestions="queryClassSuggestions" @select="onSelectClass" :size="isMobile ? 'large' : 'default'" style="width: 100%" />
            </el-form-item>
            <el-form-item label="联系方式" prop="contact">
              <el-input v-model="form.contact" clearable placeholder="11位手机号" maxlength="11" :size="isMobile ? 'large' : 'default'" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="form.password" type="password" show-password placeholder="6-12位数字和英文" maxlength="12" :size="isMobile ? 'large' : 'default'" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="form.confirmPassword" type="password" show-password placeholder="请再次输入密码" maxlength="12" :size="isMobile ? 'large' : 'default'" />
            </el-form-item>
            <!-- 设置原生 submit，支持 Enter 提交；保留 @click 以兼容鼠标点击 -->
            <div class="form-actions" style="margin-top: 24px;">
              <el-button class="main-btn" type="primary" :loading="loading" native-type="submit" @click="onSubmit" :size="isMobile ? 'large' : 'default'">注册</el-button>
              <div class="action-links">
                <el-button class="link-btn" link @click="() => router.push('/login')" :size="isMobile ? 'large' : 'default'">已有账号？去登录</el-button>
              </div>
            </div>
          </el-form>
          </form>
        </el-card>
      </div>
    </div>
  </div>
  
</template>

<style scoped>
.register-page { min-height: calc(100vh - 60px); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.top-section { width: 100%; display: flex; justify-content: center; margin-top: 24px; }
.top-image { width: 80%; max-width: 400px; height: auto; display: block; }
.mobile-only { display: none; }
.register-layout { display: grid; grid-template-columns: 1fr 520px; gap: 24px; align-items: center; width: 100%; max-width: 1200px; margin: 0 auto; padding: 24px; }
.brand-side { position: relative; min-height: 420px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.brand-img { width: 100%; height: auto; display: block; border-radius: 12px; }
.form-side { display: flex; justify-content: center; }
.box-card { width: 100%; max-width: 520px; }
.card-header { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.page-logo { height: 24px; width: auto; }

/* 按钮与文字在手机端对齐并拉大上下间距 */
.form-actions { display: flex; align-items: center; justify-content: center; gap: 24px; width: 100%; }
.main-btn { height: 40px; font-size: 14px; min-width: 120px; }
.action-links { display: flex; gap: 12px; align-items: center; }

@media (max-width: 480px) {
  .form-actions { flex-direction: column; align-items: stretch; gap: 16px; width: 100%; margin-top: 16px; }
  .main-btn { width: 100%; height: 44px; font-size: 16px; }
  .action-links { justify-content: center; gap: 24px; width: 100%; padding: 0; }
  .form-actions .link-btn { width: auto; text-align: center; margin-top: 0; }
}

@media (max-width: 992px) {
  .mobile-only { display: flex; }
  .top-image { width: 85%; }
  .register-page { justify-content: flex-start; }
  .register-layout { grid-template-columns: 1fr; padding: 16px; }
  .brand-side { display: none; }
  .box-card { max-width: 560px; }
}
</style>