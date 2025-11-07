/**
 * PolygonProvider - Example implementation for Polygon.io market data.
 *
 * This is a skeleton/example showing how to implement a new provider.
 * To use this:
 * 1. Rename to PolygonProvider.ts
 * 2. Implement the WebSocket connection logic
 * 3. Parse Polygon messages into Trade.TradeData format
 * 4. Update index.ts to use PolygonProviderLive instead of FinnhubProviderLive
 *
 * @category Providers
 * @since 0.3.0
 */

import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Socket from "@effect/platform/Socket"
import * as Console from "effect/Console"
import * as Clock from "effect/Clock"
import * as Redacted from "effect/Redacted"
import * as Data from "effect/Data"
import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as MarketDataProvider from "../services/MarketDataProvider"
import * as Trade from "../domain/Trade"

/**
 * Polygon-specific error types.
 */
export class PolygonParseError extends Data.TaggedError("PolygonParseError")<{
  readonly message: string
  readonly rawText: string
}> {}

/**
 * Polygon provider configuration.
 */
export interface PolygonConfig {
  readonly _tag: "polygon"
  readonly apiKey: Redacted.Redacted
  readonly wsUrl: string
}

/**
 * Polygon configuration tag for dependency injection.
 */
export const PolygonConfig = Context.GenericTag<PolygonConfig>("@config/PolygonConfig")

/**
 * Polygon WebSocket message types.
 *
 * Reference: https://polygon.io/docs/stocks/ws_stocks_t
 */
export interface PolygonTradeMessage {
  ev: "T" // Event type (T = Trade)
  sym: string // Symbol
  x: number // Exchange ID
  i: string // Trade ID
  z: number // Tape
  p: number // Price
  s: number // Size (volume)
  c: number[] // Conditions
  t: number // Timestamp (nanoseconds)
}

export interface PolygonStatusMessage {
  ev: "status"
  status: string
  message: string
}

export type PolygonMessage = PolygonTradeMessage | PolygonStatusMessage

/**
 * Parse incoming Polygon WebSocket message.
 */
const parseMessage = (text: string): Effect.Effect<PolygonMessage[], PolygonParseError> =>
  Effect.try({
    try: () => JSON.parse(text) as PolygonMessage[],
    catch: () => new PolygonParseError({ message: "Failed to parse JSON", rawText: text }),
  })

/**
 * Convert Polygon trade to standard Trade.TradeData format.
 */
const convertTrade = (trade: PolygonTradeMessage, receivedAt: number): Trade.TradeData =>
  Trade.TradeData.make({
    symbol: trade.sym,
    price: trade.p,
    volume: trade.s,
    timestamp: Math.floor(trade.t / 1_000_000), // Convert nanoseconds to milliseconds
    conditions: trade.c?.map(String),
    receivedAt,
    latency: receivedAt - Math.floor(trade.t / 1_000_000),
  })

/**
 * Polygon MarketDataProvider implementation.
 *
 * Type: Layer<MarketDataProvider, never, PolygonConfig | Socket.WebSocketConstructor>
 *
 * @category Layers
 * @since 0.3.0
 * @example
 * import * as PolygonProvider from "./providers/PolygonProvider"
 * import * as Layer from "effect/Layer"
 * import * as Socket from "@effect/platform/Socket"
 * import * as Redacted from "effect/Redacted"
 *
 * const configLayer = Layer.succeed(
 *   PolygonProvider.PolygonConfig,
 *   {
 *     _tag: "polygon",
 *     apiKey: Redacted.make("your-api-key"),
 *     wsUrl: "wss://socket.polygon.io/stocks"
 *   }
 * )
 *
 * const provider = PolygonProvider.PolygonProviderLive.pipe(
 *   Layer.provide(configLayer),
 *   Layer.provide(Socket.layerWebSocketConstructorGlobal)
 * )
 */
export const PolygonProviderLive = Layer.scoped(
  MarketDataProvider.MarketDataProvider,
  Effect.gen(function* () {
    const config = yield* PolygonConfig

    // Extract API key from Redacted
    const apiKey = Redacted.value(config.apiKey)
    const wsUrl = `${config.wsUrl}`

    yield* Console.log(`Polygon Provider: Connecting to ${config.wsUrl}...`)

    // Create WebSocket connection
    const ws = yield* Socket.makeWebSocket(wsUrl)

    return MarketDataProvider.MarketDataProvider.of({
      authenticate: Effect.gen(function* () {
        yield* Console.log("Polygon: Authenticating...")

        // Polygon requires authentication message after connection
        yield* Effect.scoped(
          Effect.gen(function* () {
            const write = yield* ws.writer
            const authMsg = JSON.stringify({ action: "auth", params: apiKey })
            yield* write(authMsg)
            yield* Console.log("Polygon: Authentication sent")
          })
        ).pipe(
          Effect.catchAll((error) =>
            Console.error(`Polygon: Error authenticating: ${JSON.stringify(error, null, 2)}`)
          )
        )
      }),

      subscribe: (symbols) =>
        Stream.asyncScoped<Trade.TradeData>((emit) =>
          Effect.gen(function* () {
            yield* Console.log(
              `Polygon: Subscribing to ${symbols.length} symbol(s): ${symbols.join(", ")}`
            )

            // Process incoming WebSocket messages
            const processMessage = (
              data: string | Uint8Array
            ): Effect.Effect<void, PolygonParseError> =>
              Effect.gen(function* () {
                const text = typeof data === "string" ? data : new TextDecoder().decode(data)
                const messages = yield* parseMessage(text)
                const receivedTime = yield* Clock.currentTimeMillis

                yield* Effect.forEach(
                  messages,
                  (message) => {
                    if (message.ev === "T") {
                      // Trade message
                      const tradeData = convertTrade(message, receivedTime)
                      return Effect.promise(() => emit.single(tradeData))
                    } else {
                      // Status message
                      return Console.log(`Polygon status: ${message.status} - ${message.message}`)
                    }
                  },
                  { discard: true }
                )
              })

            // Subscribe to symbols on connection open
            const onOpen = Effect.gen(function* () {
              yield* Console.log("Polygon: WebSocket connection opened")

              yield* Effect.scoped(
                Effect.gen(function* () {
                  const write = yield* ws.writer

                  // Polygon uses a single subscription message with all symbols
                  const subscribeMsg = JSON.stringify({
                    action: "subscribe",
                    params: symbols.join(","),
                  })

                  yield* write(subscribeMsg)
                  yield* Console.log(`Polygon: Subscribed to ${symbols.length} symbol(s)`)
                })
              ).pipe(
                Effect.catchAll((error) =>
                  Console.error(`Polygon: Error in onOpen: ${JSON.stringify(error, null, 2)}`)
                )
              )
            })

            // Run WebSocket with message handler
            yield* Effect.forkScoped(
              ws
                .runRaw(
                  (data) =>
                    processMessage(data).pipe(
                      Effect.catchTag("PolygonParseError", (error) =>
                        Console.error(
                          `Polygon: Parse error: ${error.message}\nRaw text: ${error.rawText}`
                        )
                      )
                    ),
                  { onOpen }
                )
                .pipe(
                  Effect.catchAll((error) =>
                    Console.error(`Polygon: WebSocket error: ${JSON.stringify(error, null, 2)}`)
                  )
                )
            )
          })
        ),
    })
  })
)
