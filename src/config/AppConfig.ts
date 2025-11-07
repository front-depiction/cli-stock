import * as Config from "effect/Config"
import * as ConfigError from "effect/ConfigError"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as Redacted from "effect/Redacted"

/**
 * Application configuration using Effect Config module.
 *
 * This module defines all configuration needed for the application,
 * supporting both environment variables and programmatic configuration.
 *
 * Environment Variables:
 * - MARKET_DATA_PROVIDER: Provider type ("finnhub" | "polygon") [default: "finnhub"]
 * - FINNHUB_TOKEN: Finnhub API token (required if using Finnhub)
 * - FINNHUB_WS_URL: Finnhub WebSocket URL [default: "wss://ws.finnhub.io"]
 * - SYMBOLS: Comma-separated symbols [default: "AAPL"]
 *
 * @category Configuration
 * @since 0.3.0
 * @example
 * import * as AppConfig from "./config/AppConfig"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* AppConfig.config
 *   console.log(`Using provider: ${config.provider._tag}`)
 * })
 */

/**
 * Provider type discriminated union.
 *
 * @category Types
 * @since 0.3.0
 */
export type ProviderType = "finnhub" | "polygon"

/**
 * Finnhub provider configuration.
 *
 * @category Types
 * @since 0.3.0
 */
export interface FinnhubConfig {
  readonly _tag: "finnhub"
  readonly token: Redacted.Redacted
  readonly wsUrl: string
}

/**
 * Polygon provider configuration (placeholder for future implementation).
 *
 * @category Types
 * @since 0.3.0
 */
export interface PolygonConfig {
  readonly _tag: "polygon"
  readonly apiKey: Redacted.Redacted
  readonly wsUrl: string
}

/**
 * Provider configuration union.
 *
 * @category Types
 * @since 0.3.0
 */
export type ProviderConfig = FinnhubConfig | PolygonConfig

/**
 * Complete application configuration.
 *
 * @category Types
 * @since 0.3.0
 */
export interface AppConfig {
  readonly provider: ProviderConfig
  readonly symbols: ReadonlyArray<string>
}

/**
 * Parse comma-separated symbols into array.
 *
 * @category Utilities
 * @since 0.3.0
 */
const parseSymbols = (symbolsStr: string): ReadonlyArray<string> =>
  symbolsStr
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

/**
 * Finnhub provider configuration.
 *
 * @category Configuration
 * @since 0.3.0
 */
export const finnhubConfig: Config.Config<FinnhubConfig> = Config.all({
  _tag: Config.succeed("finnhub" as const),
  token: Config.redacted("FINNHUB_TOKEN"),
  wsUrl: Config.string("FINNHUB_WS_URL").pipe(Config.withDefault("wss://ws.finnhub.io")),
})

/**
 * Polygon provider configuration (placeholder).
 *
 * @category Configuration
 * @since 0.3.0
 */
export const polygonConfig: Config.Config<PolygonConfig> = Config.all({
  _tag: Config.succeed("polygon" as const),
  apiKey: Config.redacted("POLYGON_API_KEY"),
  wsUrl: Config.string("POLYGON_WS_URL").pipe(Config.withDefault("wss://socket.polygon.io")),
})

/**
 * Provider configuration based on MARKET_DATA_PROVIDER env var.
 *
 * Dynamically selects between Finnhub and Polygon based on the MARKET_DATA_PROVIDER
 * environment variable (defaults to "finnhub").
 *
 * @category Configuration
 * @since 0.3.0
 */
export const providerConfig: Config.Config<ProviderConfig> = Config.suspend(() => {
  const providerType = Config.string("MARKET_DATA_PROVIDER").pipe(Config.withDefault("finnhub"))

  return pipe(
    providerType,
    Config.zipWith(
      Config.all({
        finnhub: finnhubConfig.pipe(Config.option),
        polygon: polygonConfig.pipe(Config.option),
      }),
      (provider, { finnhub, polygon }) => {
        if (provider === "finnhub" && finnhub) {
          return finnhub
        } else if (provider === "polygon" && polygon) {
          return polygon
        } else if (finnhub) {
          return finnhub
        } else if (polygon) {
          return polygon
        }
        throw new Error(`No valid provider config found for type: ${provider}`)
      }
    )
  ) as any as Config.Config<ProviderConfig>
})

/**
 * Complete application configuration.
 *
 * @category Configuration
 * @since 0.3.0
 * @example
 * import * as AppConfig from "./config/AppConfig"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const cfg = yield* AppConfig.config
 *   console.log(`Provider: ${cfg.provider._tag}`)
 *   console.log(`Symbols: ${cfg.symbols.join(", ")}`)
 * })
 */
export const config: Config.Config<AppConfig> = Config.all({
  provider: providerConfig,
  symbols: Config.string("SYMBOLS").pipe(
    Config.withDefault("AAPL"),
    Config.map(parseSymbols),
    Config.validate({
      message: "Symbols array cannot be empty",
      validation: (symbols) => symbols.length > 0,
    })
  ),
})
