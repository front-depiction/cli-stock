import * as Schema from "effect/Schema"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Order from "effect/Order"
import * as Equivalence from "effect/Equivalence"
import * as DateTime from "effect/DateTime"
import { dual } from "effect/Function"
import type * as Trade from "./Trade"

/**
 * Signal direction for trading indicators.
 *
 * @category Schemas
 * @since 0.1.0
 */
export const Buy = Schema.TaggedStruct("buy", {
  strength: Schema.Number,
  timestamp: Schema.DateTimeUtcFromSelf,
  reason: Schema.String,
})

export const Sell = Schema.TaggedStruct("sell", {
  strength: Schema.Number,
  timestamp: Schema.DateTimeUtcFromSelf,
  reason: Schema.String,
})

export const Hold = Schema.TaggedStruct("hold", {
  timestamp: Schema.DateTimeUtcFromSelf,
})

/**
 * Signal union representing trading signals.
 *
 * @category Schemas
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 * import * as DateTime from "effect/DateTime"
 *
 * const signal = Indicator.Buy.make({
 *   _tag: "buy",
 *   strength: 0.8,
 *   timestamp: DateTime.unsafeNow(),
 *   reason: "RSI oversold"
 * })
 */
export const Signal = Schema.Union(Buy, Sell, Hold)
export type Signal = Schema.Schema.Type<typeof Signal>

export type Buy = Schema.Schema.Type<typeof Buy>
export type Sell = Schema.Schema.Type<typeof Sell>
export type Hold = Schema.Schema.Type<typeof Hold>
/**
 * Type guard for Signal.
 *
 * @category Guards
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 *
 * if (Indicator.isSignal(value)) {
 *   // value is Signal
 * }
 */
export const isSignal = Schema.is(Signal)

/**
 * Refine to Buy signal.
 *
 * @category Guards
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 *
 * if (Indicator.isBuy(signal)) {
 *   console.log(`Buy strength: ${signal.strength}`)
 * }
 */
export const isBuy = (self: Signal): self is Buy => self._tag === "buy"

/**
 * Refine to Sell signal.
 *
 * @category Guards
 * @since 0.1.0
 */
export const isSell = (self: Signal): self is Sell => self._tag === "sell"

/**
 * Refine to Hold signal.
 *
 * @category Guards
 * @since 0.1.0
 */
export const isHold = (self: Signal): self is Hold => self._tag === "hold"

/**
 * Structural equality for Signal.
 *
 * @category Equivalence
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 *
 * const signal1 = Indicator.Buy.make({ ... })
 * const signal2 = Indicator.Buy.make({ ... })
 *
 * if (Indicator.SignalEquivalence(signal1, signal2)) {
 *   // Structurally equal
 * }
 */
export const SignalEquivalence: Equivalence.Equivalence<Signal> = Equivalence.make((a, b) => {
  if (a._tag !== b._tag) return false
  if (a._tag === "hold" && b._tag === "hold") {
    return DateTime.Equivalence(a.timestamp, b.timestamp)
  }
  if (a._tag === "buy" && b._tag === "buy") {
    return a.strength === b.strength && a.reason === b.reason
  }
  if (a._tag === "sell" && b._tag === "sell") {
    return a.strength === b.strength && a.reason === b.reason
  }
  return false
})

/**
 * Pattern match on Signal.
 *
 * @category Pattern Matching
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 *
 * const action = Indicator.matchSignal(signal, {
 *   buy: (s) => `BUY at ${s.strength} strength: ${s.reason}`,
 *   sell: (s) => `SELL at ${s.strength} strength: ${s.reason}`,
 *   hold: () => "HOLD position"
 * })
 */
export const matchSignal = <R>(
  self: Signal,
  cases: {
    buy: (signal: Buy) => R
    sell: (signal: Sell) => R
    hold: (signal: Hold) => R
  }
): R => {
  switch (self._tag) {
    case "buy":
      return cases.buy(self)
    case "sell":
      return cases.sell(self)
    case "hold":
      return cases.hold(self)
  }
}

/**
 * Order signals by timestamp.
 *
 * @category Orders
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 * import * as Array from "effect/Array"
 * import { pipe } from "effect/Function"
 *
 * const sorted = pipe(signals, Array.sort(Indicator.OrderByTimestamp))
 */
export const OrderByTimestamp: Order.Order<Signal> = Order.mapInput(
  DateTime.Order,
  (signal) => signal.timestamp
)

/**
 * Order by signal strength (buy/sell only, hold has no strength).
 *
 * @category Orders
 * @since 0.1.0
 */
export const OrderByStrength: Order.Order<Signal> = Order.make((a, b) => {
  const getStrength = (s: Signal): number => (s._tag === "hold" ? 0 : s.strength)
  return Order.number(getStrength(a), getStrength(b))
})

/**
 * Get timestamp from any signal variant.
 *
 * @category Destructors
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 *
 * const timestamp = Indicator.getTimestamp(signal)
 */
export const getTimestamp = (self: Signal): DateTime.DateTime => self.timestamp

/**
 * Get signal strength (returns 0 for hold).
 *
 * @category Destructors
 * @since 0.1.0
 */
export const getStrength = (self: Signal): number => (self._tag === "hold" ? 0 : self.strength)

/**
 * Predicate for strong buy signal (strength > 0.7).
 *
 * @category Predicates
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 * import * as Array from "effect/Array"
 * import { pipe } from "effect/Function"
 *
 * const strongBuys = pipe(signals, Array.filter(Indicator.isStrongBuy))
 */
export const isStrongBuy = (self: Signal): boolean => self._tag === "buy" && self.strength > 0.7

/**
 * Predicate for strong sell signal (strength > 0.7).
 *
 * @category Predicates
 * @since 0.1.0
 */
export const isStrongSell = (self: Signal): boolean => self._tag === "sell" && self.strength > 0.7

/**
 * Trigger condition variants.
 *
 * @category Schemas
 * @since 0.1.0
 */
export const PriceAbove = Schema.TaggedStruct("priceAbove", {
  threshold: Schema.Number,
})

export const PriceBelow = Schema.TaggedStruct("priceBelow", {
  threshold: Schema.Number,
})

export const VolumeAbove = Schema.TaggedStruct("volumeAbove", {
  threshold: Schema.Number,
})

export const VolatilityAbove = Schema.TaggedStruct("volatilityAbove", {
  threshold: Schema.Number,
})

export const CrossOver = Schema.TaggedStruct("crossOver", {
  fastPeriod: Schema.Number,
  slowPeriod: Schema.Number,
})

/**
 * TriggerCondition union for alert conditions.
 *
 * @category Schemas
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 *
 * const condition = Indicator.PriceAbove.make({ _tag: "priceAbove", threshold: 200 })
 */
export const TriggerCondition = Schema.Union(
  PriceAbove,
  PriceBelow,
  VolumeAbove,
  VolatilityAbove,
  CrossOver
)
export type TriggerCondition = Schema.Schema.Type<typeof TriggerCondition>

export type PriceAbove = Schema.Schema.Type<typeof PriceAbove>
export type PriceBelow = Schema.Schema.Type<typeof PriceBelow>
export type VolumeAbove = Schema.Schema.Type<typeof VolumeAbove>
export type VolatilityAbove = Schema.Schema.Type<typeof VolatilityAbove>
export type CrossOver = Schema.Schema.Type<typeof CrossOver>

/**
 * Type guard for TriggerCondition.
 *
 * @category Guards
 * @since 0.1.0
 */
export const isTriggerCondition = Schema.is(TriggerCondition)

/**
 * Pattern match on TriggerCondition.
 *
 * @category Pattern Matching
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 *
 * const message = Indicator.matchCondition(condition, {
 *   priceAbove: (c) => `Price above ${c.threshold}`,
 *   priceBelow: (c) => `Price below ${c.threshold}`,
 *   volumeAbove: (c) => `Volume above ${c.threshold}`,
 *   volatilityAbove: (c) => `Volatility above ${c.threshold}`,
 *   crossOver: (c) => `${c.fastPeriod} crossed ${c.slowPeriod}`
 * })
 */
export const matchCondition = <R>(
  self: TriggerCondition,
  cases: {
    priceAbove: (condition: PriceAbove) => R
    priceBelow: (condition: PriceBelow) => R
    volumeAbove: (condition: VolumeAbove) => R
    volatilityAbove: (condition: VolatilityAbove) => R
    crossOver: (condition: CrossOver) => R
  }
): R => {
  switch (self._tag) {
    case "priceAbove":
      return cases.priceAbove(self)
    case "priceBelow":
      return cases.priceBelow(self)
    case "volumeAbove":
      return cases.volumeAbove(self)
    case "volatilityAbove":
      return cases.volatilityAbove(self)
    case "crossOver":
      return cases.crossOver(self)
  }
}

/**
 * Indicator metadata and state.
 *
 * @category Schemas
 * @since 0.1.0
 */
export const IndicatorState = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  symbol: Schema.String,
  lastUpdate: Schema.DateTimeUtcFromSelf,
  value: Schema.Number,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

export type IndicatorState = Schema.Schema.Type<typeof IndicatorState>

/**
 * Type guard for IndicatorState.
 *
 * @category Guards
 * @since 0.1.0
 */
export const isIndicatorState = Schema.is(IndicatorState)

/**
 * Update indicator state value.
 *
 * @category Setters
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 * import * as DateTime from "effect/DateTime"
 * import { pipe } from "effect/Function"
 *
 * const updated = pipe(
 *   state,
 *   Indicator.updateValue(45.2, DateTime.unsafeNow())
 * )
 */
export const updateValue: {
  (value: number, timestamp: DateTime.DateTime): (self: IndicatorState) => IndicatorState
  (self: IndicatorState, value: number, timestamp: DateTime.DateTime): IndicatorState
} = dual(3, (self: IndicatorState, value: number, timestamp: DateTime.DateTime) => ({
  ...self,
  value,
  lastUpdate: timestamp,
}))

/**
 * Base interface for all indicators.
 *
 * Every indicator must implement this interface to process trades
 * and generate signals/state updates.
 *
 * @category Interfaces
 * @since 0.1.0
 */
export interface Indicator {
  /**
   * Unique identifier for the indicator instance.
   */
  readonly id: string

  /**
   * Human-readable name of the indicator.
   */
  readonly name: string

  /**
   * Process a stream of trades and emit indicator states.
   */
  readonly process: (
    trades: Stream.Stream<Trade.TradeData, never, never>
  ) => Stream.Stream<IndicatorState, never, never>

  /**
   * Generate trading signals based on current state.
   */
  readonly signal: (state: IndicatorState) => Effect.Effect<Signal, never, never>

  /**
   * Check if a trigger condition is met.
   */
  readonly checkTrigger: (
    state: IndicatorState,
    condition: TriggerCondition
  ) => Effect.Effect<boolean, never, never>
}

/**
 * Configuration for indicators.
 *
 * @category Schemas
 * @since 0.1.0
 */
export const IndicatorConfig = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  symbol: Schema.String,
  period: Schema.Number,
  params: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

export type IndicatorConfig = Schema.Schema.Type<typeof IndicatorConfig>

/**
 * Type guard for IndicatorConfig.
 *
 * @category Guards
 * @since 0.1.0
 */
export const isIndicatorConfig = Schema.is(IndicatorConfig)

/**
 * Context tag for registering indicator services.
 *
 * Each concrete indicator implementation should be a service
 * that can be composed via layers.
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 * import * as Context from "effect/Context"
 * import * as Layer from "effect/Layer"
 *
 * // Define a specific indicator service
 * class RSIIndicator extends Context.Tag("@indicators/RSI")<
 *   RSIIndicator,
 *   Indicator.Indicator
 * >() {}
 *
 * // Provide via layer
 * const RSILive = Layer.succeed(RSIIndicator, {
 *   id: "rsi",
 *   name: "RSI",
 *   process: (trades) => ...,
 *   signal: (state) => ...,
 *   checkTrigger: (state, condition) => ...
 * })
 */
export type IndicatorTag<Id extends string> = Context.Tag<Id, Indicator>

/**
 * Helper to create an indicator context tag.
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as Indicator from "@/domain/Indicator"
 *
 * const RSITag = Indicator.makeIndicatorTag("@indicators/RSI")
 */
export const makeIndicatorTag = <Id extends string>(id: Id): IndicatorTag<Id> =>
  Context.GenericTag<Id, Indicator>(id)
