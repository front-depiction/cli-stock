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
 * VWAP (Volume Weighted Average Price) indicator configuration.
 *
 * @category Configuration
 * @since 0.1.0
 */
export interface VWAPConfig {
  readonly id: string
  readonly symbol: string
  readonly resetDaily: boolean // Reset VWAP calculation at start of each day
}

/**
 * Configuration service for VWAP indicator.
 *
 * @category Services
 * @since 0.1.0
 */
export const VWAPConfig = Context.GenericTag<VWAPConfig>("@indicators/config/VWAP")

/**
 * VWAP indicator service.
 *
 * Calculates volume-weighted average price, giving more weight to
 * high-volume price levels. Useful for determining trend direction
 * and fair value.
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as VWAP from "@/indicators/VWAP"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 * import * as Console from "effect/Console"
 *
 * const program = Effect.gen(function* () {
 *   const vwap = yield* VWAP.VWAPIndicator
 *   const states = vwap.process(tradeStream)
 *   yield* Stream.runForEach(states, (state) =>
 *     Effect.gen(function* () {
 *       const signal = yield* vwap.signal(state)
 *       yield* Console.log(`VWAP: ${state.value.toFixed(2)} - ${signal._tag}`)
 *     })
 *   )
 * })
 */
export class VWAPIndicator extends Context.Tag("@indicators/VWAP")<
  VWAPIndicator,
  Indicator.Indicator
>() {}

/**
 * Internal state for VWAP calculation.
 */
interface VWAPState {
  readonly cumulativePV: number // Cumulative Price * Volume
  readonly cumulativeVolume: number
  readonly lastResetDate: string // ISO date string for daily reset
}

/**
 * Get date string in YYYY-MM-DD format.
 *
 * @category Utilities
 * @since 0.1.0
 */
const getDateString = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toISOString().split("T")[0]
}

/**
 * Layer that provides the VWAP indicator service.
 *
 * @category Layers
 * @since 0.1.0
 * @example
 * import * as VWAP from "@/indicators/VWAP"
 * import * as Layer from "effect/Layer"
 *
 * const config = Layer.succeed(VWAP.VWAPConfig, {
 *   id: "vwap-daily",
 *   symbol: "AAPL",
 *   resetDaily: true
 * })
 *
 * const MainLive = Layer.provide(VWAP.VWAPIndicatorLive, config)
 */
export const VWAPIndicatorLive = Layer.effect(
  VWAPIndicator,
  Effect.gen(function* () {
    const config = yield* VWAPConfig

    return VWAPIndicator.of({
      id: config.id,
      name: "VWAP",

      process: (trades: Stream.Stream<Trade.TradeData, never, never>) =>
        pipe(
          trades,
          Stream.filter((t) => t.symbol === config.symbol),
          Stream.mapAccum<VWAPState, Trade.TradeData, Indicator.IndicatorState>(
            {
              cumulativePV: 0,
              cumulativeVolume: 0,
              lastResetDate: "",
            },
            (state, trade) => {
              const currentDate = getDateString(trade.timestamp)

              // Check if we need to reset for new day
              const shouldReset =
                config.resetDaily &&
                state.lastResetDate !== "" &&
                currentDate !== state.lastResetDate

              let cumulativePV: number
              let cumulativeVolume: number

              if (shouldReset) {
                // Reset for new trading day
                cumulativePV = trade.price * trade.volume
                cumulativeVolume = trade.volume
              } else {
                // Accumulate
                cumulativePV = state.cumulativePV + trade.price * trade.volume
                cumulativeVolume = state.cumulativeVolume + trade.volume
              }

              const vwap = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : trade.price

              const newState = {
                cumulativePV,
                cumulativeVolume,
                lastResetDate: currentDate,
              }

              return [
                newState,
                Indicator.IndicatorState.make({
                  id: config.id,
                  name: "VWAP",
                  symbol: config.symbol,
                  lastUpdate: DateTime.unsafeNow(),
                  value: vwap,
                  metadata: {
                    cumulativeVolume,
                    currentPrice: trade.price,
                    currentVolume: trade.volume,
                    deviation: ((trade.price - vwap) / vwap) * 100,
                    resetDaily: config.resetDaily,
                    tradingDate: currentDate,
                  },
                }),
              ]
            }
          )
        ),

      signal: (state: Indicator.IndicatorState) =>
        Effect.gen(function* () {
          const currentPrice = state.metadata["currentPrice"] as number
          const vwap = state.value
          const deviation = state.metadata["deviation"] as number
          const timestamp = state.lastUpdate

          if (currentPrice > vwap * 1.015) {
            // Price 1.5% above VWAP - bullish
            const strength = Math.min(1, Math.abs(deviation) / 5)
            return Indicator.Buy.make({
              _tag: "buy",
              strength,
              timestamp,
              reason: `Price ${currentPrice.toFixed(2)} above VWAP ${vwap.toFixed(2)} (${deviation.toFixed(2)}%)`,
            })
          } else if (currentPrice < vwap * 0.985) {
            // Price 1.5% below VWAP - bearish
            const strength = Math.min(1, Math.abs(deviation) / 5)
            return Indicator.Sell.make({
              _tag: "sell",
              strength,
              timestamp,
              reason: `Price ${currentPrice.toFixed(2)} below VWAP ${vwap.toFixed(2)} (${deviation.toFixed(2)}%)`,
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
          const currentVolume = state.metadata["currentVolume"] as number

          return Indicator.matchCondition(condition, {
            priceAbove: (c) => currentPrice > c.threshold,
            priceBelow: (c) => currentPrice < c.threshold,
            volumeAbove: (c) => currentVolume > c.threshold,
            crossOver: () => false,
            volatilityAbove: () => false,
          })
        }),
    })
  })
)
