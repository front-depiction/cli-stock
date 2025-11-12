# ADT Design Proposals for cli-stock

## Overview
This document outlines proposed Algebraic Data Type (ADT) improvements for the cli-stock domain model, focusing on better type safety, domain invariants, and Effect Schema integration.

---

## 1. Domain Error ADTs

### Current State
- Brand types use `Brand.error()` which throws exceptions
- No structured error types for domain operations
- Services use `never` error channel

### Proposed: Domain Error Union Types

```typescript
// src/domain/DomainError.ts

import * as Schema from "effect/Schema"
import * as Data from "effect/Data"

/**
 * Validation errors for domain primitives
 */
export const ValidationError = Schema.TaggedStruct("ValidationError", {
  field: Schema.String,
  value: Schema.Unknown,
  constraint: Schema.String,
  message: Schema.String,
})

export type ValidationError = Schema.Schema.Type<typeof ValidationError>

/**
 * Errors for invalid trade data
 */
export const InvalidTradeError = Schema.TaggedStruct("InvalidTradeError", {
  tradeData: Schema.Unknown,
  reason: Schema.String,
  validationErrors: Schema.Array(ValidationError),
})

export type InvalidTradeError = Schema.Schema.Type<typeof InvalidTradeError>

/**
 * Errors for insufficient statistical data
 */
export const InsufficientDataError = Schema.TaggedStruct("InsufficientDataError", {
  symbol: Schema.String,
  required: Schema.Number,
  actual: Schema.Number,
})

export type InsufficientDataError = Schema.Schema.Type<typeof InsufficientDataError>

/**
 * Errors for window configuration
 */
export const InvalidWindowConfigError = Schema.TaggedStruct("InvalidWindowConfigError", {
  config: Schema.Unknown,
  reason: Schema.String,
})

export type InvalidWindowConfigError = Schema.Schema.Type<typeof InvalidWindowConfigError>

/**
 * Union of all domain errors
 */
export const DomainError = Schema.Union(
  ValidationError,
  InvalidTradeError,
  InsufficientDataError,
  InvalidWindowConfigError
)

export type DomainError = Schema.Schema.Type<typeof DomainError>

/**
 * Pattern match on domain errors
 */
export const matchDomainError = <R>(
  self: DomainError,
  cases: {
    ValidationError: (error: ValidationError) => R
    InvalidTradeError: (error: InvalidTradeError) => R
    InsufficientDataError: (error: InsufficientDataError) => R
    InvalidWindowConfigError: (error: InvalidWindowConfigError) => R
  }
): R => {
  switch (self._tag) {
    case "ValidationError":
      return cases.ValidationError(self)
    case "InvalidTradeError":
      return cases.InvalidTradeError(self)
    case "InsufficientDataError":
      return cases.InsufficientDataError(self)
    case "InvalidWindowConfigError":
      return cases.InvalidWindowConfigError(self)
  }
}

/**
 * Constructors using Data.TaggedEnum for better ergonomics
 */
export class DomainErrorEnum extends Data.TaggedEnum<{
  ValidationError: { field: string; value: unknown; constraint: string; message: string }
  InvalidTradeError: { tradeData: unknown; reason: string; validationErrors: ValidationError[] }
  InsufficientDataError: { symbol: string; required: number; actual: number }
  InvalidWindowConfigError: { config: unknown; reason: string }
}>() {}
```

### Benefits
- Type-safe error handling with exhaustive pattern matching
- Rich error information for debugging
- Schema-validated error structures
- Composable with Effect's error channel
- No exceptions - pure functional error handling

---

## 2. WindowConfig Schema Migration

### Current State (Statistics.ts lines 70-77)
```typescript
export type WindowConfig =
  | { readonly _tag: "EventBased"; readonly size: number }
  | { readonly _tag: "TimeBased"; readonly durationMs: number }
  | {
      readonly _tag: "Hybrid"
      readonly size: number
      readonly durationMs: number
    }
```

### Proposed: Schema-based WindowConfig

```typescript
// src/domain/Statistics.ts

/**
 * Event-based window variant
 */
export const EventBased = Schema.TaggedStruct("EventBased", {
  size: Schema.Number.pipe(
    Schema.int({ message: () => "Window size must be an integer" }),
    Schema.positive({ message: () => "Window size must be positive" }),
    Schema.brand("WindowSize")
  ),
})

export type EventBased = Schema.Schema.Type<typeof EventBased>

/**
 * Time-based window variant
 */
export const TimeBased = Schema.TaggedStruct("TimeBased", {
  durationMs: Schema.Number.pipe(
    Schema.positive({ message: () => "Duration must be positive" }),
    Schema.brand("TimeWindow")
  ),
})

export type TimeBased = Schema.Schema.Type<typeof TimeBased>

/**
 * Hybrid window variant (combines event and time constraints)
 */
export const Hybrid = Schema.TaggedStruct("Hybrid", {
  size: Schema.Number.pipe(
    Schema.int({ message: () => "Window size must be an integer" }),
    Schema.positive({ message: () => "Window size must be positive" }),
    Schema.brand("WindowSize")
  ),
  durationMs: Schema.Number.pipe(
    Schema.positive({ message: () => "Duration must be positive" }),
    Schema.brand("TimeWindow")
  ),
})

export type Hybrid = Schema.Schema.Type<typeof Hybrid>

/**
 * WindowConfig discriminated union
 */
export const WindowConfig = Schema.Union(EventBased, TimeBased, Hybrid)
export type WindowConfig = Schema.Schema.Type<typeof WindowConfig>

/**
 * Smart constructors with validation
 */
export const makeEventBased = (size: number): Effect.Effect<EventBased, ValidationError> =>
  Schema.decode(EventBased)({ _tag: "EventBased", size })

export const makeTimeBased = (durationMs: number): Effect.Effect<TimeBased, ValidationError> =>
  Schema.decode(TimeBased)({ _tag: "TimeBased", durationMs })

export const makeHybrid = (
  size: number,
  durationMs: number
): Effect.Effect<Hybrid, ValidationError> =>
  Schema.decode(Hybrid)({ _tag: "Hybrid", size, durationMs })

/**
 * Pattern match on WindowConfig
 */
export const matchWindowConfig = <R>(
  self: WindowConfig,
  cases: {
    EventBased: (config: EventBased) => R
    TimeBased: (config: TimeBased) => R
    Hybrid: (config: Hybrid) => R
  }
): R => {
  switch (self._tag) {
    case "EventBased":
      return cases.EventBased(self)
    case "TimeBased":
      return cases.TimeBased(self)
    case "Hybrid":
      return cases.Hybrid(self)
  }
}
```

### Migration Path
1. **Phase 1**: Add new schema definitions alongside existing type
2. **Phase 2**: Update `emptyStats()` to accept `WindowConfig` schema type
3. **Phase 3**: Update `updateStats()` pattern matching to use schema types
4. **Phase 4**: Update tests to use smart constructors
5. **Phase 5**: Remove old type definition

### Benefits
- Runtime validation when creating window configurations
- Type-safe branded types for size and duration
- Automatic encoder/decoder generation
- Pattern matches existing Signal/TriggerCondition design
- Composable with other schemas

---

## 3. TradeData Branded Schema Migration

### Current State (Trade.ts lines 113-121)
```typescript
export const TradeData = Schema.Struct({
  symbol: Schema.String,
  price: Schema.Number,
  volume: Schema.Number,
  timestamp: Schema.Number,
  conditions: Schema.optional(Schema.Array(Schema.String)),
  receivedAt: Schema.Number,
  latency: Schema.Number,
})
```

**Problem**: Schema uses raw primitives despite Brand types being defined for Symbol, Price, Volume, Timestamp, and Latency.

### Proposed: Unified Branded Schemas

```typescript
// src/domain/Trade.ts

/**
 * Schema for branded Symbol type
 */
export const SymbolSchema = Schema.String.pipe(
  Schema.nonEmpty({ message: () => "Symbol cannot be empty" }),
  Schema.brand("Symbol")
)

/**
 * Schema for branded Price type
 */
export const PriceSchema = Schema.Number.pipe(
  Schema.nonNegative({ message: () => "Price must be non-negative" }),
  Schema.finite({ message: () => "Price must be finite" }),
  Schema.brand("Price")
)

/**
 * Schema for branded Volume type
 */
export const VolumeSchema = Schema.Number.pipe(
  Schema.nonNegative({ message: () => "Volume must be non-negative" }),
  Schema.finite({ message: () => "Volume must be finite" }),
  Schema.brand("Volume")
)

/**
 * Schema for branded Timestamp type
 */
export const TimestampSchema = Schema.Number.pipe(
  Schema.positive({ message: () => "Timestamp must be positive" }),
  Schema.int({ message: () => "Timestamp must be an integer" }),
  Schema.brand("Timestamp")
)

/**
 * Schema for branded Latency type
 */
export const LatencySchema = Schema.Number.pipe(
  Schema.nonNegative({ message: () => "Latency must be non-negative" }),
  Schema.finite({ message: () => "Latency must be finite" }),
  Schema.brand("Latency")
)

/**
 * Refactored TradeData schema using branded types
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

/**
 * Export unified types from schema
 */
export type Symbol = Schema.Schema.Type<typeof SymbolSchema>
export type Price = Schema.Schema.Type<typeof PriceSchema>
export type Volume = Schema.Schema.Type<typeof VolumeSchema>
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>
export type Latency = Schema.Schema.Type<typeof LatencySchema>
export type TradeData = Schema.Schema.Type<typeof TradeData>

/**
 * Keep existing Brand constructors for backwards compatibility
 * These will be deprecated in favor of schema constructors
 * @deprecated Use Schema.decode(SymbolSchema)(value) instead
 */
export const Symbol = Brand.nominal<Symbol>()
export const Price = Brand.refined<Price>(
  (n) => n >= 0,
  (n) => Brand.error(`Price must be non-negative, got ${n}`)
)
export const Volume = Brand.refined<Volume>(
  (n) => n >= 0,
  (n) => Brand.error(`Volume must be non-negative, got ${n}`)
)
export const Timestamp = Brand.refined<Timestamp>(
  (n) => n > 0,
  (n) => Brand.error(`Timestamp must be positive, got ${n}`)
)
export const Latency = Brand.refined<Latency>(
  (n) => n >= 0,
  (n) => Brand.error(`Latency must be non-negative, got ${n}`)
)
```

### Migration Path
1. **Phase 1**: Define branded schemas alongside existing Brand types
2. **Phase 2**: Update TradeData schema to use branded schemas
3. **Phase 3**: Update type exports to use schema types
4. **Phase 4**: Mark old Brand constructors as deprecated
5. **Phase 5**: Update tests to use schema decoding
6. **Phase 6**: Remove deprecated constructors in breaking release

### Benefits
- Single source of truth for validation (Schema instead of Brand + Schema)
- Automatic validation when decoding external data
- Better error messages with schema annotations
- Composable with other schemas
- Runtime type safety

---

## 4. PricePoint Schema

### Current State (Statistics.ts lines 85-89)
```typescript
export interface PricePoint {
  readonly price: number
  readonly volume: number
  readonly timestamp: number
}
```

### Proposed: Schema-based PricePoint

```typescript
// src/domain/Statistics.ts

/**
 * Schema for price data points in time-based windows
 */
export const PricePoint = Schema.Struct({
  price: PriceSchema, // Import from Trade.ts
  volume: VolumeSchema, // Import from Trade.ts
  timestamp: TimestampSchema, // Import from Trade.ts
})

export type PricePoint = Schema.Schema.Type<typeof PricePoint>

/**
 * Constructor with validation
 */
export const makePricePoint = (
  price: number,
  volume: number,
  timestamp: number
): Effect.Effect<PricePoint, ValidationError> =>
  Schema.decode(PricePoint)({ price, volume, timestamp })

/**
 * Unsafe constructor for internal use when data is already validated
 */
export const unsafeMakePricePoint = (
  price: number,
  volume: number,
  timestamp: number
): PricePoint => ({ price, volume, timestamp })
```

### Benefits
- Reuses branded types from Trade.ts
- Validates price points at construction
- Type-safe price data
- Composable in larger schemas

---

## 5. Statistics Result Types

### Proposed: Domain-specific Result Types

```typescript
// src/domain/Statistics.ts

import * as Effect from "effect/Effect"
import type * as DomainError from "./DomainError"

/**
 * Result type for statistics operations that may fail
 */
export type StatsResult<A> = Effect.Effect<A, DomainError.DomainError>

/**
 * Calculate mean with validation
 */
export const calculateMeanSafe = (
  stats: Stats
): Effect.Effect<number, DomainError.InsufficientDataError> => {
  if (stats.recentPrices.length === 0) {
    return Effect.fail(
      new DomainError.DomainErrorEnum.InsufficientDataError({
        symbol: "unknown",
        required: 1,
        actual: 0,
      })
    )
  }
  return Effect.succeed(calculateMean(stats))
}

/**
 * Calculate trading metrics with validation
 */
export const calculateTradingMetricsSafe = (
  stats: Stats,
  minDataPoints: number = 2
): Effect.Effect<TradingMetrics, DomainError.InsufficientDataError> => {
  if (stats.pricePoints.length < minDataPoints) {
    return Effect.fail(
      new DomainError.DomainErrorEnum.InsufficientDataError({
        symbol: "unknown",
        required: minDataPoints,
        actual: stats.pricePoints.length,
      })
    )
  }
  return Effect.succeed(calculateTradingMetrics(stats))
}
```

### Benefits
- Explicit error handling in the type system
- No exceptions thrown
- Composable with Effect error channel
- Self-documenting code (types show what can fail)

---

## 6. Indicator Signal Enhancements (Already Well-Designed)

### Current State (Indicator.ts lines 17-50)
The Signal ADT is already excellently designed:
- Uses Schema.TaggedStruct for variants
- Schema.Union for the discriminated union
- Proper type guards and pattern matching

### Recommendation: No changes needed
This is the gold standard pattern that other ADTs should follow.

---

## 7. Additional ADT Opportunities

### NonEmptyArray for Required Data

```typescript
// src/domain/Collections.ts

import * as Schema from "effect/Schema"
import * as ReadonlyArray from "effect/Array"

/**
 * Schema for non-empty arrays of prices
 */
export const NonEmptyPrices = Schema.Array(PriceSchema).pipe(
  Schema.filter((arr) => arr.length > 0, {
    message: () => "Price array cannot be empty",
  }),
  Schema.brand("NonEmptyPrices")
)

export type NonEmptyPrices = Schema.Schema.Type<typeof NonEmptyPrices>

/**
 * Use in Stats type for stricter invariants
 */
export interface StatsWithData {
  readonly count: number
  readonly sum: number
  readonly sumSquares: number
  readonly min: number
  readonly max: number
  readonly recentPrices: NonEmptyPrices // Stronger guarantee
  readonly pricePoints: ReadonlyArray<PricePoint>
  readonly windowConfig: WindowConfig
  readonly lastUpdateTime: number
}
```

### TradingMetrics as Tagged Union

```typescript
// If trading metrics can be in different states:

export const ValidMetrics = Schema.TaggedStruct("ValidMetrics", {
  volatility: Schema.Number,
  momentum: Schema.Number,
  tradeVelocity: Schema.Number,
  vwap: Schema.Number,
  spreadApprox: Schema.Number,
})

export const InsufficientData = Schema.TaggedStruct("InsufficientData", {
  reason: Schema.String,
  dataPoints: Schema.Number,
})

export const TradingMetricsResult = Schema.Union(ValidMetrics, InsufficientData)
```

---

## Summary of Improvements

### High Priority
1. **WindowConfig Schema Migration** - Template for other ADT migrations
2. **TradeData Branded Schemas** - Unifies validation and types
3. **Domain Error ADTs** - Type-safe error handling

### Medium Priority
4. **PricePoint Schema** - Validates price data
5. **Statistics Result Types** - Explicit error handling

### Low Priority (Nice to Have)
6. **NonEmptyArray types** - Stronger invariants
7. **TradingMetrics variants** - State-based metrics

### Already Excellent
8. **Indicator Signal/TriggerCondition** - Reference implementation

---

## Implementation Order

1. **Domain Errors** - Foundation for error handling
2. **WindowConfig** - Template for schema migration pattern
3. **TradeData Brands** - Critical path for data validation
4. **PricePoint** - Depends on TradeData brands
5. **Statistics Results** - Depends on domain errors
6. **Optional enhancements** - As time permits

---

## Backwards Compatibility Strategy

All migrations follow the same pattern:
1. Add new schema-based types alongside existing types
2. Mark old constructors as `@deprecated`
3. Update tests to use new constructors
4. Update internal usage gradually
5. Remove deprecated code in next major version

This ensures no breaking changes during migration.
