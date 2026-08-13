const { API_BASE } = require('../../utils/config');

Page({
  data: {
    loading: false,
    error: ''
  },
  doLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    wx.login({
      success: (res) => {
        if (!res.code) {
          this.setData({ loading: false, error: '登录失败，请重试' });
          return;
        }
        wx.request({
          url: `${API_BASE}/api/weapp/login`,
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: { code: res.code },
          success: (resp) => {
            const data = resp.data || {};
            if (resp.statusCode === 200 && data.token) {
              wx.setStorageSync('jwt', data.token);
              wx.showToast({ title: '登录成功', icon: 'success' });
              setTimeout(() => {
                // 登录成功后跳转到“活动广场”原生页
                wx.reLaunch({ url: '/pages/activities/index' });
              }, 300);
            } else if (resp.statusCode === 200 && data.status === 'need_bind') {
              wx.navigateTo({ url: '/pages/bind/bind' });
            } else {
              this.setData({ error: data.message || '登录失败，请重试' });
            }
          },
          fail: () => {
            this.setData({ error: '网络错误，请稍后重试' });
          },
          complete: () => {
            this.setData({ loading: false });
          }
        });
      },
      fail: () => {
        this.setData({ loading: false, error: '登录失败，请检查网络' });
      }
    });
  }
});