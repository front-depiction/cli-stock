import * as Trade from "../domain/Trade"
import * as Statistics from "../domain/Statistics"
import * as Indicator from "../domain/Indicator"
import * as DateTime from "effect/DateTime"

/**
 * Create a mock trade with optional overrides.
 *
 * @example
 * const trade = mockTrade({ price: 150.0, symbol: "AAPL" })
 */
export const mockTrade = (overrides?: Partial<Trade.TradeData>): Trade.TradeData => {
  const now = Date.now()
  return {
    symbol: "AAPL",
    price: 150.0,
    volume: 100,
    timestamp: now,
    receivedAt: now + 5,
    latency: 5,
    conditions: [],
    ...overrides,
  }
}

/**
 * Create multiple mock trades with incremental prices.
 *
 * @example
 * const trades = mockTrades(10) // 10 trades with prices 150, 151, 152, ...
 */
export const mockTrades = (count: number, basePrice = 150.0): Trade.TradeData[] =>
  Array.from({ length: count }, (_, i) => {
    const now = Date.now() + i * 1000 // 1 second apart
    return mockTrade({
      price: basePrice + i,
      timestamp: now,
      receivedAt: now + 5,
      volume: 100 + i * 10,
    })
  })

/**
 * Create mock trades with specific prices.
 *
 * @example
 * const trades = mockTradesWithPrices([150, 155, 152, 160])
 */
export const mockTradesWithPrices = (prices: number[]): Trade.TradeData[] =>
  prices.map((price, i) => {
    const now = Date.now() + i * 1000
    return mockTrade({
      price,
      timestamp: now,
      receivedAt: now + 5,
    })
  })

/**
 * Create a mock Stats instance with specific prices.
 *
 * @example
 * const stats = mockStats([150, 151, 152])
 */
export const mockStats = (prices: number[]): Statistics.Stats => {
  let stats = Statistics.emptyStats()
  const baseTime = Date.now()

  prices.forEach((price, i) => {
    stats = Statistics.updateStats(stats, price, 100, baseTime + i * 1000)
  })

  return stats
}

/**
 * Create a mock IndicatorState.
 *
 * @example
 * const state = mockIndicatorState({ value: 45.2, name: "RSI" })
 */
export const mockIndicatorState = (
  overrides?: Partial<Indicator.IndicatorState>
): Indicator.IndicatorState => ({
  id: "test-indicator",
  name: "Test Indicator",
  symbol: "AAPL",
  lastUpdate: DateTime.unsafeNow(),
  value: 50.0,
  metadata: {},
  ...overrides,
})

/**
 * Create a mock Buy signal.
 *
 * @example
 * const signal = mockBuySignal({ strength: 0.8 })
 */
export const mockBuySignal = (overrides?: Partial<Indicator.Buy>): Indicator.Buy => ({
  _tag: "buy" as const,
  strength: 0.8,
  timestamp: DateTime.unsafeNow(),
  reason: "Test buy signal",
  ...overrides,
})

/**
 * Create a mock Sell signal.
 *
 * @example
 * const signal = mockSellSignal({ strength: 0.9 })
 */
export const mockSellSignal = (overrides?: Partial<Indicator.Sell>): Indicator.Sell => ({
  _tag: "sell" as const,
  strength: 0.9,
  timestamp: DateTime.unsafeNow(),
  reason: "Test sell signal",
  ...overrides,
})

/**
 * Create a mock Hold signal.
 *
 * @example
 * const signal = mockHoldSignal()
 */
export const mockHoldSignal = (overrides?: Partial<Indicator.Hold>): Indicator.Hold => ({
  _tag: "hold" as const,
  timestamp: DateTime.unsafeNow(),
  ...overrides,
})
