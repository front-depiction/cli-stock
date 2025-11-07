import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as DateTime from "effect/DateTime"
import { pipe } from "effect/Function"
import * as Indicator from "../domain/Indicator"
import * as Trade from "../domain/Trade"

/**
 * RSI (Relative Strength Index) indicator configuration.
 *
 * @category Configuration
 * @since 0.1.0
 */
export interface RSIConfig {
  readonly id: string
  readonly symbol: string
  readonly period: number
  readonly oversold: number // Default 30
  readonly overbought: number // Default 70
}

/**
 * Configuration service for RSI indicator.
 *
 * @category Services
 * @since 0.1.0
 */
export const RSIConfig = Context.GenericTag<RSIConfig>("@indicators/config/RSI")

/**
 * RSI indicator service.
 *
 * Measures momentum by comparing recent gains vs losses.
 * Values range from 0-100, with <30 indicating oversold and >70 overbought.
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as RSI from "@/indicators/RSI"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 * import * as Console from "effect/Console"
 *
 * const program = Effect.gen(function* () {
 *   const rsi = yield* RSI.RSIIndicator
 *   const states = rsi.process(tradeStream)
 *   yield* Stream.runForEach(states, (state) =>
 *     Effect.gen(function* () {
 *       const signal = yield* rsi.signal(state)
 *       yield* Console.log(`RSI: ${state.value.toFixed(2)} - ${signal._tag}`)
 *     })
 *   )
 * })
 */
export class RSIIndicator extends Context.Tag("@indicators/RSI")<
  RSIIndicator,
  Indicator.Indicator
>() {}

/**
 * Internal state for RSI calculation.
 */
interface RSIState {
  readonly prices: ReadonlyArray<number>
  readonly gains: ReadonlyArray<number>
  readonly losses: ReadonlyArray<number>
  readonly avgGain: number
  readonly avgLoss: number
}

/**
 * Calculate RSI from average gain and loss.
 *
 * @category Utilities
 * @since 0.1.0
 */
const calculateRSI = (avgGain: number, avgLoss: number): number => {
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

/**
 * Layer that provides the RSI indicator service.
 *
 * @category Layers
 * @since 0.1.0
 * @example
 * import * as RSI from "@/indicators/RSI"
 * import * as Layer from "effect/Layer"
 *
 * const config = Layer.succeed(RSI.RSIConfig, {
 *   id: "rsi-14",
 *   symbol: "AAPL",
 *   period: 14,
 *   oversold: 30,
 *   overbought: 70
 * })
 *
 * const MainLive = Layer.provide(RSI.RSIIndicatorLive, config)
 */
export const RSIIndicatorLive = Layer.effect(
  RSIIndicator,
  Effect.gen(function* () {
    const config = yield* RSIConfig

    return RSIIndicator.of({
      id: config.id,
      name: "RSI",

      process: (trades: Stream.Stream<Trade.TradeData, never, never>) =>
        pipe(
          trades,
          Stream.filter((t) => t.symbol === config.symbol),
          Stream.mapAccum<RSIState, Trade.TradeData, Indicator.IndicatorState | null>(
            {
              prices: [],
              gains: [],
              losses: [],
              avgGain: 0,
              avgLoss: 0,
            },
            (state, trade) => {
              const newPrices = [...state.prices, trade.price]

              if (newPrices.length < 2) {
                return [{ ...state, prices: newPrices }, null]
              }

              // Calculate price change
              const change = newPrices[newPrices.length - 1] - newPrices[newPrices.length - 2]
              const gain = change > 0 ? change : 0
              const loss = change < 0 ? -change : 0

              const newGains = [...state.gains, gain].slice(-config.period)
              const newLosses = [...state.losses, loss].slice(-config.period)

              // Calculate average gain and loss
              let avgGain: number
              let avgLoss: number

              if (newGains.length < config.period) {
                // Not enough data yet
                avgGain = newGains.reduce((sum, g) => sum + g, 0) / newGains.length
                avgLoss = newLosses.reduce((sum, l) => sum + l, 0) / newLosses.length
              } else {
                // Use smoothed average (Wilder's smoothing)
                avgGain = (state.avgGain * (config.period - 1) + gain) / config.period
                avgLoss = (state.avgLoss * (config.period - 1) + loss) / config.period
              }

              const rsi = calculateRSI(avgGain, avgLoss)

              const newState = {
                prices: newPrices.slice(-config.period - 1),
                gains: newGains,
                losses: newLosses,
                avgGain,
                avgLoss,
              }

              if (newGains.length >= config.period) {
                return [
                  newState,
                  Indicator.IndicatorState.make({
                    id: config.id,
                    name: "RSI",
                    symbol: config.symbol,
                    lastUpdate: DateTime.unsafeNow(),
                    value: rsi,
                    metadata: {
                      period: config.period,
                      avgGain,
                      avgLoss,
                      currentPrice: trade.price,
                      oversold: config.oversold,
                      overbought: config.overbought,
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
          const rsi = state.value
          const oversold = state.metadata["oversold"] as number
          const overbought = state.metadata["overbought"] as number
          const timestamp = state.lastUpdate

          if (rsi < oversold) {
            // Oversold - potential buy signal
            const strength = Math.min(1, (oversold - rsi) / oversold)
            return Indicator.Buy.make({
              _tag: "buy",
              strength,
              timestamp,
              reason: `RSI oversold at ${rsi.toFixed(2)} (threshold: ${oversold})`,
            })
          } else if (rsi > overbought) {
            // Overbought - potential sell signal
            const strength = Math.min(1, (rsi - overbought) / (100 - overbought))
            return Indicator.Sell.make({
              _tag: "sell",
              strength,
              timestamp,
              reason: `RSI overbought at ${rsi.toFixed(2)} (threshold: ${overbought})`,
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
          const rsi = state.value
          const currentPrice = state.metadata["currentPrice"] as number

          return Indicator.matchCondition(condition, {
            priceAbove: (c) => currentPrice > c.threshold,
            priceBelow: (c) => currentPrice < c.threshold,
            crossOver: () => false,
            volumeAbove: () => false,
            volatilityAbove: () => false,
          })
        }),
    })
  })
)
