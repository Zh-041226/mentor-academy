import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'dayjs/locale/zh-cn'
import 'element-plus/theme-chalk/el-message.css'
import 'element-plus/theme-chalk/el-message-box.css'
import './style.css'

const app = createApp(App)
// 主题作用域同步到 body，确保 Element Plus Teleport 到 body 的浮层也能命中 .theme-sunset 样式
try { document.body.classList.add('theme-sunset') } catch {}
try { document.documentElement.lang = 'zh-CN' } catch {}
// 全局指令：回车等于点击
app.directive('enter', {
  mounted(el, binding) {
    const handler = (e) => {
      if (e.key !== 'Enter') return
      // 若传入方法，优先调用方法
      if (typeof binding.value === 'function') {
        try { binding.value(e) } catch {}
        return
      }
      // 默认：在同一容器内寻找 primary 按钮或提交按钮并触发点击
      const root = el.closest('.search-bar, .filter-bar, .toolbar, form') || el.parentElement
      let btn = root?.querySelector('button[type="submit"], .el-button--primary, .el-button[type="primary"], .el-button')
      if (!btn) btn = document.querySelector('.el-button--primary')
      if (btn) { btn.click() }
    }
    el.addEventListener('keydown', handler)
    el._vEnterHandler = handler
  },
  unmounted(el) {
    if (el._vEnterHandler) {
      el.removeEventListener('keydown', el._vEnterHandler)
      delete el._vEnterHandler
    }
  }
})
app.use(router)
app.mount('#app')
