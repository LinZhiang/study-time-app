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

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault()
  deferredPrompt = event as BeforeInstallPromptEvent
  canPromptInstall.value = true
}

export function initPwaInstall() {
  if (initialized) return
  initialized = true
  refreshInstalledState()
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    canPromptInstall.value = false
    deferredPrompt = null
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

export function usePwaInstall() {
  return {
    canPromptInstall,
    isInstalled,
    showInstallBanner,
    refreshInstalledState,
    promptPwaInstall,
    dismissInstallBanner,
  }
}

if (typeof window !== 'undefined') {
  initPwaInstall()
}
