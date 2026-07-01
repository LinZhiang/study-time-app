import { computed, ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import { isStandaloneDisplayMode } from './backgroundRuntime'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallUiStatus =
  | 'installed'
  | 'ready'
  | 'manual'
  | 'preparing'
  | 'error'

export interface BrowserInstallInfo {
  isAndroid: boolean
  isHuaweiBrowser: boolean
  isWeChat: boolean
  isChromeAndroid: boolean
  /** 基本不会触发 beforeinstallprompt，只能走浏览器菜单 */
  needsManualInstall: boolean
}

const canPromptInstall = ref(false)
const isInstalled = ref(false)
const bannerDismissed = ref(false)
const swReady = ref(false)
const swRegisterError = ref<string | null>(null)
const manualInstallConfirmed = ref(false)
let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false
let manualCheckTimer: ReturnType<typeof setTimeout> | null = null

const browserInstallInfo: BrowserInstallInfo = (() => {
  if (typeof navigator === 'undefined') {
    return {
      isAndroid: false,
      isHuaweiBrowser: false,
      isWeChat: false,
      isChromeAndroid: false,
      needsManualInstall: false,
    }
  }
  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const isHuaweiBrowser = /HuaweiBrowser|Huawei/i.test(ua)
  const isWeChat = /MicroMessenger/i.test(ua)
  const isChromeAndroid =
    isAndroid && /Chrome\//i.test(ua) && !/Edg\//i.test(ua) && !isHuaweiBrowser
  const needsManualInstall = isHuaweiBrowser || isWeChat || (isAndroid && !isChromeAndroid)

  return {
    isAndroid,
    isHuaweiBrowser,
    isWeChat,
    isChromeAndroid,
    needsManualInstall,
  }
})()

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault()
  deferredPrompt = event as BeforeInstallPromptEvent
  canPromptInstall.value = true
  manualInstallConfirmed.value = false
}

function scheduleManualFallback() {
  if (manualCheckTimer) clearTimeout(manualCheckTimer)
  manualCheckTimer = setTimeout(() => {
    if (!canPromptInstall.value && !isInstalled.value) {
      manualInstallConfirmed.value = true
    }
  }, 4000)
}

export function initPwaInstall() {
  if (initialized) return
  initialized = true
  refreshInstalledState()

  if (browserInstallInfo.needsManualInstall) {
    manualInstallConfirmed.value = true
  }

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    swReady.value = true
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    canPromptInstall.value = false
    deferredPrompt = null
    manualInstallConfirmed.value = false
  })

  registerSW({
    immediate: true,
    onRegistered() {
      swReady.value = true
      swRegisterError.value = null
      if (!browserInstallInfo.needsManualInstall) {
        scheduleManualFallback()
      }
    },
    onRegisterError(error) {
      swRegisterError.value = error?.message ?? 'Service Worker 注册失败'
      if (browserInstallInfo.isAndroid) {
        manualInstallConfirmed.value = true
      }
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
  () =>
    !isInstalled.value &&
    !bannerDismissed.value &&
    (canPromptInstall.value || (manualInstallConfirmed.value && browserInstallInfo.needsManualInstall)),
)

export const installUiStatus = computed<InstallUiStatus>(() => {
  if (isInstalled.value) return 'installed'
  if (swRegisterError.value && !browserInstallInfo.needsManualInstall) return 'error'
  if (canPromptInstall.value) return 'ready'
  if (manualInstallConfirmed.value || browserInstallInfo.needsManualInstall) return 'manual'
  if (swReady.value) return 'manual'
  return 'preparing'
})

export function getManualInstallSteps(info: BrowserInstallInfo = browserInstallInfo): string[] {
  if (info.isWeChat) {
    return [
      '微信内无法直接安装，请点击右上角「⋯」',
      '选择「在浏览器中打开」，用系统浏览器或 Chrome 打开',
      '再按该浏览器的「添加到主屏幕 / 桌面」完成安装',
    ]
  }
  if (info.isHuaweiBrowser) {
    return [
      '点击浏览器右下角「菜单」（⋮ 或 四格图标）',
      '选择「添加到主屏幕」或「添加至桌面」',
      '确认后从桌面「自学时间」图标打开（不要只留书签）',
    ]
  }
  if (info.isAndroid) {
    return [
      '点击浏览器右上角或右下角的「菜单」',
      '选择「添加到主屏幕」「安装应用」或「添加至桌面」',
      '建议使用 Chrome 浏览器打开本页，成功率更高',
    ]
  }
  return [
    '在 Chrome / Edge 地址栏或菜单中查找「安装应用」',
    '安装后从桌面或开始菜单图标打开',
  ]
}

export const installStatusHint = computed(() => {
  switch (installUiStatus.value) {
    case 'installed':
      return '当前已从主屏幕或独立窗口打开。'
    case 'ready':
      return '可以安装，点击下方按钮即可。'
    case 'manual':
      if (browserInstallInfo.isHuaweiBrowser) {
        return '华为浏览器不支持应用内一键安装，请按下方步骤从菜单添加到主屏幕。'
      }
      if (browserInstallInfo.isWeChat) {
        return '请先用系统浏览器或 Chrome 打开本页，再添加到主屏幕。'
      }
      return '当前浏览器未提供一键安装，请按下方步骤手动添加。'
    case 'error':
      return swRegisterError.value ?? 'Service Worker 注册失败，请刷新页面。'
    default:
      return '正在准备，请稍候…'
  }
})

export const manualInstallSteps = computed(() => getManualInstallSteps())

export function usePwaInstall() {
  return {
    canPromptInstall,
    isInstalled,
    swReady,
    showInstallBanner,
    installUiStatus,
    installStatusHint,
    manualInstallSteps,
    browserInstallInfo,
    refreshInstalledState,
    promptPwaInstall,
    dismissInstallBanner,
  }
}

if (typeof window !== 'undefined') {
  initPwaInstall()
}
