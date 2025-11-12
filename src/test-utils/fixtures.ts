import * as Trade from "../domain/Trade"
import * as Statistics from "../domain/Statistics"
import * as Indicator from "../domain/Indicator"
import * as DateTime from "effect/DateTime"

/**
 * Helper functions for creating branded types in tests.
 * Uses the old Brand constructors for backwards compatibility.
 *
 * @category Test Helpers
 * @since 1.0.0
 */

/**
 * Create a branded Symbol for tests (unsafe).
 *
 * @example
 * const symbol = makeSymbol("AAPL")
 */
export const makeSymbol = (value: string): Trade.Symbol => Trade.Symbol(value)

/**
 * Create a branded Price for tests (unsafe).
 *
 * @example
 * const price = makePrice(150.0)
 */
export const makePrice = (value: number): Trade.Price => Trade.Price(value)

/**
 * Create a branded Volume for tests (unsafe).
 *
 * @example
 * const volume = makeVolume(1000)
 */
export const makeVolume = (value: number): Trade.Volume => Trade.Volume(value)

/**
 * Create a branded Timestamp for tests (unsafe).
 *
 * @example
 * const timestamp = makeTimestamp(Date.now())
 */
export const makeTimestamp = (value: number): Trade.Timestamp => Trade.Timestamp(value)

/**
 * Create a branded Latency for tests (unsafe).
 *
 * @example
 * const latency = makeLatency(42)
 */
export const makeLatency = (value: number): Trade.Latency => Trade.Latency(value)

/**
 * Create a branded WindowSize for tests (unsafe).
 *
 * @example
 * const size = makeWindowSize(20)
 */
export const makeWindowSize = (value: number): Statistics.WindowSize =>
  Statistics.WindowSize(value)

/**
 * Create a branded TimeWindow for tests (unsafe).
 *
 * @example
 * const window = makeTimeWindow(30_000)
 */
export const makeTimeWindow = (value: number): Statistics.TimeWindow =>
  Statistics.TimeWindow(value)

/**
 * Create a mock trade with optional overrides.
 * Uses branded types for compatibility.
 *
 * @example
 * const trade = mockTrade({ price: 150.0, symbol: "AAPL" })
 */
export const mockTrade = (
  overrides?: Partial<Omit<Trade.TradeData, "conditions">> & {
    conditions?: readonly string[]
  }
): Trade.TradeData => {
  const now = Date.now()
  return {
    symbol: makeSymbol(overrides?.symbol ?? "AAPL"),
    price: makePrice(overrides?.price ?? 150.0),
    volume: makeVolume(overrides?.volume ?? 100),
    timestamp: makeTimestamp(overrides?.timestamp ?? now),
    receivedAt: makeTimestamp(overrides?.receivedAt ?? now + 5),
    latency: makeLatency(overrides?.latency ?? 5),
    conditions: overrides?.conditions,
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
      price: makePrice(basePrice + i),
      timestamp: makeTimestamp(now),
      receivedAt: makeTimestamp(now + 5),
      volume: makeVolume(100 + i * 10),
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
      price: makePrice(price),
      timestamp: makeTimestamp(now),
      receivedAt: makeTimestamp(now + 5),
    })
  })

/**
 * Create a mock Stats instance with specific prices.
 *
 * @example
 * const stats = mockStats([150, 151, 152])
 */
export const mockStats = (
  prices: number[],
  windowConfig?: Statistics.WindowConfig
): Statistics.Stats => {
  let stats = Statistics.emptyStats(windowConfig)
  const baseTime = Date.now()

  prices.forEach((price, i) => {
    stats = Statistics.updateStats(stats, price, 100, baseTime + i * 1000)
  })

  return stats
}

/**
 * Create a mock EventBased window config for tests.
 *
 * @example
 * const config = mockEventBasedConfig(20)
 */
export const mockEventBasedConfig = (size: number): Statistics.WindowConfig => ({
  _tag: "EventBased",
  size,
})

/**
 * Create a mock TimeBased window config for tests.
 *
 * @example
 * const config = mockTimeBasedConfig(30_000)
 */
export const mockTimeBasedConfig = (durationMs: number): Statistics.WindowConfig => ({
  _tag: "TimeBased",
  durationMs,
})

/**
 * Create a mock Hybrid window config for tests.
 *
 * @example
 * const config = mockHybridConfig(20, 30_000)
 */
export const mockHybridConfig = (size: number, durationMs: number): Statistics.WindowConfig => ({
  _tag: "Hybrid",
  size,
  durationMs,
})

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
