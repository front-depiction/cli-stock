import * as Schema from "effect/Schema"
import * as Brand from "effect/Brand"
import * as Order from "effect/Order"
import * as DateTime from "effect/DateTime"
import * as Equivalence from "effect/Equivalence"

/**
 * Branded type for stock/crypto symbols.
 *
 * @category Brands
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 *
 * const symbol = Trade.Symbol.make("AAPL")
 */
export type Symbol = string & Brand.Brand<"Symbol">

/**
 * Brand for Symbol.
 *
 * @category Brands
 * @since 0.1.0
 */
export const Symbol = Brand.nominal<Symbol>()

/**
 * Branded type for trade prices.
 *
 * @category Brands
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 *
 * const price = Trade.Price.make(150.25)
 */
export type Price = number & Brand.Brand<"Price">

/**
 * Brand for Price.
 *
 * @category Brands
 * @since 0.1.0
 */
export const Price = Brand.refined<Price>(
  (n) => n >= 0,
  (n) => Brand.error(`Price must be non-negative, got ${n}`)
)

/**
 * Branded type for trade volume.
 *
 * @category Brands
 * @since 0.1.0
 */
export type Volume = number & Brand.Brand<"Volume">

/**
 * Brand for Volume.
 *
 * @category Brands
 * @since 0.1.0
 */
export const Volume = Brand.refined<Volume>(
  (n) => n >= 0,
  (n) => Brand.error(`Volume must be non-negative, got ${n}`)
)

/**
 * Branded type for timestamp in milliseconds.
 *
 * @category Brands
 * @since 0.1.0
 */
export type Timestamp = number & Brand.Brand<"Timestamp">

/**
 * Brand for Timestamp.
 *
 * @category Brands
 * @since 0.1.0
 */
export const Timestamp = Brand.refined<Timestamp>(
  (n) => n > 0,
  (n) => Brand.error(`Timestamp must be positive, got ${n}`)
)

/**
 * Branded type for latency in milliseconds.
 *
 * @category Brands
 * @since 0.1.0
 */
export type Latency = number & Brand.Brand<"Latency">

/**
 * Brand for Latency.
 *
 * @category Brands
 * @since 0.1.0
 */
export const Latency = Brand.refined<Latency>(
  (n) => n >= 0,
  (n) => Brand.error(`Latency must be non-negative, got ${n}`)
)

/**
 * Schema for TradeData representing a trade from Finnhub.
 *
 * @category Schemas
 * @since 0.1.0
 */
export const TradeData = Schema.Struct({
  symbol: Schema.String,
  price: Schema.Number,
  volume: Schema.Number,
  timestamp: Schema.Number,
  conditions: Schema.optional(Schema.Array(Schema.String)),
  receivedAt: Schema.Number,
  latency: Schema.Number,
})

/**
 * Type for TradeData.
 *
 * @category Types
 * @since 0.1.0
 */
export type TradeData = Schema.Schema.Type<typeof TradeData>

/**
 * Type guard for TradeData.
 *
 * @category Guards
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 *
 * if (Trade.isTradeData(value)) {
 *   // value is TradeData
 * }
 */
export const isTradeData = Schema.is(TradeData)

/**
 * Structural equality for TradeData.
 *
 * @category Equivalence
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 *
 * const trade1 = Trade.TradeData.make({ ... })
 * const trade2 = Trade.TradeData.make({ ... })
 *
 * if (Trade.Equivalence(trade1, trade2)) {
 *   // Structurally equal
 * }
 */
export const TradeEquivalence: Equivalence.Equivalence<TradeData> = Equivalence.make(
  (a, b) =>
    a.symbol === b.symbol &&
    a.price === b.price &&
    a.volume === b.volume &&
    a.timestamp === b.timestamp
)

/**
 * Order by timestamp.
 *
 * @category Orders
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 * import * as Array from "effect/Array"
 * import { pipe } from "effect/Function"
 *
 * const sorted = pipe(trades, Array.sort(Trade.OrderByTimestamp))
 */
export const OrderByTimestamp: Order.Order<TradeData> = Order.mapInput(
  Order.number,
  (trade) => trade.timestamp
)

/**
 * Order by price.
 *
 * @category Orders
 * @since 0.1.0
 */
export const OrderByPrice: Order.Order<TradeData> = Order.mapInput(
  Order.number,
  (trade) => trade.price
)

/**
 * Order by symbol.
 *
 * @category Orders
 * @since 0.1.0
 */
export const OrderBySymbol: Order.Order<TradeData> = Order.mapInput(
  Order.string,
  (trade) => trade.symbol
)

/**
 * Order by latency.
 *
 * @category Orders
 * @since 0.1.0
 */
export const OrderByLatency: Order.Order<TradeData> = Order.mapInput(
  Order.number,
  (trade) => trade.latency
)

/**
 * Get the symbol from a trade.
 *
 * @category Destructors
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 *
 * const symbol = Trade.getSymbol(trade)
 */
export const getSymbol = (self: TradeData): string => self.symbol

/**
 * Get the price from a trade.
 *
 * @category Destructors
 * @since 0.1.0
 */
export const getPrice = (self: TradeData): number => self.price

/**
 * Get the volume from a trade.
 *
 * @category Destructors
 * @since 0.1.0
 */
export const getVolume = (self: TradeData): number => self.volume

/**
 * Get the timestamp from a trade.
 *
 * @category Destructors
 * @since 0.1.0
 */
export const getTimestamp = (self: TradeData): number => self.timestamp

/**
 * Get the latency from a trade.
 *
 * @category Destructors
 * @since 0.1.0
 */
export const getLatency = (self: TradeData): number => self.latency

/**
 * Predicate to filter trades with low latency (< 100ms).
 *
 * @category Predicates
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 * import * as Array from "effect/Array"
 * import { pipe } from "effect/Function"
 *
 * const lowLatencyTrades = pipe(trades, Array.filter(Trade.hasLowLatency))
 */
export const hasLowLatency = (self: TradeData): boolean => self.latency < 100

/**
 * Predicate to filter trades with medium latency (100ms-500ms).
 *
 * @category Predicates
 * @since 0.1.0
 */
export const hasMediumLatency = (self: TradeData): boolean =>
  self.latency >= 100 && self.latency < 500

/**
 * Predicate to filter trades with high latency (>= 500ms).
 *
 * @category Predicates
 * @since 0.1.0
 */
export const hasHighLatency = (self: TradeData): boolean => self.latency >= 500

/**
 * Predicate to filter trades for a specific symbol.
 *
 * @category Predicates
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 * import * as Array from "effect/Array"
 * import { pipe } from "effect/Function"
 *
 * const appleTrades = pipe(trades, Array.filter(Trade.forSymbol("AAPL")))
 */
export const forSymbol =
  (symbol: string) =>
  (self: TradeData): boolean =>
    self.symbol === symbol
