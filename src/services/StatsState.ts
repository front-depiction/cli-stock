import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import type * as Statistics from "../domain/Statistics"

/**
 * StatsState Service - Manages statistics for all symbols.
 *
 * Uses a Ref (mutable reference) to track stats per symbol.
 * This service follows Effect best practices:
 * - Fine-grained capability (only manages stats state)
 * - No requirement leakage (service interface has Requirements = never)
 *
 * @category Services
 * @since 0.1.0
 * @example
 * import * as StatsState from "./services/StatsState"
 * import * as Effect from "effect/Effect"
 * import * as Ref from "effect/Ref"
 *
 * const program = Effect.gen(function* () {
 *   const statsRef = yield* StatsState.StatsState
 *   yield* Ref.update(statsRef, (map) => map.set("AAPL", newStats))
 * })
 */
export class StatsState extends Context.Tag("@services/StatsState")<
  StatsState,
  Ref.Ref<Map<string, Statistics.Stats>>
>() {}

/**
 * Layer that provides the StatsState service.
 *
 * Type: Layer<StatsState, never, never>
 * - RequirementsOut: StatsState (what we're creating)
 * - Error: never (construction cannot fail)
 * - RequirementsIn: never (no dependencies needed)
 *
 * @category Layers
 * @since 0.1.0
 * @example
 * import * as StatsState from "./services/StatsState"
 * import * as Effect from "effect/Effect"
 *
 * const program = myEffect.pipe(
 *   Effect.provide(StatsState.StatsStateLive)
 * )
 */
export const StatsStateLive = Layer.effect(
  StatsState,
  Ref.make(new Map<string, Statistics.Stats>())
)
