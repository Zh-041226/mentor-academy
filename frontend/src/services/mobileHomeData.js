import http from '../api/http'
import { getBackendBaseUrl } from '../utils/config'

const HOME_CACHE_KEY = 'mentor_home_payload_v2'
const HERO_CACHE_KEY = 'mobile-hero-data-v1'
const HOME_CACHE_TTL = 60 * 1000
const HERO_CACHE_TTL = 10 * 60 * 1000

const defaultSlides = [
  { src: '/hero/01.jpg', alt: '海报1' },
  { src: '/hero/02.jpg', alt: '海报2' },
  { src: '/hero/03.jpg', alt: '海报3' },
  { src: '/hero/04.jpg', alt: '海报4' },
]

const memoryCache = {
  home: null,
  hero: null,
}

let homeRequest = null
let heroRequest = null

function now() {
  return Date.now()
}

function readCache(key, ttl) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.timestamp || now() - parsed.timestamp > ttl) return null
    return parsed.data ?? null
  } catch {
    return null
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: now(), data }))
  } catch {}
}

function getValidMemoryCache(entry, ttl) {
  if (!entry?.timestamp || now() - entry.timestamp > ttl) return null
  return entry.data ?? null
}

function setMemoryCache(name, data) {
  memoryCache[name] = { timestamp: now(), data }
}

function getHeroSlidesFromResponse(data) {
  const base = getBackendBaseUrl()
  const items = Array.isArray(data?.items)
    ? data.items
        .filter((item) => item?.src)
        .map((item) => ({
          src: `${base}${item.src}`,
          alt: item.alt || '',
        }))
    : []
  return items.length ? items : defaultSlides
}

export function getDefaultHeroSlides() {
  return [...defaultSlides]
}

export async function fetchHeroSlides({ force = false } = {}) {
  if (!force) {
    const memory = getValidMemoryCache(memoryCache.hero, HERO_CACHE_TTL)
    if (memory) return memory
    const storage = readCache(HERO_CACHE_KEY, HERO_CACHE_TTL)
    if (storage) {
      setMemoryCache('hero', storage)
      return storage
    }
    if (heroRequest) return heroRequest
  }

  heroRequest = http.get('/hero-slides')
    .then(({ data }) => {
      const slides = getHeroSlidesFromResponse(data)
      setMemoryCache('hero', slides)
      writeCache(HERO_CACHE_KEY, slides)
      return slides
    })
    .catch(() => {
      const fallback = getDefaultHeroSlides()
      setMemoryCache('hero', fallback)
      return fallback
    })
    .finally(() => {
      heroRequest = null
    })

  return heroRequest
}

export async function fetchMobileHomePayload({ force = false } = {}) {
  if (!force) {
    const memory = getValidMemoryCache(memoryCache.home, HOME_CACHE_TTL)
    if (memory) return memory
    const storage = readCache(HOME_CACHE_KEY, HOME_CACHE_TTL)
    if (storage) {
      setMemoryCache('home', storage)
      return storage
    }
    if (homeRequest) return homeRequest
  }

  homeRequest = Promise.all([
    http.get('/activities'),
    http.get('/announcements'),
  ])
    .then(([activityRes, announcementRes]) => {
      const payload = {
        activities: Array.isArray(activityRes?.data?.items) ? activityRes.data.items : [],
        announcements: Array.isArray(announcementRes?.data?.items) ? announcementRes.data.items : [],
      }
      setMemoryCache('home', payload)
      writeCache(HOME_CACHE_KEY, payload)
      return payload
    })
    .finally(() => {
      homeRequest = null
    })

  return homeRequest
}
