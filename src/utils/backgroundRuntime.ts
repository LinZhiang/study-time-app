const STORAGE_KEY = 'background-runtime-enabled'
const LOCAL_TIMER_KEY = 'study-bg-timer-v1'
export const TIMER_BROADCAST_CHANNEL = 'study-time-timer'

export type ScheduledTimerKind =
  | 'countdown'
  | 'reminder'
  | 'free_hour_prompt'
  | 'mid_break_end'
  | 'morning_start'
  | 'force_rest'

export interface ScheduledTimerJob {
  deadlineAt: number
  title: string
  body: string
  tag: string
  kind?: ScheduledTimerKind
}

export interface TimerFiredPayload {
  type: 'TIMER_FIRED'
  kind?: ScheduledTimerKind
  tag?: string
}

export function ensureBackgroundRuntimeDefault() {
  if (localStorage.getItem(STORAGE_KEY) === null) {
    localStorage.setItem(STORAGE_KEY, '1')
  }
}

export function isBackgroundRuntimeEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === null) return true
  return stored === '1'
}

export function setBackgroundRuntimeEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
}

function persistLocalTimerJobs(jobs: ScheduledTimerJob[]) {
  if (jobs.length === 0) {
    localStorage.removeItem(LOCAL_TIMER_KEY)
    return
  }
  localStorage.setItem(LOCAL_TIMER_KEY, JSON.stringify(jobs))
}

function parseStoredTimerJobs(raw: string): ScheduledTimerJob[] {
  const data = JSON.parse(raw) as ScheduledTimerJob | ScheduledTimerJob[]
  const list = Array.isArray(data) ? data : [data]
  return list.filter((job) => Boolean(job?.deadlineAt && job?.tag))
}

export function readLocalTimerJobs(): ScheduledTimerJob[] {
  try {
    const raw = localStorage.getItem(LOCAL_TIMER_KEY)
    if (!raw) return []
    return parseStoredTimerJobs(raw)
  } catch {
    return []
  }
}

/** @deprecated 兼容旧调用，返回最近一条 */
export function readLocalTimerJob(): ScheduledTimerJob | null {
  const jobs = readLocalTimerJobs()
  if (jobs.length === 0) return null
  return jobs.reduce((earliest, job) =>
    job.deadlineAt < earliest.deadlineAt ? job : earliest,
  )
}

export function readOverdueLocalTimerJob(now = Date.now()): ScheduledTimerJob | null {
  return readLocalTimerJobs().find((job) => job.deadlineAt <= now) ?? null
}

export function isLocalTimerOverdue(now = Date.now()) {
  return readLocalTimerJobs().some((job) => job.deadlineAt <= now)
}

export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'default') {
    return Notification.requestPermission()
  }
  return Notification.permission
}

export async function requestBackgroundRuntimeSetup(): Promise<{
  enabled: boolean
  notifications: NotificationPermission | 'unsupported'
}> {
  setBackgroundRuntimeEnabled(true)

  const notifications = await ensureNotificationPermission()

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
  void clearScheduledTimers()
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

export async function syncScheduledTimers(jobs: ScheduledTimerJob[]) {
  if (!isBackgroundRuntimeEnabled()) {
    await clearScheduledTimers()
    return
  }

  const now = Date.now()
  const upcoming = jobs
    .filter((job) => job.deadlineAt > now)
    .sort((a, b) => a.deadlineAt - b.deadlineAt)

  persistLocalTimerJobs(upcoming)
  await postToServiceWorker({ type: 'SCHEDULE_TIMERS', jobs: upcoming })
}

export async function syncScheduledTimer(job: ScheduledTimerJob | null) {
  if (!job) {
    await clearScheduledTimers()
    return
  }
  await syncScheduledTimers([job])
}

export async function clearScheduledTimers() {
  persistLocalTimerJobs([])
  await postToServiceWorker({ type: 'CLEAR_TIMERS' })
}

/** @deprecated */
export async function clearScheduledTimer() {
  await clearScheduledTimers()
}

export function setupBackgroundRuntimeListener(
  onTimerFired: (payload?: TimerFiredPayload) => void,
) {
  if (!('serviceWorker' in navigator)) return () => {}

  const handler = (event: MessageEvent) => {
    const data = event.data as { type?: string; kind?: ScheduledTimerKind; tag?: string } | null
    if (!data?.type) return
    if (data.type === 'TIMER_FIRED') {
      onTimerFired(data as TimerFiredPayload)
      return
    }
    if (data.type === 'OPEN_FROM_NOTIFICATION') {
      onTimerFired()
    }
  }

  navigator.serviceWorker.addEventListener('message', handler)

  let channel: BroadcastChannel | null = null
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(TIMER_BROADCAST_CHANNEL)
    channel.onmessage = (event) => {
      onTimerFired(event.data as TimerFiredPayload)
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

if (typeof window !== 'undefined') {
  ensureBackgroundRuntimeDefault()
}
