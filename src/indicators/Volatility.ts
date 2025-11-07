import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Layer from "effect/Layer"
import * as Array from "effect/Array"
import * as Option from "effect/Option"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import { pipe } from "effect/Function"
import * as Indicator from "../domain/Indicator"
import * as Trade from "../domain/Trade"

/**
 * Number of trading days in a typical year.
 * Used for annualizing volatility calculations.
 *
 * @category Constants
 * @since 0.3.0
 */
const TRADING_DAYS_PER_YEAR = 252

/**
 * Duration of one trading year (252 trading days).
 * Used for annualizing volatility using Duration API.
 *
 * @category Constants
 * @since 0.3.0
 */
const TRADING_YEAR_MS = Duration.toMillis(Duration.days(TRADING_DAYS_PER_YEAR))

/**
 * Volatility indicator configuration.
 *
 * @category Configuration
 * @since 0.1.0
 */
export interface VolatilityConfig {
  readonly id: string
  readonly symbol: string
  readonly period: number
  readonly method: "stdDev" | "atr" | "parkinson" // Different volatility calculation methods
  readonly highVolatilityThreshold: number // Percentage threshold for high volatility
}

/**
 * Configuration service for Volatility indicator.
 *
 * @category Services
 * @since 0.1.0
 */
export const VolatilityConfig = Context.GenericTag<VolatilityConfig>(
  "@indicators/config/Volatility"
)

/**
 * Volatility indicator service.
 *
 * Measures price volatility using various methods:
 * - stdDev: Standard deviation of returns
 * - atr: Average True Range (requires high/low data)
 * - parkinson: Parkinson's historical volatility
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as Vol from "@/indicators/Volatility"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 * import * as Console from "effect/Console"
 *
 * const program = Effect.gen(function* () {
 *   const vol = yield* Vol.VolatilityIndicator
 *   const states = vol.process(tradeStream)
 *   yield* Stream.runForEach(states, (state) =>
 *     Effect.gen(function* () {
 *       const signal = yield* vol.signal(state)
 *       yield* Console.log(`Volatility: ${state.value.toFixed(2)}%`)
 *     })
 *   )
 * })
 */
export class VolatilityIndicator extends Context.Tag("@indicators/Volatility")<
  VolatilityIndicator,
  Indicator.Indicator
>() {}

/**
 * Internal state for Volatility calculation.
 */
interface VolatilityState {
  readonly prices: ReadonlyArray<number>
  readonly returns: ReadonlyArray<number>
}

/**
 * Calculate standard deviation volatility.
 *
 * @category Utilities
 * @since 0.1.0
 */
const calculateStdDevVolatility = (returns: ReadonlyArray<number>): number => {
  if (returns.length === 0) return 0

  const mean = pipe(
    returns,
    Array.reduce(0, (sum, r) => sum + r),
    (sum) => sum / returns.length
  )

  const variance = pipe(
    returns,
    Array.reduce(0, (sum, r) => sum + Math.pow(r - mean, 2)),
    (sum) => sum / returns.length
  )

  // Annualize volatility (assuming 252 trading days)
  return Math.sqrt(variance * TRADING_DAYS_PER_YEAR) * 100
}

/**
 * Calculate simple return.
 *
 * @category Utilities
 * @since 0.1.0
 */
const calculateReturn = (currentPrice: number, previousPrice: number): number => {
  if (previousPrice === 0) return 0
  return (currentPrice - previousPrice) / previousPrice
}

/**
 * Layer that provides the Volatility indicator service.
 *
 * @category Layers
 * @since 0.1.0
 * @example
 * import * as Vol from "@/indicators/Volatility"
 * import * as Layer from "effect/Layer"
 *
 * const config = Layer.succeed(Vol.VolatilityConfig, {
 *   id: "vol-20-stddev",
 *   symbol: "AAPL",
 *   period: 20,
 *   method: "stdDev",
 *   highVolatilityThreshold: 30
 * })
 *
 * const MainLive = Layer.provide(Vol.VolatilityIndicatorLive, config)
 */
export const VolatilityIndicatorLive = Layer.effect(
  VolatilityIndicator,
  Effect.gen(function* () {
    const config = yield* VolatilityConfig

    return VolatilityIndicator.of({
      id: config.id,
      name: "Volatility",

      process: (trades: Stream.Stream<Trade.TradeData, never, never>) =>
        pipe(
          trades,
          Stream.filter((t) => t.symbol === config.symbol),
          Stream.mapAccum<VolatilityState, Trade.TradeData, Indicator.IndicatorState | null>(
            {
              prices: [],
              returns: [],
            },
            (state, trade) => {
              const newPrices = [...state.prices, trade.price].slice(-config.period - 1)

              let newReturns = state.returns

              // Calculate return if we have at least 2 prices
              if (newPrices.length >= 2) {
                const ret = calculateReturn(
                  newPrices[newPrices.length - 1],
                  newPrices[newPrices.length - 2]
                )
                newReturns = [...state.returns, ret].slice(-config.period)
              }

              const newState = {
                prices: newPrices,
                returns: newReturns,
              }

              if (newReturns.length >= config.period) {
                let volatility: number

                switch (config.method) {
                  case "stdDev":
                    volatility = calculateStdDevVolatility(newReturns)
                    break
                  case "atr":
                    // Simplified ATR - would need high/low data for proper implementation
                    volatility = calculateStdDevVolatility(newReturns)
                    break
                  case "parkinson":
                    // Simplified Parkinson - would need high/low data for proper implementation
                    volatility = calculateStdDevVolatility(newReturns) * 1.67
                    break
                }

                // Calculate recent volatility change
                const recentReturns = newReturns.slice(-5)
                const recentVol = calculateStdDevVolatility(recentReturns)
                const volChange = ((recentVol - volatility) / volatility) * 100

                return [
                  newState,
                  Indicator.IndicatorState.make({
                    id: config.id,
                    name: "Volatility",
                    symbol: config.symbol,
                    lastUpdate: DateTime.unsafeNow(),
                    value: volatility,
                    metadata: {
                      period: config.period,
                      method: config.method,
                      currentPrice: trade.price,
                      recentVolatility: recentVol,
                      volatilityChange: volChange,
                      threshold: config.highVolatilityThreshold,
                    },
                  }),
                ]
              }

              return [newState, null]
            }
          ),
          Stream.filterMap((x) => (x === null ? Option.none() : Option.some(x)))
        ),

      signal: (state: Indicator.IndicatorState) =>
        Effect.gen(function* () {
          const volatility = state.value
          const threshold = state.metadata["threshold"] as number
          const volChange = state.metadata["volatilityChange"] as number
          const timestamp = state.lastUpdate

          if (volatility > threshold && volChange > 0) {
            // High and increasing volatility - caution signal (sell)
            const strength = Math.min(1, (volatility - threshold) / threshold)
            return Indicator.Sell.make({
              _tag: "sell",
              strength,
              timestamp,
              reason: `High volatility ${volatility.toFixed(2)}% (threshold: ${threshold}%, change: +${volChange.toFixed(2)}%)`,
            })
          } else if (volatility < threshold * 0.5 && volChange < 0) {
            // Low and decreasing volatility - potential accumulation (buy)
            const strength = 0.4
            return Indicator.Buy.make({
              _tag: "buy",
              strength,
              timestamp,
              reason: `Low volatility ${volatility.toFixed(2)}% (threshold: ${threshold}%, change: ${volChange.toFixed(2)}%)`,
            })
          } else {
            return Indicator.Hold.make({
              _tag: "hold",
              timestamp,
            })
          }
        }),

      checkTrigger: (state: Indicator.IndicatorState, condition: Indicator.TriggerCondition) =>
        Effect.gen(function* () {
          const volatility = state.value
          const currentPrice = state.metadata["currentPrice"] as number

          return Indicator.matchCondition(condition, {
            priceAbove: (c) => currentPrice > c.threshold,
            priceBelow: (c) => currentPrice < c.threshold,
            volatilityAbove: (c) => volatility > c.threshold,
            crossOver: () => false,
            volumeAbove: () => false,
          })
        }),
    })
  })
)
