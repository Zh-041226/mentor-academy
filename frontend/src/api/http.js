import axios from 'axios'
import router from '../router'

const isDev = import.meta.env.DEV
const backendBase = import.meta.env.VITE_BACKEND_URL
const baseURL = isDev
  ? '/api'
  : (backendBase && backendBase.trim()
      ? `${String(backendBase).replace(/\/+$/, '')}/api`
      : '/api')

const http = axios.create({
  baseURL,
  timeout: 10000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token')
      const fullPath = router.currentRoute.value?.fullPath || '/'
      const isAdminPath = String(fullPath).startsWith('/admin')
      router.replace({ path: isAdminPath ? '/admin/login' : '/login', query: { redirect: fullPath } })
    }
    return Promise.reject(err)
  }
)

export default http

