import { computed, ref } from 'vue'
import { isStandaloneDisplayMode } from './backgroundRuntime'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const canPromptInstall = ref(false)
const isInstalled = ref(false)
const bannerDismissed = ref(false)
let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false

export function isIosSafari() {
  const ua = window.navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return isIOS && !(window as Window & { MSStream?: unknown }).MSStream
}

export function initPwaInstall() {
  if (initialized) return
  initialized = true
  refreshInstalledState()

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    canPromptInstall.value = true
  })

  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    canPromptInstall.value = false
    deferredPrompt = null
  })
}

export function refreshInstalledState() {
  isInstalled.value = isStandaloneDisplayMode()
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  refreshInstalledState()
  if (isInstalled.value) return 'unavailable'
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  if (choice.outcome === 'accepted') {
    isInstalled.value = true
    canPromptInstall.value = false
    deferredPrompt = null
    return 'accepted'
  }
  return 'dismissed'
}

export function dismissInstallBanner() {
  bannerDismissed.value = true
}

export const showInstallBanner = computed(
  () => canPromptInstall.value && !isInstalled.value && !bannerDismissed.value,
)

export function usePwaInstall() {
  return {
    canPromptInstall,
    isInstalled,
    showInstallBanner,
    isIosSafari: isIosSafari(),
    refreshInstalledState,
    promptPwaInstall,
    dismissInstallBanner,
  }
}
