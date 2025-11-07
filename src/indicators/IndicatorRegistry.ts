import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Array from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as Ref from "effect/Ref"
import * as Option from "effect/Option"
import * as DateTime from "effect/DateTime"
import { pipe } from "effect/Function"
import * as Indicator from "../domain/Indicator"

/**
 * Registry for managing multiple indicator instances.
 *
 * Provides a centralized way to register, lookup, and manage
 * indicator services dynamically.
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as IndicatorRegistry from "@/indicators/IndicatorRegistry"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const registry = yield* IndicatorRegistry.IndicatorRegistry
 *   yield* registry.register("rsi-AAPL", rsiIndicator)
 *   const indicator = yield* registry.get("rsi-AAPL")
 * })
 */
export class IndicatorRegistry extends Context.Tag("@indicators/IndicatorRegistry")<
  IndicatorRegistry,
  {
    readonly register: (id: string, indicator: Indicator.Indicator) => Effect.Effect<void>
    readonly get: (id: string) => Effect.Effect<Indicator.Indicator, Error>
    readonly getAll: () => Effect.Effect<ReadonlyArray<Indicator.Indicator>>
    readonly remove: (id: string) => Effect.Effect<void>
    readonly list: () => Effect.Effect<ReadonlyArray<string>>
  }
>() {}

/**
 * Layer that provides the IndicatorRegistry service.
 *
 * @category Layers
 * @since 0.1.0
 * @example
 * import * as IndicatorRegistry from "@/indicators/IndicatorRegistry"
 * import * as Layer from "effect/Layer"
 *
 * const MainLive = Layer.provide(
 *   myProgram,
 *   IndicatorRegistry.IndicatorRegistryLive
 * )
 */
export const IndicatorRegistryLive = Layer.effect(
  IndicatorRegistry,
  Effect.gen(function* () {
    const registryRef = yield* Ref.make<HashMap.HashMap<string, Indicator.Indicator>>(
      HashMap.empty()
    )

    return IndicatorRegistry.of({
      register: (id: string, indicator: Indicator.Indicator) =>
        Ref.update(registryRef, (registry) => HashMap.set(registry, id, indicator)),

      get: (id: string) =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          const maybeIndicator = HashMap.get(registry, id)

          if (Option.isNone(maybeIndicator)) {
            return yield* Effect.fail(new Error(`Indicator not found: ${id}`))
          }

          return maybeIndicator.value
        }),

      getAll: () =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          return Array.fromIterable(HashMap.values(registry))
        }),

      remove: (id: string) => Ref.update(registryRef, (registry) => HashMap.remove(registry, id)),

      list: () =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          return Array.fromIterable(HashMap.keys(registry))
        }),
    })
  })
)

/**
 * Signal aggregator service.
 *
 * Combines signals from multiple indicators to produce
 * a consensus signal.
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as IndicatorRegistry from "@/indicators/IndicatorRegistry"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const aggregator = yield* IndicatorRegistry.SignalAggregator
 *   const consensus = yield* aggregator.aggregate([signal1, signal2, signal3])
 * })
 */
export class SignalAggregator extends Context.Tag("@indicators/SignalAggregator")<
  SignalAggregator,
  {
    readonly aggregate: (
      signals: ReadonlyArray<Indicator.Signal>
    ) => Effect.Effect<Indicator.Signal>
  }
>() {}

/**
 * Layer that provides the SignalAggregator service.
 *
 * Uses weighted voting to produce consensus signals.
 *
 * @category Layers
 * @since 0.1.0
 * @example
 * import * as IndicatorRegistry from "@/indicators/IndicatorRegistry"
 * import * as Layer from "effect/Layer"
 *
 * const MainLive = Layer.provide(
 *   myProgram,
 *   IndicatorRegistry.SignalAggregatorLive
 * )
 */
export const SignalAggregatorLive = Layer.succeed(
  SignalAggregator,
  SignalAggregator.of({
    aggregate: (signals: ReadonlyArray<Indicator.Signal>) =>
      Effect.gen(function* () {
        if (signals.length === 0) {
          return Indicator.Hold.make({
            _tag: "hold",
            timestamp: DateTime.unsafeNow(),
          })
        }

        // Count votes weighted by strength
        let buyScore = 0
        let sellScore = 0
        let holdCount = 0

        const reasons: string[] = []

        for (const signal of signals) {
          if (Indicator.isBuy(signal)) {
            buyScore += signal.strength
            reasons.push(signal.reason)
          } else if (Indicator.isSell(signal)) {
            sellScore += signal.strength
            reasons.push(signal.reason)
          } else {
            holdCount++
          }
        }

        // Get latest timestamp
        const latestSignal = pipe(signals, Array.sort(Indicator.OrderByTimestamp), Array.last)

        const timestamp = Option.isSome(latestSignal)
          ? latestSignal.value.timestamp
          : DateTime.unsafeNow()

        // Decide consensus
        const totalSignals = signals.length

        if (buyScore > sellScore && buyScore > totalSignals * 0.3) {
          // Majority buy
          const strength = Math.min(1, buyScore / totalSignals)
          return Indicator.Buy.make({
            _tag: "buy",
            strength,
            timestamp,
            reason: `Consensus buy (${reasons.length} indicators): ${reasons.join(", ")}`,
          })
        } else if (sellScore > buyScore && sellScore > totalSignals * 0.3) {
          // Majority sell
          const strength = Math.min(1, sellScore / totalSignals)
          return Indicator.Sell.make({
            _tag: "sell",
            strength,
            timestamp,
            reason: `Consensus sell (${reasons.length} indicators): ${reasons.join(", ")}`,
          })
        } else {
          // Hold or mixed signals
          return Indicator.Hold.make({
            _tag: "hold",
            timestamp,
          })
        }
      }),
  })
)

/**
 * Helper to create a layer that combines multiple indicator layers.
 *
 * @category Utilities
 * @since 0.1.0
 * @example
 * import * as IndicatorRegistry from "@/indicators/IndicatorRegistry"
 * import * as MA from "@/indicators/MovingAverage"
 * import * as RSI from "@/indicators/RSI"
 * import * as Layer from "effect/Layer"
 *
 * const indicators = IndicatorRegistry.combineIndicators(
 *   Layer.mergeAll(
 *     MA.MovingAverageLive,
 *     RSI.RSIIndicatorLive
 *   )
 * )
 */
export const combineIndicators = <R, E>(
  indicatorLayers: Layer.Layer<R, E, never>
): Layer.Layer<R | IndicatorRegistry | SignalAggregator, E, never> =>
  Layer.mergeAll(indicatorLayers, IndicatorRegistryLive, SignalAggregatorLive)
