import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as PubSub from "effect/PubSub"
import * as TradePubSub from "./TradePubSub"
import * as MarketDataProvider from "./MarketDataProvider"

/**
 * WebSocketPublisher Service - Bridges MarketDataProvider to TradePubSub.
 *
 * This service:
 * - Subscribes to market data from the configured provider
 * - Publishes trades to TradePubSub for distribution to consumers
 * - Abstracts the specific provider implementation
 * - No requirement leakage in service interface
 *
 * The architecture is now:
 * MarketDataProvider (provider-specific) -> WebSocketPublisher (bridge) -> TradePubSub (broadcast)
 *
 * @category Services
 * @since 0.3.0
 * @example
 * import * as WebSocketPublisher from "./services/WebSocketPublisher"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const publisher = yield* WebSocketPublisher.WebSocketPublisher
 *   yield* publisher.start
 * })
 */
export class WebSocketPublisher extends Context.Tag("@services/WebSocketPublisher")<
  WebSocketPublisher,
  {
    readonly start: Effect.Effect<void>
  }
>() {}

/**
 * Configuration for WebSocketPublisher.
 *
 * @category Configuration
 * @since 0.3.0
 */
export interface WebSocketPublisherConfig {
  readonly symbols: ReadonlyArray<string>
}

/**
 * Configuration service for WebSocketPublisher.
 *
 * @category Services
 * @since 0.3.0
 */
export const WebSocketPublisherConfig = Context.GenericTag<WebSocketPublisherConfig>(
  "@services/WebSocketPublisherConfig"
)

/**
 * Layer that provides the WebSocketPublisher service.
 *
 * This layer acts as a bridge between MarketDataProvider and TradePubSub.
 * It subscribes to the provider's trade stream and publishes to the PubSub.
 *
 * Type: Layer<WebSocketPublisher, never, TradePubSub | MarketDataProvider | WebSocketPublisherConfig>
 * - RequirementsOut: WebSocketPublisher (what we're creating)
 * - Error: never (errors are handled internally)
 * - RequirementsIn: TradePubSub | MarketDataProvider | WebSocketPublisherConfig (dependencies)
 *
 * @category Layers
 * @since 0.3.0
 * @example
 * import * as WebSocketPublisher from "./services/WebSocketPublisher"
 * import * as TradePubSub from "./services/TradePubSub"
 * import * as FinnhubProvider from "./providers/FinnhubProvider"
 * import * as Layer from "effect/Layer"
 *
 * const config = Layer.succeed(
 *   WebSocketPublisher.WebSocketPublisherConfig,
 *   { symbols: ["AAPL", "MSFT"] }
 * )
 *
 * const MainLive = Layer.mergeAll(
 *   TradePubSub.TradePubSubLive,
 *   WebSocketPublisher.WebSocketPublisherLive
 * ).pipe(
 *   Layer.provide(config),
 *   Layer.provide(FinnhubProvider.FinnhubProviderLive)
 * )
 */
export const WebSocketPublisherLive = Layer.scoped(
  WebSocketPublisher,
  Effect.gen(function* () {
    const { pubsub } = yield* TradePubSub.TradePubSub
    const provider = yield* MarketDataProvider.MarketDataProvider
    const config = yield* WebSocketPublisherConfig

    return WebSocketPublisher.of({
      start: Effect.gen(function* () {
        // Authenticate with the provider
        yield* provider.authenticate

        // Subscribe to symbols and publish trades to PubSub
        yield* Stream.runForEach(provider.subscribe(config.symbols), (trade) =>
          PubSub.publish(pubsub, trade)
        )
      }),
    })
  })
)
