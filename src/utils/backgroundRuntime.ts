const STORAGE_KEY = 'background-runtime-enabled'
const LOCAL_TIMER_KEY = 'study-bg-timer-v1'
export const TIMER_BROADCAST_CHANNEL = 'study-time-timer'

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

function persistLocalTimerJob(job: ScheduledTimerJob | null) {
  if (!job) {
    localStorage.removeItem(LOCAL_TIMER_KEY)
    return
  }
  localStorage.setItem(LOCAL_TIMER_KEY, JSON.stringify(job))
}

export function readLocalTimerJob(): ScheduledTimerJob | null {
  try {
    const raw = localStorage.getItem(LOCAL_TIMER_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as ScheduledTimerJob
    if (!data?.deadlineAt) return null
    return data
  } catch {
    return null
  }
}

export function isLocalTimerOverdue(now = Date.now()) {
  const job = readLocalTimerJob()
  return Boolean(job && job.deadlineAt <= now)
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
  if (!('serviceWorker' in navigator)) return false

  try {
    const registration = await navigator.serviceWorker.ready
    const targets = [
      registration.active,
      registration.waiting,
      registration.installing,
      navigator.serviceWorker.controller,
    ].filter(Boolean)

    if (targets.length === 0) return false

    for (const target of targets) {
      target?.postMessage(data)
    }
    return true
  } catch {
    return false
  }
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

  persistLocalTimerJob(job)
  await postToServiceWorker({ type: 'SCHEDULE_TIMER', job })
}

export async function clearScheduledTimer() {
  persistLocalTimerJob(null)
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

  let channel: BroadcastChannel | null = null
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(TIMER_BROADCAST_CHANNEL)
    channel.onmessage = () => {
      onTimerFired()
    }
  }

  return () => {
    navigator.serviceWorker.removeEventListener('message', handler)
    channel?.close()
  }
}

export function isStandaloneDisplayMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
