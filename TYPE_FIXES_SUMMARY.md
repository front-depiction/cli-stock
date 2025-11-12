# Type Error Fixes Summary

This document summarizes the fixes applied to resolve type errors in the ADT implementations.

## Fixed Issues

### 1. DomainError.ts - TaggedEnum Casing (Line 186)

**Problem:** `Data.TaggedEnum` should be `Data.taggedEnum` (lowercase)

**Fix:**
```typescript
// Before
export class DomainErrorEnum extends Data.TaggedEnum<{
  // ...
}>() {}

// After
export class DomainErrorEnum extends Data.taggedEnum<{
  // ...
}>() {}
```

**File:** `/Users/front_depiction/Desktop/Projects/cli-stock/src/domain/DomainError.ts`

---

### 2. Statistics.ts - ParseError Import

**Problem:** `Schema.ParseError` doesn't exist, need to import `ParseError` from "effect/ParseResult"

**Fix:**
```typescript
// Before
import * as Schema from "effect/Schema"
// ... later
Effect<EventBased, Schema.ParseError>

// After
import * as Schema from "effect/Schema"
import { ParseError } from "effect/ParseResult"
// ... later
Effect<EventBased, ParseError>
```

**Files Modified:**
- Import added at line 2
- Return types updated at lines 196, 213, 233

**File:** `/Users/front_depiction/Desktop/Projects/cli-stock/src/domain/Statistics.ts`

---

### 3. Statistics.ts - matchWindowConfig Type Signature

**Problem:** Function expected branded schema types but WindowConfig is a plain union type

**Fix:**
```typescript
// Before
export const matchWindowConfig = <R>(
  self: WindowConfig,
  cases: {
    EventBased: (config: EventBased) => R  // EventBased has branded fields
    TimeBased: (config: TimeBased) => R
    Hybrid: (config: Hybrid) => R
  }
): R => { /* ... */ }

// After
export const matchWindowConfig = <R>(
  self: WindowConfig,
  cases: {
    EventBased: (config: { readonly _tag: "EventBased"; readonly size: number }) => R
    TimeBased: (config: { readonly _tag: "TimeBased"; readonly durationMs: number }) => R
    Hybrid: (config: {
      readonly _tag: "Hybrid"
      readonly size: number
      readonly durationMs: number
    }) => R
  }
): R => { /* ... */ }
```

**Rationale:** The `WindowConfig` type is defined as a plain discriminated union (lines 172-179) for backwards compatibility. The pattern matcher should accept the plain types, not the branded schema types.

**File:** `/Users/front_depiction/Desktop/Projects/cli-stock/src/domain/Statistics.ts` (lines 250-270)

---

### 4. Test Fixtures - Branded Type Helpers

**Problem:** Tests and fixtures need helper functions to create branded types easily

**Solution:** Added helper functions using the deprecated Brand constructors for backwards compatibility during migration.

**New Helper Functions Added:**

```typescript
// Brand helpers for Trade types
export const makeSymbol = (value: string): Trade.Symbol
export const makePrice = (value: number): Trade.Price
export const makeVolume = (value: number): Trade.Volume
export const makeTimestamp = (value: number): Trade.Timestamp
export const makeLatency = (value: number): Trade.Latency

// Brand helpers for Statistics types
export const makeWindowSize = (value: number): Statistics.WindowSize
export const makeTimeWindow = (value: number): Statistics.TimeWindow

// WindowConfig helpers
export const mockEventBasedConfig = (size: number): Statistics.WindowConfig
export const mockTimeBasedConfig = (durationMs: number): Statistics.WindowConfig
export const mockHybridConfig = (size: number, durationMs: number): Statistics.WindowConfig
```

**Updated Functions:**
- `mockTrade()` - Now uses branded type helpers internally
- `mockTrades()` - Now uses branded type helpers
- `mockTradesWithPrices()` - Now uses branded type helpers
- `mockStats()` - Added optional `windowConfig` parameter

**File:** `/Users/front_depiction/Desktop/Projects/cli-stock/src/test-utils/fixtures.ts`

---

## Migration Strategy

### Phase 1: Backwards Compatibility (Current)
- Schema-based branded types are available for new code
- Old Brand constructors remain available but deprecated
- Test fixtures use Brand constructors for easy type creation
- Plain WindowConfig type for backwards compatibility

### Phase 2: Gradual Migration (Future)
- Migrate usages to `Schema.decode()` for validation
- Update tests to use Effect-based validation
- Eventually remove deprecated Brand constructors

### Phase 3: Full Schema Migration (Future)
- All types use Schema validation
- Remove Brand constructors entirely
- Update WindowConfig to use schema types

---

## Type Verification

To verify all type errors are resolved, run:

```bash
bun run typecheck
# or
bunx tsc --noEmit
```

---

## Key Design Decisions

1. **matchWindowConfig uses plain types:** The pattern matcher works with the plain `WindowConfig` union type, not the branded schema variants, for maximum compatibility.

2. **Test helpers use Brand constructors:** Unsafe brand creation is acceptable in test code where we control the inputs and want ergonomic fixture creation.

3. **ParseError from ParseResult:** Effect's ParseError type lives in `effect/ParseResult`, not `effect/Schema`.

4. **Lowercase taggedEnum:** Effect's API uses lowercase `taggedEnum`, not capitalized `TaggedEnum`.

---

## Files Modified

1. `/Users/front_depiction/Desktop/Projects/cli-stock/src/domain/DomainError.ts`
2. `/Users/front_depiction/Desktop/Projects/cli-stock/src/domain/Statistics.ts`
3. `/Users/front_depiction/Desktop/Projects/cli-stock/src/test-utils/fixtures.ts`

---

## Testing

All existing tests should continue to pass:
- `src/domain/Trade.test.ts` - Uses Brand constructors directly
- `src/domain/Statistics.test.ts` - Uses plain WindowConfig types
- `src/domain/Indicator.test.ts` - Uses fixture helpers
- `src/services/TradePubSub.test.ts` - Uses fixture helpers

Run tests with:
```bash
bun test
```
