import type {
  DailyMoneySpendRecord,
  MoneySpendEntry,
  MoneySpendSnapshot,
  MoneyWalletState,
} from '../types/moneySpend'
import {
  DAILY_MONEY_SPEND_STORAGE_KEY,
  MONEY_BASE_BALANCE,
  MONEY_DAILY_INCREMENT,
  MONEY_WALLET_STORAGE_KEY,
} from '../types/moneySpend'
import { DAILY_STARS_START_DATE } from '../types/dailyStars'
import { getTodayKey } from './scheduleStorage'
import { shouldTrackStatistics } from './pausePeriod'
import { logMoneySpendSubmit } from './activityLog'

function daysBetween(fromDate: string, toDate: string) {
  const [fy, fm, fd] = fromDate.split('-').map(Number)
  const [ty, tm, td] = toDate.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(ty, tm - 1, td)
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000))
}

function createEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadWalletRaw(): MoneyWalletState {
  try {
    const raw = localStorage.getItem(MONEY_WALLET_STORAGE_KEY)
    if (!raw) {
      return { lastAccrualDate: null, balance: MONEY_BASE_BALANCE }
    }
    const data = JSON.parse(raw) as MoneyWalletState
    return {
      lastAccrualDate: data.lastAccrualDate ?? null,
      balance: typeof data.balance === 'number' ? data.balance : MONEY_BASE_BALANCE,
    }
  } catch {
    return { lastAccrualDate: null, balance: MONEY_BASE_BALANCE }
  }
}

function saveWallet(state: MoneyWalletState) {
  localStorage.setItem(MONEY_WALLET_STORAGE_KEY, JSON.stringify(state))
}

export function syncMoneyWallet(targetDate = getTodayKey()) {
  if (targetDate < DAILY_STARS_START_DATE) return loadWalletRaw()

  const wallet = loadWalletRaw()
  if (!wallet.lastAccrualDate) {
    wallet.lastAccrualDate = targetDate
    wallet.balance = MONEY_BASE_BALANCE
    saveWallet(wallet)
    return wallet
  }

  if (wallet.lastAccrualDate >= targetDate) return wallet

  const elapsedDays = daysBetween(wallet.lastAccrualDate, targetDate)
  if (elapsedDays > 0) {
    wallet.balance += elapsedDays * MONEY_DAILY_INCREMENT
    wallet.lastAccrualDate = targetDate
    saveWallet(wallet)
  }

  return wallet
}

export function getMoneyWalletBalance(targetDate = getTodayKey()) {
  return syncMoneyWallet(targetDate).balance
}

function createEmptySpendRecord(date = getTodayKey()): DailyMoneySpendRecord {
  return {
    date,
    hasSpending: false,
    spent: null,
    entries: [],
    noSpendConfirmed: false,
    submitted: false,
    walletBalanceAfterSubmit: null,
  }
}

function sumEntryAmounts(entries: MoneySpendEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.amount, 0)
}

function normalizeSpendRecord(data: Partial<DailyMoneySpendRecord>, date: string): DailyMoneySpendRecord {
  const entries = Array.isArray(data.entries) ? data.entries : []
  const migratedEntries =
    entries.length === 0 && data.submitted && data.hasSpending && typeof data.spent === 'number'
      ? [{ id: createEntryId(), amount: data.spent, submittedAt: Date.now() }]
      : entries
  const spent = migratedEntries.length > 0 ? sumEntryAmounts(migratedEntries) : data.spent ?? null

  return {
    date,
    hasSpending: migratedEntries.length > 0 ? true : !!data.hasSpending,
    spent,
    entries: migratedEntries,
    noSpendConfirmed: !!data.noSpendConfirmed && migratedEntries.length === 0,
    submitted: !!data.submitted || migratedEntries.length > 0 || !!data.noSpendConfirmed,
    walletBalanceAfterSubmit:
      typeof data.walletBalanceAfterSubmit === 'number' ? data.walletBalanceAfterSubmit : null,
  }
}

function loadTodaySpendRaw(): DailyMoneySpendRecord {
  try {
    const raw = localStorage.getItem(DAILY_MONEY_SPEND_STORAGE_KEY)
    if (!raw) return createEmptySpendRecord()
    const data = JSON.parse(raw) as DailyMoneySpendRecord
    if (data.date !== getTodayKey()) return createEmptySpendRecord()
    return normalizeSpendRecord(data, getTodayKey())
  } catch {
    return createEmptySpendRecord()
  }
}

function saveTodaySpend(record: DailyMoneySpendRecord) {
  localStorage.setItem(DAILY_MONEY_SPEND_STORAGE_KEY, JSON.stringify(record))
}

export function loadTodayMoneySpend() {
  syncMoneyWallet()
  return loadTodaySpendRaw()
}

export function readMoneySpendForDate(date: string): DailyMoneySpendRecord {
  try {
    const raw = localStorage.getItem(DAILY_MONEY_SPEND_STORAGE_KEY)
    if (!raw) return createEmptySpendRecord(date)
    const data = JSON.parse(raw) as DailyMoneySpendRecord
    if (data.date !== date) return createEmptySpendRecord(date)
    return normalizeSpendRecord(data, date)
  } catch {
    return createEmptySpendRecord(date)
  }
}

/** 追加一笔消费；可一天内多次提交，金额累加 */
export function submitTodayMoneySpend(hasSpending: boolean, spentInput: number) {
  if (!shouldTrackStatistics()) return false
  syncMoneyWallet()
  const wallet = loadWalletRaw()
  const record = loadTodaySpendRaw()

  if (hasSpending) {
    const amount = Math.max(0, Math.round(spentInput))
    if (amount <= 0) return false

    wallet.balance = Math.max(0, wallet.balance - amount)
    const entry: MoneySpendEntry = {
      id: createEntryId(),
      amount,
      submittedAt: Date.now(),
    }
    const entries = [...record.entries, entry]
    const spent = sumEntryAmounts(entries)

    saveWallet(wallet)
    saveTodaySpend({
      date: getTodayKey(),
      hasSpending: true,
      spent,
      entries,
      noSpendConfirmed: false,
      submitted: true,
      walletBalanceAfterSubmit: wallet.balance,
    })

    try {
      logMoneySpendSubmit(true, amount, spent)
    } catch {
      // 日志写入失败不影响消费提交
    }
    return true
  }

  if (record.entries.length > 0) return false

  saveTodaySpend({
    date: getTodayKey(),
    hasSpending: false,
    spent: 0,
    entries: [],
    noSpendConfirmed: true,
    submitted: true,
    walletBalanceAfterSubmit: wallet.balance,
  })

  try {
    logMoneySpendSubmit(false, 0, 0)
  } catch {
    // 日志写入失败不影响消费提交
  }
  return true
}

export function buildMoneySpendSnapshot(
  date: string,
  record: DailyMoneySpendRecord,
): MoneySpendSnapshot {
  syncMoneyWallet(date)
  const wallet = loadWalletRaw()
  const normalized = normalizeSpendRecord(record, date)
  const spent = normalized.spent ?? 0
  const walletBalance =
    normalized.walletBalanceAfterSubmit ??
    (normalized.submitted ? wallet.balance : syncMoneyWallet(date).balance)
  return {
    walletBalance,
    dailyIncrement: MONEY_DAILY_INCREMENT,
    hasSpending: spent > 0,
    spent,
    submitted: normalized.submitted,
  }
}

export function getTodayMoneySpendSnapshot(): MoneySpendSnapshot {
  const record = loadTodayMoneySpend()
  return buildMoneySpendSnapshot(getTodayKey(), record)
}

export function resetMoneySpendForToday(today = getTodayKey()) {
  saveTodaySpend(createEmptySpendRecord(today))
}

export function formatMoneyAmount(amount: number) {
  return `${Math.round(amount)} 元`
}

export function formatMoneyEntryTime(timestamp: number) {
  const date = new Date(timestamp)
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}
