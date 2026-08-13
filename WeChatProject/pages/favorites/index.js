import { request } from '../../utils/request'
const { API_BASE } = require('../../utils/config')

Page({
  data: {
    loading: false,
    error: '',
    items: [],
    unfavoritingId: 0
  },
  onLoad() {
    this.fetchList()
  },
  async fetchList() {
    this.setData({ loading: true, error: '' })
    try {
      const res = await request({ url: `${API_BASE}/api/users/me/favorites`, method: 'GET' })
      const items = Array.isArray(res.data?.items) ? res.data.items.map(it => ({
        id: it.id,
        title: it.title || '',
        mentorName: it.mentorName || '',
        timeText: it.timeText || '',
        place: it.place || '',
        category: it.category || ''
      })) : []
      this.setData({ items })
    } catch (e) {
      const msg = e?.data?.message || '获取收藏失败'
      this.setData({ error: msg })
    } finally {
      this.setData({ loading: false })
    }
  },
  async unfavorite(e) {
    const id = Number(e?.currentTarget?.dataset?.id)
    if (!Number.isFinite(id) || id <= 0) return
    this.setData({ unfavoritingId: id })
    try {
      await request({ url: `${API_BASE}/api/activities/${id}/favorite`, method: 'DELETE' })
      wx.showToast({ title: '已取消收藏', icon: 'success' })
      await this.fetchList()
    } catch (er) {
      wx.showToast({ title: er?.data?.message || '取消失败', icon: 'none' })
    } finally {
      this.setData({ unfavoritingId: 0 })
    }
  },
  openDetail(e) {
    const id = Number(e?.currentTarget?.dataset?.id)
    if (!Number.isFinite(id) || id <= 0) return
    wx.navigateTo({ url: `/pages/activities/detail?id=${id}` })
  }
})