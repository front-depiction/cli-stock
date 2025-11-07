/**
 * Indicator module exports.
 *
 * This module provides a complete plugin architecture for trading indicators.
 * Each indicator is a separate service that can be composed via layers.
 *
 * @module Indicators
 * @since 0.1.0
 *
 * @example
 * import * as Indicators from "@/indicators"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.gen(function* () {
 *   const rsi = yield* Indicators.RSI.RSIIndicator
 *   const ma = yield* Indicators.MA.MovingAverage
 *
 *   // Use indicators...
 * })
 *
 * Effect.runPromise(program.pipe(
 *   Effect.provide(Indicators.AllIndicatorsLive)
 * ))
 */

// Re-export all indicator implementations
export * as MA from "./MovingAverage"
export * as RSI from "./RSI"
export * as BollingerBands from "./BollingerBands"
export * as VWAP from "./VWAP"
export * as Volatility from "./Volatility"

// Re-export registry and aggregator
export * as Registry from "./IndicatorRegistry"

// Re-export domain models
export * as Domain from "../domain/Indicator"
