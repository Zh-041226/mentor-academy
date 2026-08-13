// Simple request wrapper that injects JWT from storage
export function request(options) {
  const jwt = wx.getStorageSync('jwt') || ''
  const headers = Object.assign({}, options.header || {}, jwt ? { 'Authorization': 'Bearer ' + jwt } : {})
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      header: headers,
      success: (res) => {
        const sc = Number(res.statusCode || 0)
        if (sc >= 200 && sc < 300) return resolve(res)
        const message = (res.data && res.data.message) ? res.data.message : `HTTP ${sc}`
        reject({ ...res, message })
      },
      fail: (err) => reject(err)
    })
  })
}