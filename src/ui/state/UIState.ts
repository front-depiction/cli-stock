import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as PubSub from "effect/PubSub"
import * as Ref from "effect/Ref"
import * as Schedule from "effect/Schedule"
import * as Duration from "effect/Duration"
import { Atom, Result } from "@effect-atom/atom-react"
import type * as Trade from "../../domain/Trade"
import type * as Statistics from "../../domain/Statistics"
import * as TradePubSub from "../../services/TradePubSub"
import * as StatsState from "../../services/StatsState"
import { Channel } from "effect"

/**
 * UI State - Reactive state for the terminal UI.
 *
 * This holds the data that the UI renders:
 * - Recent trades (fixed-size rolling window)
 * - Statistics per symbol
 *
 * @category State
 * @since 0.1.0
 */
export interface UIState {
  readonly recentTrades: ReadonlyArray<Trade.TradeData>
  readonly statistics: ReadonlyMap<string, Statistics.Stats>
  readonly symbols: ReadonlyArray<string>
  readonly maxTrades: number
}

/**
 * Create an empty UI state.
 *
 * @category Constructors
 * @since 0.1.0
 */
export const empty = (symbols: ReadonlyArray<string>, maxTrades: number = 20): UIState => ({
  recentTrades: [],
  statistics: new Map(),
  symbols,
  maxTrades,
})

/**
 * Add a trade to the UI state.
 *
 * @category Combinators
 * @since 0.1.0
 */
export const addTrade = (state: UIState, trade: Trade.TradeData): UIState => ({
  ...state,
  recentTrades: [trade, ...state.recentTrades].slice(0, state.maxTrades),
})

/**
 * Update statistics for a symbol.
 *
 * @category Combinators
 * @since 0.1.0
 */
export const updateStats = (state: UIState, symbol: string, stats: Statistics.Stats): UIState => ({
  ...state,
  statistics: new Map(state.statistics).set(symbol, stats),
})

/**
 * UIState Service - An Atom holding the UI state for reactive React integration.
 *
 * Wraps the state in a Result to handle loading and error states.
 *
 * @category Services
 * @since 0.1.0
 */
export class UIStateAtom extends Context.Tag("@ui/UIStateAtom")<
  UIStateAtom,
  Atom.Atom<Result.Result<UIState>>
>() { }

/**
 * Configuration for UIState.
 *
 * @category Configuration
 * @since 0.1.0
 */
export interface UIStateConfig {
  readonly symbols: ReadonlyArray<string>
  readonly maxTrades: number
  readonly showEnhancedMetrics: boolean
}

/**
 * Configuration service for UIState.
 *
 * @category Services
 * @since 0.1.0
 */
export const UIStateConfig = Context.GenericTag<UIStateConfig>("@ui/UIStateConfig")

/**
 * Layer that provides the UIStateAtom service.
 *
 * Creates an Atom that automatically updates from the trade stream and statistics.
 *
 * @category Layers
 * @since 0.1.0
 */
export const UIStateAtomLive = Layer.scoped(
  UIStateAtom,
  Effect.gen(function* () {
    const config = yield* UIStateConfig
    const { pubsub } = yield* TradePubSub.TradePubSub
    const statsState = yield* StatsState.StatsState


    const stream = Stream.fromPubSub(pubsub)

    // Create stream that scans trades into UI state
    const tradeStream = stream.pipe(
      Stream.scan(empty(config.symbols, config.maxTrades), (state, trade) => addTrade(state, trade))
    )

    // Periodically read statistics
    const statsStream = Stream.fromSchedule(Schedule.spaced(Duration.millis(100))).pipe(
      Stream.mapEffect(() => Ref.get(statsState)),
      Stream.changes
    )

    // Combine both streams into UI state updates
    const uiStateStream = Stream.merge(
      tradeStream.pipe(Stream.map((state) => ({ type: "trade" as const, state }))),
      statsStream.pipe(Stream.map((stats) => ({ type: "stats" as const, stats })))
    ).pipe(
      Stream.scan(empty(config.symbols, config.maxTrades), (state, update) =>
        update.type === "trade" ? update.state : { ...state, statistics: update.stats }
      )
    )

    // Create a simple writable atom from the stream
    return Atom.make(uiStateStream, { initialValue: empty(config.symbols, config.maxTrades) }).pipe(
      Atom.keepAlive
    )
  })
)
