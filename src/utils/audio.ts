/**
 * 音效加载说明：
 * - 不使用 .wav 直链，避免 IDM 等下载工具拦截 HTTP 请求
 * - 通过 fetch 加载 .dat，转成 Blob URL 再播放
 * - 首次点击页面时预加载，之后计时器触发播放不再发起新 HTTP 请求
 */
import { ref } from 'vue'
import { isTodayPaused } from './pausePeriod'
const soundFiles = {
  start: 'audio/start.dat',
  classStart: 'audio/class-start.dat',
  classEnd: 'audio/class-end.dat',
  pomodoroClassEnd: 'audio/pomodoro-class-end.dat',
  timeUp: 'audio/time-up.dat',
} as const

export type SoundKey = keyof typeof soundFiles

export const sounds = {
  start: 'start' as SoundKey,
  classStart: 'classStart' as SoundKey,
  classEnd: 'classEnd' as SoundKey,
  pomodoroClassEnd: 'pomodoroClassEnd' as SoundKey,
  timeUp: 'timeUp' as SoundKey,
}

const blobUrls = new Map<SoundKey, string>()

let preloadPromise: Promise<void> | null = null
let audioUnlocked = false
/** 供界面提示「需先点击启用音效」 */
export const audioUnlockedRef = ref(false)
let suppressClassSounds = false
let suppressTimer: ReturnType<typeof setTimeout> | null = null

/** 先加载短音效，最后加载约 7MB 的模式切换铃 */
const preloadOrder: SoundKey[] = ['start', 'pomodoroClassEnd', 'classEnd', 'classStart', 'timeUp']

function resolveAssetPath(relativePath: string) {
  const base = import.meta.env.BASE_URL
  return `${base}${relativePath}`
}

async function fetchSoundBlob(key: SoundKey) {
  const path = resolveAssetPath(soundFiles[key])
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`加载音效失败: ${path} (${response.status})`)
  }
  const buffer = await response.arrayBuffer()
  return new Blob([buffer], { type: 'audio/wav' })
}

async function loadSound(key: SoundKey) {
  if (blobUrls.has(key)) return
  const blob = await fetchSoundBlob(key)
  blobUrls.set(key, URL.createObjectURL(blob))
}

async function preloadAllSounds() {
  await loadSound('start')
  await loadSound('pomodoroClassEnd')
  await loadSound('classEnd')
  await loadSound('classStart')
  await loadSound('timeUp')
}

export function ensureSoundsLoaded() {
  if (!preloadPromise) {
    preloadPromise = preloadAllSounds().catch((error) => {
      preloadPromise = null
      console.warn('[audio] 预加载失败:', error)
      throw error
    })
  }
  return preloadPromise
}

/**
 * 在用户点击时调用（同步入口），启动预加载并标记已解锁。
 */
export function unlockAudio() {
  if (!audioUnlocked) {
    audioUnlocked = true
    audioUnlockedRef.value = true
    void ensureSoundsLoaded()
  }
}

export function isAudioUnlocked() {
  return audioUnlocked
}

export function isSoundLoaded(key: SoundKey) {
  return blobUrls.has(key)
}

export function areAllSoundsLoaded() {
  return preloadOrder.every((key) => blobUrls.has(key))
}

function playKey(key: SoundKey, volume = 1) {
  if (!audioUnlocked) {
    console.warn('[audio] 请先点击页面任意位置以加载音效')
    return
  }

  const tryPlay = () => {
    const url = blobUrls.get(key)
    if (!url) return false
    const audio = new Audio(url)
    audio.volume = volume
    void audio.play().catch((error) => {
      console.warn('[audio] 播放失败:', key, error.message)
    })
    return true
  }

  if (tryPlay()) return

  void ensureSoundsLoaded()?.then(() => {
    tryPlay()
  })
}

function shouldPlayAlertSounds() {
  return !isTodayPaused()
}

export function playModeSwitchSound() {
  if (!shouldPlayAlertSounds()) return
  if (!audioUnlocked) return
  if (suppressTimer) clearTimeout(suppressTimer)
  suppressClassSounds = true
  playKey('timeUp')
  suppressTimer = setTimeout(() => {
    suppressClassSounds = false
    suppressTimer = null
  }, 3000)
}

export function playPomodoroSound(key: SoundKey) {
  if (!shouldPlayAlertSounds()) return
  if (suppressClassSounds && (key === 'classStart' || key === 'classEnd')) {
    return
  }
  playKey(key)
}

export function playReminderSound() {
  if (!shouldPlayAlertSounds()) return
  playKey('start')
}

/** 锻炼、劳动、休整等活动模式切换（pomodoro-class-end.wav） */
export function playActivitySwitchSound() {
  if (!shouldPlayAlertSounds()) return
  playKey('pomodoroClassEnd')
}

export function playTimeUpSound() {
  if (!shouldPlayAlertSounds()) return
  playKey('timeUp')
}

export function setupGlobalAudioUnlock() {
  const handler = () => {
    unlockAudio()
  }
  document.addEventListener('pointerdown', handler, { once: true, passive: true })
  document.addEventListener('keydown', handler, { once: true })
}
