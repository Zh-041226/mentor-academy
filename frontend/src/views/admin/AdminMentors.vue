<script setup>
import { ref, onMounted } from 'vue'
import http from '../../api/http'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const items = ref([])

async function fetchList() {
  loading.value = true
  try {
    const { data } = await http.get('/mentors')
    items.value = Array.isArray(data?.items) ? data.items.map(it => ({
      id: it.id,
      name: it.name,
      title: it.title || '',
      tags: it.tags || ''
    })) : []
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取导师列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(fetchList)
</script>

<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>导师管理</span>
          <div class="actions">
            <el-button type="primary" disabled>新增导师（待后端）</el-button>
          </div>
        </div>
      </template>
      <el-skeleton :loading="loading" animated>
        <template #default>
          <el-table :data="items" border style="width: 100%">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="姓名" />
            <el-table-column prop="title" label="职称" width="160" />
            <el-table-column prop="tags" label="标签" />
            <el-table-column label="操作" width="260">
              <template #default>
                <el-button size="small" disabled>编辑（待后端）</el-button>
                <el-button size="small" type="danger" disabled>删除（待后端）</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!items.length" description="暂无导师数据" />
        </template>
      </el-skeleton>
    </el-card>
  </div>
</template>

<style scoped>
.card-header { display:flex; align-items:center; justify-content:space-between; font-weight: 600; }
.actions { display:flex; gap:8px; }
</style>