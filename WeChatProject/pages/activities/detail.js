import { request } from '../../utils/request'
const { API_BASE } = require('../../utils/config')

Page({
  data: {
    loading: false,
    error: '',
    item: null,
    regStatus: null,
    registering: false,
    favorited: false,
    favoriting: false,
    descHtml: ''
  },
  onLoad(options) {
    const id = Number(options?.id)
    if (!Number.isFinite(id) || id <= 0) {
      this.setData({ error: '参数错误：活动ID' })
      return
    }
    this._id = id
    this.fetchDetail()
    this.fetchMyRegStatus()
    this.fetchFavoriteStatus()
  },
  async fetchDetail() {
    this.setData({ loading: true, error: '' })
    try {
      const res = await request({ url: `${API_BASE}/api/activities/${this._id}`, method: 'GET' })
      const item = res.data?.item || null
      this.setData({ item, descHtml: this.buildDescHtml(item) })
    } catch (e) {
      this.setData({ error: e?.data?.message || '获取活动详情失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async fetchMyRegStatus() {
    try {
      const res = await request({ url: `${API_BASE}/api/users/me/registrations`, method: 'GET' })
      const registered = Array.isArray(res.data?.registered) ? res.data.registered : []
      const hit = registered.find(x => Number(x.id) === this._id)
      this.setData({ regStatus: hit?.status || null })
    } catch (_) {
      // 未登录或401不强制报错
    }
  },
  async fetchFavoriteStatus() {
    try {
      const res = await request({ url: `${API_BASE}/api/users/me/favorites`, method: 'GET' })
      const items = Array.isArray(res.data?.items) ? res.data.items : []
      const fav = items.some(x => Number(x.id) === this._id)
      this.setData({ favorited: fav })
    } catch (_) {
      // 未登录或401忽略
    }
  },
  canRegister() {
    const item = this.data.item
    if (!item) return false
    const st = String(item.status || '')
    if (['CLOSED', 'FINISHED', 'CANCELED'].includes(st)) return false
    return !this.data.regStatus
  },
  async handleRegister() {
    if (!this.canRegister()) return
    this.setData({ registering: true })
    try {
      await request({ url: `${API_BASE}/api/activities/${this._id}/register`, method: 'POST' })
      wx.showToast({ title: '报名成功', icon: 'success' })
      await this.fetchMyRegStatus()
    } catch (e) {
      const msg = e?.data?.message || '报名失败'
      wx.showToast({ title: msg, icon: 'none', duration: 2000 })
    } finally {
      this.setData({ registering: false })
    }
  },
  async toggleFavorite() {
    const { favorited } = this.data
    this.setData({ favoriting: true })
    try {
      if (!favorited) {
        await request({ url: `${API_BASE}/api/activities/${this._id}/favorite`, method: 'POST' })
        this.setData({ favorited: true })
        wx.showToast({ title: '已收藏', icon: 'success' })
      } else {
        await request({ url: `${API_BASE}/api/activities/${this._id}/favorite`, method: 'DELETE' })
        this.setData({ favorited: false })
        wx.showToast({ title: '已取消收藏', icon: 'success' })
      }
    } catch (e) {
      const msg = e?.data?.message || (favorited ? '取消收藏失败' : '收藏失败')
      wx.showToast({ title: msg, icon: 'none' })
    } finally {
      this.setData({ favoriting: false })
    }
  },
  buildDescHtml(item) {
    if (!item) return '<p>暂无活动介绍</p>'
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const desc = esc(item.description || '').replace(/\n/g, '<br/>')
    let html = `<div class="rt">${desc || '暂无活动介绍'}</div>`
    if (item.promoImageUrl) {
      const src = this.fullUploadsUrl(item.promoImageUrl)
      html += `<div class="rt"><img src="${src}" style="max-width:100%;border-radius:8px;"/></div>`
    }
    if (item.qqGroupQrUrl) {
      const src = this.fullUploadsUrl(item.qqGroupQrUrl)
      html += `<div class="rt"><div style="color:#888;font-size:12px;margin-bottom:4px;">QQ群二维码</div><img src="${src}" style="max-width:100%;border-radius:8px;"/></div>`
    }
    return html
  },
  copyPromoLink() {
    const url = this.data.item?.promoLinkUrl
    if (!url) return
    wx.setClipboardData({ data: String(url) })
  },
  formatDateTime(s) {
    if (!s) return ''
    try {
      const dt = new Date(s)
      const pad = n => String(n).padStart(2, '0')
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    } catch { return '' }
  },
  fullUploadsUrl(rel) {
    if (!rel) return ''
    if (String(rel).startsWith('http')) return rel
    return `${API_BASE}/uploads/${rel}`
  },
  goBack() { wx.navigateBack() }
})