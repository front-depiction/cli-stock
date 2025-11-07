import * as Layer from "effect/Layer"
import * as TradePubSub from "../services/TradePubSub"
import * as StatsState from "../services/StatsState"
import * as WebSocketPublisher from "../services/WebSocketPublisher"
import * as StatsCollector from "../services/StatsCollector"
import * as UIState from "../ui/state/UIState"

/**
 * Main application layer that composes all services.
 *
 * This layer follows Effect best practices:
 * - Fine-grained services are composed together
 * - Dependencies are automatically resolved
 * - No requirement leakage
 * - Provider abstraction allows easy swapping of data sources
 *
 * Layer composition structure:
 *
 * ```
 * Infrastructure (no dependencies):
 *   - TradePubSub
 *   - StatsState
 *   - UIStateAtom
 *
 * Services (depend on infrastructure and provider):
 *   - WebSocketPublisher (depends on TradePubSub, MarketDataProvider, WebSocketPublisherConfig)
 *   - StatsCollector (depends on TradePubSub, StatsState, StatsCollectorConfig)
 *   - UIRenderer (depends on TradePubSub, StatsState, UIStateAtom, UIRendererConfig)
 *
 * Provider Layer (injected externally):
 *   - MarketDataProvider (e.g., FinnhubProvider, PolygonProvider)
 *     This is NOT included in MainLive - it must be provided separately
 *     to allow for easy provider swapping.
 * ```
 *
 * @category Layers
 * @since 0.3.0
 * @example
 * import * as MainLive from "./layers/MainLive"
 * import * as FinnhubProvider from "./providers/FinnhubProvider"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = myEffect.pipe(
 *   Effect.provide(
 *     MainLive.MainLive.pipe(
 *       Layer.provide(FinnhubProvider.FinnhubProviderLive)
 *     )
 *   )
 * )
 */
export const MainLive = Layer.mergeAll(
  WebSocketPublisher.WebSocketPublisherLive,
  StatsCollector.StatsCollectorLive,
  UIState.UIStateAtomLive
).pipe(Layer.provide(Layer.mergeAll(TradePubSub.TradePubSubLiveDefault, StatsState.StatsStateLive)))
