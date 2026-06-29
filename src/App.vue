<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import PwaInstallBanner from './components/PwaInstallBanner.vue'

const route = useRoute()

const pageTitle = computed(() => {
  return (route.meta.title as string) ?? '自学时间'
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1 class="app-title">{{ pageTitle }}</h1>
    </header>

    <main class="app-main">
      <RouterView />
    </main>

    <BottomNav />
    <PwaInstallBanner />
  </div>
</template>
