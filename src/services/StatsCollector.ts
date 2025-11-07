import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as PubSub from "effect/PubSub"
import * as Ref from "effect/Ref"
import { pipe } from "effect/Function"
import * as TradePubSub from "./TradePubSub"
import * as StatsState from "./StatsState"
import * as Trade from "../domain/Trade"
import * as Statistics from "../domain/Statistics"

/**
 * StatsCollector Service - Enhanced statistics computation with time-based windows.
 *
 * This service:
 * - Subscribes to TradePubSub broadcast stream
 * - Updates statistics with configurable windows (event-based, time-based, or hybrid)
 * - Computes advanced trading metrics (volatility, momentum, VWAP, velocity, spread)
 * - No console output (UI handles all display)
 * - No requirement leakage in service interface
 *
 * @category Services
 * @since 0.2.0
 * @example
 * import * as StatsCollector from "./services/StatsCollector"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const collector = yield* StatsCollector.StatsCollector
 *   yield* collector.start
 * })
 */
export class StatsCollector extends Context.Tag("@services/StatsCollector")<
  StatsCollector,
  {
    readonly start: Effect.Effect<void>
  }
>() {}

/**
 * Configuration for StatsCollector.
 *
 * @category Configuration
 * @since 0.2.0
 */
export interface StatsCollectorConfig {
  readonly symbols: ReadonlyArray<string>
  readonly windowConfig: Statistics.WindowConfig
  readonly displayInterval: number
  readonly showEnhancedMetrics: boolean
}

/**
 * Configuration service for StatsCollector.
 *
 * @category Services
 * @since 0.1.0
 */
export const StatsCollectorConfig = Context.GenericTag<StatsCollectorConfig>(
  "@services/StatsCollectorConfig"
)

/**
 * Default configuration for StatsCollector.
 *
 * @category Configuration
 * @since 0.2.0
 */
export const defaultConfig: StatsCollectorConfig = {
  symbols: [],
  windowConfig: { _tag: "EventBased", size: 20 },
  displayInterval: 5,
  showEnhancedMetrics: true,
}

/**
 * Layer that provides the StatsCollector service with enhanced metrics.
 *
 * Type: Layer<StatsCollector, never, TradePubSub | StatsState | StatsCollectorConfig>
 * - RequirementsOut: StatsCollector (what we're creating)
 * - Error: never (errors are handled internally)
 * - RequirementsIn: TradePubSub | StatsState | StatsCollectorConfig (dependencies)
 *
 * @category Layers
 * @since 0.2.0
 * @example
 * import * as StatsCollector from "./services/StatsCollector"
 * import * as Statistics from "../domain/Statistics"
 * import * as Layer from "effect/Layer"
 *
 * const config = Layer.succeed(
 *   StatsCollector.StatsCollectorConfig,
 *   {
 *     symbols: ["AAPL", "MSFT"],
 *     windowConfig: { _tag: "TimeBased", durationMs: 30_000 },
 *     displayInterval: 10,
 *     showEnhancedMetrics: true
 *   }
 * )
 *
 * const MainLive = Layer.mergeAll(
 *   TradePubSub.TradePubSubLiveDefault,
 *   StatsState.StatsStateLive,
 *   StatsCollector.StatsCollectorLive
 * ).pipe(Layer.provide(config))
 */
export const StatsCollectorLive = Layer.scoped(
  StatsCollector,
  Effect.gen(function* () {
    const { pubsub } = yield* TradePubSub.TradePubSub
    const statsRef = yield* StatsState.StatsState
    const config = yield* StatsCollectorConfig

    const dequeue = yield* PubSub.subscribe(pubsub)
    const stream = Stream.fromQueue(dequeue)

    return StatsCollector.of({
      start: pipe(
        stream,
        Stream.runForEach((tradeData: Trade.TradeData) =>
          Effect.gen(function* () {
            const { symbol, price, volume, timestamp } = tradeData

            // Update stats for this symbol (no console output)
            yield* Ref.update(statsRef, (statsMap) => {
              const currentStats =
                statsMap.get(symbol) ?? Statistics.emptyStats(config.windowConfig)
              const updatedStats = Statistics.updateStats(currentStats, price, volume, timestamp)
              return new Map(statsMap).set(symbol, updatedStats)
            })
          })
        )
      ),
    })
  })
)
