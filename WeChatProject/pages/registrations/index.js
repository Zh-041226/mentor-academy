import { request } from '../../utils/request'
const { API_BASE } = require('../../utils/config')

Page({
  data: {
    loading: false,
    error: '',
    registered: [],
    history: [],
    inputVisibleId: 0,
    reasonInputs: {},
    canceling: false
  },
  onShow() {
    this.fetchMyRegistrations()
  },
  async fetchMyRegistrations() {
    this.setData({ loading: true, error: '' })
    try {
      const res = await request({ url: `${API_BASE}/api/users/me/registrations`, method: 'GET' })
      const data = res.data || {}
      this.setData({
        registered: Array.isArray(data.registered) ? data.registered : [],
        history: Array.isArray(data.history) ? data.history : []
      })
    } catch (e) {
      this.setData({ error: e?.data?.message || '获取我的报名失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  fullUploadsUrl(rel) {
    if (!rel) return ''
    if (String(rel).startsWith('http')) return rel
    return `${API_BASE}/uploads/${rel}`
  },
  formatDateTime(s) {
    if (!s) return ''
    try {
      const dt = new Date(s)
      const pad = n => String(n).padStart(2, '0')
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    } catch { return '' }
  },
  showCancelInput(e) {
    const id = Number(e?.currentTarget?.dataset?.id)
    if (!Number.isFinite(id) || id <= 0) return
    this.setData({ inputVisibleId: id })
  },
  hideCancelInput() { this.setData({ inputVisibleId: 0 }) },
  onReasonInput(e) {
    const id = Number(e?.currentTarget?.dataset?.id)
    const v = String(e?.detail?.value || '')
    const dict = Object.assign({}, this.data.reasonInputs)
    dict[id] = v
    this.setData({ reasonInputs: dict })
  },
  async submitCancel(e) {
    const id = Number(e?.currentTarget?.dataset?.id)
    if (!Number.isFinite(id) || id <= 0) return
    const reason = String(this.data.reasonInputs[id] || '').trim()
    if (reason.length < 5) {
      wx.showToast({ title: '请填写不少于5字事由', icon: 'none' })
      return
    }
    this.setData({ canceling: true })
    try {
      await request({ url: `${API_BASE}/api/activities/${id}/cancel`, method: 'POST', data: { reason } })
      wx.showToast({ title: '已提交取消申请', icon: 'success' })
      this.setData({ inputVisibleId: 0 })
      await this.fetchMyRegistrations()
    } catch (err) {
      const msg = err?.data?.message || '取消失败'
      wx.showToast({ title: msg, icon: 'none' })
    } finally {
      this.setData({ canceling: false })
    }
  }
})