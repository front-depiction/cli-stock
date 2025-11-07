import * as Layer from "effect/Layer"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as PubSub from "effect/PubSub"
import * as Console from "effect/Console"
import { pipe } from "effect/Function"
import * as TradePubSub from "../services/TradePubSub"
import * as MA from "../indicators/MovingAverage"
import * as RSI from "../indicators/RSI"
import * as BB from "../indicators/BollingerBands"
import * as VWAP from "../indicators/VWAP"
import * as Vol from "../indicators/Volatility"
import * as IndicatorRegistry from "../indicators/IndicatorRegistry"
import * as Indicator from "../domain/Indicator"

/**
 * Example layer composition showing how to combine multiple indicators.
 *
 * This demonstrates the plugin architecture where:
 * 1. Each indicator is a separate service
 * 2. Indicators are configured via Context.Tag
 * 3. Multiple indicators can be composed via layers
 * 4. Indicators subscribe to the same trade stream independently
 *
 * @category Examples
 * @since 0.1.0
 * @example
 * import * as IndicatorExample from "@/layers/IndicatorLayerExample"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   // All indicators are now available
 *   const ma = yield* MA.MovingAverage
 *   const rsi = yield* RSI.RSIIndicator
 *   const registry = yield* IndicatorRegistry.IndicatorRegistry
 * })
 *
 * Effect.runPromise(program.pipe(
 *   Effect.provide(IndicatorExample.AllIndicatorsLive)
 * ))
 */

/**
 * Configuration layer for all indicators.
 *
 * @category Layers
 * @since 0.1.0
 */
export const IndicatorConfigsLive = Layer.mergeAll(
  // Moving Average - Simple 20-period
  Layer.succeed(MA.MovingAverageConfig, {
    id: "sma-20-AAPL",
    symbol: "AAPL",
    period: 20,
    type: "simple",
  }),

  // Moving Average - Exponential 12-period
  Layer.succeed(MA.MovingAverageConfig, {
    id: "ema-12-AAPL",
    symbol: "AAPL",
    period: 12,
    type: "exponential",
  }),

  // RSI - 14-period
  Layer.succeed(RSI.RSIConfig, {
    id: "rsi-14-AAPL",
    symbol: "AAPL",
    period: 14,
    oversold: 30,
    overbought: 70,
  }),

  // Bollinger Bands - 20-period, 2 std dev
  Layer.succeed(BB.BollingerBandsConfig, {
    id: "bb-20-2-AAPL",
    symbol: "AAPL",
    period: 20,
    stdDevMultiplier: 2,
  }),

  // VWAP - Daily reset
  Layer.succeed(VWAP.VWAPConfig, {
    id: "vwap-daily-AAPL",
    symbol: "AAPL",
    resetDaily: true,
  }),

  // Volatility - 20-period standard deviation
  Layer.succeed(Vol.VolatilityConfig, {
    id: "vol-20-stddev-AAPL",
    symbol: "AAPL",
    period: 20,
    method: "stdDev",
    highVolatilityThreshold: 30,
  })
)

/**
 * Layer that provides all indicator services.
 *
 * @category Layers
 * @since 0.1.0
 */
export const AllIndicatorsLive = pipe(
  Layer.mergeAll(
    MA.MovingAverageLive,
    RSI.RSIIndicatorLive,
    BB.BollingerBandsIndicatorLive,
    VWAP.VWAPIndicatorLive,
    Vol.VolatilityIndicatorLive
  ),
  Layer.provide(IndicatorConfigsLive)
)

/**
 * Layer with registry and aggregator for managing indicators.
 *
 * @category Layers
 * @since 0.1.0
 */
export const IndicatorManagementLive = Layer.mergeAll(
  AllIndicatorsLive,
  IndicatorRegistry.IndicatorRegistryLive,
  IndicatorRegistry.SignalAggregatorLive
)

/**
 * Complete application layer with trade pubsub and all indicators.
 *
 * @category Layers
 * @since 0.1.0
 */
export const MainWithIndicatorsLive = Layer.mergeAll(
  TradePubSub.TradePubSubLive,
  IndicatorManagementLive
)

/**
 * Example program that subscribes multiple indicators to the trade stream.
 *
 * @category Examples
 * @since 0.1.0
 * @example
 * import * as IndicatorExample from "@/layers/IndicatorLayerExample"
 * import * as Effect from "effect/Effect"
 * import * as PubSub from "effect/PubSub"
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* TradePubSub.TradePubSub
 *
 *   // Start publishing trades
 *   yield* PubSub.publish(pubsub, someTrade)
 *
 *   // Subscribe all indicators
 *   yield* IndicatorExample.subscribeAllIndicators
 * })
 *
 * Effect.runPromise(program.pipe(
 *   Effect.provide(IndicatorExample.MainWithIndicatorsLive)
 * ))
 */
export const subscribeAllIndicators = Effect.gen(function* () {
  const { pubsub } = yield* TradePubSub.TradePubSub
  const dequeue = yield* PubSub.subscribe(pubsub)
  const tradeStream = Stream.fromQueue(dequeue)

  const ma = yield* MA.MovingAverage
  const rsi = yield* RSI.RSIIndicator
  const bb = yield* BB.BollingerBandsIndicator
  const vwap = yield* VWAP.VWAPIndicator
  const vol = yield* Vol.VolatilityIndicator
  const aggregator = yield* IndicatorRegistry.SignalAggregator

  // Subscribe each indicator to the trade stream
  const allSignals: Indicator.Signal[] = []

  // Process RSI
  yield* Stream.runForEach(rsi.process(tradeStream), (state) =>
    Effect.gen(function* () {
      const signal = yield* rsi.signal(state)
      allSignals.push(signal)
      yield* Console.log(`[RSI] Value: ${state.value.toFixed(2)} | Signal: ${signal._tag}`)
    })
  )

  // Process Moving Average
  yield* Stream.runForEach(ma.process(tradeStream), (state) =>
    Effect.gen(function* () {
      const signal = yield* ma.signal(state)
      allSignals.push(signal)
      yield* Console.log(`[MA] Value: ${state.value.toFixed(2)} | Signal: ${signal._tag}`)
    })
  )

  // Process Bollinger Bands
  yield* Stream.runForEach(bb.process(tradeStream), (state) =>
    Effect.gen(function* () {
      const signal = yield* bb.signal(state)
      allSignals.push(signal)
      const upper = state.metadata["upperBand"] as number
      const lower = state.metadata["lowerBand"] as number
      yield* Console.log(
        `[BB] Range: ${lower.toFixed(2)} - ${upper.toFixed(2)} | Signal: ${signal._tag}`
      )
    })
  )

  // Process VWAP
  yield* Stream.runForEach(vwap.process(tradeStream), (state) =>
    Effect.gen(function* () {
      const signal = yield* vwap.signal(state)
      allSignals.push(signal)
      const deviation = state.metadata["deviation"] as number
      yield* Console.log(
        `[VWAP] Value: ${state.value.toFixed(2)} | Deviation: ${deviation.toFixed(2)}% | Signal: ${signal._tag}`
      )
    })
  )

  // Process Volatility
  yield* Stream.runForEach(vol.process(tradeStream), (state) =>
    Effect.gen(function* () {
      const signal = yield* vol.signal(state)
      allSignals.push(signal)
      yield* Console.log(`[VOL] Volatility: ${state.value.toFixed(2)}% | Signal: ${signal._tag}`)
    })
  )

  // Aggregate signals
  if (allSignals.length > 0) {
    const consensus = yield* aggregator.aggregate(allSignals)
    yield* Console.log(`\n[CONSENSUS] ${consensus._tag.toUpperCase()}`)

    if (Indicator.isBuy(consensus)) {
      yield* Console.log(`  Strength: ${consensus.strength.toFixed(2)}`)
      yield* Console.log(`  Reason: ${consensus.reason}`)
    } else if (Indicator.isSell(consensus)) {
      yield* Console.log(`  Strength: ${consensus.strength.toFixed(2)}`)
      yield* Console.log(`  Reason: ${consensus.reason}`)
    }
  }
})
