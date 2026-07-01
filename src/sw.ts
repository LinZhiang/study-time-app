/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

interface TimerJob {
  deadlineAt: number
  title: string
  body: string
  tag: string
}

const TIMER_CACHE = 'study-timer-v1'
const TIMER_CACHE_KEY = 'https://study-time-app.local/timer-job'

precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

let timerJob: TimerJob | null = null
let checkId: ReturnType<typeof setInterval> | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null

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

async function persistTimerJob(job: TimerJob | null) {
  const cache = await caches.open(TIMER_CACHE)
  if (!job) {
    await cache.delete(TIMER_CACHE_KEY)
    return
  }
  await cache.put(TIMER_CACHE_KEY, new Response(JSON.stringify(job), {
    headers: { 'Content-Type': 'application/json' },
  }))
}

async function loadPersistedTimerJob(): Promise<TimerJob | null> {
  try {
    const cache = await caches.open(TIMER_CACHE)
    const response = await cache.match(TIMER_CACHE_KEY)
    if (!response) return null
    const data = JSON.parse(await response.text()) as TimerJob
    if (!data?.deadlineAt) return null
    return data
  } catch {
    return null
  }
}

async function showTimerNotification(job: TimerJob) {
  await self.registration.showNotification(job.title, {
    body: job.body,
    tag: job.tag,
    icon: '/study-icon.svg',
    badge: '/study-icon.svg',
    data: { url: '/time' },
  })
}

async function fireTimer(job: TimerJob) {
  await persistTimerJob(null)
  await showTimerNotification(job)
  await notifyClients({ type: 'TIMER_FIRED', tag: job.tag })
  getTimerChannel()?.postMessage({ type: 'TIMER_FIRED', tag: job.tag })
}

function stopCheckLoop() {
  if (checkId !== null) {
    clearInterval(checkId)
    checkId = null
  }
}

function clearTimerSchedule() {
  stopCheckLoop()
  if (timeoutId !== null) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

function startCheckLoop() {
  if (checkId !== null) return
  checkId = setInterval(() => {
    if (!timerJob) {
      clearTimerSchedule()
      return
    }
    if (Date.now() >= timerJob.deadlineAt) {
      const job = timerJob
      timerJob = null
      clearTimerSchedule()
      void fireTimer(job)
    }
  }, 1000)
}

function scheduleTimer(job: TimerJob) {
  clearTimerSchedule()
  timerJob = job
  void persistTimerJob(job)

  const delay = Math.max(0, job.deadlineAt - Date.now())
  if (delay === 0) {
    timerJob = null
    void fireTimer(job)
    return
  }

  timeoutId = setTimeout(() => {
    timeoutId = null
    if (!timerJob) return
    if (Date.now() >= timerJob.deadlineAt) {
      const current = timerJob
      timerJob = null
      clearTimerSchedule()
      void fireTimer(current)
    }
  }, Math.min(delay, 2_147_483_647))

  startCheckLoop()
}

async function resumePersistedTimer() {
  const persisted = await loadPersistedTimerJob()
  if (!persisted) return

  if (Date.now() >= persisted.deadlineAt) {
    timerJob = null
    clearTimerSchedule()
    await fireTimer(persisted)
    return
  }

  scheduleTimer(persisted)
}

self.addEventListener('activate', (event) => {
  event.waitUntil(resumePersistedTimer())
})

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; job?: TimerJob } | null
  if (!data?.type) return

  if (data.type === 'SCHEDULE_TIMER' && data.job) {
    scheduleTimer(data.job)
    return
  }

  if (data.type === 'CLEAR_TIMER') {
    timerJob = null
    clearTimerSchedule()
    void persistTimerJob(null)
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
