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

precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

let timerJob: TimerJob | null = null
let checkId: ReturnType<typeof setInterval> | null = null

async function notifyClients(data: unknown) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage(data)
  }
}

async function showTimerNotification(job: TimerJob) {
  await self.registration.showNotification(job.title, {
    body: job.body,
    tag: job.tag,
    icon: '/study-icon.svg',
    badge: '/study-icon.svg',
    data: { url: '/' },
  })
}

async function fireTimer(job: TimerJob) {
  await showTimerNotification(job)
  await notifyClients({ type: 'TIMER_FIRED', tag: job.tag })
}

function stopCheckLoop() {
  if (checkId !== null) {
    clearInterval(checkId)
    checkId = null
  }
}

function startCheckLoop() {
  if (checkId !== null) return
  checkId = setInterval(() => {
    if (!timerJob) {
      stopCheckLoop()
      return
    }
    if (Date.now() >= timerJob.deadlineAt) {
      const job = timerJob
      timerJob = null
      stopCheckLoop()
      void fireTimer(job)
    }
  }, 1000)
}

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; job?: TimerJob } | null
  if (!data?.type) return

  if (data.type === 'SCHEDULE_TIMER' && data.job) {
    timerJob = data.job
    if (Date.now() >= timerJob.deadlineAt) {
      const job = timerJob
      timerJob = null
      stopCheckLoop()
      void fireTimer(job)
      return
    }
    startCheckLoop()
  }

  if (data.type === 'CLEAR_TIMER') {
    timerJob = null
    stopCheckLoop()
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
      const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
      await self.clients.openWindow(url)
    })(),
  )
})
