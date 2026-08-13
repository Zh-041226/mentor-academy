import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useMobile(breakpoint = 768) {
  const isMobile = ref(false)
  let mediaQuery = null
  let handler = null

  const update = () => {
    try {
      if (mediaQuery) {
        isMobile.value = !!mediaQuery.matches
        return
      }
      isMobile.value = window.innerWidth <= breakpoint
    } catch {
      isMobile.value = false
    }
  }

  onMounted(() => {
    try {
      mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`)
      handler = () => update()
      update()
      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handler)
      else mediaQuery.addListener(handler)
    } catch {
      update()
      handler = () => update()
      window.addEventListener('resize', handler, { passive: true })
    }
  })

  onBeforeUnmount(() => {
    try {
      if (mediaQuery && handler) {
        if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', handler)
        else mediaQuery.removeListener(handler)
      } else if (handler) {
        window.removeEventListener('resize', handler)
      }
    } catch {}
  })

  return { isMobile }
}
