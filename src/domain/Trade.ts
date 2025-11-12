import * as Schema from "effect/Schema"
import * as Brand from "effect/Brand"
import * as Order from "effect/Order"
import * as DateTime from "effect/DateTime"
import * as Equivalence from "effect/Equivalence"

// ============================================================================
// Branded Schemas (Preferred)
// ============================================================================

/**
 * Schema for branded Symbol type.
 *
 * @category Schemas
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 * import * as Schema from "effect/Schema"
 * import * as Effect from "effect/Effect"
 *
 * const decodeSymbol = Schema.decode(Trade.SymbolSchema)
 * const program = decodeSymbol("AAPL") // Effect<Symbol, ParseError>
 */
export const SymbolSchema = Schema.String.pipe(
  Schema.nonEmpty({ message: () => "Symbol cannot be empty" }),
  Schema.brand("Symbol")
)

/**
 * Schema for branded Price type.
 *
 * @category Schemas
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 * import * as Schema from "effect/Schema"
 *
 * const decodePrice = Schema.decode(Trade.PriceSchema)
 * const program = decodePrice(150.25) // Effect<Price, ParseError>
 */
export const PriceSchema = Schema.Number.pipe(
  Schema.nonNegative({ message: () => "Price must be non-negative" }),
  Schema.finite({ message: () => "Price must be finite" }),
  Schema.brand("Price")
)

/**
 * Schema for branded Volume type.
 *
 * @category Schemas
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 * import * as Schema from "effect/Schema"
 *
 * const decodeVolume = Schema.decode(Trade.VolumeSchema)
 * const program = decodeVolume(1000) // Effect<Volume, ParseError>
 */
export const VolumeSchema = Schema.Number.pipe(
  Schema.nonNegative({ message: () => "Volume must be non-negative" }),
  Schema.finite({ message: () => "Volume must be finite" }),
  Schema.brand("Volume")
)

/**
 * Schema for branded Timestamp type.
 *
 * @category Schemas
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 * import * as Schema from "effect/Schema"
 *
 * const decodeTimestamp = Schema.decode(Trade.TimestampSchema)
 * const program = decodeTimestamp(Date.now()) // Effect<Timestamp, ParseError>
 */
export const TimestampSchema = Schema.Number.pipe(
  Schema.positive({ message: () => "Timestamp must be positive" }),
  Schema.int({ message: () => "Timestamp must be an integer" }),
  Schema.brand("Timestamp")
)

/**
 * Schema for branded Latency type.
 *
 * @category Schemas
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 * import * as Schema from "effect/Schema"
 *
 * const decodeLatency = Schema.decode(Trade.LatencySchema)
 * const program = decodeLatency(42) // Effect<Latency, ParseError>
 */
export const LatencySchema = Schema.Number.pipe(
  Schema.nonNegative({ message: () => "Latency must be non-negative" }),
  Schema.finite({ message: () => "Latency must be finite" }),
  Schema.brand("Latency")
)

/**
 * Schema for TradeData representing a trade from Finnhub.
 * Uses branded schemas for type-safe validation.
 *
 * @category Schemas
 * @since 0.1.0
 * @example
 * import * as Trade from "./domain/Trade"
 * import * as Schema from "effect/Schema"
 *
 * const decodeTrade = Schema.decode(Trade.TradeData)
 * const program = decodeTrade({
 *   symbol: "AAPL",
 *   price: 150.25,
 *   volume: 1000,
 *   timestamp: Date.now(),
 *   receivedAt: Date.now(),
 *   latency: 42
 * })
 */
export const TradeData = Schema.Struct({
  symbol: SymbolSchema,
  price: PriceSchema,
  volume: VolumeSchema,
  timestamp: TimestampSchema,
  conditions: Schema.optional(Schema.Array(Schema.String)),
  receivedAt: TimestampSchema,
  latency: LatencySchema,
})

// ============================================================================
// Type Exports (from Schemas)
// ============================================================================

/**
 * Branded type for stock/crypto symbols.
 *
 * @category Types
 * @since 0.1.0
 */
export type Symbol = Schema.Schema.Type<typeof SymbolSchema>

/**
 * Branded type for trade prices.
 *
 * @category Types
 * @since 0.1.0
 */
export type Price = Schema.Schema.Type<typeof PriceSchema>

/**
 * Branded type for trade volume.
 *
 * @category Types
 * @since 0.1.0
 */
export type Volume = Schema.Schema.Type<typeof VolumeSchema>

/**
 * Branded type for timestamp in milliseconds.
 *
 * @category Types
 * @since 0.1.0
 */
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

/**
 * Branded type for latency in milliseconds.
 *
 * @category Types
 * @since 0.1.0
 */
export type Latency = Schema.Schema.Type<typeof LatencySchema>

/**
 * Type for TradeData.
 *
 * @category Types
 * @since 0.1.0
 */
export type TradeData = Schema.Schema.Type<typeof TradeData>

// ============================================================================
// Deprecated Brand Constructors (Backwards Compatibility)
// ============================================================================

/**
 * Brand constructor for Symbol.
 *
 * @category Brands
 * @since 0.1.0
 * @deprecated Use Schema.decode(SymbolSchema)(value) instead for runtime validation
 * @example
 * // Old way (deprecated):
 * const symbol = Symbol.make("AAPL")
 *
 * // New way (preferred):
 * import * as Effect from "effect/Effect"
 * const program = Schema.decode(SymbolSchema)("AAPL")
 */
export const Symbol = Brand.nominal<Symbol>()

/**
 * Brand constructor for Price.
 *
 * @category Brands
 * @since 0.1.0
 * @deprecated Use Schema.decode(PriceSchema)(value) instead for runtime validation
 * @example
 * // Old way (deprecated):
 * const price = Price.make(150.25)
 *
 * // New way (preferred):
 * import * as Effect from "effect/Effect"
 * const program = Schema.decode(PriceSchema)(150.25)
 */
export const Price = Brand.refined<Price>(
  (n) => n >= 0,
  (n) => Brand.error(`Price must be non-negative, got ${n}`)
)

/**
 * Brand constructor for Volume.
 *
 * @category Brands
 * @since 0.1.0
 * @deprecated Use Schema.decode(VolumeSchema)(value) instead for runtime validation
 * @example
 * // Old way (deprecated):
 * const volume = Volume.make(1000)
 *
 * // New way (preferred):
 * import * as Effect from "effect/Effect"
 * const program = Schema.decode(VolumeSchema)(1000)
 */
export const Volume = Brand.refined<Volume>(
  (n) => n >= 0,
  (n) => Brand.error(`Volume must be non-negative, got ${n}`)
)

/**
 * Brand constructor for Timestamp.
 *
 * @category Brands
 * @since 0.1.0
 * @deprecated Use Schema.decode(TimestampSchema)(value) instead for runtime validation
 * @example
 * // Old way (deprecated):
 * const timestamp = Timestamp.make(Date.now())
 *
 * // New way (preferred):
 * import * as Effect from "effect/Effect"
 * const program = Schema.decode(TimestampSchema)(Date.now())
 */
export const Timestamp = Brand.refined<Timestamp>(
  (n) => n > 0,
  (n) => Brand.error(`Timestamp must be positive, got ${n}`)
)

/**
 * Brand constructor for Latency.
 *
 * @category Brands
 * @since 0.1.0
 * @deprecated Use Schema.decode(LatencySchema)(value) instead for runtime validation
 * @example
 * // Old way (deprecated):
 * const latency = Latency.make(42)
 *
 * // New way (preferred):
 * import * as Effect from "effect/Effect"
 * const program = Schema.decode(LatencySchema)(42)
 */
export const Latency = Brand.refined<Latency>(
  (n) => n >= 0,
  (n) => Brand.error(`Latency must be non-negative, got ${n}`)
)

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
