import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import type * as Trade from "../domain/Trade"

/**
 * MarketDataProvider - Generic market data streaming abstraction.
 *
 * This service abstracts the data source (Finnhub, Polygon, etc.) behind a
 * capability-based interface, making it trivial to swap providers.
 *
 * The service provides:
 * - Authentication/connection lifecycle
 * - Symbol subscription with trade stream
 * - No requirement leakage (Requirements = never)
 *
 * @category Services
 * @since 0.3.0
 * @example
 * import * as MarketDataProvider from "./services/MarketDataProvider"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const program = Effect.gen(function* () {
 *   const provider = yield* MarketDataProvider.MarketDataProvider
 *   yield* provider.authenticate
 *
 *   yield* Stream.runForEach(
 *     provider.subscribe(["AAPL", "MSFT"]),
 *     (trade) => Effect.log(`${trade.symbol}: ${trade.price}`)
 *   )
 * })
 */
export class MarketDataProvider extends Context.Tag("@services/MarketDataProvider")<
  MarketDataProvider,
  {
    /**
     * Authenticate and establish connection to the data source.
     * This may include WebSocket connection, API key validation, etc.
     */
    readonly authenticate: Effect.Effect<void>

    /**
     * Subscribe to market data for the given symbols.
     * Returns a stream of trade data that continues indefinitely.
     *
     * @param symbols - Array of symbols to subscribe to (e.g., ["AAPL", "MSFT"])
     * @returns Stream of trade data
     */
    readonly subscribe: (symbols: ReadonlyArray<string>) => Stream.Stream<Trade.TradeData>
  }
>() {}
