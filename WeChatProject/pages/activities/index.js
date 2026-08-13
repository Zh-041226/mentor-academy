import { request } from '../../utils/request'
const { API_BASE } = require('../../utils/config')

Page({
  data: {
    loading: false,
    error: '',
    items: [],
    favIds: [],
    favoritingId: 0,
    showFavOnly: false
  },
  onLoad() {
    this.fetchList()
    this.fetchFavorites()
  },
  async fetchList() {
    this.setData({ loading: true, error: '' })
    try {
      const res = await request({ url: `${API_BASE}/api/activities`, method: 'GET' })
      const data = res.data || {}
      const raw = Array.isArray(data.items) ? data.items.map(it => ({
        id: it.id,
        title: it.title || '',
        category: it.category || '',
        startAt: it.startAt || null,
        timeText: it.timeText || '',
        place: it.place || '',
        posterUrl: it.posterUrl || '',
        registeredCount: Number(it.registeredCount ?? 0),
        limit: Number(it.limit ?? 0)
      })) : []
      const marked = this.markFavorites(raw, this.data.favIds)
      const items = this.applyFavFilter(marked, this.data.showFavOnly)
      this.setData({ items })
    } catch (e) {
      this.setData({ error: (e?.data?.message) || '获取活动失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async fetchFavorites() {
    try {
      const res = await request({ url: `${API_BASE}/api/users/me/favorites`, method: 'GET' })
      const items = Array.isArray(res.data?.items) ? res.data.items : []
      const ids = items.map(x => Number(x.id)).filter(n => Number.isFinite(n) && n > 0)
      const marked = this.markFavorites(this.data.items, ids)
      const items2 = this.applyFavFilter(marked, this.data.showFavOnly)
      this.setData({ favIds: ids, items: items2 })
    } catch (_) { /* 未登录或401忽略 */ }
  },
  markFavorites(list, favIds) {
    const set = new Set(Array.isArray(favIds) ? favIds : [])
    return Array.isArray(list) ? list.map(it => ({ ...it, favorited: set.has(Number(it.id)) })) : []
  },
  applyFavFilter(list, showFavOnly) {
    if (!Array.isArray(list)) return []
    return showFavOnly ? list.filter(it => !!it.favorited) : list
  },
  openDetail(e) {
    const id = Number(e?.currentTarget?.dataset?.id)
    if (!Number.isFinite(id) || id <= 0) return
    wx.navigateTo({ url: `/pages/activities/detail?id=${id}` })
  },
  async toggleFavorite(e) {
    const id = Number(e?.currentTarget?.dataset?.id)
    if (!Number.isFinite(id) || id <= 0) return
    const item = (this.data.items || []).find(x => Number(x.id) === id)
    const isFav = !!item?.favorited
    this.setData({ favoritingId: id })
    try {
      if (!isFav) {
        await request({ url: `${API_BASE}/api/activities/${id}/favorite`, method: 'POST' })
        const ids = Array.from(new Set([...(this.data.favIds || []), id]))
        const marked = this.markFavorites(this.data.items, ids)
        const items = this.applyFavFilter(marked, this.data.showFavOnly)
        this.setData({ favIds: ids, items })
        wx.showToast({ title: '已收藏', icon: 'success' })
      } else {
        await request({ url: `${API_BASE}/api/activities/${id}/favorite`, method: 'DELETE' })
        const ids = (this.data.favIds || []).filter(x => x !== id)
        const marked = this.markFavorites(this.data.items, ids)
        const items = this.applyFavFilter(marked, this.data.showFavOnly)
        this.setData({ favIds: ids, items })
        wx.showToast({ title: '已取消收藏', icon: 'success' })
      }
    } catch (er) {
      const msg = er?.data?.message || (isFav ? '取消失败' : '收藏失败')
      wx.showToast({ title: msg, icon: 'none' })
    } finally {
      this.setData({ favoritingId: 0 })
    }
  },
  goMyRegistrations() {
    wx.navigateTo({ url: '/pages/registrations/index' })
  },
  goMyFavorites() {
    wx.navigateTo({ url: '/pages/favorites/index' })
  },
  toggleFavOnly(e) {
    const on = !!e?.detail?.value
    const items = this.applyFavFilter(this.markFavorites(this.data.items, this.data.favIds), on)
    this.setData({ showFavOnly: on, items })
  },
  fullUploadsUrl(rel) {
    if (!rel) return ''
    if (rel.startsWith('http')) return rel
    return `${API_BASE}/uploads/${rel}`
  },
  formatDateTime(s) {
    if (!s) return ''
    try {
      const dt = new Date(s)
      const pad = n => String(n).padStart(2, '0')
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    } catch { return '' }
  }
})