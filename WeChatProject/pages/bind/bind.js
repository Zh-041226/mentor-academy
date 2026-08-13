import { request } from '../../utils/request'
const { API_BASE } = require('../../utils/config')

Page({
  data: {
    studentId: '',
    password: '',
    loading: false,
    error: ''
  },
  onStudentId(e) {
    this.setData({ studentId: e.detail.value.trim() })
  },
  onPassword(e) {
    this.setData({ password: e.detail.value })
  },
  async onBind() {
    const { studentId, password } = this.data
    if (!/^\d{10,16}$/.test(studentId)) {
      this.setData({ error: '请填写正确的学号' })
      return
    }
    if (!/^.{6,}$/.test(password)) {
      this.setData({ error: '请填写正确的密码' })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      })
      const code = loginRes.code
      if (!code) throw new Error('获取登录凭证失败')

      const { data } = await request({
        url: `${API_BASE}/api/weapp/bind`,
        method: 'POST',
        data: { code, studentId, password }
      })

      if (data && data.token) {
        wx.setStorageSync('jwt', data.token)
        wx.showToast({ title: '绑定成功', icon: 'success' })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/index/index' })
        }, 500)
        return
      }
      if (data && data.message) {
        this.setData({ error: data.message })
      } else {
        this.setData({ error: '绑定失败，请稍后重试' })
      }
    } catch (e) {
      this.setData({ error: e.message || '网络异常' })
    } finally {
      this.setData({ loading: false })
    }
  }
})