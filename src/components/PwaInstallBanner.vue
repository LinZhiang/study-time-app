<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { isStandaloneDisplayMode } from '../utils/backgroundRuntime'

const visible = ref(false)
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault()
  deferredPrompt.value = event as BeforeInstallPromptEvent
  if (!isStandaloneDisplayMode()) {
    visible.value = true
  }
}

async function installApp() {
  const prompt = deferredPrompt.value
  if (!prompt) return
  await prompt.prompt()
  await prompt.userChoice
  visible.value = false
  deferredPrompt.value = null
}

function dismissBanner() {
  visible.value = false
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})
</script>

<template>
  <div v-if="visible" class="pwa-install-banner">
    <p class="pwa-install-banner__text">安装到主屏幕，使用更方便</p>
    <div class="pwa-install-banner__actions">
      <button class="btn btn--ghost btn--small" type="button" @click="dismissBanner">稍后</button>
      <button class="btn btn--primary btn--small" type="button" @click="installApp">安装</button>
    </div>
  </div>
</template>

<style scoped>
.pwa-install-banner {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(var(--nav-height) + var(--safe-bottom) + 12px);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgb(26 107 92 / 18%);
}

.pwa-install-banner__text {
  margin: 0;
  font-size: 14px;
  color: var(--color-text);
}

.pwa-install-banner__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
