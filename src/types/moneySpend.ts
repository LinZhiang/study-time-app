export const MONEY_BASE_BALANCE = 300
export const MONEY_DAILY_INCREMENT = 50
export const DAILY_MONEY_SPEND_STORAGE_KEY = 'daily-money-spend'
export const MONEY_WALLET_STORAGE_KEY = 'money-wallet'

export interface MoneyWalletState {
  lastAccrualDate: string | null
  balance: number
}

export interface MoneySpendEntry {
  id: string
  amount: number
  submittedAt: number
}

export interface DailyMoneySpendRecord {
  date: string
  hasSpending: boolean
  spent: number | null
  entries: MoneySpendEntry[]
  noSpendConfirmed: boolean
  submitted: boolean
  walletBalanceAfterSubmit: number | null
}

export interface MoneySpendSnapshot {
  walletBalance: number
  dailyIncrement: number
  hasSpending: boolean
  spent: number
  submitted: boolean
}
