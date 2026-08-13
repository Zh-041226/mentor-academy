<script setup>
import { computed } from 'vue'
import { useMobile } from '../composables/useMobile'
import MobileHome from './MobileHome.vue'
import Activities from './Activities.vue'

const { isMobile } = useMobile()
</script>

<template>
  <MobileHome v-if="isMobile" />
  <Activities v-else />
</template>
