import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import * as PubSub from "effect/PubSub"
import * as Array from "effect/Array"
import * as Chunk from "effect/Chunk"
import { pipe } from "effect/Function"
import type * as Trade from "../domain/Trade"

/**
 * TradePubSub Service - Broadcast hub for trade distribution with typed subscribers.
 *
 * This service provides:
 * - PubSub-based fan-out for multiple independent subscribers
 * - Automatic backpressure handling
 * - Optional time-ordered trade stream
 * - No requirement leakage (service interface has Requirements = never)
 *
 * @category Services
 * @since 0.2.0
 * @example
 * import * as TradePubSub from "./services/TradePubSub"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* TradePubSub.TradePubSub
 *   yield* pubsub.publish(tradeData)
 *
 *   // Subscribe to ordered stream (each call creates a new subscriber)
 *   yield* Stream.runForEach(pubsub.subscribe(), (trade) =>
 *     Effect.log(`Received: ${trade.symbol}`)
 *   )
 * })
 */
export class TradePubSub extends Context.Tag("@services/TradePubSub")<
  TradePubSub,
  {
    readonly pubsub: PubSub.PubSub<Trade.TradeData>
  }
>() {}

/**
 * Configuration for TradePubSub broadcasting.
 *
 * @category Configuration
 * @since 0.2.0
 */
export interface TradePubSubConfig {
  readonly capacity: number
  readonly replay: number
  readonly sortByTimestamp: boolean
}

/**
 * Configuration service for TradePubSub.
 *
 * @category Services
 * @since 0.2.0
 */
export const TradePubSubConfig = Context.GenericTag<TradePubSubConfig>(
  "@services/TradePubSubConfig"
)

/**
 * Default configuration for TradePubSub.
 *
 * @category Configuration
 * @since 0.2.0
 */
export const defaultConfig: TradePubSubConfig = {
  capacity: 1024,
  replay: 0,
  sortByTimestamp: true,
}

/**
 * Order trades by timestamp for time-ordered stream processing.
 *
 * @category Utilities
 * @since 0.2.0
 */
const orderByTimestamp: Order.Order<Trade.TradeData> = Order.mapInput(
  Order.number,
  (trade) => trade.timestamp
)

/**
 * Layer that provides the TradePubSub service using Effect PubSub.
 *
 * Architecture:
 * - Each subscribe() call creates a new queue via PubSub.subscribe
 * - PubSub handles fan-out internally - that's its entire purpose
 * - Stream.unwrapScoped ensures subscription happens in the consumer's fiber scope
 * - Optional time-based sorting on subscriber streams
 *
 * Type: Layer<TradePubSub, never, TradePubSubConfig>
 * - RequirementsOut: TradePubSub (what we're creating)
 * - Error: never (construction cannot fail)
 * - RequirementsIn: TradePubSubConfig (configuration dependency)
 *
 * @category Layers
 * @since 0.2.0
 * @example
 * import * as TradePubSub from "./services/TradePubSub"
 * import * as Layer from "effect/Layer"
 *
 * const config = Layer.succeed(
 *   TradePubSub.TradePubSubConfig,
 *   { capacity: 2048, replay: 0, sortByTimestamp: true }
 * )
 *
 * const program = myEffect.pipe(
 *   Effect.provide(TradePubSub.TradePubSubLive),
 *   Effect.provide(config)
 * )
 */
export const TradePubSubLive = Layer.scoped(
  TradePubSub,
  Effect.gen(function* () {
    const config = yield* TradePubSubConfig
    const pubsub = yield* PubSub.bounded<Trade.TradeData>(config.capacity)
    return TradePubSub.of({ pubsub })
  })
)

/**
 * Layer with default configuration.
 *
 * @category Layers
 * @since 0.2.0
 */
export const TradePubSubLiveDefault = Layer.provide(
  TradePubSubLive,
  Layer.succeed(TradePubSubConfig, defaultConfig)
)

/**
 * Typed subscriber for specific trade stream processing.
 *
 * @category Utilities
 * @since 0.2.0
 * @example
 * import * as TradePubSub from "./services/TradePubSub"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const statsSubscriber = TradePubSub.createSubscriber(
 *   "stats",
 *   (trade) => Effect.log(`Stats processing: ${trade.symbol}`)
 * )
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* TradePubSub.TradePubSub
 *   yield* statsSubscriber(pubsub.subscribe())
 * })
 */
export const createSubscriber =
  <E = never, R = never>(
    name: string,
    handler: (trade: Trade.TradeData) => Effect.Effect<void, E, R>
  ) =>
  (stream: Stream.Stream<Trade.TradeData>): Effect.Effect<void, E, R> =>
    pipe(
      stream,
      Stream.runForEach((trade) =>
        pipe(
          handler(trade),
          Effect.catchAllCause((cause) => Effect.logError(`[${name}] Subscriber error: ${cause}`))
        )
      )
    )

/**
 * Filter stream for specific symbol.
 *
 * @category Utilities
 * @since 0.2.0
 * @example
 * import * as TradePubSub from "./services/TradePubSub"
 * import * as Stream from "effect/Stream"
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* TradePubSub.TradePubSub
 *   const appleStream = TradePubSub.filterBySymbol("AAPL")(pubsub.subscribe())
 *   yield* Stream.runForEach(appleStream, (trade) => Effect.log(trade.price))
 * })
 */
export const filterBySymbol =
  (symbol: string) =>
  (stream: Stream.Stream<Trade.TradeData>): Stream.Stream<Trade.TradeData> =>
    pipe(
      stream,
      Stream.filter((trade) => trade.symbol === symbol)
    )

/**
 * Filter stream by multiple symbols.
 *
 * @category Utilities
 * @since 0.2.0
 */
export const filterBySymbols =
  (symbols: ReadonlyArray<string>) =>
  (stream: Stream.Stream<Trade.TradeData>): Stream.Stream<Trade.TradeData> => {
    const symbolSet = new Set(symbols)
    return pipe(
      stream,
      Stream.filter((trade) => symbolSet.has(trade.symbol))
    )
  }

/**
 * Tap into stream without consuming it (useful for logging/monitoring).
 *
 * @category Utilities
 * @since 0.2.0
 * @example
 * import * as TradePubSub from "./services/TradePubSub"
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* TradePubSub.TradePubSub
 *   const monitored = TradePubSub.tap(
 *     (trade) => Effect.log(`Monitor: ${trade.symbol}`)
 *   )(pubsub.subscribe())
 * })
 */
export const tap =
  <E = never, R = never>(f: (trade: Trade.TradeData) => Effect.Effect<void, E, R>) =>
  (stream: Stream.Stream<Trade.TradeData>): Stream.Stream<Trade.TradeData, E, R> =>
    pipe(stream, Stream.tap(f))
