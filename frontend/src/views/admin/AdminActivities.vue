<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import http from '../../api/http'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUploadsFullUrl } from '../../utils/config'

const loading = ref(false)
const items = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const showCreate = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const presetCategories = ['崇德讲堂', '朋辈导师', '晨曦晨读', '其他']
const historicalCategories = ref([])
const categorySelect = ref('')
const form = reactive({
  title: '',
  category: '',
  mentorName: '',
  place: '',
  limit: 0,
  startAt: '',
  registerDeadline: '',
  status: 'PUBLISHED',
  posterUrl: '',
  posterSizeBytes: 0,
  qqGroupQrUrl: '',
  qqGroupQrSizeBytes: 0,
  promoLinkUrl: '',
  promoImageUrl: '',
  promoImageSizeBytes: 0,
  timeText: '',
  description: ''
})

const categoryOptions = computed(() => {
  const seen = new Set()
  const items = []
  ;[...presetCategories, ...historicalCategories.value].forEach((item) => {
    const label = normalizeCategory(item)
    if (!label || seen.has(label)) return
    seen.add(label)
    items.push(label)
  })
  return items
})

async function fetchList(resetPage = false) {
  if (resetPage) currentPage.value = 1
  loading.value = true
  try {
    const { data } = await http.get('/admin/activities', { params: { page: currentPage.value, pageSize: pageSize.value } })
    items.value = Array.isArray(data?.items) ? data.items : []
    total.value = Number(data?.total || 0)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '获取活动列表失败')
  } finally {
    loading.value = false
  }
}

function handlePageChange(page) {
  currentPage.value = page
  fetchList()
}

function handlePageSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  fetchList()
}

function normalizeCategory(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function resetForm() {
  form.title = ''
  form.category = ''
  categorySelect.value = ''
  form.mentorName = ''
  form.place = ''
  form.limit = 0
  form.startAt = ''
  form.registerDeadline = ''
  form.status = 'PUBLISHED'
  form.posterUrl = ''
  form.posterSizeBytes = 0
  form.qqGroupQrUrl = ''
  form.qqGroupQrSizeBytes = 0
  form.promoLinkUrl = ''
  form.promoImageUrl = ''
  form.promoImageSizeBytes = 0
  form.timeText = ''
  form.description = ''
}

async function fetchCategoryOptions() {
  try {
    const { data } = await http.get('/admin/activities/categories')
    historicalCategories.value = Array.isArray(data?.items)
      ? data.items.map(normalizeCategory).filter(Boolean)
      : []
  } catch (e) {
    const fallback = [...new Set(items.value.map(it => normalizeCategory(it.category)).filter(Boolean))]
    historicalCategories.value = fallback
    ElMessage.warning(e?.response?.data?.message || '历史活动类型读取失败，已暂时回退到当前列表类型')
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function onPosterSuccess(resp) {
  if (resp && resp.url) {
    form.posterUrl = resp.url
    form.posterSizeBytes = Number(resp.sizeBytes || 0)
  }
}

function onQqQrSuccess(resp) {
  if (resp && resp.url) {
    form.qqGroupQrUrl = resp.url
    form.qqGroupQrSizeBytes = Number(resp.sizeBytes || 0)
  }
}

function onPromoSuccess(resp) {
  if (resp && resp.url) {
    form.promoImageUrl = resp.url
    form.promoImageSizeBytes = Number(resp.sizeBytes || 0)
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

function beforePosterUpload(file) {
  return true
}

function beforeQqQrUpload(file) {
  return true
}

function beforePromoUpload(file) {
  return true
}

// 图片预览：将后端返回的相对路径转换为完整URL
// 已移至 utils/config.js 统一管理

const posterPreviewUrl = computed(() => getUploadsFullUrl(form.posterUrl))
const qqQrPreviewUrl = computed(() => getUploadsFullUrl(form.qqGroupQrUrl))
const promoPreviewUrl = computed(() => getUploadsFullUrl(form.promoImageUrl))
const openCount = computed(() => items.value.filter(it => it.status !== 'CLOSED').length)
const closedCount = computed(() => items.value.filter(it => it.status === 'CLOSED').length)
const posterCount = computed(() => items.value.filter(it => !!it.posterUrl).length)

function formatDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleString() } catch { return '' }
}

// 当前管理员信息用于前端界面权限控制
const me = ref(null)
const level = computed(() => me.value?.adminLevel || '')
const isStaff = computed(() => level.value === 'STAFF')
const isPromoAllowed = computed(() => ['OWNER_PRIMARY', 'SUPERVISOR', 'SUPER_ADMIN'].includes(level.value))

async function fetchMe() {
  try {
    const { data } = await http.get('/users/me')
    me.value = data || null
  } catch {}
}

function openCreate() {
  if (isStaff.value) { ElMessage.warning('普通干事无权新建活动'); return }
  isEdit.value = false
  editId.value = null
  resetForm()
  showCreate.value = true
}

async function onDelete(row) {
  if (isStaff.value) { ElMessage.warning('普通干事无权删除活动'); return }
  try {
    await ElMessageBox.confirm('确定要删除该活动吗？删除后不可恢复。', '确认删除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await http.delete(`/admin/activities/${row.id}`)
    ElMessage.success('已删除')
    if (items.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
    fetchList()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '删除失败')
  }
}

function openEdit(row) {
  if (isStaff.value) { ElMessage.warning('普通干事无权编辑活动'); return }
  isEdit.value = true
  editId.value = row.id
  form.title = row.title || ''
  form.category = row.category || ''
  categorySelect.value = normalizeCategory(form.category)
  form.mentorName = row.mentorName || ''
  form.place = row.place || ''
  form.limit = Number(row.limit ?? 0)
  form.startAt = row.startAt ? new Date(row.startAt) : ''
  form.registerDeadline = row.registerDeadline ? new Date(row.registerDeadline) : ''
  form.status = row.status || 'PUBLISHED'
  form.posterUrl = row.posterUrl || ''
  form.posterSizeBytes = Number(row.posterSizeBytes || 0)
  form.qqGroupQrUrl = row.qqGroupQrUrl || ''
  form.qqGroupQrSizeBytes = Number(row.qqGroupQrSizeBytes || 0)
  form.promoLinkUrl = row.promoLinkUrl || ''
  form.promoImageUrl = row.promoImageUrl || ''
  form.promoImageSizeBytes = Number(row.promoImageSizeBytes || 0)
  form.description = row.description || ''
  form.timeText = row.timeText || ''
  showCreate.value = true
}

async function submitCreate() {
  if (!form.title) { ElMessage.error('请填写标题'); return }
  if (!form.place) { ElMessage.error('请填写地点'); return }
  const finalCategory = normalizeCategory(categorySelect.value)
  if (!finalCategory) { ElMessage.error('请选择或输入活动类型'); return }
  submitting.value = true
  try {
    const payload = { ...form, category: finalCategory }
    if (!isPromoAllowed.value) {
      delete payload.promoLinkUrl
      delete payload.promoImageUrl
      delete payload.promoImageSizeBytes
    } else {
      // 基础URL校验（前端提示，后端仍做最终校验）
      const link = String(payload.promoLinkUrl || '').trim()
      if (link && !/^https?:\/\//i.test(link)) {
        ElMessage.error('推文链接需以 http 或 https 开头')
        submitting.value = false
        return
      }
    }
    if (isEdit.value && editId.value) {
      const { data } = await http.put(`/admin/activities/${editId.value}`, payload)
      if (data && data.id) {
        ElMessage.success('更新成功')
        showCreate.value = false
        resetForm()
        await fetchCategoryOptions()
        fetchList()
      } else {
        ElMessage.error('更新失败')
      }
    } else {
      const { data } = await http.post('/admin/activities', payload)
      if (data && data.id) {
        ElMessage.success('创建成功')
        showCreate.value = false
        resetForm()
        await fetchCategoryOptions()
        fetchList(true)
      } else {
        ElMessage.error('创建失败')
      }
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || (isEdit.value ? '更新失败' : '创建失败'))
  } finally {
    submitting.value = false
  }
}

async function initPage() {
  await Promise.all([fetchList(), fetchMe()])
  if (!isStaff.value) {
    await fetchCategoryOptions()
  }
}

onMounted(initPage)
</script>

<template>
  <div class="admin-page">
    <section class="admin-page-head">
      <div class="admin-page-head__main">
        <div class="admin-page-head__eyebrow">Activity Workspace</div>
        <div class="admin-page-head__title">活动管理</div>
        <p class="admin-page-head__desc">集中维护活动资料、时间、报名状态和展示素材，减少零散跳转，保持单页即可完成高频管理动作。</p>
      </div>
      <div class="admin-page-head__side">
        <div class="admin-page-head__meta-label">当前列表</div>
        <div class="admin-page-head__meta-value">{{ total }}</div>
        <div class="admin-page-head__meta-note">共 {{ total }} 个活动，当前第 {{ currentPage }} 页</div>
      </div>
    </section>

    <section class="admin-metrics">
      <article class="admin-metric">
        <div class="admin-metric__label">活动总数</div>
        <div class="admin-metric__value">{{ total }}</div>
        <div class="admin-metric__hint">后台已录入的全部活动</div>
      </article>
      <article class="admin-metric">
        <div class="admin-metric__label">当前页开放中</div>
        <div class="admin-metric__value">{{ openCount }}</div>
        <div class="admin-metric__hint">当前页仍允许报名的活动</div>
      </article>
      <article class="admin-metric">
        <div class="admin-metric__label">当前页已关闭</div>
        <div class="admin-metric__value">{{ closedCount }}</div>
        <div class="admin-metric__hint">当前页已关闭报名的活动</div>
      </article>
      <article class="admin-metric">
        <div class="admin-metric__label">当前页已配海报</div>
        <div class="admin-metric__value">{{ posterCount }}</div>
        <div class="admin-metric__hint">海报素材已上传的活动</div>
      </article>
    </section>

    <section class="admin-toolbar-panel">
      <div class="admin-toolbar-panel__row">
        <div class="admin-toolbar-panel__group">
          <span class="admin-toolbar-panel__label">页面动作</span>
          <el-button v-if="!isStaff" type="primary" class="btn-sunset" @click="openCreate">新建活动</el-button>
        </div>
        <div class="admin-toolbar-panel__group">
          <span class="admin-toolbar-panel__label">浏览提示</span>
          <span class="toolbar-tip">图片支持直接预览，分页保持单页工作区更紧凑</span>
        </div>
      </div>
    </section>

    <el-card class="admin-workspace-card">
      <template #header>
        <div class="admin-table-title">
          <div class="admin-table-title__main">
            <span class="admin-table-title__label">活动列表</span>
            <span class="admin-table-title__desc">在同一工作区完成查看、编辑、删除与素材预览</span>
          </div>
        </div>
      </template>
      <el-skeleton :loading="loading" animated>
        <template #default>
          <div class="admin-table-shell">
            <el-table :data="items" border style="width: 100%">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="category" label="活动类型" width="140" />
              <el-table-column prop="title" label="活动名称" min-width="180" />
              <el-table-column label="活动开始时间" width="200">
                <template #default="scope">
                  {{ formatDate(scope.row.startAt) || scope.row.timeText || '' }}
                </template>
              </el-table-column>
              <el-table-column prop="place" label="活动地点" width="160" />
              <el-table-column label="活动限制人数" width="140">
                <template #default="scope">
                  {{ Number(scope.row.limit) > 0 ? scope.row.limit : '不限' }}
                </template>
              </el-table-column>
              <el-table-column label="活动报名截止时间" width="200">
                <template #default="scope">
                  {{ formatDate(scope.row.registerDeadline) }}
                </template>
              </el-table-column>
              <el-table-column label="报名状态" width="120">
                <template #default="scope">
                  <el-tag :type="scope.row.status==='CLOSED' ? 'danger' : 'success'">
                    {{ scope.row.status==='CLOSED' ? '已关闭' : '开放中' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="海报" width="140">
                <template #default="scope">
                  <div class="thumb-cell">
                    <el-image
                      v-if="scope.row.posterUrl"
                      :src="getUploadsFullUrl(scope.row.posterUrl)"
                      :preview-src-list="[getUploadsFullUrl(scope.row.posterUrl)]"
                      :preview-teleported="true"
                      fit="cover"
                      class="table-thumb table-thumb--poster"
                      lazy
                    />
                    <span v-else class="table-empty">—</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="QQ群二维码" width="140">
                <template #default="scope">
                  <div class="thumb-cell">
                    <el-image
                      v-if="scope.row.qqGroupQrUrl"
                      :src="getUploadsFullUrl(scope.row.qqGroupQrUrl)"
                      :preview-src-list="[getUploadsFullUrl(scope.row.qqGroupQrUrl)]"
                      :preview-teleported="true"
                      fit="cover"
                      class="table-thumb table-thumb--qr"
                      lazy
                    />
                    <span v-else class="table-empty">—</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column v-if="!isStaff" label="操作" width="200" fixed="right">
                <template #default="scope">
                  <el-button size="small" type="primary" class="btn-sunset" @click="openEdit(scope.row)">编辑</el-button>
                  <el-button size="small" type="danger" @click="onDelete(scope.row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <el-empty v-if="!items.length" description="暂无活动数据" />
          <div class="table-footer">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              :total="total"
              @size-change="handlePageSizeChange"
              @current-change="handlePageChange"
            />
          </div>
        </template>
      </el-skeleton>
    </el-card>

    <el-dialog v-model="showCreate" :title="isEdit ? '编辑活动' : '新建活动'" width="720px">
      <el-form label-width="100px">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入活动标题" />
        </el-form-item>
        <el-form-item label="活动类型">
          <el-select
            v-model="categorySelect"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="请选择或输入活动类型"
            style="width:100%"
          >
            <el-option v-for="opt in categoryOptions" :key="opt" :label="opt" :value="opt" />
          </el-select>
          <div style="color:#909399; margin-top:6px; font-size:12px;">预设类型优先展示，历史活动类型会自动补进这里；如果都不合适，可以直接输入新类型。</div>
        </el-form-item>
        <el-form-item label="导师">
          <el-input v-model="form.mentorName" placeholder="请输入导师姓名" />
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="form.place" placeholder="请输入活动地点" />
        </el-form-item>
        <el-form-item label="人数上限">
          <el-input v-model.number="form.limit" type="number" placeholder="0 表示不限" />
        </el-form-item>
        <el-form-item label="举办时间">
          <el-date-picker v-model="form.startAt" type="datetime" placeholder="选择日期时间" style="width:100%" :popper-options="{ strategy: 'fixed', placement: 'bottom-start' }" />
        </el-form-item>
      <el-form-item label="报名截止">
        <el-date-picker v-model="form.registerDeadline" type="datetime" placeholder="选择截止时间" style="width:100%" :popper-options="{ strategy: 'fixed', placement: 'bottom-start' }" />
      </el-form-item>
      <el-form-item label="报名开关">
        <el-select v-model="form.status" placeholder="请选择">
          <el-option label="开放报名" value="PUBLISHED" />
          <el-option label="关闭报名" value="CLOSED" />
        </el-select>
        <div style="color:#909399; margin-top:6px; font-size:12px;">选择“关闭报名”后，前后端均会阻止报名。</div>
      </el-form-item>
        <el-form-item label="海报">
          <el-upload
            :action="'/api/admin/upload/image?type=poster'"
            :headers="getAuthHeaders()"
            :limit="1"
            :show-file-list="true"
            :before-upload="beforePosterUpload"
            :on-success="onPosterSuccess"
            :on-error="onUploadError"
          >
            <el-button type="primary" class="btn-sunset">上传海报</el-button>
          </el-upload>
          <div v-if="form.posterUrl" style="margin-top:8px;color:#666">已上传：{{ form.posterUrl }}</div>
          <div v-if="posterPreviewUrl" class="preview-row">
            <el-image
              :src="posterPreviewUrl"
              :preview-src-list="[posterPreviewUrl]"
              :preview-teleported="true"
              fit="contain"
              class="poster-preview"
            />
            <div class="preview-meta">
              <div>大小：{{ (form.posterSizeBytes/1024/1024).toFixed(2) }} MB</div>
              <div style="color:#909399">支持预览，点击图片可放大</div>
            </div>
          </div>
        </el-form-item>
      <el-form-item label="QQ群二维码">
          <el-upload
            :action="'/api/admin/upload/image?type=qqqr'"
            :headers="getAuthHeaders()"
            :limit="1"
            :show-file-list="true"
            :before-upload="beforeQqQrUpload"
            :on-success="onQqQrSuccess"
            :on-error="onUploadError"
          >
            <el-button type="primary" class="btn-sunset">上传二维码</el-button>
          </el-upload>
          <div v-if="form.qqGroupQrUrl" style="margin-top:8px;color:#666">已上传：{{ form.qqGroupQrUrl }}</div>
          <div v-if="qqQrPreviewUrl" class="preview-row">
            <el-image
              :src="qqQrPreviewUrl"
              :preview-src-list="[qqQrPreviewUrl]"
              :preview-teleported="true"
              fit="contain"
              class="qrcode-preview"
            />
            <div class="preview-meta">
              <div>大小：{{ (form.qqGroupQrSizeBytes/1024/1024).toFixed(2) }} MB</div>
              <div style="color:#909399">支持预览，点击图片可放大</div>
            </div>
          </div>
      </el-form-item>
      <el-form-item v-if="isPromoAllowed" label="推文链接">
        <el-input v-model="form.promoLinkUrl" placeholder="请输入链接（以 http 或 https 开头）" />
      </el-form-item>
      <el-form-item v-if="isPromoAllowed" label="宣传图片">
        <el-upload
          :action="'/api/admin/upload/image?type=promo'"
          :headers="getAuthHeaders()"
          :limit="1"
          :show-file-list="true"
          :before-upload="beforePromoUpload"
          :on-success="onPromoSuccess"
          :on-error="onUploadError"
        >
          <el-button type="primary" class="btn-sunset">上传宣传图片</el-button>
        </el-upload>
        <div v-if="form.promoImageUrl" style="margin-top:8px;color:#666">已上传：{{ form.promoImageUrl }}</div>
        <div v-if="promoPreviewUrl" class="preview-row">
          <el-image
            :src="promoPreviewUrl"
            :preview-src-list="[promoPreviewUrl]"
            :preview-teleported="true"
            fit="contain"
            class="poster-preview"
          />
          <div class="preview-meta">
            <div>大小：{{ (form.promoImageSizeBytes/1024/1024).toFixed(2) }} MB</div>
            <div style="color:#909399">支持预览，点击图片可放大</div>
          </div>
        </div>
      </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="5000"
            show-word-limit
            placeholder="请输入活动简介"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showCreate = false">取消</el-button>
          <el-button type="primary" class="btn-sunset" :loading="submitting" @click="submitCreate">提交</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dialog-footer { display:flex; justify-content:flex-end; gap:8px; }
.table-footer { display:flex; justify-content:flex-end; margin-top:16px; }
.preview-row { display:flex; align-items:center; gap:12px; margin-top:8px; }
.poster-preview { width: 180px; height: 260px; border:1px solid #ebeef5; border-radius:4px; }
.qrcode-preview { width: 160px; height: 160px; border:1px solid #ebeef5; border-radius:4px; background:#fff; }
.preview-meta { font-size:12px; color:#666; }
.toolbar-tip { color: #64748b; font-size: 13px; }
.thumb-cell { display: flex; align-items: center; justify-content: center; min-height: 56px; }
.table-thumb {
  display: block;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
}
.table-thumb--poster { width: 42px; height: 56px; }
.table-thumb--qr { width: 48px; height: 48px; }
.table-empty { color: #bbb; }
</style>
