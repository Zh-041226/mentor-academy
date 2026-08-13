import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 开发环境代理：将前端的 /api 请求转发到后端服务（默认 http://localhost:3001）
export default defineConfig({
  plugins: [
    vue(),
    Components({
      dts: false,
      resolvers: [
        ElementPlusResolver({
          importStyle: 'css',
        }),
      ],
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/xlsx/')) return 'xlsx'
          if (id.includes('echarts')) return 'echarts'
          if (id.includes('sortablejs')) return 'sortablejs'
          if (id.includes('element-plus/theme-chalk')) return 'element-plus-style'
          if (id.includes('element-plus')) return 'element-plus'
          if (id.includes('vue-router')) return 'vue-router'
          if (id.includes('/vue/')) return 'vue-core'
          if (id.includes('axios')) return 'http'
        }
      }
    },
    chunkSizeWarningLimit: 900
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      }
      ,'/logo': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      }
      // 说明：/logo 与 /hero 在开发环境直接由前端 public 目录提供静态资源，避免代理不可用导致资源加载失败
      ,'/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      }
      ,'/uploads': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      }
    }
  }
})
