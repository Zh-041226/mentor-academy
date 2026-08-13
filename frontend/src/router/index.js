import { createRouter, createWebHistory } from 'vue-router'
import http from '../api/http'

const Register = () => import('../views/Register.vue')
const Login = () => import('../views/Login.vue')
const UserCenter = () => import('../views/UserCenter.vue')
const Activities = () => import('../views/Activities.vue')
const Announcements = () => import('../views/Announcements.vue')
const HomeWrapper = () => import('../views/HomeWrapper.vue')
const ActivityDetail = () => import('../views/ActivityDetail.vue')
const ActivityRegisterConfirm = () => import('../views/ActivityRegisterConfirm.vue')
const MyActivities = () => import('../views/MyActivities.vue')
const Mentors = () => import('../views/Mentors.vue')
const MentorDetail = () => import('../views/MentorDetail.vue')
const AdminLayout = () => import('../views/admin/AdminLayout.vue')
const AdminDashboard = () => import('../views/admin/AdminDashboard.vue')
const AdminActivities = () => import('../views/admin/AdminActivities.vue')
const AdminUsers = () => import('../views/admin/AdminUsers.vue')
const AdminRegistrations = () => import('../views/admin/AdminRegistrations.vue')
const AdminLogin = () => import('../views/admin/AdminLogin.vue')
const AdminPoster = () => import('../views/admin/AdminPoster.vue')
const AdminAnnouncements = () => import('../views/admin/AdminAnnouncements.vue')
const WeAppSso = () => import('../views/WeAppSso.vue')

const routes = [
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'Home', component: HomeWrapper, meta: { mobileTitle: '首页' } },
  { path: '/activities', redirect: '/home' },
  { path: '/register', name: 'Register', component: Register },
  { path: '/login', name: 'Login', component: Login },
  { path: '/weapp-sso', name: 'WeAppSso', component: WeAppSso },
  { path: '/admin/login', name: 'AdminLogin', component: AdminLogin },
  { path: '/me', name: 'UserCenter', component: UserCenter, meta: { requiresAuth: true, mobileTitle: '我的' } },
  { path: '/announcements', name: 'Announcements', component: Announcements, meta: { mobileTitle: '公告' } },
  { path: '/activities/:id/register', name: 'ActivityRegisterConfirm', component: ActivityRegisterConfirm, meta: { requiresAuth: true, mobileTitle: '确认报名' } },
  { path: '/activities/:id', name: 'ActivityDetail', component: ActivityDetail, meta: { mobileTitle: '活动详情' } },
  { path: '/my-activities', name: 'MyActivities', component: MyActivities, meta: { requiresAuth: true, mobileTitle: '我的报名' } },
  { path: '/mentors', name: 'Mentors', component: Mentors }
  ,{ path: '/mentors/:id', name: 'MentorDetail', component: MentorDetail }
  ,{
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true, title: '管理后台', description: '统一处理活动、报名、用户与配置' },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'AdminDashboard', component: AdminDashboard, meta: { title: '仪表盘', description: '查看关键数据与近期趋势' } },
      { path: 'activities', name: 'AdminActivities', component: AdminActivities, meta: { title: '活动管理', description: '统一维护活动资料、状态与展示素材' } },
      { path: 'announcements', name: 'AdminAnnouncements', component: AdminAnnouncements, meta: { title: '公告管理', description: '发布通知、综测证明与资料附件' } },
      { path: 'users', name: 'AdminUsers', component: AdminUsers, meta: { title: '用户管理', description: '管理普通用户、管理员与禁报名状态' } },
      { path: 'registrations', name: 'AdminRegistrations', component: AdminRegistrations, meta: { title: '活动报名管理', description: '集中处理报名名单、取消审核与签到标记' } },
      { path: 'poster', name: 'AdminPoster', component: AdminPoster, meta: { title: '海报设置', description: '维护首页轮播海报与展示时段' } }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta?.requiresAuth && !token) {
    const isAdminPath = String(to.fullPath || '').startsWith('/admin')
    next({ path: isAdminPath ? '/admin/login' : '/login', query: { redirect: to.fullPath } })
    return
  }
  if (to.meta?.requiresAdmin) {
    if (!token) {
      next({ path: '/admin/login', query: { redirect: to.fullPath } })
      return
    }
    try {
      const { data } = await http.get('/users/me')
      if (data?.role !== 'ADMIN') {
        next({ path: '/admin/login', query: { redirect: to.fullPath, noauth: 1 } })
        return
      }
      // 细粒度访问控制：普通干事仅允许访问仪表盘与活动报名管理
      const lvl = data?.adminLevel
      const path = String(to.path || '')
      const isActivities = path.startsWith('/admin/activities')
      const isUsers = path.startsWith('/admin/users')
      if (lvl === 'STAFF' && (isActivities || isUsers)) {
        next({ path: '/admin/registrations', query: { reason: 'no-permission' } })
        return
      }
    } catch {
      next({ path: '/admin/login', query: { redirect: to.fullPath } })
      return
    }
  }
  next()
})

export default router
