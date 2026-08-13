<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import http from '../../api/http'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const me = ref(null)
const list = ref([])
const currentEditId = ref(null)

const isStaff = computed(() => me.value?.adminLevel === 'STAFF')
const total = computed(() => list.value.length)

const form = reactive({
  title: '',
  summary: '',
  content: '',
  published: true,
  attachmentPath: '',
  attachmentOriginalName: '',
  attachmentMimeType: '',
  attachmentSizeBytes: 0
})

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function resetForm() {
  currentEditId.value = null
  form.title = ''
  form.summary = ''
  form.content = ''
  form.published = true
  form.attachmentPath = ''
  form.attachmentOriginalName = ''
  form.attachmentMimeType = ''
  form.attachmentSizeBytes = 0
}

function fillForm(item) {
  currentEditId.value = item.id
  form.title = item.title || ''
  form.summary = item.summary || ''
  form.content = item.content || ''
  form.published = !!item.published
  form.attachmentPath = item.attachmentPath || ''
  form.attachmentOriginalName = item.attachmentOriginalName || ''
  form.attachmentMimeType = item.attachmentMimeType || ''
  form.attachmentSizeBytes = Number(item.attachmentSizeBytes || 0)
}

function beforeDocumentUpload(rawFile) {
  const allowed = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z', 'txt', 'csv']
  const ext = String(rawFile.name || '').split('.').pop()?.toLowerCase() || ''
  const isAllowed = allowed.includes(ext)
  const isLt20M = rawFile.size / 1024 / 1024 < 20
  if (!isAllowed) {
    ElMessage.error('仅支持 PDF、Word、Excel、PPT、压缩包、TXT、CSV')
    return false
  }
  if (!isLt20M) {
    ElMessage.error('公告附件需小于20MB')
    return false
  }
  return true
}

function onUploadSuccess(resp) {
  form.attachmentPath = resp?.path || ''
  form.attachmentOriginalName = resp?.originalName || ''
  form.attachmentMimeType = resp?.mimeType || ''
  form.attachmentSizeBytes = Number(resp?.sizeBytes || 0)
  if (form.attachmentPath) ElMessage.success('附件上传成功')
}

function formatDateTime(value) {
  if (!value) return '待发布'
  try {
    const dt = new Date(value)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function formatSize(size) {
  const num = Number(size || 0)
  if (!num) return ''
  if (num >= 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`
  if (num >= 1024) return `${(num / 1024).toFixed(1)} KB`
  return `${num} B`
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
    const { data } = await http.get('/admin/announcements')
    list.value = Array.isArray(data?.items) ? data.items : []
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取公告列表失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(item) {
  fillForm(item)
  dialogVisible.value = true
}

async function saveItem() {
  if (!form.title.trim()) {
    ElMessage.error('请填写公告标题')
    return
  }
  if (!form.content.trim()) {
    ElMessage.error('请填写公告内容')
    return
  }
  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
      published: !!form.published,
      attachmentPath: form.attachmentPath || '',
      attachmentOriginalName: form.attachmentOriginalName || '',
      attachmentMimeType: form.attachmentMimeType || '',
      attachmentSizeBytes: Number(form.attachmentSizeBytes || 0)
    }
    if (currentEditId.value) {
      await http.put(`/admin/announcements/${currentEditId.value}`, payload)
      ElMessage.success('公告更新成功')
    } else {
      await http.post('/admin/announcements', payload)
      ElMessage.success('公告创建成功')
    }
    dialogVisible.value = false
    resetForm()
    await fetchList()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存公告失败')
  } finally {
    saving.value = false
  }
}

async function deleteItem(item) {
  try {
    await ElMessageBox.confirm(`确定删除公告“${item.title}”吗？`, '确认删除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await http.delete(`/admin/announcements/${item.id}`)
    ElMessage.success('公告已删除')
    await fetchList()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '删除公告失败')
  }
}

function clearAttachment() {
  form.attachmentPath = ''
  form.attachmentOriginalName = ''
  form.attachmentMimeType = ''
  form.attachmentSizeBytes = 0
}

onMounted(async () => {
  await fetchMe()
  await fetchList()
})
</script>

<template>
  <div class="admin-page">
    <section class="admin-page-head">
      <div class="admin-page-head__main">
        <div class="admin-page-head__eyebrow">Announcement Workspace</div>
        <div class="admin-page-head__title">公告管理</div>
        <p class="admin-page-head__desc">统一发布综测证明、资料下载和各类通知附件，控制发布状态并维护文件信息。</p>
      </div>
      <div class="admin-page-head__side">
        <div class="admin-page-head__meta-label">当前公告</div>
        <div class="admin-page-head__meta-value">{{ total }}</div>
        <div class="admin-page-head__meta-note">已收录 {{ total }} 条公告，支持文档附件上传与登录后下载。</div>
      </div>
    </section>

    <el-card class="admin-workspace-card">
      <template #header>
        <div class="workspace-head">
          <div>
            <div class="workspace-head__title">公告列表</div>
            <div class="workspace-head__desc">对外发布前可先保存草稿，确认无误后再切换为已发布。</div>
          </div>
          <el-button v-if="!isStaff" type="primary" class="btn-sunset" @click="openCreate">新建公告</el-button>
        </div>
      </template>

      <div v-if="isStaff" class="workspace-empty">普通干事无权管理公告。</div>

      <div v-else-if="loading" class="workspace-empty">正在加载公告...</div>

      <div v-else-if="!list.length" class="workspace-empty">暂无公告，点击右上角创建第一条公告。</div>

      <div v-else class="announcement-admin-list">
        <article v-for="item in list" :key="item.id" class="announcement-admin-card">
          <div class="announcement-admin-card__main">
            <div class="announcement-admin-card__meta">
              <el-tag :type="item.published ? 'success' : 'info'" effect="light" round>{{ item.published ? '已发布' : '草稿' }}</el-tag>
              <span>{{ formatDateTime(item.publishedAt || item.createdAt) }}</span>
            </div>
            <div class="announcement-admin-card__title">{{ item.title }}</div>
            <div v-if="item.summary" class="announcement-admin-card__summary">{{ item.summary }}</div>
            <div class="announcement-admin-card__content">{{ item.content }}</div>
            <div v-if="item.hasAttachment" class="announcement-admin-card__attachment">
              <span>{{ item.attachmentOriginalName }}</span>
              <span>{{ item.attachmentMimeType || '附件' }}<template v-if="item.attachmentSizeBytes"> · {{ formatSize(item.attachmentSizeBytes) }}</template></span>
            </div>
          </div>
          <div class="announcement-admin-card__actions">
            <el-button size="small" type="primary" class="btn-sunset" @click="openEdit(item)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="deleteItem(item)">删除</el-button>
          </div>
        </article>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="currentEditId ? '编辑公告' : '新建公告'" width="760px">
      <el-form label-width="88px">
        <el-form-item label="公告标题">
          <el-input v-model="form.title" placeholder="例如：综测证明领取通知" maxlength="80" show-word-limit />
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" placeholder="用于列表快速说明，可选" maxlength="180" show-word-limit />
        </el-form-item>
        <el-form-item label="正文内容">
          <el-input v-model="form.content" type="textarea" :rows="8" placeholder="支持粘贴公告正文、领取说明、截止时间等内容" maxlength="4000" show-word-limit />
        </el-form-item>
        <el-form-item label="附件">
          <div class="announcement-upload">
            <el-upload
              action="/api/admin/upload/document?type=announcement"
              :headers="getAuthHeaders()"
              :show-file-list="false"
              :before-upload="beforeDocumentUpload"
              :on-success="onUploadSuccess"
              :limit="1"
            >
              <el-button type="primary" class="btn-sunset">上传附件</el-button>
            </el-upload>
            <el-button v-if="form.attachmentPath" plain @click="clearAttachment">移除附件</el-button>
          </div>
          <div v-if="form.attachmentPath" class="announcement-file-chip">
            <span>{{ form.attachmentOriginalName }}</span>
            <span>{{ form.attachmentMimeType || '附件' }}<template v-if="form.attachmentSizeBytes"> · {{ formatSize(form.attachmentSizeBytes) }}</template></span>
          </div>
          <div class="announcement-upload__hint">支持 PDF、Word、Excel、PPT、压缩包、TXT、CSV，单个文件不超过 20MB。</div>
        </el-form-item>
        <el-form-item label="发布状态">
          <el-switch v-model="form.published" active-text="已发布" inactive-text="草稿" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" class="btn-sunset" :loading="saving" @click="saveItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.workspace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.workspace-head__title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.workspace-head__desc {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
}

.workspace-empty {
  padding: 44px 16px;
  text-align: center;
  color: #94a3b8;
}

.announcement-admin-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.announcement-admin-card {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 22px;
  border-radius: 20px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: linear-gradient(180deg, #fff 0%, #fffaf7 100%);
}

.announcement-admin-card__main {
  min-width: 0;
  flex: 1;
}

.announcement-admin-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #94a3b8;
}

.announcement-admin-card__title {
  margin-top: 12px;
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}

.announcement-admin-card__summary {
  margin-top: 10px;
  color: #475569;
  line-height: 1.75;
}

.announcement-admin-card__content {
  margin-top: 10px;
  color: #334155;
  line-height: 1.85;
  white-space: pre-wrap;
}

.announcement-admin-card__attachment {
  margin-top: 14px;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 247, 237, 0.82);
  border: 1px solid rgba(255, 125, 115, 0.16);
  color: #475569;
  font-size: 13px;
}

.announcement-admin-card__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.announcement-upload {
  display: flex;
  align-items: center;
  gap: 10px;
}

.announcement-upload__hint {
  margin-top: 8px;
  color: #94a3b8;
  font-size: 12px;
}

.announcement-file-chip {
  margin-top: 10px;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  border: 1px solid rgba(226, 232, 240, 0.9);
}

@media (max-width: 900px) {
  .workspace-head,
  .announcement-admin-card,
  .announcement-upload {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
