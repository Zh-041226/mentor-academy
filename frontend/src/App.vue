<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import NavBar from './components/NavBar.vue'
import FooterBar from './components/FooterBar.vue'
import MobileTopBar from './components/MobileTopBar.vue'
import MobileTabBar from './components/MobileTabBar.vue'
import { useMobile } from './composables/useMobile'

const { isMobile } = useMobile()
</script>

<template>
  <!-- 全局主题容器：应用 sunset 风格到全站 -->
  <el-config-provider :locale="zhCn">
    <div class="app theme-sunset" :class="{ 'app--mobile': isMobile }">
      <NavBar v-if="!isMobile" />
      <MobileTopBar v-else />
      <router-view />
      <FooterBar v-if="!isMobile" />
      <MobileTabBar v-else />
    </div>
  </el-config-provider>
  
</template>

<style scoped>
.app { min-height: 100vh; }
.app--mobile {
  padding-bottom: 86px;
}
</style>
