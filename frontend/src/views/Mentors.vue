<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import http from '../api/http'
import { useRouter } from 'vue-router'

const loading = ref(false)
const mentors = ref([])
const router = useRouter()

async function fetchMentors() {
  loading.value = true
  try {
    const { data } = await http.get('/mentors')
    mentors.value = Array.isArray(data?.items) ? data.items : []
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取导师列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(fetchMentors)

function openDetail(id) { router.push(`/mentors/${id}`) }
</script>

<template>
  <div style="max-width: 960px; margin: 24px auto;">
    <el-card>
      <template #header>
        <div class="card-header">导师风采</div>
      </template>
      <el-skeleton :loading="loading" animated>
        <template #default>
          <template v-if="mentors.length">
            <el-row :gutter="12">
              <el-col :span="8" v-for="(m, i) in mentors" :key="i">
                <el-card shadow="hover">
                  <div class="mentor">
                    <el-avatar :size="48" :src="m.photoUrl || ''" style="margin-right: 8px;" />
                    <div class="info">
                      <div class="title">{{ m.name }}</div>
                      <div class="meta">{{ m.title }}</div>
                      <div class="bio">{{ (m.bio || '').slice(0, 60) }}</div>
                      <el-button size="small" type="primary" @click="openDetail(m.id)">查看详情</el-button>
                    </div>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </template>
          <el-empty v-else description="导师数据开发中" />
        </template>
      </el-skeleton>
    </el-card>
  </div>
</template>

<style scoped>
.card-header { font-weight: 600; }
.mentor { display: flex; align-items: center; }
.title { font-weight: 600; }
.meta { color: #909399; }
.bio { color: #606266; font-size: 12px; margin-top: 4px; }
</style>