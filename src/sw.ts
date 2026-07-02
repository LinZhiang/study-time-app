/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

interface TimerJob {
  deadlineAt: number
  title: string
  body: string
  tag: string
  kind?: string
}

const TIMER_CACHE = 'study-timer-v1'
const TIMER_CACHE_KEY = 'https://study-time-app.local/timer-jobs'

precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

let timerJobs: TimerJob[] = []
let checkId: ReturnType<typeof setInterval> | null = null
const timeoutIds = new Map<string, ReturnType<typeof setTimeout>>()

function getTimerChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel('study-time-timer')
}

async function notifyClients(data: unknown) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage(data)
  }
}

async function persistTimerJobs(jobs: TimerJob[]) {
  const cache = await caches.open(TIMER_CACHE)
  if (jobs.length === 0) {
    await cache.delete(TIMER_CACHE_KEY)
    return
  }
  await cache.put(
    TIMER_CACHE_KEY,
    new Response(JSON.stringify(jobs), {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

async function loadPersistedTimerJobs(): Promise<TimerJob[]> {
  try {
    const cache = await caches.open(TIMER_CACHE)
    const response = await cache.match(TIMER_CACHE_KEY)
    if (!response) return []
    const data = JSON.parse(await response.text()) as TimerJob | TimerJob[]
    const list = Array.isArray(data) ? data : [data]
    return list.filter((job) => Boolean(job?.deadlineAt && job?.tag))
  } catch {
    return []
  }
}

function isImportantJob(kind?: string) {
  return (
    kind === 'countdown' ||
    kind === 'morning_start' ||
    kind === 'force_rest' ||
    kind === 'mid_break_end' ||
    kind === 'free_hour_prompt'
  )
}

async function showTimerNotification(job: TimerJob) {
  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: job.body,
    tag: job.tag,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [180, 90, 180],
    requireInteraction: isImportantJob(job.kind),
    silent: false,
    renotify: true,
    data: { url: '/time', kind: job.kind, tag: job.tag },
  }
  await self.registration.showNotification(job.title, options)
}

async function fireTimer(job: TimerJob) {
  timerJobs = timerJobs.filter((item) => item.tag !== job.tag)
  clearJobTimeout(job.tag)
  await persistTimerJobs(timerJobs)
  await showTimerNotification(job)
  const payload = { type: 'TIMER_FIRED', kind: job.kind, tag: job.tag }
  await notifyClients(payload)
  getTimerChannel()?.postMessage(payload)
}

function clearJobTimeout(tag: string) {
  const timeoutId = timeoutIds.get(tag)
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId)
    timeoutIds.delete(tag)
  }
}

function stopCheckLoop() {
  if (checkId !== null) {
    clearInterval(checkId)
    checkId = null
  }
}

function clearAllTimeouts() {
  for (const tag of timeoutIds.keys()) {
    clearJobTimeout(tag)
  }
}

function clearTimerSchedule() {
  stopCheckLoop()
  clearAllTimeouts()
}

function scheduleJobTimeout(job: TimerJob) {
  clearJobTimeout(job.tag)
  const delay = Math.max(0, job.deadlineAt - Date.now())
  if (delay === 0) {
    void fireTimer(job)
    return
  }

  const timeoutId = setTimeout(() => {
    timeoutIds.delete(job.tag)
    const current = timerJobs.find((item) => item.tag === job.tag)
    if (!current) return
    if (Date.now() >= current.deadlineAt) {
      void fireTimer(current)
    }
  }, Math.min(delay, 2_147_483_647))

  timeoutIds.set(job.tag, timeoutId)
}

function startCheckLoop() {
  if (checkId !== null) return
  checkId = setInterval(() => {
    if (timerJobs.length === 0) {
      clearTimerSchedule()
      return
    }

    const dueJobs = timerJobs.filter((job) => Date.now() >= job.deadlineAt)
    if (dueJobs.length === 0) return

    for (const job of dueJobs) {
      void fireTimer(job)
    }
  }, 1000)
}

function scheduleTimers(jobs: TimerJob[]) {
  clearTimerSchedule()
  const now = Date.now()
  timerJobs = jobs
    .filter((job) => job.deadlineAt > now)
    .sort((a, b) => a.deadlineAt - b.deadlineAt)

  void persistTimerJobs(timerJobs)

  for (const job of timerJobs) {
    scheduleJobTimeout(job)
  }

  if (timerJobs.length > 0) {
    startCheckLoop()
  }
}

async function resumePersistedTimers() {
  const persisted = await loadPersistedTimerJobs()
  if (persisted.length === 0) return

  const now = Date.now()
  const overdue = persisted.filter((job) => job.deadlineAt <= now)
  const upcoming = persisted.filter((job) => job.deadlineAt > now)

  for (const job of overdue.sort((a, b) => a.deadlineAt - b.deadlineAt)) {
    await fireTimer(job)
  }

  if (upcoming.length > 0) {
    scheduleTimers(upcoming)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(resumePersistedTimers())
})

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; job?: TimerJob; jobs?: TimerJob[] } | null
  if (!data?.type) return

  if (data.type === 'SCHEDULE_TIMERS' && Array.isArray(data.jobs)) {
    scheduleTimers(data.jobs)
    return
  }

  if (data.type === 'SCHEDULE_TIMER' && data.job) {
    scheduleTimers([data.job])
    return
  }

  if (data.type === 'CLEAR_TIMERS' || data.type === 'CLEAR_TIMER') {
    timerJobs = []
    clearTimerSchedule()
    void persistTimerJobs([])
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        await client.focus()
        client.postMessage({ type: 'OPEN_FROM_NOTIFICATION' })
        return
      }
      const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/time'
      const opened = await self.clients.openWindow(url)
      if (opened) {
        opened.postMessage({ type: 'OPEN_FROM_NOTIFICATION' })
      }
    })(),
  )
})
