#!/usr/bin/env bun

import { BunContext, BunRuntime } from "@effect/platform-bun"
import * as Socket from "@effect/platform/Socket"
import * as Cli from "@effect/cli"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Array from "effect/Array"
import * as Redacted from "effect/Redacted"
import { pipe } from "effect/Function"
import { render } from "@opentui/react"
import * as MainLive from "./layers/MainLive"
import * as WebSocketPublisher from "./services/WebSocketPublisher"
import * as StatsCollector from "./services/StatsCollector"
import * as UIState from "./ui/state/UIState"
import * as Statistics from "./domain/Statistics"
import * as FinnhubProvider from "./providers/FinnhubProvider"
import { App } from "./ui/components/App"

/**
 * CLI option definitions.
 */
const tokenOption = Cli.Options.text("token").pipe(
  Cli.Options.withAlias("t"),
  Cli.Options.withDescription("Your Finnhub.io API token")
)

const symbolOption = Cli.Options.text("symbol").pipe(
  Cli.Options.withAlias("s"),
  Cli.Options.withDefault("AAPL"),
  Cli.Options.withDescription(
    "Symbol(s) to subscribe to (comma-separated, e.g., AAPL,MSFT,BINANCE:BTCUSDT)"
  )
)

const wsUrlOption = Cli.Options.text("url").pipe(
  Cli.Options.withAlias("u"),
  Cli.Options.withDefault("wss://ws.finnhub.io"),
  Cli.Options.withDescription("WebSocket URL (default: wss://ws.finnhub.io)")
)

const maxTradesOption = Cli.Options.integer("max-trades").pipe(
  Cli.Options.withDefault(20),
  Cli.Options.withDescription("Maximum number of trades to display (default: 20)")
)

const windowSizeOption = Cli.Options.integer("window-size").pipe(
  Cli.Options.withDefault(20),
  Cli.Options.withDescription("Window size for statistics (default: 20 trades)")
)

const enhancedMetricsOption = Cli.Options.boolean("enhanced-metrics").pipe(
  Cli.Options.withDefault(true),
  Cli.Options.withDescription("Show enhanced trading metrics (default: true)")
)

/**
 * Main command handler that orchestrates the application.
 *
 * This handler:
 * 1. Starts background services (WebSocketPublisher, StatsCollector)
 * 2. Gets the UI state atom (which auto-updates from streams)
 * 3. Renders OpenTUI App component with the atom
 * 4. Blocks until user exits (Ctrl+C)
 */
const createCommandHandler = Effect.gen(function* () {
  const config = yield* UIState.UIStateConfig
  const webSocketPublisher = yield* WebSocketPublisher.WebSocketPublisher
  const statsCollector = yield* StatsCollector.StatsCollector
  const uiStateAtom = yield* UIState.UIStateAtom

  // Fork background services
  yield* Effect.forkScoped(webSocketPublisher.start)
  yield* Effect.forkScoped(statsCollector.start)

  // Render OpenTUI App with reactive Atom (atom handles its own updates from streams)
  yield* Effect.sync(() => {
    render(<App stateAtom={uiStateAtom} showEnhancedMetrics={config.showEnhancedMetrics} />)
  })

  // Block until interrupted (Ctrl+C)
  yield* Effect.never
})

/**
 * Create the CLI command with proper layer composition.
 */
const command = Cli.Command.make(
  "finnhub-trades",
  {
    token: tokenOption,
    symbol: symbolOption,
    url: wsUrlOption,
    maxTrades: maxTradesOption,
    windowSize: windowSizeOption,
    enhancedMetrics: enhancedMetricsOption,
  },
  ({ token, symbol, url, maxTrades, windowSize, enhancedMetrics }) => {
    // Parse symbols for configuration
    const symbolList = pipe(
      symbol.split(","),
      Array.map((s) => s.trim()),
      Array.filter((s) => s.length > 0)
    )

    // Create window configuration (event-based)
    const windowConfig: Statistics.WindowConfig = {
      _tag: "EventBased",
      size: windowSize,
    }

    // Create Finnhub provider configuration
    const finnhubConfig = Layer.succeed(FinnhubProvider.FinnhubConfigTag, {
      _tag: "finnhub" as const,
      token: Redacted.make(token),
      wsUrl: url,
    })

    // Create WebSocketPublisher configuration
    const webSocketPublisherConfig = Layer.succeed(WebSocketPublisher.WebSocketPublisherConfig, {
      symbols: symbolList,
    })

    const statsCollectorConfig = Layer.succeed(StatsCollector.StatsCollectorConfig, {
      symbols: symbolList,
      windowConfig,
      displayInterval: 5,
      showEnhancedMetrics: enhancedMetrics,
    })

    const uiStateConfig = Layer.succeed(UIState.UIStateConfig, {
      symbols: symbolList,
      maxTrades,
      showEnhancedMetrics: enhancedMetrics,
    })

    // Combine configuration layers
    const configLayer = Layer.mergeAll(
      finnhubConfig,
      webSocketPublisherConfig,
      statsCollectorConfig,
      uiStateConfig
    )

    // Compose the full application layer by providing all dependencies
    // First provide FinnhubConfig to FinnhubProviderLive, along with WebSocketConstructor
    const finnhubLayer = Layer.provide(
      FinnhubProvider.FinnhubProviderLive,
      Layer.mergeAll(finnhubConfig, Socket.layerWebSocketConstructorGlobal)
    )

    // Then merge all dependency layers and provide to MainLive
    const appLayer = Layer.provideMerge(
      MainLive.MainLive,
      Layer.mergeAll(finnhubLayer, webSocketPublisherConfig, statsCollectorConfig, uiStateConfig)
    )

    // Run the command handler with all layers
    return Effect.scoped(createCommandHandler).pipe(Effect.provide(appLayer))
  }
)

/**
 * Create the CLI app.
 */
const cli = Cli.Command.run(command, {
  name: "Finnhub Trades CLI",
  version: "2.0.0",
})

/**
 * Run the app with Bun runtime.
 */
pipe(cli(process.argv), Effect.provide(BunContext.layer), BunRuntime.runMain)
