import express from 'express'
import cors from 'cors'
import compression from 'compression'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { imageSize } from 'image-size'
import sharp from 'sharp'
import { PrismaClient, Prisma } from '@prisma/client'

dotenv.config()

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(cors())
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false
    return compression.filter(req, res)
  }
}))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
// 统一处理 JSON 解析错误，避免默认 HTML 400 页面
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 'BAD_REQUEST', message: '请求体不是合法的 JSON' })
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: '请求体不是合法的 JSON' })
  }
  next(err)
})

const STATIC_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.pdf': 'application/pdf'
}

function setStaticAssetHeaders(res, filePath, { maxAgeSeconds = 86400, immutable = false } = {}) {
  try {
    const ext = path.extname(filePath).toLowerCase()
    const type = STATIC_MIME_TYPES[ext]
    if (type) res.setHeader('Content-Type', type)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}${immutable ? ', immutable' : ', stale-while-revalidate=86400'}`)
  } catch {}
}
// 静态文件：上传目录（用于访问保存的图片）
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) {
  try { fs.mkdirSync(UPLOAD_DIR) } catch {}
}
app.use('/uploads', express.static(UPLOAD_DIR, {
  etag: true,
  lastModified: true,
  maxAge: '7d',
  setHeaders: (res, filePath) => setStaticAssetHeaders(res, filePath, { maxAgeSeconds: 604800 })
}))
const PROTECTED_UPLOAD_DIR = path.join(UPLOAD_DIR, 'protected')
const PROTECTED_ANNOUNCEMENT_DIR = path.join(PROTECTED_UPLOAD_DIR, 'announcements')
for (const dir of [PROTECTED_UPLOAD_DIR, PROTECTED_ANNOUNCEMENT_DIR]) {
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
  }
}

// 书院 Logo 静态资源：从项目根目录的 /logo 提供静态访问（显式设置响应头，避免浏览器 ORB/CORB 误拦截）
try {
  const LOGO_DIR = path.join(process.cwd(), '..', 'logo')
  if (fs.existsSync(LOGO_DIR)) {
    app.use('/logo', express.static(LOGO_DIR, {
      etag: true,
      lastModified: true,
      maxAge: '30d',
      setHeaders: (res, filePath) => setStaticAssetHeaders(res, filePath, { maxAgeSeconds: 2592000, immutable: true })
    }))
  }
} catch {}

// 首页轮播海报：从项目根目录的 /hero 提供静态访问（你可把想要的图片放到该文件夹）。显式设置响应头，避免浏览器 ORB/CORB 误拦截。
try {
  const HERO_DIR = path.join(process.cwd(), '..', 'hero')
  if (fs.existsSync(HERO_DIR)) {
    app.use('/hero', express.static(HERO_DIR, {
      etag: true,
      lastModified: true,
      maxAge: '30d',
      setHeaders: (res, filePath) => setStaticAssetHeaders(res, filePath, { maxAgeSeconds: 2592000, immutable: true })
    }))
  }
} catch {}

// 登录/注册左侧展示图：从项目根目录的 /auth 提供静态访问（将你想要的图片放到该文件夹）
try {
  const AUTH_DIR = path.join(process.cwd(), '..', 'auth')
  if (fs.existsSync(AUTH_DIR)) {
    app.use('/auth', express.static(AUTH_DIR, {
      etag: true,
      lastModified: true,
      maxAge: '30d',
      setHeaders: (res, filePath) => setStaticAssetHeaders(res, filePath, { maxAgeSeconds: 2592000, immutable: true })
    }))
  }
} catch {}

const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
// WeChat Mini Program config
const WECHAT_APPID = process.env.WECHAT_APPID || ''
const WECHAT_SECRET = process.env.WECHAT_SECRET || ''
const WEAPP_SSO_TTL_MINUTES = parseInt(process.env.WEAPP_SSO_TICKET_TTL_MINUTES || '10', 10)
const ACTIVITY_DESCRIPTION_MAX_LENGTH = 5000
const prisma = new PrismaClient()

function getEffectiveActivityStatus(activity, now = new Date()) {
  const rawStatus = String(activity?.status || '').trim().toUpperCase()
  const terminalStatuses = new Set(['CLOSED', 'FINISHED', 'CANCELED'])
  if (terminalStatuses.has(rawStatus)) return rawStatus
  if (!activity?.registerDeadline) return rawStatus || 'PUBLISHED'
  const deadlineMs = new Date(activity.registerDeadline).getTime()
  if (!Number.isFinite(deadlineMs)) return rawStatus || 'PUBLISHED'
  return now.getTime() > deadlineMs ? 'CLOSED' : (rawStatus || 'PUBLISHED')
}

function decorateActivity(activity, now = new Date()) {
  return { ...activity, status: getEffectiveActivityStatus(activity, now) }
}

// 学号注册接口：仅接受学号 + 密码
app.post('/api/auth/register', async (req, res) => {
  const { studentId, password, name, contact, className } = req.body || {}
  // 统一规则：学号需为12位数字（与管理员创建学生接口保持一致）
  if (!studentId || !/^\d{12}$/.test(String(studentId))) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '学号需为12位数字' })
  }
  if (!password || !/^[A-Za-z0-9]{6,12}$/.test(String(password))) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '密码要求6-12位（只能由数字和英文组成）' })
  }
  if (!name || !/^[\u4e00-\u9fa5]+$/.test(String(name).trim())) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '姓名（只能为中文）' })
  }
  if (!contact || !/^\d{11}$/.test(String(contact).trim())) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '联系方式（11位数字）' })
  }
  if (!className || String(className).trim().length === 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写班级' })
  }
  const existed = await prisma.user.findUnique({ where: { studentId: String(studentId) } })
  if (existed) {
    return res.status(409).json({ code: 'CONFLICT', message: '该学号已注册' })
  }
  const hashed = await bcrypt.hash(String(password), 10)
  const user = await prisma.user.create({ data: { studentId: String(studentId), password: hashed, plainPassword: String(password), name: String(name).trim(), contact: String(contact).trim(), className: String(className).trim() } })
  return res.status(201).json({ message: '注册成功', studentId: user.studentId })
})

// 仅学号登录，返回 JWT
app.post('/api/auth/login', async (req, res) => {
  const { studentId, password } = req.body || {}
  if (!studentId || !password) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请输入学号和密码' })
  }
  const user = await prisma.user.findUnique({ where: { studentId: String(studentId) } })
  if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: '学号或密码错误' })
  const ok = await bcrypt.compare(String(password), user.password)
  if (!ok) return res.status(401).json({ code: 'UNAUTHORIZED', message: '学号或密码错误' })
  // 登录成功后，若缺少明文或不同步，则回填明文密码
  try {
    const plain = String(password)
    if (!user.plainPassword || user.plainPassword !== plain) {
      await prisma.user.update({ where: { id: user.id }, data: { plainPassword: plain } })
    }
  } catch (e) {
    console.warn('[login] plainPassword backfill failed', e)
  }
  const token = jwt.sign({ sub: user.id, studentId: user.studentId, role: user.role || 'STUDENT' }, JWT_SECRET, { expiresIn: '7d' })
  return res.json({ token })
})

// WeChat Mini Program: obtain sso_ticket via jscode2session
app.post('/api/weapp/login', async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim()
    if (!code) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 code' })
    }
    if (!WECHAT_APPID || !WECHAT_SECRET) {
      return res.status(500).json({ code: 'SERVER_MISCONFIG', message: '未配置 WECHAT_APPID/WECHAT_SECRET' })
    }
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
    url.searchParams.set('appid', WECHAT_APPID)
    url.searchParams.set('secret', WECHAT_SECRET)
    url.searchParams.set('js_code', code)
    url.searchParams.set('grant_type', 'authorization_code')
    let wx
    try {
      const r = await fetch(url, { method: 'GET' })
      wx = await r.json()
    } catch (e) {
      console.error('[weapp/login] fetch jscode2session failed', e)
      return res.status(502).json({ code: 'UPSTREAM_ERROR', message: '微信接口调用失败' })
    }
    if (!wx || !wx.openid) {
      const msg = wx?.errmsg || '微信未返回 openid'
      return res.status(400).json({ code: 'WECHAT_ERROR', message: msg, detail: wx || null })
    }

    // 已绑定用户：直接签发站点 JWT
    let boundUser = null
    try {
      boundUser = await prisma.user.findUnique({ where: { weappOpenId: wx.openid } })
      if (!boundUser && wx.unionid) {
        boundUser = await prisma.user.findFirst({ where: { weappUnionId: wx.unionid } })
      }
    } catch (e) {
      console.warn('[weapp/login] binding lookup failed', e)
    }

    if (boundUser) {
      const token = jwt.sign({ sub: boundUser.id, studentId: boundUser.studentId, role: boundUser.role || 'STUDENT' }, JWT_SECRET, { expiresIn: '7d' })
      return res.json({ token })
    }

    // 未绑定：返回短期 sso_ticket（可用于 H5 绑定或保留回退方案）以及引导绑定标识
    const ttlSec = Math.max(60, (Number.isFinite(WEAPP_SSO_TTL_MINUTES) ? WEAPP_SSO_TTL_MINUTES : 10) * 60)
    const ssoTicket = jwt.sign({ typ: 'weapp_sso', openid: wx.openid, unionid: wx.unionid || null }, JWT_SECRET, { expiresIn: ttlSec })
    return res.json({ need_bind: true, sso_ticket: ssoTicket, expires_in: ttlSec })
  } catch (e) {
    console.error('[weapp/login] error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '小程序登录失败' })
  }
})

// WeChat Mini Program: exchange sso_ticket to site JWT
// Note: 当前不做账号自动绑定；若尚未绑定，返回 NO_BINDING，前端可引导用户使用站点账号登录或后续实现绑定流程
app.post('/api/weapp/sso-exchange', async (req, res) => {
  try {
    const ticket = String(req.body?.sso_ticket || '').trim()
    if (!ticket) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 sso_ticket' })
    }
    let payload
    try {
      payload = jwt.verify(ticket, JWT_SECRET)
    } catch (e) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'sso_ticket 无效或已过期' })
    }
    if (!payload || payload.typ !== 'weapp_sso' || !payload.openid) {
      return res.status(400).json({ code: 'BAD_TICKET', message: 'sso_ticket 内容非法' })
    }

    // TODO: 当有 weappOpenId/UnionId 绑定字段后，在此查找对应用户并签发站点 JWT
    // 目前返回未绑定标志，避免误登录到错误账号
    return res.status(428).json({ code: 'NO_BINDING', message: '尚未绑定站点账号，请先在 H5 登录或后续完成绑定' })
  } catch (e) {
    console.error('[weapp/sso-exchange] error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'SSO 交换失败' })
  }
})

// WeChat Mini Program: bind openid/unionid to existing user (studentId + password)
app.post('/api/weapp/bind', async (req, res) => {
  try {
    const b = req.body || {}
    const code = String(b.code || '').trim()
    const studentId = String(b.studentId || '').trim()
    const password = String(b.password || '')
    if (!code) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '缺少 code' })
    if (!studentId || !/^\d{12}$/.test(studentId)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '学号需为12位数字' })
    if (!password || !/^[A-Za-z0-9]{6,12}$/.test(password)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '密码要求6-12位（数字或字母）' })
    if (!WECHAT_APPID || !WECHAT_SECRET) {
      return res.status(500).json({ code: 'SERVER_MISCONFIG', message: '未配置 WECHAT_APPID/WECHAT_SECRET' })
    }

    // 通过 jscode2session 获取 openid/unionid
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
    url.searchParams.set('appid', WECHAT_APPID)
    url.searchParams.set('secret', WECHAT_SECRET)
    url.searchParams.set('js_code', code)
    url.searchParams.set('grant_type', 'authorization_code')
    let wx
    try {
      const r = await fetch(url, { method: 'GET' })
      wx = await r.json()
    } catch (e) {
      console.error('[weapp/bind] fetch jscode2session failed', e)
      return res.status(502).json({ code: 'UPSTREAM_ERROR', message: '微信接口调用失败' })
    }
    if (!wx || !wx.openid) {
      const msg = wx?.errmsg || '微信未返回 openid'
      return res.status(400).json({ code: 'WECHAT_ERROR', message: msg, detail: wx || null })
    }

    // 校验站点账号
    const user = await prisma.user.findUnique({ where: { studentId } })
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: '学号或密码错误' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ code: 'UNAUTHORIZED', message: '学号或密码错误' })

    // 冲突检查：该 openid/unionid 是否已绑定其他账号
    const existedByOpenId = await prisma.user.findUnique({ where: { weappOpenId: wx.openid } }).catch(() => null)
    if (existedByOpenId && existedByOpenId.id !== user.id) {
      return res.status(409).json({ code: 'CONFLICT', message: '该微信已绑定其他账号，请更换或联系管理员' })
    }
    let existedByUnionId = null
    if (wx.unionid) {
      try { existedByUnionId = await prisma.user.findFirst({ where: { weappUnionId: wx.unionid } }) } catch {}
      if (existedByUnionId && existedByUnionId.id !== user.id) {
        return res.status(409).json({ code: 'CONFLICT', message: '该微信 UnionID 已绑定其他账号，请更换或联系管理员' })
      }
    }

    // 执行绑定
    const updated = await prisma.user.update({ where: { id: user.id }, data: { weappOpenId: wx.openid, weappUnionId: wx.unionid || undefined, weappBoundAt: new Date() } })
    const token = jwt.sign({ sub: updated.id, studentId: updated.studentId, role: updated.role || 'STUDENT' }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ token })
  } catch (e) {
    console.error('[weapp/bind] error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '绑定失败' })
  }
})

// 简单鉴权中间件
const auth = (req, res, next) => {
  const h = req.headers.authorization || ''
  let token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token && req.query.token) token = String(req.query.token)
  if (!token) return res.status(401).json({ code: 'UNAUTHORIZED', message: '缺少令牌' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '令牌无效或已过期' })
  }
}

// 管理员权限校验（需已通过 auth）
const adminAuth = async (req, res, next) => {
  try {
    const id = Number(req.user?.sub)
    if (!Number.isFinite(id)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '需要管理员权限' })
    }
    if (prisma.user && typeof prisma.user.findUnique === 'function') {
      const u = await prisma.user.findUnique({ where: { id } })
      if (u && u.role === 'ADMIN') {
        // 始终注入管理员等级，供后续细粒度权限控制
        req.adminLevel = u.adminLevel || req.adminLevel
        return next()
      }
    }
  } catch (e) {
    console.error('[adminAuth] error', e)
  }
  return res.status(403).json({ code: 'FORBIDDEN', message: '需要管理员权限' })
}

// 软认证：允许未登录访问，若携带合法令牌则附加用户信息
function tryAuth(req, _res, next) {
  try {
    const authHeader = String(req.headers.authorization || '').trim()
    let token = null
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length)
    } else if (req.query.token) {
      token = String(req.query.token)
    }
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET)
      if (payload && payload.sub) {
        req.user = payload
      }
    }
  } catch {}
  next()
}

// 细粒度权限控制：根据管理员等级限制不同能力
const ADMIN_LEVEL = {
  MENGSUILIANYUN: 'MENGSUILIANYUN',
  SUPERVISOR: 'SUPERVISOR',
  OWNER_PRIMARY: 'OWNER_PRIMARY',
  OWNER_SECONDARY: 'OWNER_SECONDARY',
  STAFF: 'STAFF'
}

function getRestrictedAdminLevels(viewerLevel) {
  switch (viewerLevel) {
    case ADMIN_LEVEL.SUPERVISOR:
      return new Set([ADMIN_LEVEL.MENGSUILIANYUN, ADMIN_LEVEL.SUPERVISOR])
    case ADMIN_LEVEL.OWNER_PRIMARY:
      return new Set([ADMIN_LEVEL.MENGSUILIANYUN, ADMIN_LEVEL.SUPERVISOR, ADMIN_LEVEL.OWNER_PRIMARY])
    case ADMIN_LEVEL.OWNER_SECONDARY:
      return new Set([ADMIN_LEVEL.MENGSUILIANYUN, ADMIN_LEVEL.SUPERVISOR, ADMIN_LEVEL.OWNER_PRIMARY, ADMIN_LEVEL.OWNER_SECONDARY])
    case ADMIN_LEVEL.STAFF:
      // 普通干事仅允许访问：仪表盘与活动报名管理
      return new Set([ADMIN_LEVEL.MENGSUILIANYUN, ADMIN_LEVEL.SUPERVISOR, ADMIN_LEVEL.OWNER_PRIMARY, ADMIN_LEVEL.OWNER_SECONDARY, ADMIN_LEVEL.STAFF])
    default:
      return new Set() // 梦碎怜云：无限制
  }
}

function isStaff(level) { return level === ADMIN_LEVEL.STAFF }

// 轮播海报管理权限（当前仅梦碎怜云）
function canManageHeroSlides(level) { return level === ADMIN_LEVEL.MENGSUILIANYUN }

// 图片上传：海报/QQ群二维码
function sanitizeUploadBaseName(fileName, fallback = 'file') {
  const ext = path.extname(fileName || '').toLowerCase()
  const rawBase = path.basename(fileName || fallback, ext).slice(0, 60)
  const safeBase = rawBase.replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return safeBase || fallback
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
    const base = sanitizeUploadBaseName(file.originalname || 'image', 'image')
    const name = `${base}_${Date.now()}${ext}`
    cb(null, name)
  }
})
const upload = multer({ storage })
const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROTECTED_ANNOUNCEMENT_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin'
    const base = sanitizeUploadBaseName(file.originalname || 'announcement', 'announcement')
    cb(null, `${base}_${Date.now()}${ext}`)
  }
})
const uploadDocument = multer({ storage: documentStorage })

function isAllowedImage(file) {
  // 根据用户需求，放开所有文件格式限制
  return !!file
}

function isAllowedAnnouncementDocument(file) {
  if (!file) return false
  const allowedMimes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/vnd.rar',
    'application/x-7z-compressed',
    'text/plain',
    'text/csv',
    'application/octet-stream'
  ])
  const allowedExts = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z', '.txt', '.csv'])
  const ext = path.extname(file.originalname || '').toLowerCase()
  return allowedMimes.has(file.mimetype || '') && allowedExts.has(ext)
}

function removeIfExists(filePath) {
  if (!filePath) return
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
}

function buildAnnouncementAttachmentPath(fileName) {
  return `announcements/${fileName}`
}

function getAnnouncementAttachmentAbsolutePath(storedPath) {
  const normalized = String(storedPath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const fileName = path.basename(normalized)
  return path.join(PROTECTED_ANNOUNCEMENT_DIR, fileName)
}

function formatAnnouncement(item) {
  return {
    id: item.id,
    title: item.title || '',
    summary: item.summary || '',
    content: item.content || '',
    published: !!item.published,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    hasAttachment: !!item.attachmentPath,
    attachmentPath: item.attachmentPath || '',
    attachmentOriginalName: item.attachmentOriginalName || '',
    attachmentMimeType: item.attachmentMimeType || '',
    attachmentSizeBytes: Number(item.attachmentSizeBytes || 0)
  }
}

app.post('/api/admin/upload/image', auth, adminAuth, upload.single('file'), async (req, res) => {
  try {
    if (isStaff(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权上传图片' })
    }
    const type = String(req.query.type || '').toLowerCase()
    const f = req.file
    if (!f) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '未接收到文件' })
    }
    
    // 移除所有大小、尺寸、比例限制
    const size = Number(f.size || 0)
    
    // 如果是活动海报或宣传图，尝试生成低画质缩略图（真低画质方案）
    let hasThumb = false
    if (type === 'poster' || type === 'promo' || type === 'hero') {
      try {
        const thumbName = `${f.filename.split('.')[0]}_thumb.webp`
        const thumbPath = path.join(UPLOAD_DIR, thumbName)
        await sharp(f.path)
          .resize({ width: 400, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(thumbPath)
        hasThumb = true
      } catch (err) {
        console.error('[admin] generate thumbnail error:', err)
      }
    }
    
    const url = `/uploads/${f.filename}`
    return res.json({ url, sizeBytes: size, hasThumb })
  } catch (e) {
    console.error('[admin] upload image error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '图片上传失败' })
  }
})

app.post('/api/admin/upload/document', auth, adminAuth, uploadDocument.single('file'), async (req, res) => {
  try {
    if (isStaff(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权上传公告附件' })
    }
    const type = String(req.query.type || '').toLowerCase()
    if (type !== 'announcement') {
      if (req.file?.path) removeIfExists(req.file.path)
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '仅支持公告附件上传' })
    }
    const f = req.file
    if (!f || !isAllowedAnnouncementDocument(f)) {
      if (f?.path) removeIfExists(f.path)
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '仅支持 PDF、Word、Excel、PPT、压缩包、TXT、CSV 等常见文档' })
    }
    const size = Number(f.size || 0)
    const limit = 20 * 1024 * 1024
    if (size > limit) {
      removeIfExists(f.path)
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '公告附件需小于20MB' })
    }
    return res.json({
      path: buildAnnouncementAttachmentPath(f.filename),
      originalName: f.originalname || f.filename,
      mimeType: f.mimetype || 'application/octet-stream',
      sizeBytes: size
    })
  } catch (e) {
    console.error('[admin] upload document error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '公告附件上传失败' })
  }
})
// ====== 主海报设置（仅梦碎怜云） ======
function isMengSuiLianYun(level) { return level === ADMIN_LEVEL.MENGSUILIANYUN }
const HERO_MAIN_CONFIG = path.join(UPLOAD_DIR, 'hero-main.json')

// 读取主海报设置
app.get('/api/admin/hero/main', auth, adminAuth, async (req, res) => {
  try {
    if (!isMengSuiLianYun(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '仅梦碎怜云可操作主海报设置' })
    }
    let url = ''
    if (fs.existsSync(HERO_MAIN_CONFIG)) {
      try {
        const j = JSON.parse(fs.readFileSync(HERO_MAIN_CONFIG, 'utf-8'))
        url = String(j?.url || '')
      } catch {}
    }
    return res.json({ url })
  } catch (e) {
    console.error('[admin] get hero main error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取主海报设置失败' })
  }
})

// 设置/清除主海报
app.post('/api/admin/hero/main', auth, adminAuth, async (req, res) => {
  try {
    if (!isMengSuiLianYun(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '仅梦碎怜云可操作主海报设置' })
    }
    const b = req.body || {}
    let url = String(b.url || '').trim()
    if (url) {
      // 仅允许使用本系统上传的图片（/uploads/...）
      if (!url.startsWith('/uploads/')) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '图片地址不合法（必须为 /uploads/...）' })
      }
      const filePath = path.join(process.cwd(), url.replace(/^\/+/, ''))
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '图片文件不存在，请重新上传' })
      }
      fs.writeFileSync(HERO_MAIN_CONFIG, JSON.stringify({ url, updatedAt: Date.now() }, null, 2))
      return res.json({ message: '已设置主海报', url })
    } else {
      try { if (fs.existsSync(HERO_MAIN_CONFIG)) fs.unlinkSync(HERO_MAIN_CONFIG) } catch {}
      return res.json({ message: '已清除主海报设置' })
    }
  } catch (e) {
    console.error('[admin] set hero main error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '设置主海报失败' })
  }
})

// ====== 轮播海报 CRUD（仅梦碎怜云） ======
app.get('/api/admin/hero-slides', auth, adminAuth, async (req, res) => {
  try {
    if (!canManageHeroSlides(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '仅梦碎怜云可管理轮播海报' })
    }
    const items = await prisma.heroSlide.findMany({ orderBy: { sortOrder: 'asc' } })
    return res.json({ items })
  } catch (e) {
    console.error('[admin hero-slides] list error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取轮播海报列表失败' })
  }
})

app.post('/api/admin/hero-slides', auth, adminAuth, async (req, res) => {
  try {
    if (!canManageHeroSlides(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '仅梦碎怜云可管理轮播海报' })
    }
    const b = req.body || {}
    const imageUrl = String(b.imageUrl || '').trim()
    const alt = String(b.alt || '').trim()
    const published = b.published != null ? !!b.published : true
    const startsAt = b.startsAt ? new Date(b.startsAt) : null
    const endsAt = b.endsAt ? new Date(b.endsAt) : null
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '图片地址不合法（必须为 /uploads/...）' })
    }
    const filePath = path.join(process.cwd(), imageUrl.replace(/^\/+/, ''))
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '图片文件不存在，请重新上传' })
    }
    const maxOrder = await prisma.heroSlide.findMany({ select: { sortOrder: true }, orderBy: { sortOrder: 'desc' }, take: 1 })
    const sortOrder = (maxOrder[0]?.sortOrder ?? 0) + 10
    const created = await prisma.heroSlide.create({ data: { imageUrl, alt, published, startsAt: startsAt || undefined, endsAt: endsAt || undefined, sortOrder, updatedAt: new Date() } })
    return res.json({ item: created })
  } catch (e) {
    console.error('[admin hero-slides] create error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '新增轮播海报失败' })
  }
})

app.put('/api/admin/hero-slides/:id', auth, adminAuth, async (req, res) => {
  try {
    if (!canManageHeroSlides(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '仅梦碎怜云可管理轮播海报' })
    }
    const id = Number(req.params.id)
    const b = req.body || {}
    const data = {}
    if (b.imageUrl != null) {
      const imageUrl = String(b.imageUrl || '').trim()
      if (!imageUrl.startsWith('/uploads/')) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '图片地址不合法（必须为 /uploads/...）' })
      }
      const filePath = path.join(process.cwd(), imageUrl.replace(/^\/+/, ''))
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '图片文件不存在，请重新上传' })
      }
      data.imageUrl = imageUrl
    }
    if (b.alt != null) data.alt = String(b.alt || '').trim()
    if (b.published != null) data.published = !!b.published
    if (b.startsAt != null) data.startsAt = b.startsAt ? new Date(b.startsAt) : null
    if (b.endsAt != null) data.endsAt = b.endsAt ? new Date(b.endsAt) : null
    if (b.sortOrder != null) data.sortOrder = Number(b.sortOrder)
    data.updatedAt = new Date()
    const updated = await prisma.heroSlide.update({ where: { id }, data })
    return res.json({ item: updated })
  } catch (e) {
    console.error('[admin hero-slides] update error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '更新轮播海报失败' })
  }
})

app.delete('/api/admin/hero-slides/:id', auth, adminAuth, async (req, res) => {
  try {
    if (!canManageHeroSlides(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '仅梦碎怜云可管理轮播海报' })
    }
    const id = Number(req.params.id)
    await prisma.heroSlide.delete({ where: { id } })
    return res.json({ message: '已删除' })
  } catch (e) {
    console.error('[admin hero-slides] delete error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '删除轮播海报失败' })
  }
})

// 批量排序：传递 ids 按顺序重排 sortOrder
app.post('/api/admin/hero-slides/reorder', auth, adminAuth, async (req, res) => {
  try {
    if (!canManageHeroSlides(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '仅梦碎怜云可管理轮播海报' })
    }
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x) => Number(x)) : []
    if (!ids.length) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请提供待排序的 id 列表' })
    let order = 10
    for (const id of ids) {
      await prisma.heroSlide.update({ where: { id }, data: { sortOrder: order, updatedAt: new Date() } })
      order += 10
    }
    return res.json({ message: '排序已更新' })
  } catch (e) {
    console.error('[admin hero-slides] reorder error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '更新排序失败' })
  }
})

app.get('/api/users/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: Number(req.user.sub) } })
  if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: '用户不存在' })
  const now = new Date()
  let bannedUntil = user.bannedUntil
  // 若禁期已过，返回时清理显示但不改库（避免频繁写库）
  const isBanned = bannedUntil && bannedUntil.getTime() > now.getTime()
  const remainingDays = isBanned ? Math.max(0, Math.ceil((bannedUntil.getTime() - now.getTime()) / (24 * 3600 * 1000))) : 0
  res.json({
    id: user.id,
    studentId: user.studentId,
    name: user.name,
    contact: user.contact,
    className: user.className,
    role: user.role,
    adminLevel: user.adminLevel,
    plainPassword: user.plainPassword,
    createdAt: user.createdAt,
    bannedUntil,
    bannedNote: user.bannedNote || '',
    bannedCount: user.bannedCount || 0,
    banRemainingDays: remainingDays,
    isBanned
  })
})

// 更新我的信息（仅允许：联系方式、密码）
app.put('/api/users/me', auth, async (req, res) => {
  try {
    const id = Number(req.user.sub)
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: '用户不存在' })

    const b = req.body || {}
    const data = {}

    // 禁止修改：角色与创建时间
    if (b.role != null) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '角色不可自行修改，如需变更请联系管理员' })
    }
    if (b.createdAt != null) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '创建时间不可修改' })
    }

    // 限制：除联系方式、密码外的字段不可修改
    if (b.name != null || b.className != null || b.studentId != null || b.adminLevel != null) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '仅允许修改联系方式与密码，其他信息不可修改' })
    }

    // 可修改：联系方式（11位数字）
    if (b.contact != null) {
      const contact = String(b.contact).trim()
      if (!/^\d{11}$/.test(contact)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '联系方式需为11位数字' })
      }
      data.contact = contact
    }

    // 密码（6-12位数字或字母）
    if (b.password != null) {
      const pwd = String(b.password)
      if (!/^[A-Za-z0-9]{6,12}$/.test(pwd)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '密码要求6-12位（只能由数字和英文组成）' })
      }
      const hashed = await bcrypt.hash(pwd, 10)
      data.password = hashed
      data.plainPassword = pwd
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '未提供可修改的字段' })
    }

    // 原密码校验：任何修改都需提供并验证原密码
    const current = String(b.currentPassword || '').trim()
    if (!current) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写原密码以确认修改' })
    }
    const ok = await bcrypt.compare(current, user.password)
    if (!ok) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '原密码不正确' })
    }

    const updated = await prisma.user.update({ where: { id }, data })
    return res.json({ id: updated.id, studentId: updated.studentId, name: updated.name, contact: updated.contact, className: updated.className, role: updated.role, adminLevel: updated.adminLevel, plainPassword: updated.plainPassword, createdAt: updated.createdAt })
  } catch (e) {
    console.error('[users] update me error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '更新我的信息失败' })
  }
})

// Activities: list and detail (fallback to empty list if Prisma client not generated)
app.get('/api/announcements', async (_req, res) => {
  try {
    if (!prisma.announcement || typeof prisma.announcement.findMany !== 'function') {
      return res.json({ items: [] })
    }
    const items = await prisma.announcement.findMany({
      where: { published: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 100
    })
    return res.json({ items: items.map(formatAnnouncement) })
  } catch (e) {
    console.error('[announcements] list error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取公告列表失败' })
  }
})

app.get('/api/announcements/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '公告ID不合法' })
  try {
    if (!prisma.announcement || typeof prisma.announcement.findUnique !== 'function') {
      return res.status(404).json({ code: 'NOT_FOUND', message: '公告不存在' })
    }
    const item = await prisma.announcement.findUnique({ where: { id } })
    if (!item || !item.published) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '公告不存在或未发布' })
    }
    return res.json({ item: formatAnnouncement(item) })
  } catch (e) {
    console.error('[announcements] detail error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取公告详情失败' })
  }
})

app.get('/api/announcements/:id/download', auth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '公告ID不合法' })
  try {
    if (!prisma.announcement || typeof prisma.announcement.findUnique !== 'function') {
      return res.status(404).json({ code: 'NOT_FOUND', message: '公告不存在' })
    }
    const announcement = await prisma.announcement.findUnique({ where: { id } })
    if (!announcement) return res.status(404).json({ code: 'NOT_FOUND', message: '公告不存在' })
    let canView = !!announcement.published
    if (!canView) {
      const userId = Number(req.user?.sub)
      if (Number.isFinite(userId)) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
        canView = user?.role === 'ADMIN'
      }
    }
    if (!canView) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '公告不存在或未发布' })
    }
    if (!announcement.attachmentPath) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '该公告暂无附件' })
    }
    const absolutePath = getAnnouncementAttachmentAbsolutePath(announcement.attachmentPath)
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '附件文件不存在' })
    }
    const name = encodeURIComponent(announcement.attachmentOriginalName || path.basename(absolutePath))
    res.setHeader('Content-Type', announcement.attachmentMimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${name}`)
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate')
    return res.sendFile(absolutePath)
  } catch (e) {
    console.error('[announcements] download error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '下载公告附件失败' })
  }
})

app.get('/api/activities', async (req, res) => {
  const keyword = String(req.query.keyword || '').trim()
  try {
    if (prisma.activity && typeof prisma.activity.findMany === 'function') {
      const where = keyword ? { OR: [{ title: { contains: keyword } }, { mentorName: { contains: keyword } }] } : {}
      const items = await prisma.activity.findMany({ where, orderBy: { id: 'desc' }, take: 500 })
      const now = new Date()
      // 追加报名人数统计（REGISTERED + PENDING_CANCEL 状态），用于前端展示“已报名人数/活动限制人数”
      if (Array.isArray(items) && items.length && prisma.activityRegistration && typeof prisma.activityRegistration.groupBy === 'function') {
        const ids = items.map(i => i.id)
        try {
          const grouped = await prisma.activityRegistration.groupBy({
            by: ['activityId'],
            where: { activityId: { in: ids }, status: { in: ['REGISTERED', 'PENDING_CANCEL'] } },
            _count: { activityId: true }
          })
          const countMap = Object.create(null)
          grouped.forEach(g => { countMap[g.activityId] = (g._count?.activityId ?? 0) })
          const enriched = items.map(i => ({ ...decorateActivity(i, now), registeredCount: countMap[i.id] || 0 }))
          res.json({ items: enriched })
          return
        } catch (err) {
          console.warn('[activities] count groupBy failed, fallback to raw items', err)
        }
      }
      res.json({ items: items.map(item => decorateActivity(item, now)) })
    } else {
      res.json({ items: [] })
    }
  } catch (e) {
    console.error('[activities] list error', e)
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取活动失败' })
  }
})

// 活动广场：智能推荐（最多5条：3个可报名活动 + 2个推文）
app.get('/api/activities/recommendations', tryAuth, async (req, res) => {
  try {
    // 拉取候选活动（尽量多一些，便于打分与筛选）
    const rawItems = (prisma.activity && typeof prisma.activity.findMany === 'function')
      ? await prisma.activity.findMany({ where: { status: 'PUBLISHED' }, orderBy: { id: 'desc' }, take: 200 })
      : []
    const now = new Date()
    const items = rawItems.map(item => decorateActivity(item, now))

    // 计算占用名额（REGISTERED + PENDING_CANCEL）以便判断是否已满
    let countMap = Object.create(null)
    if (Array.isArray(items) && items.length && prisma.activityRegistration && typeof prisma.activityRegistration.groupBy === 'function') {
      const ids = items.map(i => i.id)
      try {
        const grouped = await prisma.activityRegistration.groupBy({
          by: ['activityId'],
          where: { activityId: { in: ids }, status: { in: ['REGISTERED', 'PENDING_CANCEL'] } },
          _count: { activityId: true }
        })
        grouped.forEach(g => { countMap[g.activityId] = (g._count?.activityId ?? 0) })
      } catch {}
    }

    // 偏好：用户曾参加过的活动类别（用于加权）
    const prefs = new Set()
    let attendedIds = new Set()
    const userId = Number((req.user || {}).sub || 0)
    if (userId && prisma.activityRegistration && typeof prisma.activityRegistration.findMany === 'function') {
      try {
        const regs = await prisma.activityRegistration.findMany({ where: { userId }, include: { activity: true }, orderBy: { id: 'desc' }, take: 200 })
        regs.forEach(r => { const cat = r.activity?.category; if (cat) prefs.add(cat) })
        regs.forEach(r => { attendedIds.add(r.activityId) })
      } catch {}
    }

    const nowMs = now.getTime()
    function canRegister(it) {
      const limit = Number(it.limit || 0)
      const reg = Number(countMap[it.id] || 0)
      const full = limit > 0 && reg >= limit
      const dl = it.registerDeadline ? new Date(it.registerDeadline).getTime() : null
      const deadlinePassed = dl ? (nowMs > dl) : false
      return String(it.status || '').toUpperCase() !== 'CLOSED' && !full && !deadlinePassed
    }

    // 近期热门可报名活动打分排序
    const upcomingBase = items.filter(it => canRegister(it))
    const upcomingScored = upcomingBase.map(it => {
      let score = 0
      const reg = Number(countMap[it.id] || 0)
      score += Math.min(20, reg)
      if (it.startAt) {
        const st = new Date(it.startAt).getTime()
        const days = Math.max(0, (st - nowMs) / (24 * 3600 * 1000))
        score += Math.max(0, 20 - days)
      }
      if (prefs.has(it.category || '')) score += 35
      return { it: { ...it, registeredCount: reg }, score }
    })
    const upcomingSorted = upcomingScored.sort((a, b) => b.score - a.score).map(x => x.it)

    // 往期回顾推文：有 promo 链接或图片，且时间已过
    const reviewPoolRaw = items.filter(it => !!it.promoLinkUrl || !!it.promoImageUrl)
      .filter(it => !it.startAt || new Date(it.startAt).getTime() <= nowMs)
    let reviewPool = reviewPoolRaw
    if (userId) {
      // 登录用户优先展示本人参加过的活动推文
      reviewPool = reviewPoolRaw.filter(it => attendedIds.has(it.id))
    }
    reviewPool.sort((a, b) => {
      const ta = a.startAt ? new Date(a.startAt).getTime() : 0
      const tb = b.startAt ? new Date(b.startAt).getTime() : 0
      return tb - ta
    })

    const result = []
    // 先取最多3个“可报名活动”
    for (const it of upcomingSorted) { if (result.length >= 3) break; result.push({ kind: 'UPCOMING', it }) }
    // 再补最多2个“推文回顾”
    for (const it of reviewPool) { if (result.length >= 5) break; result.push({ kind: 'REVIEW', it }) }
    // 若不足5个，允许另一类补齐
    if (result.length < 5) {
      const existed = new Set(result.map(x => x.it.id))
      const fillPool = [
        ...reviewPool.map(it => ({ kind: 'REVIEW', it })),
        ...upcomingSorted.map(it => ({ kind: 'UPCOMING', it }))
      ]
      for (const x of fillPool) {
        if (result.length >= 5) break
        if (existed.has(x.it.id)) continue
        result.push(x)
        existed.add(x.it.id)
      }
    }

    return res.json({ items: result })
  } catch (e) {
    console.error('[activities] recommendations error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取推荐失败' })
  }
})

app.get('/api/activities/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  try {
    if (prisma.activity && typeof prisma.activity.findUnique === 'function') {
      const item = await prisma.activity.findUnique({ where: { id } })
      if (!item) return res.status(404).json({ code: 'NOT_FOUND', message: '活动不存在' })
      let registeredCount = 0
      try {
        if (prisma.activityRegistration && typeof prisma.activityRegistration.count === 'function') {
          registeredCount = await prisma.activityRegistration.count({
            where: { activityId: id, status: { in: ['REGISTERED', 'PENDING_CANCEL'] } }
          })
        }
      } catch (err) {
        console.warn('[activities] detail count failed', err)
      }
      res.json({ item: { ...decorateActivity(item), registeredCount } })
    } else {
      return res.status(404).json({ code: 'NOT_FOUND', message: '活动不存在' })
    }
  } catch (e) {
    console.error('[activities] detail error', e)
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取活动详情失败' })
  }
})

// Mentors: list and detail
app.get('/api/mentors', async (_req, res) => {
  try {
    if (prisma.mentor && typeof prisma.mentor.findMany === 'function') {
      const items = await prisma.mentor.findMany({ orderBy: { id: 'desc' }, take: 100 })
      res.json({ items })
    } else {
      res.json({ items: [] })
    }
  } catch (e) {
    console.error('[mentors] list error', e)
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取导师列表失败' })
  }
})

app.get('/api/mentors/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '导师ID不合法' })
  try {
    if (prisma.mentor && typeof prisma.mentor.findUnique === 'function') {
      const item = await prisma.mentor.findUnique({ where: { id } })
      if (!item) return res.status(404).json({ code: 'NOT_FOUND', message: '导师不存在' })
      res.json({ item })
    } else {
      return res.status(404).json({ code: 'NOT_FOUND', message: '导师不存在' })
    }
  } catch (e) {
    console.error('[mentors] detail error', e)
    res.status(500).json({ code: 'SERVER_ERROR', message: '获取导师详情失败' })
  }
})

// Registration: sign up and cancel (requires auth). Fallback when Prisma client not generated
app.post('/api/activities/:id/register', auth, async (req, res) => {
  const activityId = Number(req.params.id)
  if (!Number.isFinite(activityId) || activityId <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  if (!prisma.activity || typeof prisma.activity.findUnique !== 'function' || !prisma.activityRegistration || typeof prisma.activityRegistration.upsert !== 'function') {
    return res.status(501).json({ code: 'NOT_IMPLEMENTED', message: '报名模块暂未就绪，请稍后再试' })
  }
  try {
    const act = await prisma.activity.findUnique({ where: { id: activityId } })
    if (!act) return res.status(404).json({ code: 'NOT_FOUND', message: '活动不存在' })
    const userId = Number(req.user.sub)
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: '用户不存在' })
    const now = new Date()
    // 后端强制校验：用户禁报名、活动状态、报名截止与名额上限
    if (user.bannedUntil && user.bannedUntil.getTime() > now.getTime()) {
      const untilStr = user.bannedUntil.toISOString().slice(0, 10)
      return res.status(403).json({ code: 'FORBIDDEN', message: `当前账号处于禁报名期，至 ${untilStr}，如有异议请联系管理员` })
    }
    // 活动状态不可报名
    const closedStatuses = new Set(['CLOSED', 'FINISHED', 'CANCELED'])
    if (act.status && closedStatuses.has(String(act.status))) {
      return res.status(403).json({ code: 'REGISTRATION_CLOSED', message: '当前活动已关闭报名或已结束' })
    }
    // 报名截止时间校验
    if (act.registerDeadline && now.getTime() > new Date(act.registerDeadline).getTime()) {
      return res.status(403).json({ code: 'REGISTRATION_DEADLINE_PASSED', message: '报名已截止' })
    }
    // 举办时间已过也不允许报名（容错：若未设置 startAt 则忽略）
    if (act.startAt && now.getTime() > new Date(act.startAt).getTime()) {
      return res.status(403).json({ code: 'REGISTRATION_CLOSED', message: '活动已结束，无法报名' })
    }
    // 名额上限校验（按 REGISTERED + PENDING_CANCEL 计占用）
    let usedCount = 0
    try {
      if (typeof prisma.activityRegistration.count === 'function') {
        usedCount = await prisma.activityRegistration.count({ where: { activityId, status: { in: ['REGISTERED', 'PENDING_CANCEL'] } } })
      } else if (typeof prisma.activityRegistration.groupBy === 'function') {
        const grouped = await prisma.activityRegistration.groupBy({ by: ['activityId'], where: { activityId, status: { in: ['REGISTERED', 'PENDING_CANCEL'] } }, _count: { activityId: true } })
        usedCount = grouped?.[0]?._count?.activityId ?? 0
      }
    } catch {}
    const limit = Number(act.limit || 0)
    if (limit > 0 && usedCount >= limit) {
      return res.status(403).json({ code: 'REGISTRATION_FULL', message: '名额已满，无法报名' })
    }
    // 重复报名保护：若已存在且未取消，则直接提示
    try {
      const existed = await prisma.activityRegistration.findUnique({ where: { activityId_userId: { activityId, userId } } })
      if (existed && existed.status !== 'CANCELED') {
        return res.status(409).json({ code: 'ALREADY_REGISTERED', message: '你已报名该活动，无需重复报名' })
      }
    } catch {}
    const reg = await prisma.activityRegistration.upsert({
      where: { activityId_userId: { activityId, userId } },
      update: { status: 'REGISTERED', reason: null, canceledAt: null },
      create: { activityId, userId, status: 'REGISTERED' }
    })
    return res.json({ message: '报名成功', registrationId: reg.id })
  } catch (e) {
    console.error('[registrations] register error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '报名失败' })
  }
})

app.post('/api/activities/:id/cancel', auth, async (req, res) => {
  const activityId = Number(req.params.id)
  const reason = String((req.body || {}).reason || '').trim()
  if (!Number.isFinite(activityId) || activityId <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  if (reason.length < 5 || reason.length > 200) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写5-200字的取消事由' })
  if (!prisma.activityRegistration || typeof prisma.activityRegistration.update !== 'function') {
    return res.status(501).json({ code: 'NOT_IMPLEMENTED', message: '取消模块暂未就绪，请稍后再试' })
  }
  try {
    const userId = Number(req.user.sub)
    const existed = await prisma.activityRegistration.findUnique({ where: { activityId_userId: { activityId, userId } } })
    if (!existed) {
      return res.status(409).json({ code: 'CONFLICT', message: '尚未报名或无法取消' })
    }
    if (existed.status === 'CANCELED') {
      return res.status(409).json({ code: 'CONFLICT', message: '已取消报名，无需重复申请' })
    }
    if (existed.status === 'PENDING_CANCEL') {
      return res.status(409).json({ code: 'CONFLICT', message: '取消申请已提交，请等待管理员审核' })
    }
    const reg = await prisma.activityRegistration.update({ where: { activityId_userId: { activityId, userId } }, data: { status: 'PENDING_CANCEL', reason, canceledAt: null } })
    return res.json({ message: '已提交取消申请，待管理员审核', registrationId: reg.id })
  } catch (e) {
    console.error('[registrations] cancel error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '取消失败' })
  }
})

// Favorites: add/remove and my favorites
app.post('/api/activities/:id/favorite', auth, async (req, res) => {
  const activityId = Number(req.params.id)
  if (!Number.isFinite(activityId) || activityId <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  if (!prisma.favorite || typeof prisma.favorite.upsert !== 'function') {
    return res.status(501).json({ code: 'NOT_IMPLEMENTED', message: '收藏模块暂未就绪，请稍后再试' })
  }
  try {
    const userId = Number(req.user.sub)
    const fav = await prisma.favorite.upsert({ where: { userId_activityId: { userId, activityId } }, update: {}, create: { userId, activityId } })
    return res.json({ message: '已收藏', favoriteId: fav.id })
  } catch (e) {
    console.error('[favorites] add error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '收藏失败' })
  }
})

app.delete('/api/activities/:id/favorite', auth, async (req, res) => {
  const activityId = Number(req.params.id)
  if (!Number.isFinite(activityId) || activityId <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  if (!prisma.favorite || typeof prisma.favorite.delete !== 'function') {
    return res.status(501).json({ code: 'NOT_IMPLEMENTED', message: '收藏模块暂未就绪，请稍后再试' })
  }
  try {
    const userId = Number(req.user.sub)
    // 优雅删除：若不存在直接返回成功
    const existed = await prisma.favorite.findUnique({ where: { userId_activityId: { userId, activityId } } })
    if (!existed) return res.json({ message: '未收藏，无需取消' })
    await prisma.favorite.delete({ where: { userId_activityId: { userId, activityId } } })
    return res.json({ message: '已取消收藏' })
  } catch (e) {
    console.error('[favorites] remove error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '取消收藏失败' })
  }
})

app.get('/api/users/me/favorites', auth, async (_req, res) => {
  if (!prisma.favorite || typeof prisma.favorite.findMany !== 'function') {
    return res.json({ items: [] })
  }
  try {
    const userId = Number(_req.user.sub)
    const items = await prisma.favorite.findMany({ where: { userId }, include: { activity: true }, orderBy: { id: 'desc' }, take: 100 })
    const mapped = items.map(x => ({ id: x.activity.id, title: x.activity.title, mentorName: x.activity.mentorName || '', timeText: x.activity.timeText || '', place: x.activity.place || '', category: x.activity.category || '' }))
    return res.json({ items: mapped })
  } catch (e) {
    console.error('[favorites] my list error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取收藏失败' })
  }
})

// My registrations
app.get('/api/users/me/registrations', auth, async (req, res) => {
  if (!prisma.activityRegistration || typeof prisma.activityRegistration.findMany !== 'function') {
    return res.json({ registered: [], history: [] })
  }
  try {
    const userId = Number(req.user.sub)
    const tab = String(req.query.tab || '').trim().toLowerCase()
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const psRaw = parseInt(req.query.pageSize, 10)
    const pageSize = Math.min(50, Math.max(1, Number.isFinite(psRaw) ? psRaw : 10))
    const pagedTabs = new Set(['registered', 'upcoming', 'history'])

    const mapMyRegistration = (x) => ({
      id: x.activity.id,
      title: x.activity.title,
      mentorName: x.activity.mentorName || '',
      timeText: x.activity.timeText || '',
      place: x.activity.place || '',
      posterUrl: x.activity.posterUrl || '',
      status: x.status,
      category: x.activity.category || '',
      reason: x.reason || '',
      canceledAt: x.canceledAt
    })

    if (pagedTabs.has(tab)) {
      const isHistory = tab === 'history'
      const where = {
        userId,
        status: isHistory ? 'CANCELED' : { in: ['REGISTERED', 'PENDING_CANCEL'] }
      }
      const total = await prisma.activityRegistration.count({ where })
      const rows = await prisma.activityRegistration.findMany({
        where,
        include: { activity: true },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
      const items = rows.map(mapMyRegistration)
      return res.json({ items, page, pageSize, total, tab })
    }

    const list = await prisma.activityRegistration.findMany({ where: { userId }, include: { activity: true }, orderBy: { id: 'desc' }, take: 100 })
    const registered = list.filter(x => x.status === 'REGISTERED' || x.status === 'PENDING_CANCEL').map(mapMyRegistration)
    const history = list.filter(x => x.status === 'CANCELED').map(mapMyRegistration)
    return res.json({ registered, history })
  } catch (e) {
    console.error('[registrations] my list error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取我的报名失败' })
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// 首页轮播海报列表：自动读取 /hero 目录下的图片（按文件名排序）
app.get('/api/hero-slides', async (_req, res) => {
  try {
    const now = new Date()
    const slides = await prisma.heroSlide.findMany({
      where: {
        published: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      orderBy: { sortOrder: 'asc' }
    })
    if (slides.length) {
      const items = slides.map(s => ({ src: s.imageUrl, alt: s.alt || '' }))
      return res.json({ items })
    }
  } catch (e) {
    console.warn('[hero-slides] db read error, fallback to defaults', e)
  }
  // Fallback：静态 hero 目录或 logo 背景图
  try {
    const HERO_DIR = path.join(process.cwd(), '..', 'hero')
    const allow = new Set(['.jpg', '.jpeg', '.png', '.webp'])
    if (fs.existsSync(HERO_DIR)) {
      const files = fs.readdirSync(HERO_DIR).filter(f => allow.has(path.extname(f).toLowerCase()))
      files.sort()
      const items = files.map(f => ({ src: `/hero/${f}`, alt: path.basename(f, path.extname(f)) }))
      if (items.length) return res.json({ items })
    }
  } catch (e) {}
  return res.json({ items: [{ src: '/logo/background.png', alt: '海报' }] })
})

// 班级字典：支持关键字检索（注册页智能提示）
app.get('/api/classes', async (req, res) => {
  const keyword = String(req.query.keyword || req.query.q || '').trim()
  try {
    if (prisma.class && typeof prisma.class.findMany === 'function') {
      const where = keyword ? { name: { contains: keyword } } : {}
      const items = await prisma.class.findMany({ where, orderBy: { name: 'asc' }, take: 50 })
      return res.json({ items })
    }
    return res.json({ items: [] })
  } catch (e) {
    console.error('[classes] list error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取班级列表失败' })
  }
})

const server = app.listen(PORT, () => {
  console.log(`[backend] server started at http://localhost:${PORT}`)
})
server.keepAliveTimeout = 65000
server.headersTimeout = 66000
server.requestTimeout = 120000

async function shutdown(signal) {
  console.log(`[backend] received ${signal}, shutting down gracefully...`)
  server.close(async () => {
    try {
      await prisma.$disconnect()
    } catch (e) {
      console.error('[backend] prisma disconnect error', e)
    } finally {
      process.exit(0)
    }
  })
}

process.on('SIGINT', () => { shutdown('SIGINT') })
process.on('SIGTERM', () => { shutdown('SIGTERM') })
// 管理员登录（需匹配角色与等级）
app.post('/api/admin/auth/login', async (req, res) => {
  const { username, studentId, password, level } = req.body || {}
  const sid = String(studentId || username || '').trim()
  const pwd = String(password || '')
  const lvl = String(level || '').trim()
  if (!sid || !/^[A-Za-z0-9]{6,20}$/.test(sid)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '用户名应为6-20位字母或数字' })
  }
  if (!pwd || !/^[A-Za-z0-9]{6,12}$/.test(pwd)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '密码要求6-12位（只能由数字和英文组成）' })
  }
  if (!lvl) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请选择管理员等级' })
  }
  try {
    // 仅选择必要字段，避免不相干列引发解析问题
    const user = await prisma.user.findUnique({
      where: { studentId: sid },
      select: { id: true, role: true, adminLevel: true, password: true, plainPassword: true }
    })
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: '用户名或密码错误' })

    // 安全比较：兼容历史明文密码，避免无效哈希导致的异常
    let ok = false
    try {
      ok = await bcrypt.compare(pwd, user.password)
    } catch (cmpErr) {
      // bcrypt 比较异常（如无效哈希格式）时，尝试明文比较并自愈为哈希
      if (user.password === pwd) {
        ok = true
        try {
          const hashed = await bcrypt.hash(pwd, 10)
          await prisma.user.update({ where: { id: user.id }, data: { password: hashed, plainPassword: pwd } })
        } catch (rehashErr) {
          console.warn('[admin login] rehash password failed', rehashErr)
        }
      } else {
        console.warn('[admin login] bcrypt.compare failed', cmpErr)
      }
    }
    if (!ok) return res.status(401).json({ code: 'UNAUTHORIZED', message: '用户名或密码错误' })

    if (user.role !== 'ADMIN') return res.status(403).json({ code: 'FORBIDDEN', message: '非管理员账号，无法登录管理端' })

    // 等级校验（传入中文等级映射到枚举）
    const map = {
      '梦碎怜云': 'MENGSUILIANYUN',
      '主管老师': 'SUPERVISOR',
      '第一负责人': 'OWNER_PRIMARY',
      '第二负责人': 'OWNER_SECONDARY',
      '普通干事': 'STAFF'
    }
    const expected = map[lvl] || lvl
    if (!user.adminLevel || user.adminLevel !== expected) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '管理员等级不匹配' })
    }

    // 回填明文密码（仅用于兼容老数据，不影响校验逻辑）
    try {
      if (!user.plainPassword || user.plainPassword !== pwd) {
        await prisma.user.update({ where: { id: user.id }, data: { plainPassword: pwd } })
      }
    } catch (e) {
      console.warn('[admin login] plainPassword backfill failed', e)
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ token })
  } catch (e) {
    console.error('[admin] login error', e)
    // 统一避免 500 暴露，明确返回认证失败
    if (e && e.code && String(e.code).startsWith('P')) {
      return res.status(500).json({ code: 'SERVER_ERROR', message: '管理员登录失败' })
    }
    return res.status(500).json({ code: 'SERVER_ERROR', message: '管理员登录失败' })
  }
})

function normalizeActivityCategory(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

async function listAdminActivityCategories() {
  if (!prisma.activity || typeof prisma.activity.findMany !== 'function') return []
  const rows = await prisma.activity.findMany({
    select: { category: true },
    orderBy: { id: 'desc' }
  })
  const seen = new Set()
  const items = []
  rows.forEach((row) => {
    const category = normalizeActivityCategory(row.category)
    if (!category || seen.has(category)) return
    seen.add(category)
    items.push(category)
  })
  return items
}

// 管理员：创建活动
app.post('/api/admin/activities', auth, adminAuth, async (req, res) => {
  if (isStaff(req.adminLevel)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权创建或编辑活动' })
  }
  const b = req.body || {}
  const title = String(b.title || '').trim()
  const category = normalizeActivityCategory(b.category)
  const mentorId = b.mentorId != null ? Number(b.mentorId) : null
  const mentorName = String(b.mentorName || '').trim()
  const place = String(b.place || '').trim()
  const limitNum = b.limit != null ? Number(b.limit) : 0
  const description = String(b.description || '').trim()
  const startAt = b.startAt ? new Date(b.startAt) : null
  const registerDeadline = b.registerDeadline ? new Date(b.registerDeadline) : null
  const posterUrl = String(b.posterUrl || '').trim() || null
  const posterSizeBytes = b.posterSizeBytes != null ? Number(b.posterSizeBytes) : null
  const qqGroupQrUrl = String(b.qqGroupQrUrl || '').trim() || null
  const qqGroupQrSizeBytes = b.qqGroupQrSizeBytes != null ? Number(b.qqGroupQrSizeBytes) : null
  // 推广：链接与图片（仅 OWNER_PRIMARY/SUPERVISOR/MENGSUILIANYUN 可配置）
  const promoLinkUrl = String(b.promoLinkUrl || '').trim()
  const promoImageUrl = String(b.promoImageUrl || '').trim() || null
  const promoImageSizeBytes = b.promoImageSizeBytes != null ? Number(b.promoImageSizeBytes) : null
  const promoAllowed = new Set([ADMIN_LEVEL.OWNER_PRIMARY, ADMIN_LEVEL.SUPERVISOR, ADMIN_LEVEL.MENGSUILIANYUN]).has(req.adminLevel)
  // 报名开关：允许管理员在创建时指定活动状态（默认 PUBLISHED）。
  // 仅允许有限集合，避免误设为 FINISHED/CANCELED 等终结态。
  const allowedCreateStatuses = new Set(['PUBLISHED', 'OPEN', 'CLOSED'])
  const inputStatusRaw = String(b.status || '').trim().toUpperCase()
  const finalStatus = allowedCreateStatuses.has(inputStatusRaw) ? inputStatusRaw : 'PUBLISHED'

  if (!title) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写标题' })
  if (!place) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写地点' })
  if (description.length > ACTIVITY_DESCRIPTION_MAX_LENGTH) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: `活动简介不能超过 ${ACTIVITY_DESCRIPTION_MAX_LENGTH} 字` })
  }
  if (registerDeadline && startAt && registerDeadline > startAt) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '报名截止时间需不晚于举办时间' })
  }
  if ((promoLinkUrl || promoImageUrl) && !promoAllowed) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '仅第一负责人及以上可设置推广链接与宣传图片' })
  }
  if (promoLinkUrl && !/^https?:\/\//i.test(promoLinkUrl)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '推文链接需以 http 或 https 开头' })
  }
  if (mentorId && (!prisma.mentor || typeof prisma.mentor.findUnique !== 'function')) {
    return res.status(501).json({ code: 'NOT_IMPLEMENTED', message: '导师模块暂未就绪' })
  }
  try {
    let mentorCheckName = mentorName
    if (mentorId) {
      const m = await prisma.mentor.findUnique({ where: { id: mentorId } })
      if (!m) return res.status(404).json({ code: 'NOT_FOUND', message: '导师不存在' })
      mentorCheckName = m.name
    }
    const data = {
      title,
      category,
      mentorId: mentorId || undefined,
      mentorName: mentorCheckName || '',
      place,
      limit: Number.isFinite(limitNum) && limitNum > 0 ? limitNum : 0,
      description,
      status: finalStatus,
      startAt,
      registerDeadline,
      posterUrl,
      posterSizeBytes,
      qqGroupQrUrl,
      qqGroupQrSizeBytes,
      promoLinkUrl: promoAllowed ? (promoLinkUrl || '') : '',
      promoImageUrl: promoAllowed ? (promoImageUrl || null) : null,
      promoImageSizeBytes: promoAllowed ? (promoImageSizeBytes ?? null) : null,
      timeText: startAt ? '' : (String(b.timeText || '').trim()),
      updatedAt: new Date()
    }
    const created = await prisma.activity.create({ data })
    return res.status(201).json({ id: created.id })
  } catch (e) {
    console.error('[admin] create activity error', e)
    if (e?.code === 'P2000' && e?.meta?.column_name === 'description') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '活动简介过长，请精简后重试' })
    }
    return res.status(500).json({ code: 'SERVER_ERROR', message: '创建活动失败' })
  }
})

// 管理员：更新活动
app.put('/api/admin/activities/:id', auth, adminAuth, async (req, res) => {
  if (isStaff(req.adminLevel)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权创建或编辑活动' })
  }
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  const b = req.body || {}
  const startAt = b.startAt ? new Date(b.startAt) : null
  const registerDeadline = b.registerDeadline ? new Date(b.registerDeadline) : null
  if (registerDeadline && startAt && registerDeadline > startAt) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '报名截止时间需不晚于举办时间' })
  }
  const promoAllowed = new Set([ADMIN_LEVEL.OWNER_PRIMARY, ADMIN_LEVEL.SUPERVISOR, ADMIN_LEVEL.MENGSUILIANYUN]).has(req.adminLevel)
  const wantPromoWrite = (b.promoLinkUrl != null) || (b.promoImageUrl != null) || (b.promoImageSizeBytes != null)
  if (wantPromoWrite && !promoAllowed) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '仅第一负责人及以上可设置推广链接与宣传图片' })
  }
  if (b.promoLinkUrl != null) {
    const link = String(b.promoLinkUrl || '').trim()
    if (link && !/^https?:\/\//i.test(link)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '推文链接需以 http 或 https 开头' })
    }
  }
  if (b.description != null && String(b.description).trim().length > ACTIVITY_DESCRIPTION_MAX_LENGTH) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: `活动简介不能超过 ${ACTIVITY_DESCRIPTION_MAX_LENGTH} 字` })
  }
  try {
    const existed = await prisma.activity.findUnique({ where: { id } })
    if (!existed) return res.status(404).json({ code: 'NOT_FOUND', message: '活动不存在' })
    const mentorId = b.mentorId != null ? Number(b.mentorId) : null
    let mentorCheckName = String(b.mentorName || existed.mentorName || '').trim()
    if (mentorId) {
      const m = await prisma.mentor.findUnique({ where: { id: mentorId } })
      if (!m) return res.status(404).json({ code: 'NOT_FOUND', message: '导师不存在' })
      mentorCheckName = m.name
    }
    // 允许管理员切换活动状态以实现“报名开关”（限制在 PUBLISHED/OPEN/CLOSED）
    const allowedUpdateStatuses = new Set(['PUBLISHED', 'OPEN', 'CLOSED'])
    const statusUpdate = b.status != null ? String(b.status).trim().toUpperCase() : null
    const nextStatus = statusUpdate && allowedUpdateStatuses.has(statusUpdate) ? statusUpdate : existed.status
    const data = {
      title: b.title != null ? String(b.title).trim() : existed.title,
      category: b.category != null ? normalizeActivityCategory(b.category) : existed.category,
      mentorId: mentorId ?? existed.mentorId,
      mentorName: mentorCheckName,
      place: b.place != null ? String(b.place).trim() : existed.place,
      limit: b.limit != null ? Number(b.limit) : existed.limit,
      description: b.description != null ? String(b.description).trim() : existed.description,
      status: nextStatus,
      startAt,
      registerDeadline,
      posterUrl: b.posterUrl != null ? String(b.posterUrl).trim() || null : existed.posterUrl,
      posterSizeBytes: b.posterSizeBytes != null ? Number(b.posterSizeBytes) : existed.posterSizeBytes,
      qqGroupQrUrl: b.qqGroupQrUrl != null ? String(b.qqGroupQrUrl).trim() || null : existed.qqGroupQrUrl,
      qqGroupQrSizeBytes: b.qqGroupQrSizeBytes != null ? Number(b.qqGroupQrSizeBytes) : existed.qqGroupQrSizeBytes,
      promoLinkUrl: promoAllowed ? (b.promoLinkUrl != null ? String(b.promoLinkUrl).trim() : existed.promoLinkUrl) : existed.promoLinkUrl,
      promoImageUrl: promoAllowed ? (b.promoImageUrl != null ? (String(b.promoImageUrl).trim() || null) : existed.promoImageUrl) : existed.promoImageUrl,
      promoImageSizeBytes: promoAllowed ? (b.promoImageSizeBytes != null ? Number(b.promoImageSizeBytes) : existed.promoImageSizeBytes) : existed.promoImageSizeBytes,
      timeText: startAt ? '' : (b.timeText != null ? String(b.timeText).trim() : existed.timeText),
      updatedAt: new Date()
    }
    await prisma.activity.update({ where: { id }, data })
    return res.json({ id })
  } catch (e) {
    console.error('[admin] update activity error', e)
    if (e?.code === 'P2000' && e?.meta?.column_name === 'description') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '活动简介过长，请精简后重试' })
    }
    return res.status(500).json({ code: 'SERVER_ERROR', message: '更新活动失败' })
  }
})

// 管理员：活动列表（含新增字段）
app.get('/api/admin/activities', auth, adminAuth, async (_req, res) => {
  try {
    if (isStaff(_req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事仅可使用“活动报名管理”，无权查看“活动管理”列表' })
    }
    const q = _req.query || {}
    const page = Math.max(1, parseInt(q.page, 10) || 1)
    const psRaw = parseInt(q.pageSize, 10)
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(psRaw) ? psRaw : 10))
    const total = await prisma.activity.count()
    const items = await prisma.activity.findMany({
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return res.json({ items: items.map(item => decorateActivity(item)), page, pageSize, total })
  } catch (e) {
    console.error('[admin] list activities error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取活动列表失败' })
  }
})

app.get('/api/admin/activities/categories', auth, adminAuth, async (req, res) => {
  try {
    if (isStaff(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权查看活动类型列表' })
    }
    const items = await listAdminActivityCategories()
    return res.json({ items })
  } catch (e) {
    console.error('[admin] list activity categories error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取活动类型失败' })
  }
})

app.get('/api/admin/announcements', auth, adminAuth, async (req, res) => {
  try {
    if (isStaff(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权查看公告管理' })
    }
    const items = await prisma.announcement.findMany({
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 200
    })
    return res.json({ items: items.map(formatAnnouncement) })
  } catch (e) {
    console.error('[admin] list announcements error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取公告列表失败' })
  }
})

app.post('/api/admin/announcements', auth, adminAuth, async (req, res) => {
  try {
    if (isStaff(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权创建公告' })
    }
    const b = req.body || {}
    const title = String(b.title || '').trim()
    const summary = String(b.summary || '').trim()
    const content = String(b.content || '').trim()
    const published = !!b.published
    const attachmentPath = String(b.attachmentPath || '').trim()
    const attachmentOriginalName = String(b.attachmentOriginalName || '').trim()
    const attachmentMimeType = String(b.attachmentMimeType || '').trim()
    const attachmentSizeBytes = b.attachmentSizeBytes != null ? Number(b.attachmentSizeBytes) : null
    if (!title) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写公告标题' })
    if (!content) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写公告内容' })
    if (attachmentPath && !/^announcements\/[^/]+$/i.test(attachmentPath)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '公告附件路径不合法，请重新上传' })
    }
    const item = await prisma.announcement.create({
      data: {
        title,
        summary,
        content,
        published,
        publishedAt: published ? new Date() : null,
        attachmentPath: attachmentPath || null,
        attachmentOriginalName: attachmentPath ? attachmentOriginalName : '',
        attachmentMimeType: attachmentPath ? attachmentMimeType : '',
        attachmentSizeBytes: attachmentPath ? attachmentSizeBytes : null
      }
    })
    return res.json({ item: formatAnnouncement(item) })
  } catch (e) {
    console.error('[admin] create announcement error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '创建公告失败' })
  }
})

app.put('/api/admin/announcements/:id', auth, adminAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '公告ID不合法' })
  try {
    if (isStaff(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权编辑公告' })
    }
    const existed = await prisma.announcement.findUnique({ where: { id } })
    if (!existed) return res.status(404).json({ code: 'NOT_FOUND', message: '公告不存在' })
    const b = req.body || {}
    const nextTitle = b.title != null ? String(b.title || '').trim() : existed.title
    const nextSummary = b.summary != null ? String(b.summary || '').trim() : existed.summary
    const nextContent = b.content != null ? String(b.content || '').trim() : existed.content
    if (!nextTitle) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写公告标题' })
    if (!nextContent) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写公告内容' })
    let nextAttachmentPath = existed.attachmentPath || null
    let nextAttachmentOriginalName = existed.attachmentOriginalName || ''
    let nextAttachmentMimeType = existed.attachmentMimeType || ''
    let nextAttachmentSizeBytes = existed.attachmentSizeBytes ?? null
    if (b.attachmentPath != null) {
      const rawPath = String(b.attachmentPath || '').trim()
      if (rawPath && !/^announcements\/[^/]+$/i.test(rawPath)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '公告附件路径不合法，请重新上传' })
      }
      nextAttachmentPath = rawPath || null
      nextAttachmentOriginalName = rawPath ? String(b.attachmentOriginalName || '').trim() : ''
      nextAttachmentMimeType = rawPath ? String(b.attachmentMimeType || '').trim() : ''
      nextAttachmentSizeBytes = rawPath ? Number(b.attachmentSizeBytes || 0) : null
    }
    const nextPublished = b.published != null ? !!b.published : !!existed.published
    const item = await prisma.announcement.update({
      where: { id },
      data: {
        title: nextTitle,
        summary: nextSummary,
        content: nextContent,
        published: nextPublished,
        publishedAt: nextPublished ? (existed.published ? existed.publishedAt || new Date() : new Date()) : null,
        attachmentPath: nextAttachmentPath,
        attachmentOriginalName: nextAttachmentOriginalName,
        attachmentMimeType: nextAttachmentMimeType,
        attachmentSizeBytes: nextAttachmentSizeBytes
      }
    })
    if (existed.attachmentPath && existed.attachmentPath !== nextAttachmentPath) {
      removeIfExists(getAnnouncementAttachmentAbsolutePath(existed.attachmentPath))
    }
    return res.json({ item: formatAnnouncement(item) })
  } catch (e) {
    console.error('[admin] update announcement error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '更新公告失败' })
  }
})

app.delete('/api/admin/announcements/:id', auth, adminAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '公告ID不合法' })
  try {
    if (isStaff(req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权删除公告' })
    }
    const existed = await prisma.announcement.findUnique({ where: { id } })
    if (!existed) return res.status(404).json({ code: 'NOT_FOUND', message: '公告不存在' })
    await prisma.announcement.delete({ where: { id } })
    if (existed.attachmentPath) {
      removeIfExists(getAnnouncementAttachmentAbsolutePath(existed.attachmentPath))
    }
    return res.json({ id })
  } catch (e) {
    console.error('[admin] delete announcement error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '删除公告失败' })
  }
})

// 管理端：活动报名汇总（支持关键字/类别筛选），含占用名额计数（REGISTERED + PENDING_CANCEL）
app.get('/api/admin/activities/summary', auth, adminAuth, async (req, res) => {
  const keyword = String(req.query.keyword || '').trim()
  const category = String(req.query.category || '').trim()
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const psRaw = parseInt(req.query.pageSize, 10)
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(psRaw) ? psRaw : 10))
  try {
    const where = {}
    if (keyword) {
      where.OR = [{ title: { contains: keyword } }, { category: { contains: keyword } }]
    }
    if (category) {
      where.category = { contains: category }
    }
    const total = await prisma.activity.count({ where })
    const items = await prisma.activity.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    if (Array.isArray(items) && items.length) {
      const ids = items.map(i => i.id)
      const grouped = await prisma.activityRegistration.groupBy({
        by: ['activityId'],
        where: { activityId: { in: ids }, status: { in: ['REGISTERED', 'PENDING_CANCEL'] } },
        _count: { activityId: true }
      })
      const countMap = Object.create(null)
      grouped.forEach(g => { countMap[g.activityId] = (g._count?.activityId ?? 0) })
      const enriched = items.map(i => ({ id: i.id, title: i.title, category: i.category || '', limit: i.limit || 0, registeredCount: countMap[i.id] || 0 }))
      return res.json({ items: enriched, page, pageSize, total })
    }
    return res.json({ items, page, pageSize, total })
  } catch (e) {
    console.error('[admin] activities summary error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取活动报名汇总失败' })
  }
})

// 管理端：某活动报名列表（支持按状态筛选）
app.get('/api/admin/activities/:id/registrations', auth, adminAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  const status = String(req.query.status || '').trim()
  const allow = new Set(['REGISTERED', 'PENDING_CANCEL', 'CANCELED'])
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const psRaw = parseInt(req.query.pageSize, 10)
  const pageSize = Math.min(10000, Math.max(1, Number.isFinite(psRaw) ? psRaw : 10))
  try {
    const act = await prisma.activity.findUnique({ where: { id } })
    if (!act) return res.status(404).json({ code: 'NOT_FOUND', message: '活动不存在' })
    const where = { activityId: id }
    if (status && allow.has(status)) {
      where.status = status
    }
    const total = await prisma.activityRegistration.count({ where })
    const regs = await prisma.activityRegistration.findMany({
      where,
      include: { user: true },
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    const items = regs.map(r => ({
      id: r.id,
      studentId: r.user.studentId,
      name: r.user.name || '',
      className: r.user.className || '',
      contact: r.user.contact || '',
      status: r.status,
      createdAt: r.createdAt,
      canceledAt: r.canceledAt,
      reason: r.reason || '',
      reviewNote: r.reviewNote || '',
      attended: !!r.attended,
      noShow: !!r.noShow,
      markedAt: r.markedAt || null
    }))
    return res.json({ items, page, pageSize, total })
  } catch (e) {
    console.error('[admin] registrations list error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取报名列表失败' })
  }
})

// 管理端：审核取消（通过/驳回）
app.post('/api/admin/activities/:id/registrations/review', auth, adminAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  const b = req.body || {}
  const registrationId = Number(b.registrationId)
  const decision = String(b.decision || '').trim() // 'approve' | 'reject'
  const note = String(b.reviewNote || '').trim()
  if (!Number.isFinite(registrationId) || registrationId <= 0) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'registrationId 不合法' })
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'decision 需为 approve 或 reject' })
  try {
    const reg = await prisma.activityRegistration.findUnique({ where: { id: registrationId } })
    if (!reg || reg.activityId !== id) return res.status(404).json({ code: 'NOT_FOUND', message: '报名记录不存在' })
    if (reg.status !== 'PENDING_CANCEL') return res.status(409).json({ code: 'CONFLICT', message: '当前状态不可审核' })
    if (decision === 'approve') {
      await prisma.activityRegistration.update({ where: { id: registrationId }, data: { status: 'CANCELED', canceledAt: new Date(), reviewNote: note } })
      return res.json({ message: '已通过取消申请' })
    } else {
      await prisma.activityRegistration.update({ where: { id: registrationId }, data: { status: 'REGISTERED', canceledAt: null, reviewNote: note } })
      return res.json({ message: '已驳回取消申请' })
    }
  } catch (e) {
    console.error('[admin] review cancel error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '审核取消失败' })
  }
})

// 管理端：导出报名 CSV（Excel 可直接打开），默认导出 REGISTERED
app.get('/api/admin/activities/:id/registrations/export', auth, adminAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  const status = String(req.query.status || 'REGISTERED').trim()
  const allow = new Set(['REGISTERED', 'PENDING_CANCEL', 'CANCELED'])
  const useStatus = allow.has(status) ? status : 'REGISTERED'
  try {
    const act = await prisma.activity.findUnique({ where: { id } })
    if (!act) return res.status(404).json({ code: 'NOT_FOUND', message: '活动不存在' })
    const regs = await prisma.activityRegistration.findMany({ where: { activityId: id, status: useStatus }, include: { user: true }, orderBy: { id: 'asc' }, take: 10000 })
    const BOM = '\uFEFF'
    const header = ['活动名称', '学号', '姓名', '班级', '联系方式']
    const rows = regs.map(r => [act.title || '', r.user.studentId || '', r.user.name || '', r.user.className || '', r.user.contact || ''])
    const csvLines = [header.join(','), ...rows.map(cols => cols.map(v => String(v).replace(/"/g, '""')).map(v => /,|\n|\r|"/.test(v) ? `"${v}"` : v).join(','))]
    const csv = BOM + csvLines.join('\n')
    const safeTitle = String(act.title || 'activity').replace(/[\\/:*?"<>|]/g, '').trim() || `activity_${id}`
    const name = `${safeTitle}_${useStatus.toLowerCase()}_registrations.csv`
    const encodedName = encodeURIComponent(name)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate')
    return res.send(csv)
  } catch (e) {
    console.error('[admin] export registrations error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '导出报名数据失败' })
  }
})

// 管理员：删除活动（同时清理关联报名与收藏）
app.delete('/api/admin/activities/:id', auth, adminAuth, async (req, res) => {
  if (isStaff(req.adminLevel)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权删除活动' })
  }
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ code: 'BAD_REQUEST', message: '活动ID不合法' })
  if (!prisma.activity || typeof prisma.activity.delete !== 'function') {
    return res.status(501).json({ code: 'NOT_IMPLEMENTED', message: '活动模块暂未就绪' })
  }
  try {
    const existed = await prisma.activity.findUnique({ where: { id } })
    if (!existed) return res.status(404).json({ code: 'NOT_FOUND', message: '活动不存在' })
    if (prisma.activityRegistration && typeof prisma.activityRegistration.deleteMany === 'function') {
      await prisma.activityRegistration.deleteMany({ where: { activityId: id } })
    }
    if (prisma.favorite && typeof prisma.favorite.deleteMany === 'function') {
      await prisma.favorite.deleteMany({ where: { activityId: id } })
    }
    await prisma.activity.delete({ where: { id } })
    return res.json({ id })
  } catch (e) {
    console.error('[admin] delete activity error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '删除活动失败' })
  }
})

// 管理员：用户列表
app.get('/api/admin/users', auth, adminAuth, async (_req, res) => {
  try {
    if (isStaff(_req.adminLevel)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权访问用户管理' })
    }
    if (prisma.user && typeof prisma.user.findMany === 'function') {
      const q = _req.query || {}
      const page = Math.max(1, parseInt(q.page, 10) || 1)
      const psRaw = parseInt(q.pageSize, 10)
      const pageSize = Math.min(200, Math.max(1, Number.isFinite(psRaw) ? psRaw : 50))
      const roleFilter = String(q.role || '').trim() // '' | 'ADMIN' | 'STUDENT'
      const adminLevelFilter = String(q.adminLevel || '').trim()
      const keyword = String(q.keyword || '').trim()
      const start = String(q.start || '').trim()
      const end = String(q.end || '').trim()

      const restricted = getRestrictedAdminLevels(_req.adminLevel)

      // 组装 where 条件
      const where = {}
      if (roleFilter === 'ADMIN') where.role = 'ADMIN'
      else if (roleFilter === 'STUDENT') where.role = 'STUDENT'

      // 管理员可见性与等级筛选
      if (where.role === 'ADMIN') {
        if (adminLevelFilter) {
          where.adminLevel = adminLevelFilter
        } else if (restricted && restricted.size > 0) {
          where.adminLevel = { notIn: Array.from(restricted) }
        }
      }

      // 关键字匹配：姓名/用户名/班级/联系方式
      if (keyword) {
        where.OR = [
          { name: { contains: keyword } },
          { studentId: { contains: keyword } },
          { className: { contains: keyword } },
          { contact: { contains: keyword } }
        ]
      }

      // 时间范围：createdAt
      const startDate = start ? new Date(start) : null
      const endDate = end ? new Date(end) : null
      if ((start && Number.isFinite(startDate.getTime())) || (end && Number.isFinite(endDate.getTime()))) {
        const range = {}
        if (start && Number.isFinite(startDate.getTime())) range.gte = startDate
        if (end && Number.isFinite(endDate.getTime())) range.lte = new Date(endDate.getTime() + 24 * 3600 * 1000 - 1) // 包含当天
        where.createdAt = range
      }

      const total = await prisma.user.count({ where })
      const items = await prisma.user.findMany({
        select: { id: true, studentId: true, name: true, className: true, role: true, adminLevel: true, contact: true, plainPassword: true, password: true, createdAt: true, bannedUntil: true, bannedNote: true, bannedCount: true },
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })

      // 附加剩余天数
      const now = new Date()
      const mapped = (Array.isArray(items) ? items : []).map(u => {
        const isBanned = !!(u.bannedUntil && u.bannedUntil.getTime() > now.getTime())
        const remainingDays = isBanned ? Math.max(0, Math.ceil((u.bannedUntil.getTime() - now.getTime()) / (24 * 3600 * 1000))) : 0
        return { ...u, isBanned, banRemainingDays: remainingDays }
      })
      return res.json({ items: mapped, page, pageSize, total })
    }
    return res.json({ items: [], page: 1, pageSize: 0, total: 0 })
  } catch (e) {
    console.error('[admin] users list error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取用户列表失败' })
  }
})

// 管理员：禁报名与解除禁报名
app.post('/api/admin/users/:id/ban', auth, adminAuth, async (req, res) => {
  if (isStaff(req.adminLevel)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权禁报名用户' })
  }
  const id = Number(req.params.id)
  const days = Number((req.body || {}).days || 0)
  const note = String(((req.body || {}).note || '').slice(0, 200))
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(days) || days <= 0) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: '参数不合法' })
  }
  try {
    const until = new Date(Date.now() + days * 24 * 3600 * 1000)
    const updated = await prisma.user.update({ where: { id }, data: { bannedUntil: until, bannedNote: note, bannedCount: { increment: 1 } } })
    return res.json({ message: `已禁报名 ${days} 天`, id: updated.id, bannedUntil: updated.bannedUntil, bannedNote: updated.bannedNote, bannedCount: updated.bannedCount })
  } catch (e) {
    console.error('[admin users] ban error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '禁报名失败' })
  }
})

app.post('/api/admin/users/:id/unban', auth, adminAuth, async (req, res) => {
  if (isStaff(req.adminLevel)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权解除禁报名' })
  }
  const id = Number(req.params.id)
  const note = String(((req.body || {}).note || '').slice(0, 200))
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: '参数不合法' })
  }
  try {
    const updated = await prisma.user.update({ where: { id }, data: { bannedUntil: null, bannedNote: note } })
    return res.json({ message: '已解除禁报名', id: updated.id, bannedUntil: updated.bannedUntil, bannedNote: updated.bannedNote, bannedCount: updated.bannedCount })
  } catch (e) {
    console.error('[admin users] unban error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '解除禁报名失败' })
  }
})

// 管理员：出勤标记（签到/未到），未到将自动按 7/14/28 天禁报名递进
app.post('/api/admin/activities/:id/registrations/:regId/attendance', auth, adminAuth, async (req, res) => {
  const activityId = Number(req.params.id)
  const regId = Number(req.params.regId)
  if (!Number.isFinite(activityId) || activityId <= 0 || !Number.isFinite(regId) || regId <= 0) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: '参数不合法' })
  }
  if (!prisma.activityRegistration || typeof prisma.activityRegistration.update !== 'function') {
    return res.status(501).json({ code: 'NOT_IMPLEMENTED', message: '出勤标记模块暂未就绪，请稍后再试' })
  }
  try {
    const b = req.body || {}
    const attended = !!b.attended
    const noShow = !!b.noShow
    if (!attended && !noShow) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请提供 attended 或 noShow 其中之一' })
    }
    // 更新报名记录的出勤状态
    const updatedReg = await prisma.activityRegistration.update({ where: { id: regId }, data: { attended, noShow, markedAt: new Date() } })
    let banResult = null
    if (noShow) {
      const user = await prisma.user.findUnique({ where: { id: updatedReg.userId } })
      if (user) {
        const count = Number(user.bannedCount || 0)
        const banDays = count <= 0 ? 7 : (count === 1 ? 14 : 28)
        const until = new Date(Date.now() + banDays * 24 * 3600 * 1000)
        const note = `活动ID=${activityId} 未到，自动禁报名 ${banDays} 天`
        const updatedUser = await prisma.user.update({ where: { id: user.id }, data: { bannedUntil: until, bannedNote: note, bannedCount: { increment: 1 } } })
        banResult = { id: updatedUser.id, bannedUntil: updatedUser.bannedUntil, bannedCount: updatedUser.bannedCount }
      }
    }
    return res.json({ message: '标记成功', registration: { id: updatedReg.id, attended: updatedReg.attended, noShow: updatedReg.noShow, markedAt: updatedReg.markedAt }, ban: banResult })
  } catch (e) {
    console.error('[admin registrations] attendance error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '出勤标记失败' })
  }
})

// 管理员：创建管理员用户
app.post('/api/admin/users/create', auth, adminAuth, async (req, res) => {
  if (isStaff(req.adminLevel)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权创建管理员' })
  }
  const b = req.body || {}
  const sid = String(b.username || b.studentId || '').trim()
  const pwd = String(b.password || '')
  const lvl = String(b.adminLevel || '').trim()
  if (!sid || !/^[A-Za-z0-9]{6,20}$/.test(sid)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '用户名应为6-20位字母或数字' })
  }
  if (!pwd || !/^[A-Za-z0-9]{6,12}$/.test(pwd)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '密码要求6-12位（只能由数字和英文组成）' })
  }
  if (!lvl) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请选择管理员等级' })
  }
  const allowed = ['MENGSUILIANYUN', 'SUPERVISOR', 'OWNER_PRIMARY', 'OWNER_SECONDARY', 'STAFF']
  if (!allowed.includes(lvl)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '管理员等级不合法' })
  }
  // 等级约束：非最高权限不可创建受限等级
  const restricted = getRestrictedAdminLevels(req.adminLevel)
  if (restricted.has(lvl)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '无权创建该管理员等级' })
  }
  try {
    const existed = await prisma.user.findUnique({ where: { studentId: sid } })
    if (existed) return res.status(409).json({ code: 'CONFLICT', message: '用户名已存在' })
    const hashed = await bcrypt.hash(pwd, 10)
    const created = await prisma.user.create({
      data: {
        studentId: sid,
        password: hashed,
        plainPassword: pwd,
        role: 'ADMIN',
        adminLevel: lvl
      }
    })
    return res.status(201).json({ id: created.id })
  } catch (e) {
    console.error('[admin] create admin user error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '创建管理员失败' })
  }
})

// 管理员：创建学生用户
app.post('/api/admin/users/create-student', auth, adminAuth, async (req, res) => {
  if (isStaff(req.adminLevel)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权创建用户' })
  }
  const b = req.body || {}
  const sid = String(b.studentId || '').trim()
  const pwd = String(b.password || '')
  const name = String(b.name || '').trim()
  const contact = String(b.contact || '').trim()
  const className = String(b.className || '').trim()
  if (!sid || !/^\d{12}$/.test(sid)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '学号需为12位数字' })
  }
  if (!pwd || !/^[A-Za-z0-9]{6,12}$/.test(pwd)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '密码需为6-12位（数字或英文）' })
  }
  if (!name || !/^[\u4e00-\u9fa5]+$/.test(name)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '姓名需为中文' })
  }
  if (!contact || !/^\d{11}$/.test(contact)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '联系方式需为11位数字' })
  }
  if (!className) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请填写班级' })
  }
  try {
    const existed = await prisma.user.findUnique({ where: { studentId: sid } })
    if (existed) return res.status(409).json({ code: 'CONFLICT', message: '该学号已注册' })
    const hashed = await bcrypt.hash(pwd, 10)
    const created = await prisma.user.create({
      data: {
        studentId: sid,
        password: hashed,
        plainPassword: pwd,
        role: 'STUDENT',
        name,
        contact,
        className
      }
    })
    return res.status(201).json({ id: created.id, studentId: created.studentId })
  } catch (e) {
    console.error('[admin] create student user error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '创建用户失败' })
  }
})

// 管理员：批量删除用户（清理关联报名与收藏）
app.post('/api/admin/users/batch-delete', auth, adminAuth, async (req, res) => {
  if (isStaff(req.adminLevel)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权删除用户' })
  }
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(x => Number.isFinite(Number(x))) .map(x => Number(x)) : []
  if (!ids.length) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请选择要删除的用户' })
  try {
    // 过滤掉受限等级的管理员，避免误删
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true, adminLevel: true } })
    const restricted = getRestrictedAdminLevels(req.adminLevel)
    const allowIds = users.filter(u => (u.role !== 'ADMIN') || !restricted.has(u.adminLevel)).map(u => u.id)
    if (!allowIds.length) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '无权限操作所选账号' })
    }
    // 先删除关联的报名和收藏，避免外键约束
    if (prisma.activityRegistration && typeof prisma.activityRegistration.deleteMany === 'function') {
      await prisma.activityRegistration.deleteMany({ where: { userId: { in: allowIds } } })
    }
    if (prisma.favorite && typeof prisma.favorite.deleteMany === 'function') {
      await prisma.favorite.deleteMany({ where: { userId: { in: allowIds } } })
    }
    // 删除用户
    const r = await prisma.user.deleteMany({ where: { id: { in: allowIds } } })
    return res.json({ deletedCount: r.count || 0 })
  } catch (e) {
    console.error('[admin] users batch delete error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '批量删除用户失败' })
  }
})

// 管理员：批量修改用户（支持统一更新部分字段）
app.post('/api/admin/users/batch-update', auth, adminAuth, async (req, res) => {
  if (isStaff(req.adminLevel)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '普通干事无权修改用户' })
  }
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(x => Number.isFinite(Number(x))) .map(x => Number(x)) : []
  const p = req.body?.payload || {}
  if (!ids.length) return res.status(400).json({ code: 'VALIDATION_ERROR', message: '请选择要修改的用户' })
  // 允许修改的字段：role、adminLevel、contact、className、password（明文，将进行哈希与明文同步）
  const data = {}
  if (p.role != null) {
    const role = String(p.role).trim()
    if (!['ADMIN', 'STUDENT'].includes(role)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '角色不合法' })
    }
    data.role = role
  }
  if (p.adminLevel != null) {
    const lvl = String(p.adminLevel).trim()
    const allowed = ['MENGSUILIANYUN', 'SUPERVISOR', 'OWNER_PRIMARY', 'OWNER_SECONDARY', 'STAFF']
    if (!allowed.includes(lvl)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '管理员等级不合法' })
    }
    // 等级约束：非最高权限不可将账号修改为受限等级
    const restricted = getRestrictedAdminLevels(req.adminLevel)
    if (restricted.has(lvl)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '无权将账号修改为该管理员等级' })
    }
    data.adminLevel = lvl
  }
  if (p.contact != null) {
    const c = String(p.contact).trim()
    if (!/^\d{11}$/.test(c)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '联系方式需为11位数字' })
    }
    data.contact = c
  }
  if (p.className != null) {
    const cn = String(p.className).trim()
    if (!cn) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '班级不能为空' })
    }
    data.className = cn
  }
  if (p.password != null) {
    const pwd = String(p.password)
    if (!/^[A-Za-z0-9]{6,12}$/.test(pwd)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: '密码要求6-12位（只能由数字和英文组成）' })
    }
    const hashed = await bcrypt.hash(pwd, 10)
    data.password = hashed
    data.plainPassword = pwd
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: '未提供可修改的字段' })
  }
  try {
    // 过滤掉受限等级的管理员，避免越权修改
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true, adminLevel: true } })
    const restricted = getRestrictedAdminLevels(req.adminLevel)
    const allowIds = users.filter(u => (u.role !== 'ADMIN') || !restricted.has(u.adminLevel)).map(u => u.id)
    if (!allowIds.length) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '无权限操作所选账号' })
    }
    const r = await prisma.user.updateMany({ where: { id: { in: allowIds } }, data })
    return res.json({ updatedCount: r.count || 0 })
  } catch (e) {
    console.error('[admin] users batch update error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '批量修改用户失败' })
  }
})

// 管理员：数据总览
app.get('/api/admin/analytics/overview', auth, adminAuth, async (_req, res) => {
  try {
    const activities = (prisma.activity && typeof prisma.activity.count === 'function') ? await prisma.activity.count() : 0
    const registrations = (prisma.activityRegistration && typeof prisma.activityRegistration.count === 'function') ? await prisma.activityRegistration.count() : 0
    const users = (prisma.user && typeof prisma.user.count === 'function') ? await prisma.user.count({ where: { role: { not: 'ADMIN' } } }) : 0
    const admins = (prisma.user && typeof prisma.user.count === 'function') ? await prisma.user.count({ where: { role: 'ADMIN' } }) : 0
    return res.json({ activities, registrations, users, admins })
  } catch (e) {
    console.error('[admin] analytics overview error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取数据总览失败' })
  }
})

// 管理员：报名趋势（日维度，按报名创建时间聚合）
app.get('/api/admin/analytics/registrations/by-day', auth, adminAuth, async (req, res) => {
  try {
    const days = Math.min(180, Math.max(1, Number(req.query.days || 30)))
    const statusParam = String(req.query.statuses || 'REGISTERED,PENDING_CANCEL')
    const allowed = new Set(['REGISTERED','PENDING_CANCEL','CANCELED'])
    const statuses = statusParam.split(',').map(s => String(s).trim()).filter(s => allowed.has(s))
    if (!statuses.length) statuses.push('REGISTERED','PENDING_CANCEL')
    const end = new Date()
    // 起始为当天 00:00:00（含），结束为当天 23:59:59（含）
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1))
    const startStr = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')} 00:00:00`
    const endStr = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')} 23:59:59`
    const category = String(req.query.category || '').trim()
    const mentorName = String(req.query.mentor || '').trim()
    const where = [Prisma.sql`ar.createdAt BETWEEN ${startStr} AND ${endStr}`, Prisma.sql`ar.status IN (${Prisma.join(statuses)})`]
    if (category) where.push(Prisma.sql`a.category LIKE ${`%${category}%`}`)
    if (mentorName) where.push(Prisma.sql`a.mentorName LIKE ${`%${mentorName}%`}`)
    const rows = await prisma.$queryRaw(
      Prisma.sql`SELECT DATE_FORMAT(ar.createdAt, '%Y-%m-%d') AS day, COUNT(*) AS cnt
                 FROM ActivityRegistration ar
                 JOIN Activity a ON a.id = ar.activityId
                 WHERE ${Prisma.join(where, ' AND ')}
                 GROUP BY day
                 ORDER BY day`
    )
    const labels = []
    const dayMap = Object.create(null)
    for (let i=days-1; i>=0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth(), end.getDate()-i)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      labels.push(key); dayMap[key] = 0
    }
    for (const r of rows) { const k = String(r.day); if (k in dayMap) dayMap[k] = Number(r.cnt || 0) }
    const series = labels.map(k => dayMap[k] || 0)
    return res.json({ labels, series, range: { start: startStr.slice(0,10), end: endStr.slice(0,10) } })
  } catch (e) {
    console.error('[admin] analytics registrations by-day error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取报名日趋势失败' })
  }
})

// 管理员：报名趋势（小时维度，按报名创建时间聚合）
app.get('/api/admin/analytics/registrations/by-hour', auth, adminAuth, async (req, res) => {
  try {
    const date = String(req.query.date || '').trim() // YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: '日期格式需为 YYYY-MM-DD' })
    }
    const statusParam = String(req.query.statuses || 'REGISTERED,PENDING_CANCEL')
    const allowed = new Set(['REGISTERED','PENDING_CANCEL','CANCELED'])
    const statuses = statusParam.split(',').map(s => String(s).trim()).filter(s => allowed.has(s))
    if (!statuses.length) statuses.push('REGISTERED','PENDING_CANCEL')
    const category = String(req.query.category || '').trim()
    const mentorName = String(req.query.mentor || '').trim()
    const where = [Prisma.sql`DATE(ar.createdAt) = ${date}`, Prisma.sql`ar.status IN (${Prisma.join(statuses)})`]
    if (category) where.push(Prisma.sql`a.category LIKE ${`%${category}%`}`)
    if (mentorName) where.push(Prisma.sql`a.mentorName LIKE ${`%${mentorName}%`}`)
    const rows = await prisma.$queryRaw(
      Prisma.sql`SELECT HOUR(ar.createdAt) AS hour, COUNT(*) AS cnt
                 FROM ActivityRegistration ar
                 JOIN Activity a ON a.id = ar.activityId
                 WHERE ${Prisma.join(where, ' AND ')}
                 GROUP BY hour
                 ORDER BY hour`
    )
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
    const hm = Object.create(null); for (let i=0;i<24;i++){ hm[i]=0 }
    for (const r of rows) { const h = Number(r.hour || 0); if (h>=0 && h<24) hm[h] = Number(r.cnt || 0) }
    const series = Array.from({ length: 24 }, (_, i) => hm[i])
    return res.json({ labels, series, date })
  } catch (e) {
    console.error('[admin] analytics registrations by-hour error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取报名小时趋势失败' })
  }
})

// 管理员：报名状态分布（堆叠柱状，按日聚合）
app.get('/api/admin/analytics/registrations/status-by-day', auth, adminAuth, async (req, res) => {
  try {
    const days = Math.min(180, Math.max(1, Number(req.query.days || 30)))
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1))
    const startStr = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')} 00:00:00`
    const endStr = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')} 23:59:59`
    const category = String(req.query.category || '').trim()
    const mentorName = String(req.query.mentor || '').trim()
    const where = [Prisma.sql`ar.createdAt BETWEEN ${startStr} AND ${endStr}`]
    if (category) where.push(Prisma.sql`a.category LIKE ${`%${category}%`}`)
    if (mentorName) where.push(Prisma.sql`a.mentorName LIKE ${`%${mentorName}%`}`)
    const rows = await prisma.$queryRaw(
      Prisma.sql`SELECT DATE_FORMAT(ar.createdAt, '%Y-%m-%d') AS day, ar.status AS status, COUNT(*) AS cnt
                 FROM ActivityRegistration ar
                 JOIN Activity a ON a.id = ar.activityId
                 WHERE ${Prisma.join(where, ' AND ')}
                 GROUP BY day, status
                 ORDER BY day`
    )
    const labels = []
    const dayMap = Object.create(null)
    for (let i=days-1; i>=0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth(), end.getDate()-i)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      labels.push(key); dayMap[key] = { REGISTERED: 0, PENDING_CANCEL: 0, CANCELED: 0 }
    }
    for (const r of rows) {
      const k = String(r.day); const s = String(r.status)
      if (dayMap[k] && (s in dayMap[k])) dayMap[k][s] = Number(r.cnt || 0)
    }
    const series = {
      REGISTERED: labels.map(k => dayMap[k].REGISTERED || 0),
      PENDING_CANCEL: labels.map(k => dayMap[k].PENDING_CANCEL || 0),
      CANCELED: labels.map(k => dayMap[k].CANCELED || 0)
    }
    return res.json({ labels, series })
  } catch (e) {
    console.error('[admin] analytics registrations status-by-day error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取报名状态分布失败' })
  }
})

// 管理员：TopN 维度分析（按报名创建时间聚合）
app.get('/api/admin/analytics/registrations/top', auth, adminAuth, async (req, res) => {
  try {
    const dimension = String(req.query.dimension || 'category').trim()
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)))
    const days = Math.min(365, Math.max(1, Number(req.query.days || 90)))
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1))
    const startStr = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')} 00:00:00`
    const endStr = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')} 23:59:59`
    const statusParam = String(req.query.statuses || 'REGISTERED,PENDING_CANCEL')
    const allowed = new Set(['REGISTERED','PENDING_CANCEL','CANCELED'])
    const statuses = statusParam.split(',').map(s => String(s).trim()).filter(s => allowed.has(s))
    if (!statuses.length) statuses.push('REGISTERED','PENDING_CANCEL')
    let dimSql
    if (dimension === 'mentor') dimSql = Prisma.sql`a.mentorName`
    else dimSql = Prisma.sql`a.category`
    const rows = await prisma.$queryRaw(
      Prisma.sql`SELECT ${dimSql} AS dim, COUNT(*) AS cnt
                 FROM ActivityRegistration ar
                 JOIN Activity a ON a.id = ar.activityId
                 WHERE ar.createdAt BETWEEN ${startStr} AND ${endStr}
                   AND ar.status IN (${Prisma.join(statuses)})
                 GROUP BY ${dimSql}
                 ORDER BY cnt DESC
                 LIMIT ${limit}`
    )
    const items = (rows || []).map(r => ({ key: String(r.dim || (dimension==='mentor'?'未知导师':'未分类')), count: Number(r.cnt || 0) }))
    return res.json({ items, range: { start: startStr.slice(0,10), end: endStr.slice(0,10) } })
  } catch (e) {
    console.error('[admin] analytics registrations top error', e)
    return res.status(500).json({ code: 'SERVER_ERROR', message: '获取报名TopN分析失败' })
  }
})
