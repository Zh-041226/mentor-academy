<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '../api/http'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const status = ref('INIT') // INIT | OK | NO_BINDING | ERROR
const message = ref('')

async function exchange() {
  loading.value = true
  status.value = 'INIT'
  try {
    const ticket = String(route.query?.sso_ticket || '').trim()
    if (!ticket) {
      status.value = 'ERROR'
      message.value = '缺少 sso_ticket 参数'
      return
    }
    const { data } = await http.post('/weapp/sso-exchange', { sso_ticket: ticket })
    if (data?.token) {
      localStorage.setItem('token', data.token)
      status.value = 'OK'
      ElMessage.success('已通过小程序登录')
      const to = String(route.query?.redirect || '/activities')
      router.replace(to)
      return
    }
    status.value = 'ERROR'
    message.value = '未返回令牌'
  } catch (e) {
    const code = e?.response?.data?.code
    const msg = e?.response?.data?.message || '登录失败'
    if (code === 'NO_BINDING' || e?.response?.status === 428) {
      status.value = 'NO_BINDING'
      message.value = '尚未绑定站点账号，请先在下方登录'
    } else {
      status.value = 'ERROR'
      message.value = msg
    }
  } finally {
    loading.value = false
  }
}

onMounted(exchange)
</script>

<template>
  <div style="max-width: 560px; margin: 24px auto;">
    <el-card>
      <template #header>
        <div class="card-header">小程序免登录</div>
      </template>

      <div v-if="loading" style="color:#909399;">正在验证，请稍候...</div>

      <div v-else>
        <div v-if="status==='OK'" style="color:#67C23A;">登录成功，正在跳转...</div>
        <div v-else-if="status==='NO_BINDING'" style="color:#E6A23C;">
          {{ message }}
          <div style="margin-top:12px;">
            <el-button type="primary" @click="router.push('/login?redirect='+encodeURIComponent('/activities'))">前往登录</el-button>
          </div>
        </div>
        <div v-else-if="status==='ERROR'" style="color:#F56C6C;">{{ message }}</div>
      </div>
    </el-card>
  </div>
  
</template>

<style scoped>
.card-header { font-weight: 600; }
</style>