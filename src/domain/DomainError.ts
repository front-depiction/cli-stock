/**
 * Domain Error ADTs
 *
 * Structured error types for domain operations using Effect Schema.
 * Provides type-safe error handling with exhaustive pattern matching.
 *
 * @since 1.0.0
 * @category Domain
 */

import * as Schema from "effect/Schema"
import * as Data from "effect/Data"

/**
 * Validation errors for domain primitives
 *
 * @since 1.0.0
 * @category Errors
 * @example
 * ```typescript
 * const error = new DomainErrorEnum.ValidationError({
 *   field: "price",
 *   value: -10,
 *   constraint: "non-negative",
 *   message: "Price must be non-negative, got -10"
 * })
 * ```
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
 *
 * @since 1.0.0
 * @category Errors
 * @example
 * ```typescript
 * const error = new DomainErrorEnum.InvalidTradeError({
 *   tradeData: rawData,
 *   reason: "Missing required field: symbol",
 *   validationErrors: []
 * })
 * ```
 */
export const InvalidTradeError = Schema.TaggedStruct("InvalidTradeError", {
  tradeData: Schema.Unknown,
  reason: Schema.String,
  validationErrors: Schema.Array(ValidationError),
})

export type InvalidTradeError = Schema.Schema.Type<typeof InvalidTradeError>

/**
 * Errors for insufficient statistical data
 *
 * @since 1.0.0
 * @category Errors
 * @example
 * ```typescript
 * const error = new DomainErrorEnum.InsufficientDataError({
 *   symbol: "AAPL",
 *   required: 10,
 *   actual: 3
 * })
 * ```
 */
export const InsufficientDataError = Schema.TaggedStruct("InsufficientDataError", {
  symbol: Schema.String,
  required: Schema.Number,
  actual: Schema.Number,
})

export type InsufficientDataError = Schema.Schema.Type<typeof InsufficientDataError>

/**
 * Errors for window configuration
 *
 * @since 1.0.0
 * @category Errors
 * @example
 * ```typescript
 * const error = new DomainErrorEnum.InvalidWindowConfigError({
 *   config: { _tag: "EventBased", size: -5 },
 *   reason: "Window size must be positive"
 * })
 * ```
 */
export const InvalidWindowConfigError = Schema.TaggedStruct("InvalidWindowConfigError", {
  config: Schema.Unknown,
  reason: Schema.String,
})

export type InvalidWindowConfigError = Schema.Schema.Type<typeof InvalidWindowConfigError>

/**
 * Union of all domain errors
 *
 * @since 1.0.0
 * @category Errors
 * @example
 * ```typescript
 * const handleError = (error: DomainError): string =>
 *   matchDomainError(error, {
 *     ValidationError: (e) => `Validation failed: ${e.message}`,
 *     InvalidTradeError: (e) => `Invalid trade: ${e.reason}`,
 *     InsufficientDataError: (e) => `Need ${e.required} points, got ${e.actual}`,
 *     InvalidWindowConfigError: (e) => `Bad config: ${e.reason}`
 *   })
 * ```
 */
export const DomainError = Schema.Union(
  ValidationError,
  InvalidTradeError,
  InsufficientDataError,
  InvalidWindowConfigError
)

export type DomainError = Schema.Schema.Type<typeof DomainError>

/**
 * Pattern match on domain errors with exhaustive case handling
 *
 * @since 1.0.0
 * @category Pattern Matching
 * @example
 * ```typescript
 * const errorMessage = matchDomainError(error, {
 *   ValidationError: (e) => `Field '${e.field}' ${e.message}`,
 *   InvalidTradeError: (e) => `Trade error: ${e.reason}`,
 *   InsufficientDataError: (e) => `Symbol ${e.symbol}: need ${e.required} data points`,
 *   InvalidWindowConfigError: (e) => `Window config error: ${e.reason}`
 * })
 * ```
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
 *
 * @since 1.0.0
 * @category Constructors
 * @example
 * ```typescript
 * // Create validation error
 * const error = new DomainErrorEnum.ValidationError({
 *   field: "price",
 *   value: -10,
 *   constraint: "non-negative",
 *   message: "Price must be non-negative"
 * })
 *
 * // Create insufficient data error
 * const dataError = new DomainErrorEnum.InsufficientDataError({
 *   symbol: "AAPL",
 *   required: 5,
 *   actual: 2
 * })
 * ```
 */
export class DomainErrorEnum extends Data.taggedEnum<{
  ValidationError: { field: string; value: unknown; constraint: string; message: string }
  InvalidTradeError: { tradeData: unknown; reason: string; validationErrors: ValidationError[] }
  InsufficientDataError: { symbol: string; required: number; actual: number }
  InvalidWindowConfigError: { config: unknown; reason: string }
}>() {}
