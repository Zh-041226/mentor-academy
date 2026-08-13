<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import http from '../api/http'

const route = useRoute()
const id = route.params.id
const loading = ref(false)
const detail = ref({ name: '', title: '', photoUrl: '', bio: '', tags: '' })

async function fetchDetail() {
  loading.value = true
  try {
    const { data } = await http.get(`/mentors/${id}`)
    const it = data?.item || {}
    detail.value = {
      name: it.name || `导师 #${id}`,
      title: it.title || '',
      photoUrl: it.photoUrl || '',
      bio: it.bio || '导师详情开发中',
      tags: it.tags || ''
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取导师详情失败')
  } finally {
    loading.value = false
  }
}

function tagList() {
  const raw = detail.value.tags || ''
  return raw.split(/[\s,，;；]+/).filter(Boolean).slice(0, 10)
}

onMounted(fetchDetail)
</script>

<template>
  <div style="max-width: 800px; margin: 24px auto;">
    <el-card>
      <template #header>
        <div class="card-header">导师详情</div>
      </template>
      <el-skeleton :loading="loading" animated>
        <template #default>
          <div class="profile">
            <el-avatar :size="80" :src="detail.photoUrl || ''" />
            <div class="info">
              <div class="name">{{ detail.name }}</div>
              <div class="title">{{ detail.title }}</div>
              <div class="tags" v-if="tagList().length">
                <el-tag v-for="(t,i) in tagList()" :key="i" type="info" style="margin-right:6px;">{{ t }}</el-tag>
              </div>
            </div>
          </div>
          <el-divider />
          <div class="section">
            <div class="section-title">导师简介</div>
            <div class="bio">{{ detail.bio }}</div>
          </div>
        </template>
      </el-skeleton>
    </el-card>
  </div>
  
</template>

<style scoped>
.card-header { font-weight: 600; }
.profile { display: flex; gap: 16px; align-items: center; }
.info .name { font-weight: 600; font-size: 18px; }
.info .title { color: #909399; }
.section-title { font-weight: 600; margin-bottom: 6px; }
.bio { white-space: pre-wrap; line-height: 1.6; }
</style>