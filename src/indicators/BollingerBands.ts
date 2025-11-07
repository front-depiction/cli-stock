import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Layer from "effect/Layer"
import * as Array from "effect/Array"
import * as Option from "effect/Option"
import * as DateTime from "effect/DateTime"
import { pipe } from "effect/Function"
import * as Indicator from "../domain/Indicator"
import * as Trade from "../domain/Trade"

/**
 * Bollinger Bands indicator configuration.
 *
 * @category Configuration
 * @since 0.1.0
 */
export interface BollingerBandsConfig {
  readonly id: string
  readonly symbol: string
  readonly period: number
  readonly stdDevMultiplier: number // Typically 2
}

/**
 * Configuration service for Bollinger Bands indicator.
 *
 * @category Services
 * @since 0.1.0
 */
export const BollingerBandsConfig = Context.GenericTag<BollingerBandsConfig>(
  "@indicators/config/BollingerBands"
)

/**
 * Bollinger Bands indicator service.
 *
 * Uses a moving average with upper and lower bands based on standard deviation.
 * Useful for identifying volatility and potential reversal points.
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as BB from "@/indicators/BollingerBands"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 * import * as Console from "effect/Console"
 *
 * const program = Effect.gen(function* () {
 *   const bb = yield* BB.BollingerBandsIndicator
 *   const states = bb.process(tradeStream)
 *   yield* Stream.runForEach(states, (state) =>
 *     Effect.gen(function* () {
 *       const signal = yield* bb.signal(state)
 *       const upper = state.metadata["upperBand"] as number
 *       const lower = state.metadata["lowerBand"] as number
 *       yield* Console.log(`BB: ${lower.toFixed(2)} < ${state.value.toFixed(2)} < ${upper.toFixed(2)}`)
 *     })
 *   )
 * })
 */
export class BollingerBandsIndicator extends Context.Tag("@indicators/BollingerBands")<
  BollingerBandsIndicator,
  Indicator.Indicator
>() {}

/**
 * Internal state for Bollinger Bands calculation.
 */
interface BBState {
  readonly prices: ReadonlyArray<number>
}

/**
 * Calculate standard deviation.
 *
 * @category Utilities
 * @since 0.1.0
 */
const calculateStdDev = (prices: ReadonlyArray<number>, mean: number): number => {
  if (prices.length === 0) return 0
  return Math.sqrt(
    pipe(
      prices,
      Array.reduce(0, (sum, p) => sum + Math.pow(p - mean, 2)),
      (sum) => sum / prices.length
    )
  )
}

/**
 * Calculate simple moving average.
 *
 * @category Utilities
 * @since 0.1.0
 */
const calculateSMA = (prices: ReadonlyArray<number>): number => {
  if (prices.length === 0) return 0
  return pipe(
    prices,
    Array.reduce(0, (sum, p) => sum + p),
    (sum) => sum / prices.length
  )
}

/**
 * Layer that provides the Bollinger Bands indicator service.
 *
 * @category Layers
 * @since 0.1.0
 * @example
 * import * as BB from "@/indicators/BollingerBands"
 * import * as Layer from "effect/Layer"
 *
 * const config = Layer.succeed(BB.BollingerBandsConfig, {
 *   id: "bb-20-2",
 *   symbol: "AAPL",
 *   period: 20,
 *   stdDevMultiplier: 2
 * })
 *
 * const MainLive = Layer.provide(BB.BollingerBandsIndicatorLive, config)
 */
export const BollingerBandsIndicatorLive = Layer.effect(
  BollingerBandsIndicator,
  Effect.gen(function* () {
    const config = yield* BollingerBandsConfig

    return BollingerBandsIndicator.of({
      id: config.id,
      name: "Bollinger Bands",

      process: (trades: Stream.Stream<Trade.TradeData, never, never>) =>
        pipe(
          trades,
          Stream.filter((t) => t.symbol === config.symbol),
          Stream.mapAccum<BBState, Trade.TradeData, Indicator.IndicatorState | null>(
            { prices: [] },
            (state, trade) => {
              const newPrices = [...state.prices, trade.price].slice(-config.period)
              const newState = { prices: newPrices }

              if (newPrices.length >= config.period) {
                const sma = calculateSMA(newPrices)
                const stdDev = calculateStdDev(newPrices, sma)
                const upperBand = sma + stdDev * config.stdDevMultiplier
                const lowerBand = sma - stdDev * config.stdDevMultiplier

                // Calculate bandwidth as percentage
                const bandwidth = ((upperBand - lowerBand) / sma) * 100

                // Calculate %B (position within bands)
                const percentB = (trade.price - lowerBand) / (upperBand - lowerBand)

                return [
                  newState,
                  Indicator.IndicatorState.make({
                    id: config.id,
                    name: "Bollinger Bands",
                    symbol: config.symbol,
                    lastUpdate: DateTime.unsafeNow(),
                    value: sma,
                    metadata: {
                      period: config.period,
                      upperBand,
                      lowerBand,
                      stdDev,
                      bandwidth,
                      percentB,
                      currentPrice: trade.price,
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
          const currentPrice = state.metadata["currentPrice"] as number
          const upperBand = state.metadata["upperBand"] as number
          const lowerBand = state.metadata["lowerBand"] as number
          const percentB = state.metadata["percentB"] as number
          const timestamp = state.lastUpdate

          if (currentPrice <= lowerBand) {
            // Price at or below lower band - oversold, potential buy
            const strength = Math.min(1, Math.abs(percentB))
            return Indicator.Buy.make({
              strength,
              timestamp,
              reason: `Price ${currentPrice.toFixed(2)} at/below lower band ${lowerBand.toFixed(2)}`,
            })
          } else if (currentPrice >= upperBand) {
            // Price at or above upper band - overbought, potential sell
            const strength = Math.min(1, percentB)
            return Indicator.Sell.make({
              _tag: "sell" as const,
              strength,
              timestamp,
              reason: `Price ${currentPrice.toFixed(2)} at/above upper band ${upperBand.toFixed(2)}`,
            })
          } else {
            return Indicator.Hold.make({
              _tag: "hold" as const,
              timestamp,
            })
          }
        }),

      checkTrigger: (state: Indicator.IndicatorState, condition: Indicator.TriggerCondition) =>
        Effect.gen(function* () {
          const currentPrice = state.metadata["currentPrice"] as number
          const bandwidth = state.metadata["bandwidth"] as number

          return Indicator.matchCondition(condition, {
            priceAbove: (c) => currentPrice > c.threshold,
            priceBelow: (c) => currentPrice < c.threshold,
            volatilityAbove: (c) => bandwidth > c.threshold,
            crossOver: () => false,
            volumeAbove: () => false,
          })
        }),
    })
  })
)
