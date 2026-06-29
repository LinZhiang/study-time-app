const STORAGE_KEY = 'background-runtime-enabled'

export interface ScheduledTimerJob {
  deadlineAt: number
  title: string
  body: string
  tag: string
}

export function isBackgroundRuntimeEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export function setBackgroundRuntimeEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
}

export async function requestBackgroundRuntimeSetup(): Promise<{
  enabled: boolean
  notifications: NotificationPermission | 'unsupported'
}> {
  setBackgroundRuntimeEnabled(true)

  let notifications: NotificationPermission | 'unsupported' = 'unsupported'
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      notifications = await Notification.requestPermission()
    } else {
      notifications = Notification.permission
    }
  }

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.ready
    } catch {
      // ignore
    }
  }

  return { enabled: true, notifications }
}

export function disableBackgroundRuntime() {
  setBackgroundRuntimeEnabled(false)
  void clearScheduledTimer()
}

async function postToServiceWorker(data: unknown) {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  registration.active?.postMessage(data)
}

export async function syncScheduledTimer(job: ScheduledTimerJob | null) {
  if (!isBackgroundRuntimeEnabled()) {
    await clearScheduledTimer()
    return
  }
  if (!job) {
    await clearScheduledTimer()
    return
  }
  await postToServiceWorker({ type: 'SCHEDULE_TIMER', job })
}

export async function clearScheduledTimer() {
  await postToServiceWorker({ type: 'CLEAR_TIMER' })
}

export function setupBackgroundRuntimeListener(onTimerFired: () => void) {
  if (!('serviceWorker' in navigator)) return () => {}

  const handler = (event: MessageEvent) => {
    const type = (event.data as { type?: string } | null)?.type
    if (type === 'TIMER_FIRED' || type === 'OPEN_FROM_NOTIFICATION') {
      onTimerFired()
    }
  }

  navigator.serviceWorker.addEventListener('message', handler)
  return () => navigator.serviceWorker.removeEventListener('message', handler)
}

export function isStandaloneDisplayMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
