import * as Schema from "effect/Schema"
import { ParseError } from "effect/ParseResult"
import * as Brand from "effect/Brand"
import * as Equivalence from "effect/Equivalence"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Duration from "effect/Duration"

/**
 * Duration constant for one trading year (252 trading days).
 * Used for annualizing financial metrics like volatility.
 *
 * @category Constants
 * @since 0.3.0
 */
const TRADING_YEAR_MS = Duration.toMillis(Duration.days(252))

/**
 * Branded type for sliding window size (event-based).
 *
 * @category Brands
 * @since 0.1.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const windowSize = Statistics.WindowSize.make(20)
 */
export type WindowSize = number & Brand.Brand<"WindowSize">

/**
 * Brand for WindowSize.
 *
 * @category Brands
 * @since 0.1.0
 */
export const WindowSize = Brand.refined<WindowSize>(
  (n) => n > 0 && Number.isInteger(n),
  (n) => Brand.error(`WindowSize must be a positive integer, got ${n}`)
)

/**
 * Branded type for time window duration in milliseconds.
 *
 * @category Brands
 * @since 0.2.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const window = Statistics.TimeWindow.make(30_000) // 30 seconds
 */
export type TimeWindow = number & Brand.Brand<"TimeWindow">

/**
 * Brand for TimeWindow.
 *
 * @category Brands
 * @since 0.2.0
 */
export const TimeWindow = Brand.refined<TimeWindow>(
  (n) => n > 0,
  (n) => Brand.error(`TimeWindow must be positive, got ${n}`)
)

/**
 * Event-based window variant (Schema-based).
 *
 * @category Schemas
 * @since 0.4.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 * import * as Effect from "effect/Effect"
 *
 * const config = yield* Statistics.makeEventBased(20)
 */
export const EventBased = Schema.TaggedStruct("EventBased", {
  size: Schema.Number.pipe(
    Schema.int({ message: () => "Window size must be an integer" }),
    Schema.positive({ message: () => "Window size must be positive" }),
    Schema.brand("WindowSize")
  ),
})

/**
 * Type for EventBased window configuration.
 *
 * @category Types
 * @since 0.4.0
 */
export type EventBased = Schema.Schema.Type<typeof EventBased>

/**
 * Time-based window variant (Schema-based).
 *
 * @category Schemas
 * @since 0.4.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 * import * as Effect from "effect/Effect"
 *
 * const config = yield* Statistics.makeTimeBased(30_000)
 */
export const TimeBased = Schema.TaggedStruct("TimeBased", {
  durationMs: Schema.Number.pipe(
    Schema.positive({ message: () => "Duration must be positive" }),
    Schema.brand("TimeWindow")
  ),
})

/**
 * Type for TimeBased window configuration.
 *
 * @category Types
 * @since 0.4.0
 */
export type TimeBased = Schema.Schema.Type<typeof TimeBased>

/**
 * Hybrid window variant (combines event and time constraints).
 *
 * @category Schemas
 * @since 0.4.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 * import * as Effect from "effect/Effect"
 *
 * const config = yield* Statistics.makeHybrid(20, 30_000)
 */
export const Hybrid = Schema.TaggedStruct("Hybrid", {
  size: Schema.Number.pipe(
    Schema.int({ message: () => "Window size must be an integer" }),
    Schema.positive({ message: () => "Window size must be positive" }),
    Schema.brand("WindowSize")
  ),
  durationMs: Schema.Number.pipe(
    Schema.positive({ message: () => "Duration must be positive" }),
    Schema.brand("TimeWindow")
  ),
})

/**
 * Type for Hybrid window configuration.
 *
 * @category Types
 * @since 0.4.0
 */
export type Hybrid = Schema.Schema.Type<typeof Hybrid>

/**
 * WindowConfig discriminated union (Schema-based).
 *
 * @category Schemas
 * @since 0.4.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 * import * as Schema from "effect/Schema"
 *
 * const config: Statistics.WindowConfig = { _tag: "EventBased", size: 20 }
 * const validated = yield* Schema.decode(Statistics.WindowConfig)(config)
 */
export const WindowConfigSchema = Schema.Union(EventBased, TimeBased, Hybrid)

/**
 * Window configuration for statistics computation.
 *
 * @category Configuration
 * @since 0.2.0
 * @remarks
 * This type is compatible with both the legacy plain union type and the new schema-based type.
 * The schema types are branded, but structurally compatible for backward compatibility.
 */
export type WindowConfig =
  | { readonly _tag: "EventBased"; readonly size: number }
  | { readonly _tag: "TimeBased"; readonly durationMs: number }
  | {
      readonly _tag: "Hybrid"
      readonly size: number
      readonly durationMs: number
    }

/**
 * Smart constructor for EventBased window configuration with validation.
 *
 * @category Constructors
 * @since 0.4.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* Statistics.makeEventBased(20)
 *   const stats = Statistics.emptyStats(config)
 * })
 */
export const makeEventBased = (size: number): Effect.Effect<EventBased, ParseError> =>
  Schema.decode(EventBased)({ _tag: "EventBased", size })

/**
 * Smart constructor for TimeBased window configuration with validation.
 *
 * @category Constructors
 * @since 0.4.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* Statistics.makeTimeBased(30_000)
 *   const stats = Statistics.emptyStats(config)
 * })
 */
export const makeTimeBased = (durationMs: number): Effect.Effect<TimeBased, ParseError> =>
  Schema.decode(TimeBased)({ _tag: "TimeBased", durationMs })

/**
 * Smart constructor for Hybrid window configuration with validation.
 *
 * @category Constructors
 * @since 0.4.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* Statistics.makeHybrid(20, 30_000)
 *   const stats = Statistics.emptyStats(config)
 * })
 */
export const makeHybrid = (
  size: number,
  durationMs: number
): Effect.Effect<Hybrid, ParseError> =>
  Schema.decode(Hybrid)({ _tag: "Hybrid", size, durationMs })

/**
 * Pattern match on WindowConfig.
 *
 * @category Pattern Matching
 * @since 0.4.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const description = Statistics.matchWindowConfig(config, {
 *   EventBased: (config) => `Event-based: ${config.size} events`,
 *   TimeBased: (config) => `Time-based: ${config.durationMs}ms`,
 *   Hybrid: (config) => `Hybrid: ${config.size} events or ${config.durationMs}ms`
 * })
 */
export const matchWindowConfig = <R>(
  self: WindowConfig,
  cases: {
    EventBased: (config: { readonly _tag: "EventBased"; readonly size: number }) => R
    TimeBased: (config: { readonly _tag: "TimeBased"; readonly durationMs: number }) => R
    Hybrid: (config: {
      readonly _tag: "Hybrid"
      readonly size: number
      readonly durationMs: number
    }) => R
  }
): R => {
  switch (self._tag) {
    case "EventBased":
      return cases.EventBased(self)
    case "TimeBased":
      return cases.TimeBased(self)
    case "Hybrid":
      return cases.Hybrid(self)
  }
}

/**
 * Price data point with timestamp for time-based windows.
 *
 * @category Types
 * @since 0.2.0
 */
export interface PricePoint {
  readonly price: number
  readonly volume: number
  readonly timestamp: number
}

/**
 * Enhanced trading metrics computed from price stream.
 *
 * @category Types
 * @since 0.2.0
 */
export interface TradingMetrics {
  readonly volatility: number // Annualized volatility (%)
  readonly momentum: number // Price rate of change (%)
  readonly tradeVelocity: number // Trades per second
  readonly vwap: number // Volume-weighted average price
  readonly spreadApprox: number // Estimated bid-ask spread (%)
}

/**
 * Schema for TradeStatistics containing rolling statistics.
 *
 * @category Schemas
 * @since 0.1.0
 */
export const TradeStatistics = Schema.Struct({
  symbol: Schema.String,
  mean: Schema.Number,
  stdDev: Schema.Number,
  min: Schema.Number,
  max: Schema.Number,
  count: Schema.Number,
  recentPrices: Schema.Array(Schema.Number),
})

/**
 * Type for TradeStatistics.
 *
 * @category Types
 * @since 0.1.0
 */
export type TradeStatistics = Schema.Schema.Type<typeof TradeStatistics>

/**
 * Internal Stats type used for incremental computation.
 *
 * @category Types
 * @since 0.1.0
 */
export interface Stats {
  readonly count: number
  readonly sum: number
  readonly sumSquares: number
  readonly min: number
  readonly max: number
  readonly recentPrices: ReadonlyArray<number>
  readonly pricePoints: ReadonlyArray<PricePoint>
  readonly windowConfig: WindowConfig
  readonly lastUpdateTime: number
}

/**
 * Create an empty Stats instance with event-based window.
 *
 * @category Constructors
 * @since 0.1.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const stats = Statistics.emptyStats()
 */
export const emptyStats = (windowConfig?: WindowConfig): Stats => ({
  count: 0,
  sum: 0,
  sumSquares: 0,
  min: Infinity,
  max: -Infinity,
  recentPrices: [],
  pricePoints: [],
  windowConfig: windowConfig ?? { _tag: "EventBased", size: 20 },
  lastUpdateTime: 0,
})

/**
 * Identity value for Stats.
 *
 * @category Identity
 * @since 0.1.0
 */
export const zero: Stats = emptyStats()

/**
 * Filter price points within time window.
 *
 * @category Utilities
 * @since 0.2.0
 */
const filterByTimeWindow = (
  points: ReadonlyArray<PricePoint>,
  durationMs: number,
  currentTime: number
): ReadonlyArray<PricePoint> => {
  const cutoff = currentTime - durationMs
  return pipe(
    points,
    Array.filter((p) => p.timestamp >= cutoff)
  )
}

/**
 * Update stats with a new price value (enhanced with time-based windows).
 *
 * @category Combinators
 * @since 0.2.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 * import { pipe } from "effect/Function"
 *
 * const updated = pipe(
 *   stats,
 *   Statistics.updateStats(150.25, 1000, Date.now())
 * )
 */
export const updateStats: {
  (price: number, volume: number, timestamp: number): (self: Stats) => Stats
  (self: Stats, price: number, volume: number, timestamp: number): Stats
} = dual(4, (self: Stats, price: number, volume: number, timestamp: number): Stats => {
  const pricePoint: PricePoint = { price, volume, timestamp }
  const newPricePoints = [...self.pricePoints, pricePoint]

  // Apply window configuration
  const { filteredPoints, filteredPrices } = (() => {
    switch (self.windowConfig._tag) {
      case "EventBased":
        const eventFiltered = newPricePoints.slice(-self.windowConfig.size)
        return {
          filteredPoints: eventFiltered,
          filteredPrices: eventFiltered.map((p) => p.price),
        }

      case "TimeBased":
        const timeFiltered = filterByTimeWindow(
          newPricePoints,
          self.windowConfig.durationMs,
          timestamp
        )
        return {
          filteredPoints: timeFiltered,
          filteredPrices: timeFiltered.map((p) => p.price),
        }

      case "Hybrid": {
        const { size, durationMs } = self.windowConfig
        const hybridFiltered = pipe(
          filterByTimeWindow(newPricePoints, durationMs, timestamp),
          (points) => points.slice(-size)
        )
        return {
          filteredPoints: hybridFiltered,
          filteredPrices: hybridFiltered.map((p) => p.price),
        }
      }
    }
  })()

  return {
    count: self.count + 1,
    sum: self.sum + price,
    sumSquares: self.sumSquares + price * price,
    min: Math.min(self.min, price),
    max: Math.max(self.max, price),
    recentPrices: filteredPrices,
    pricePoints: filteredPoints,
    windowConfig: self.windowConfig,
    lastUpdateTime: timestamp,
  }
})

/**
 * Calculate mean from recent prices.
 *
 * @category Destructors
 * @since 0.1.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const mean = Statistics.calculateMean(stats)
 */
export const calculateMean = (stats: Stats): number => {
  const prices = stats.recentPrices
  if (prices.length === 0) return 0
  return pipe(
    prices,
    Array.reduce(0, (sum, p) => sum + p),
    (sum) => sum / prices.length
  )
}

/**
 * Calculate standard deviation from recent prices.
 *
 * @category Destructors
 * @since 0.1.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const stdDev = Statistics.calculateStdDev(stats)
 */
export const calculateStdDev = (stats: Stats): number => {
  const prices = stats.recentPrices
  if (prices.length === 0) return 0
  const mean = calculateMean(stats)
  return pipe(
    prices,
    Array.reduce(0, (sum, p) => sum + Math.pow(p - mean, 2)),
    (sum) => sum / prices.length,
    Math.sqrt
  )
}

/**
 * Calculate annualized volatility (assuming 252 trading days, 6.5 hour trading day).
 *
 * @category Destructors
 * @since 0.2.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const vol = Statistics.calculateVolatility(stats) // Returns as percentage
 */
export const calculateVolatility = (stats: Stats): number => {
  if (stats.pricePoints.length < 2) return 0

  // Calculate returns manually by iterating consecutive pairs
  const returns: number[] = []
  for (let i = 1; i < stats.pricePoints.length; i++) {
    const prev = stats.pricePoints[i - 1]
    const curr = stats.pricePoints[i]
    returns.push(Math.log(curr.price / prev.price))
  }

  if (returns.length === 0) return 0

  const meanReturn = pipe(
    returns,
    Array.reduce(0, (sum, r) => sum + r),
    (sum) => sum / returns.length
  )

  const variance = pipe(
    returns,
    Array.reduce(0, (sum, r) => sum + Math.pow(r - meanReturn, 2)),
    (sum) => sum / returns.length
  )

  // Annualize based on time window
  const timeSpanMs = stats.lastUpdateTime - stats.pricePoints[0].timestamp
  const timeSpanYears = timeSpanMs / TRADING_YEAR_MS

  if (timeSpanYears <= 0) return 0

  const annualizationFactor = Math.sqrt(1 / timeSpanYears)
  return Math.sqrt(variance) * annualizationFactor * 100 // Return as percentage
}

/**
 * Calculate price momentum (rate of change).
 *
 * @category Destructors
 * @since 0.2.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const momentum = Statistics.calculateMomentum(stats) // Returns as percentage
 */
export const calculateMomentum = (stats: Stats): number => {
  if (stats.pricePoints.length < 2) return 0
  const first = stats.pricePoints[0].price
  const last = stats.pricePoints[stats.pricePoints.length - 1].price
  return ((last - first) / first) * 100
}

/**
 * Calculate trade velocity (trades per second).
 *
 * @category Destructors
 * @since 0.2.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const velocity = Statistics.calculateTradeVelocity(stats)
 */
export const calculateTradeVelocity = (stats: Stats): number => {
  if (stats.pricePoints.length < 2) return 0
  const timeSpanMs = stats.lastUpdateTime - stats.pricePoints[0].timestamp
  if (timeSpanMs <= 0) return 0
  // Trades per second: count / timespan
  const msPerSecond = Duration.toMillis(Duration.seconds(1))
  return (stats.pricePoints.length / timeSpanMs) * msPerSecond
}

/**
 * Calculate Volume-Weighted Average Price (VWAP).
 *
 * @category Destructors
 * @since 0.2.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const vwap = Statistics.calculateVWAP(stats)
 */
export const calculateVWAP = (stats: Stats): number => {
  if (stats.pricePoints.length === 0) return 0

  const { totalPV, totalV } = pipe(
    stats.pricePoints,
    Array.reduce({ totalPV: 0, totalV: 0 }, (acc, p) => ({
      totalPV: acc.totalPV + p.price * p.volume,
      totalV: acc.totalV + p.volume,
    }))
  )

  return totalV > 0 ? totalPV / totalV : 0
}

/**
 * Estimate bid-ask spread based on price variance.
 * Uses high-low spread as a proxy.
 *
 * @category Destructors
 * @since 0.2.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const spread = Statistics.calculateSpreadApprox(stats) // Returns as percentage
 */
export const calculateSpreadApprox = (stats: Stats): number => {
  if (stats.recentPrices.length < 2) return 0
  const min = getMin(stats)
  const max = getMax(stats)
  const mid = (min + max) / 2
  return mid > 0 ? ((max - min) / mid) * 100 : 0
}

/**
 * Calculate all trading metrics at once.
 *
 * @category Destructors
 * @since 0.2.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const metrics = Statistics.calculateTradingMetrics(stats)
 */
export const calculateTradingMetrics = (stats: Stats): TradingMetrics => ({
  volatility: calculateVolatility(stats),
  momentum: calculateMomentum(stats),
  tradeVelocity: calculateTradeVelocity(stats),
  vwap: calculateVWAP(stats),
  spreadApprox: calculateSpreadApprox(stats),
})

/**
 * Get minimum price from recent prices.
 *
 * @category Destructors
 * @since 0.1.0
 */
export const getMin = (stats: Stats): number =>
  stats.recentPrices.length > 0 ? Math.min(...stats.recentPrices) : 0

/**
 * Get maximum price from recent prices.
 *
 * @category Destructors
 * @since 0.1.0
 */
export const getMax = (stats: Stats): number =>
  stats.recentPrices.length > 0 ? Math.max(...stats.recentPrices) : 0

/**
 * Convert Stats to TradeStatistics for a given symbol.
 *
 * @category Combinators
 * @since 0.1.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const tradeStats = Statistics.toTradeStatistics("AAPL")(stats)
 */
export const toTradeStatistics: {
  (symbol: string): (self: Stats) => TradeStatistics
  (self: Stats, symbol: string): TradeStatistics
} = dual(
  2,
  (self: Stats, symbol: string): TradeStatistics => ({
    symbol,
    mean: calculateMean(self),
    stdDev: calculateStdDev(self),
    min: getMin(self),
    max: getMax(self),
    count: self.count,
    recentPrices: [...self.recentPrices],
  })
)

/**
 * Type guard for TradeStatistics.
 *
 * @category Guards
 * @since 0.1.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * if (Statistics.isTradeStatistics(value)) {
 *   // value is TradeStatistics
 * }
 */
export const isTradeStatistics = Schema.is(TradeStatistics)

/**
 * Structural equality for TradeStatistics.
 *
 * @category Equivalence
 * @since 0.1.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 *
 * const stats1 = Statistics.TradeStatistics.make({ ... })
 * const stats2 = Statistics.TradeStatistics.make({ ... })
 *
 * if (Statistics.TradeStatisticsEquivalence(stats1, stats2)) {
 *   // Structurally equal
 * }
 */
export const TradeStatisticsEquivalence: Equivalence.Equivalence<TradeStatistics> =
  Equivalence.make((a, b) => a.symbol === b.symbol && a.count === b.count)

/**
 * Predicate to check if statistics have sufficient data.
 *
 * @category Predicates
 * @since 0.1.0
 * @example
 * import * as Statistics from "./domain/Statistics"
 * import * as Array from "effect/Array"
 * import { pipe } from "effect/Function"
 *
 * const validStats = pipe(allStats, Array.filter(Statistics.hasSufficientData(10)))
 */
export const hasSufficientData =
  (minCount: number) =>
  (self: Stats): boolean =>
    self.recentPrices.length >= minCount

/**
 * Predicate to check if statistics are empty.
 *
 * @category Predicates
 * @since 0.1.0
 */
export const isEmpty = (self: Stats): boolean => self.recentPrices.length === 0

/**
 * Predicate to check if statistics are at capacity (for event-based windows).
 *
 * @category Predicates
 * @since 0.1.0
 */
export const isAtCapacity =
  (windowSize: number) =>
  (self: Stats): boolean =>
    self.recentPrices.length === windowSize
