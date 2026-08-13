<script setup>
import { useRouter } from 'vue-router'
import { getBackendBaseUrl } from '../utils/config'

const router = useRouter()
const base = getBackendBaseUrl()
const logoUrl = `${base}/logo/logo.png`
const brandUrl = `${base}/logo/logo2.png`

function goHome() {
  router.push('/home')
}
</script>

<template>
  <header class="mobile-top-bar">
    <div class="mobile-top-bar__brand" @click="goHome">
      <img class="mobile-top-bar__logo" :src="logoUrl" alt="崇德书院 Logo">
      <img class="mobile-top-bar__brand-image" :src="brandUrl" alt="崇德书院题字">
    </div>
  </header>
</template>

<style scoped>
.mobile-top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: var(--mobile-topbar-height);
  padding: calc(6px + env(safe-area-inset-top, 0px)) var(--mobile-page-x) 8px;
  background: linear-gradient(
    180deg,
    rgba(190, 150, 90, 0.78) 0%,
    rgba(214, 186, 132, 0.46) 52%,
    rgba(231, 210, 168, 0.10) 100%
  );
  border-bottom: none;
  box-shadow: none;
  backdrop-filter: blur(3px);
}

.mobile-top-bar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: pointer;
  margin-top: 1px;
}

.mobile-top-bar__logo {
  height: 34px;
  width: auto;
  display: block;
}

.mobile-top-bar__brand-image {
  height: 32px;
  width: auto;
  display: block;
  max-width: min(42vw, 150px);
}
</style>
