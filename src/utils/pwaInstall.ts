import { computed, ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import { isStandaloneDisplayMode } from './backgroundRuntime'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const canPromptInstall = ref(false)
const isInstalled = ref(false)
const bannerDismissed = ref(false)
const swReady = ref(false)
const swRegisterError = ref<string | null>(null)
let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault()
  deferredPrompt = event as BeforeInstallPromptEvent
  canPromptInstall.value = true
}

export function initPwaInstall() {
  if (initialized) return
  initialized = true
  refreshInstalledState()

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    swReady.value = true
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    canPromptInstall.value = false
    deferredPrompt = null
  })

  registerSW({
    immediate: true,
    onRegistered() {
      swReady.value = true
      swRegisterError.value = null
    },
    onRegisterError(error) {
      swRegisterError.value = error?.message ?? 'Service Worker 注册失败'
    },
  })
}

export function refreshInstalledState() {
  isInstalled.value = isStandaloneDisplayMode()
}

export async function promptPwaInstall(): Promise<boolean> {
  refreshInstalledState()
  if (isInstalled.value || !deferredPrompt) return false
  await deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  if (choice.outcome === 'accepted') {
    isInstalled.value = true
    canPromptInstall.value = false
    deferredPrompt = null
    return true
  }
  return false
}

export function dismissInstallBanner() {
  bannerDismissed.value = true
}

export const showInstallBanner = computed(
  () => canPromptInstall.value && !isInstalled.value && !bannerDismissed.value,
)

export type InstallUiStatus = 'installed' | 'ready' | 'waiting_browser' | 'preparing' | 'error'

export const installUiStatus = computed<InstallUiStatus>(() => {
  if (isInstalled.value) return 'installed'
  if (swRegisterError.value) return 'error'
  if (canPromptInstall.value) return 'ready'
  if (swReady.value) return 'waiting_browser'
  return 'preparing'
})

export const installStatusHint = computed(() => {
  switch (installUiStatus.value) {
    case 'installed':
      return '当前已从主屏幕或独立窗口打开。'
    case 'ready':
      return '可以安装，点击下方按钮即可。'
    case 'waiting_browser':
      return '应用已就绪。请在页面内点击、操作约 30 秒后再点安装（浏览器安全策略）。'
    case 'error':
      return swRegisterError.value ?? 'Service Worker 注册失败，请刷新页面。'
    default:
      return '正在注册 Service Worker，请稍候…'
  }
})

export function usePwaInstall() {
  return {
    canPromptInstall,
    isInstalled,
    swReady,
    showInstallBanner,
    installUiStatus,
    installStatusHint,
    refreshInstalledState,
    promptPwaInstall,
    dismissInstallBanner,
  }
}

if (typeof window !== 'undefined') {
  initPwaInstall()
}
