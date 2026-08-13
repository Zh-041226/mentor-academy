<script setup>
import { ref, computed, onMounted } from 'vue'
import http from '../../api/http'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUploadsFullUrl } from '../../utils/config'

let sortableModule = null

async function getSortable() {
  if (sortableModule) return sortableModule
  const mod = await import('sortablejs')
  sortableModule = mod.default || mod
  return sortableModule
}

// 权限
const me = ref(null)
const level = computed(() => me.value?.adminLevel || '')
const isMengsuilianyun = computed(() => level.value === 'MENGSUILIANYUN')

// 状态
const loading = ref(false)
const saving = ref(false)
const list = ref([])
const listRef = ref(null)
const editDialogVisible = ref(false)
const currentEditItem = ref(null)

// URL 处理（开发环境相对路径，生产拼接后端基地址）
// 已移至 utils/config.js 统一管理

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchMe() {
  try {
    const { data } = await http.get('/users/me')
    me.value = data || null
  } catch {}
}

async function fetchList() {
  loading.value = true
  try {
    const { data } = await http.get('/admin/hero-slides')
    list.value = Array.isArray(data?.items) ? data.items : []
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取轮播列表失败')
  } finally {
    loading.value = false
  }
}

// 尺寸校验已根据要求放开所有限制
function beforePosterUpload(rawFile) {
  return true
}

function onUploadSuccess(resp) {
  if (resp?.url && currentEditItem.value) {
    currentEditItem.value.imageUrl = resp.url
  } else {
    ElMessage.error('上传成功但无法更新图片地址')
  }
}

function onUploadError(err) {
  try {
    const res = JSON.parse(err.message)
    ElMessage.error(res.message || '上传失败')
  } catch (e) {
    ElMessage.error('上传失败，请检查网络或图片格式')
  }
}

function openEditDialog(item = null) {
  currentEditItem.value = JSON.parse(JSON.stringify(item || { imageUrl: '', alt: '', published: true, startsAt: null, endsAt: null }))
  editDialogVisible.value = true
}

async function saveItem() {
  if (!currentEditItem.value) return
  const isNew = !currentEditItem.value.id
  const url = isNew ? '/admin/hero-slides' : `/admin/hero-slides/${currentEditItem.value.id}`
  const method = isNew ? 'post' : 'put'
  const payload = { ...currentEditItem.value }
  if (payload.startsAt && isNaN(new Date(payload.startsAt))) payload.startsAt = null
  if (payload.endsAt && isNaN(new Date(payload.endsAt))) payload.endsAt = null
  saving.value = true
  try {
    const { data } = await http[method](url, payload)
    if (isNew) {
      list.value.push(data.item)
    } else {
      const idx = list.value.findIndex(x => x.id === data.item.id)
      if (idx !== -1) list.value[idx] = data.item
    }
    editDialogVisible.value = false
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteItem(item) {
  try {
    await ElMessageBox.confirm(`确定要删除海报“${item.alt || '未命名'}”吗？`, '确认删除', { type: 'warning' })
  } catch { return }
  try {
    await http.delete(`/admin/hero-slides/${item.id}`)
    const idx = list.value.findIndex(x => x.id === item.id)
    if (idx !== -1) list.value.splice(idx, 1)
    ElMessage.success('删除成功')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '删除失败')
  }
}

async function updateSortOrder() {
  const ids = list.value.map(item => item.id)
  saving.value = true
  try {
    await http.post('/admin/hero-slides/reorder', { ids })
    ElMessage.success('排序已更新')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '更新排序失败')
    await fetchList()
  } finally {
    saving.value = false
  }
}

function moveUp(index) {
  // 旧的按钮排序已废弃，保留函数以避免运行时错误
}
function moveDown(index) {
  // 旧的按钮排序已废弃，保留函数以避免运行时错误
}

onMounted(async () => {
  await fetchMe()
  await fetchList()
  // 初始化拖拽排序
  if (listRef.value) {
    const Sortable = await getSortable()
    new Sortable(listRef.value, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'drag-ghost',
      chosenClass: 'drag-chosen',
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex === newIndex || oldIndex == null || newIndex == null) return
        const item = list.value.splice(oldIndex, 1)[0]
        list.value.splice(newIndex, 0, item)
        updateSortOrder()
      }
    })
  }
})
</script>

<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>轮播海报管理</span>
          <el-button v-if="isMengsuilianyun" type="primary" class="btn-sunset" @click="openEditDialog()">新增海报</el-button>
        </div>
      </template>
      <div v-if="loading">正在加载...</div>
      <template v-else>
        <div v-if="!isMengsuilianyun" class="hint">仅“梦碎怜云”可操作</div>
        <div v-else>
          <div v-if="!list.length" class="empty">暂无海报，请新增</div>
          <div v-else class="list-container" ref="listRef">
            <div v-for="(item, idx) in list" :key="item.id" class="list-item">
              <el-image :src="getUploadsFullUrl(item.imageUrl)" fit="contain" class="item-thumb" lazy />
              <div class="item-info">
                <div class="item-alt">{{ item.alt || '(未命名)' }}</div>
                <div class="item-meta">{{ item.imageUrl }}</div>
                <div class="item-meta">
                  状态：<el-tag :type="item.published ? 'success' : 'info'" size="small">{{ item.published ? '已发布' : '未发布' }}</el-tag>
                  <span v-if="item.startsAt || item.endsAt" class="time-range">
                    ( {{ item.startsAt ? new Date(item.startsAt).toLocaleString() : '' }} - {{ item.endsAt ? new Date(item.endsAt).toLocaleString() : '' }} )
                  </span>
                </div>
              </div>
              <div class="item-actions">
                <span class="drag-handle" title="拖拽排序">☰</span>
                <el-button type="primary" class="btn-sunset" size="small" @click="openEditDialog(item)">编辑</el-button>
                <el-button type="danger" size="small" @click="deleteItem(item)">删除</el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-card>

    <el-dialog v-if="currentEditItem" v-model="editDialogVisible" :title="currentEditItem.id ? '编辑海报' : '新增海报'" width="640px">
      <el-form :model="currentEditItem" label-width="80px">
        <el-form-item label="图片">
          <el-upload action="/api/admin/upload/image?type=poster" :headers="getAuthHeaders()" :limit="1" :show-file-list="false" :before-upload="beforePosterUpload" :on-success="onUploadSuccess" :on-error="onUploadError">
            <el-button type="primary" class="btn-sunset">上传图片</el-button>
          </el-upload>
          <div v-if="currentEditItem.imageUrl" class="preview-row">
            <el-image :src="getUploadsFullUrl(currentEditItem.imageUrl)" fit="contain" class="hero-preview" />
            <div class="meta">{{ currentEditItem.imageUrl }}</div>
          </div>
          <div class="hint">建议尺寸不小于 1280px，宽高比 16:9 效果最佳</div>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="currentEditItem.alt" placeholder="例如：迎新晚会"></el-input>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="currentEditItem.published" active-text="发布" inactive-text="草稿"></el-switch>
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker v-model="currentEditItem.startsAt" type="datetime" placeholder="开始时间"></el-date-picker>
          <span style="margin:0 8px">-</span>
          <el-date-picker v-model="currentEditItem.endsAt" type="datetime" placeholder="结束时间"></el-date-picker>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取 消</el-button>
        <el-button type="primary" class="btn-sunset" :loading="saving" @click="saveItem">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.card-header { display:flex; align-items:center; justify-content:space-between; font-weight:600; }
.hint { color:#909399; font-size:12px; margin-top:4px; }
.empty { text-align:center; color:#909399; padding:32px 0; }
.list-container { display:flex; flex-direction:column; gap:12px; }
.list-item { display:flex; align-items:center; gap:12px; padding:8px; border:1px solid #ebeef5; border-radius:4px; }
.item-thumb { width:128px; height:72px; border-radius:4px; background:#f5f7fa; }
.item-info { flex:1; }
.item-alt { font-weight:600; }
.item-meta { font-size:12px; color:#666; word-break:break-all; margin-top:4px; }
.time-range { margin-left:8px; color:#999; }
.item-actions { display:flex; gap:6px; }
.drag-handle { cursor:grab; font-size:18px; line-height:18px; color:#999; padding:6px; }
.drag-handle:active { cursor:grabbing; }
.drag-ghost { opacity:0.6; }
.drag-chosen { background:#f5f7fa; }
.preview-row { display:flex; align-items:center; gap:12px; margin-top:8px;}
.hero-preview { width: 280px; height: 160px; border:1px solid #ebeef5; border-radius:4px; background:#fff; }
.meta { font-size:12px; color:#666; word-break: break-all; }
</style>
