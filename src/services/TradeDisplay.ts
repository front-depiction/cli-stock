import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as PubSub from "effect/PubSub"
import * as Console from "effect/Console"
import { pipe } from "effect/Function"
import * as TradePubSub from "./TradePubSub"
import * as Trade from "../domain/Trade"

/**
 * ANSI color codes for terminal formatting.
 *
 * @category Utilities
 * @since 0.1.0
 */
export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  brightCyan: "\x1b[96m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
}

/**
 * Format timestamp as HH:MM:SS.mmm.
 *
 * @category Utilities
 * @since 0.1.0
 */
const formatTime = (millis: number): string => {
  const date = new Date(millis)
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  const milliseconds = date.getMilliseconds().toString().padStart(3, "0")
  return `${hours}:${minutes}:${seconds}.${milliseconds}`
}

/**
 * Format trade data for display with latency tracking.
 *
 * @category Utilities
 * @since 0.1.0
 */
const formatTradeCompact = (tradeData: Trade.TradeData): string => {
  const tradeTime = formatTime(tradeData.timestamp)
  const latency = tradeData.latency

  // Color-code latency: green if < 100ms, yellow if < 500ms, magenta if >= 500ms
  const latencyColor =
    latency < 100 ? ANSI.brightGreen : latency < 500 ? ANSI.brightYellow : ANSI.magenta

  return `${ANSI.dim}${tradeTime}${ANSI.reset} ${ANSI.brightCyan}${tradeData.symbol.padEnd(20)}${ANSI.reset} ${ANSI.green}$${tradeData.price.toFixed(2).padStart(10)}${ANSI.reset} ${ANSI.yellow}${tradeData.volume.toString().padStart(8)}${ANSI.reset} ${latencyColor}${latency}ms${ANSI.reset}`
}

/**
 * TradeDisplay Service - Subscribes to trades and displays them.
 *
 * This service:
 * - Subscribes to TradePubSub
 * - Formats and displays each trade
 * - No requirement leakage in service interface
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as TradeDisplay from "./services/TradeDisplay"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const display = yield* TradeDisplay.TradeDisplay
 *   yield* display.start
 * })
 */
export class TradeDisplay extends Context.Tag("@services/TradeDisplay")<
  TradeDisplay,
  {
    readonly start: Effect.Effect<void>
  }
>() {}

/**
 * Layer that provides the TradeDisplay service.
 *
 * Type: Layer<TradeDisplay, never, TradePubSub>
 * - RequirementsOut: TradeDisplay (what we're creating)
 * - Error: never (errors are handled internally)
 * - RequirementsIn: TradePubSub (dependencies)
 *
 * @category Layers
 * @since 0.1.0
 * @example
 * import * as TradeDisplay from "./services/TradeDisplay"
 * import * as TradePubSub from "./services/TradePubSub"
 * import * as Layer from "effect/Layer"
 *
 * const MainLive = Layer.mergeAll(
 *   TradePubSub.TradePubSubLive,
 *   TradeDisplay.TradeDisplayLive
 * )
 */
export const TradeDisplayLive = Layer.scoped(
  TradeDisplay,
  Effect.gen(function* () {
    const { pubsub } = yield* TradePubSub.TradePubSub

    const dequeue = yield* PubSub.subscribe(pubsub)
    const stream = Stream.fromQueue(dequeue)

    return TradeDisplay.of({
      start: pipe(
        stream,
        Stream.runForEach((tradeData: Trade.TradeData) =>
          Console.log(formatTradeCompact(tradeData))
        )
      ),
    })
  })
)
