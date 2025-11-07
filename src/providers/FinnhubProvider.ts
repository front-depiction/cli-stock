import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Socket from "@effect/platform/Socket"
import * as Console from "effect/Console"
import * as Clock from "effect/Clock"
import * as Array from "effect/Array"
import * as Data from "effect/Data"
import * as Scope from "effect/Scope"
import * as Redacted from "effect/Redacted"
import { pipe } from "effect/Function"
import * as MarketDataProvider from "../services/MarketDataProvider"
import * as Trade from "../domain/Trade"
import { type FinnhubConfig } from "../config/AppConfig"

/**
 * Finnhub-specific error types.
 *
 * @category Errors
 * @since 0.3.0
 */
export class FinnhubParseError extends Data.TaggedError("FinnhubParseError")<{
  readonly message: string
  readonly rawText: string
}> {}

export class FinnhubConnectionError extends Data.TaggedError("FinnhubConnectionError")<{
  readonly reason: string
}> {}

/**
 * Finnhub WebSocket message types.
 *
 * @category Types
 * @since 0.3.0
 */
export interface SubscribeMessage {
  type: "subscribe"
  symbol: string
}

export interface UnsubscribeMessage {
  type: "unsubscribe"
  symbol: string
}

export interface TradeDataRaw {
  p: number // Price
  s: string // Symbol
  t: number // Timestamp in milliseconds
  v: number // Volume
  c?: string[] // Trade conditions
}

export interface TradeMessage {
  type: "trade"
  data: TradeDataRaw[]
}

export interface PingMessage {
  type: "ping"
}

export interface ErrorMessage {
  type: "error"
  msg: string
}

export type FinnhubMessage = TradeMessage | PingMessage | ErrorMessage

/**
 * Parse incoming Finnhub WebSocket message.
 *
 * @category Utilities
 * @since 0.3.0
 */
const parseMessage = (text: string): Effect.Effect<FinnhubMessage, FinnhubParseError> =>
  Effect.try({
    try: () => JSON.parse(text) as FinnhubMessage,
    catch: () => new FinnhubParseError({ message: "Failed to parse JSON", rawText: text }),
  })

/**
 * ANSI color codes for terminal formatting.
 *
 * @category Utilities
 * @since 0.3.0
 */
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  brightCyan: "\x1b[96m",
  brightGreen: "\x1b[92m",
}

/**
 * Finnhub configuration tag for dependency injection.
 *
 * @category Services
 * @since 0.3.0
 */
export const FinnhubConfigTag = Context.GenericTag<FinnhubConfig>("@config/FinnhubConfig")

/**
 * Finnhub MarketDataProvider implementation.
 *
 * This layer implements the MarketDataProvider interface for Finnhub's
 * WebSocket API. It:
 * - Establishes WebSocket connection with authentication
 * - Subscribes to symbols
 * - Parses and transforms Finnhub messages into Trade.TradeData
 * - Handles connection lifecycle and errors
 *
 * Type: Layer<MarketDataProvider, never, FinnhubConfig | Socket.WebSocketConstructor>
 * - RequirementsOut: MarketDataProvider (what we're creating)
 * - Error: never (errors are handled internally)
 * - RequirementsIn: FinnhubConfig | Socket.WebSocketConstructor (dependencies)
 *
 * @category Layers
 * @since 0.3.0
 * @example
 * import * as FinnhubProvider from "./providers/FinnhubProvider"
 * import * as AppConfig from "./config/AppConfig"
 * import * as Layer from "effect/Layer"
 * import * as Socket from "@effect/platform/Socket"
 *
 * const configLayer = Layer.succeed(
 *   FinnhubProvider.FinnhubConfigTag,
 *   {
 *     _tag: "finnhub",
 *     token: Redacted.make("your-token"),
 *     wsUrl: "wss://ws.finnhub.io"
 *   }
 * )
 *
 * const provider = FinnhubProvider.FinnhubProviderLive.pipe(
 *   Layer.provide(configLayer),
 *   Layer.provide(Socket.layerWebSocketConstructorGlobal)
 * )
 */
export const FinnhubProviderLive = Layer.scoped(
  MarketDataProvider.MarketDataProvider,
  Effect.gen(function* () {
    const config = yield* FinnhubConfigTag
    const scope = yield* Scope.Scope
    // Extract token from Redacted
    const token = Redacted.value(config.token)
    const wsUrl = `${config.wsUrl}?token=${token}`

    yield* Console.log(
      `${ANSI.brightCyan}Finnhub Provider: Connecting to ${config.wsUrl}...${ANSI.reset}`
    )

    // Create WebSocket connection (requires WebSocketConstructor from layer dependencies)
    const ws = yield* Socket.makeWebSocket(wsUrl)

    return MarketDataProvider.MarketDataProvider.of({
      authenticate: Effect.gen(function* () {
        yield* Console.log(`${ANSI.brightGreen}Finnhub: Connection authenticated${ANSI.reset}`)
      }),

      subscribe: (symbols) =>
        Stream.asyncScoped<Trade.TradeData>((emit) =>
          Effect.gen(function* () {
            yield* Console.log(
              `${ANSI.brightCyan}Finnhub: Subscribing to ${symbols.length} symbol(s): ${symbols.join(", ")}${ANSI.reset}`
            )

            // Process incoming WebSocket messages
            const processMessage = (
              data: string | Uint8Array
            ): Effect.Effect<void, FinnhubParseError> =>
              Effect.gen(function* () {
                const text = typeof data === "string" ? data : new TextDecoder().decode(data)
                const message = yield* parseMessage(text)

                if (message.type === "trade") {
                  const receivedTime = yield* Clock.currentTimeMillis

                  // Emit each trade to the stream
                  yield* Effect.forEach(
                    message.data,
                    (trade) => {
                      const tradeData = Trade.TradeData.make({
                        symbol: trade.s,
                        price: trade.p,
                        volume: trade.v,
                        timestamp: trade.t,
                        conditions: trade.c,
                        receivedAt: receivedTime,
                        latency: receivedTime - trade.t,
                      })
                      return Effect.promise(() => emit.single(tradeData))
                    },
                    { discard: true }
                  )
                }
              })

            // Subscribe to symbols on connection open
            const onOpen = Effect.gen(function* () {
              yield* Console.log(
                `${ANSI.brightGreen}Finnhub: WebSocket connection opened${ANSI.reset}`
              )

              yield* Effect.gen(function* () {
                const write = yield* ws.writer

                yield* pipe(
                  symbols,
                  Array.map((symbol) => {
                    const subscribeMsg: SubscribeMessage = {
                      type: "subscribe",
                      symbol: symbol,
                    }
                    return write(JSON.stringify(subscribeMsg))
                  }),
                  Effect.all,
                  Effect.asVoid
                )

                yield* Console.log(
                  `${ANSI.brightGreen}Finnhub: Subscribed to ${symbols.length} symbol(s)${ANSI.reset}`
                )
              }).pipe(
                Scope.extend(scope),
                Effect.catchAll((error) =>
                  Console.error(`Finnhub: Error in onOpen: ${JSON.stringify(error, null, 2)}`)
                )
              )
            })

            // Run WebSocket with message handler
            yield* Effect.forkScoped(
              ws
                .runRaw(
                  (data) =>
                    processMessage(data).pipe(
                      Effect.catchTag("FinnhubParseError", (error) =>
                        Console.error(
                          `Finnhub: Parse error: ${error.message}\nRaw text: ${error.rawText}`
                        )
                      )
                    ),
                  { onOpen }
                )
                .pipe(
                  Effect.catchAll((error) =>
                    Console.error(`Finnhub: WebSocket error: ${JSON.stringify(error, null, 2)}`)
                  )
                )
            )
          })
        ),
    })
  })
)
