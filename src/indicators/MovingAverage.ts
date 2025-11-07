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
 * Moving Average indicator configuration.
 *
 * @category Configuration
 * @since 0.1.0
 */
export interface MovingAverageConfig {
  readonly id: string
  readonly symbol: string
  readonly period: number
  readonly type: "simple" | "exponential"
}

/**
 * Configuration service for Moving Average indicator.
 *
 * @category Services
 * @since 0.1.0
 */
export const MovingAverageConfig = Context.GenericTag<MovingAverageConfig>("@indicators/config/MA")

/**
 * Moving Average indicator service.
 *
 * Computes simple (SMA) or exponential (EMA) moving averages
 * and generates crossover signals.
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as MA from "@/indicators/MovingAverage"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const program = Effect.gen(function* () {
 *   const ma = yield* MA.MovingAverage
 *   const states = ma.process(tradeStream)
 *   yield* Stream.runForEach(states, (state) =>
 *     Effect.gen(function* () {
 *       const signal = yield* ma.signal(state)
 *       yield* Console.log(signal)
 *     })
 *   )
 * })
 */
export class MovingAverage extends Context.Tag("@indicators/MovingAverage")<
  MovingAverage,
  Indicator.Indicator
>() {}

/**
 * Internal state for MA calculation.
 */
interface MAState {
  readonly prices: ReadonlyArray<number>
  readonly currentMA: number
}

/**
 * Calculate Simple Moving Average.
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
 * Calculate Exponential Moving Average.
 *
 * @category Utilities
 * @since 0.1.0
 */
const calculateEMA = (prices: ReadonlyArray<number>, period: number): number => {
  if (prices.length === 0) return 0
  if (prices.length === 1) return prices[0]

  const multiplier = 2 / (period + 1)
  let ema = prices[0]

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * multiplier + ema * (1 - multiplier)
  }

  return ema
}

/**
 * Layer that provides the Moving Average indicator service.
 *
 * @category Layers
 * @since 0.1.0
 * @example
 * import * as MA from "@/indicators/MovingAverage"
 * import * as Layer from "effect/Layer"
 * import * as Context from "effect/Context"
 *
 * const config = Layer.succeed(MA.MovingAverageConfig, {
 *   id: "sma-20",
 *   symbol: "AAPL",
 *   period: 20,
 *   type: "simple"
 * })
 *
 * const MainLive = Layer.provide(MA.MovingAverageLive, config)
 */
export const MovingAverageLive = Layer.effect(
  MovingAverage,
  Effect.gen(function* () {
    const config = yield* MovingAverageConfig

    return MovingAverage.of({
      id: config.id,
      name: config.type === "simple" ? "SMA" : "EMA",

      process: (trades: Stream.Stream<Trade.TradeData, never, never>) =>
        pipe(
          trades,
          Stream.filter((t) => t.symbol === config.symbol),
          Stream.mapAccum<MAState, Trade.TradeData, Indicator.IndicatorState | null>(
            { prices: [], currentMA: 0 },
            (state, trade) => {
              const newPrices = [...state.prices, trade.price].slice(-config.period)
              const newMA =
                config.type === "simple"
                  ? calculateSMA(newPrices)
                  : calculateEMA(newPrices, config.period)

              const newState = { prices: newPrices, currentMA: newMA }

              if (newPrices.length >= config.period) {
                return [
                  newState,
                  Indicator.IndicatorState.make({
                    id: config.id,
                    name: config.type === "simple" ? "SMA" : "EMA",
                    symbol: config.symbol,
                    lastUpdate: DateTime.unsafeNow(),
                    value: newMA,
                    metadata: {
                      period: config.period,
                      type: config.type,
                      priceCount: newPrices.length,
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
          const ma = state.value
          const timestamp = state.lastUpdate

          if (currentPrice > ma * 1.02) {
            // Price 2% above MA - bullish
            return Indicator.Buy.make({
              _tag: "buy",
              strength: 0.6,
              timestamp,
              reason: `Price ${currentPrice.toFixed(2)} above ${state.name} ${ma.toFixed(2)}`,
            })
          } else if (currentPrice < ma * 0.98) {
            // Price 2% below MA - bearish
            return Indicator.Sell.make({
              _tag: "sell",
              strength: 0.6,
              timestamp,
              reason: `Price ${currentPrice.toFixed(2)} below ${state.name} ${ma.toFixed(2)}`,
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
          const currentPrice = state.metadata["currentPrice"] as number
          const ma = state.value

          return Indicator.matchCondition(condition, {
            priceAbove: (c) => currentPrice > c.threshold,
            priceBelow: (c) => currentPrice < c.threshold,
            crossOver: (c) => {
              // Check if fast period crossed above slow period (golden cross)
              // This is simplified - real implementation would track both MAs
              return c.fastPeriod < c.slowPeriod && currentPrice > ma
            },
            volumeAbove: () => false,
            volatilityAbove: () => false,
          })
        }),
    })
  })
)
