import * as React from "react"
import { TextAttributes } from "@opentui/core"
import { Atom, useAtomValue, Result } from "@effect-atom/atom-react"
import { TradeList } from "./TradeList"
import { StatisticsPanel } from "./StatisticsPanel"
import type * as UIState from "../state/UIState"

/**
 * Header - Displays the application header.
 *
 * @category Components
 * @since 0.1.0
 */
export const Header: React.FC<{ symbols: ReadonlyArray<string> }> = ({ symbols }) => (
  <box flexDirection="column" marginBottom={1}>
    <box>
      <text fg="cyan" attributes={TextAttributes.BOLD}>
        {"═".repeat(120)}
      </text>
    </box>
    <box>
      <text fg="cyan" attributes={TextAttributes.BOLD}>
        REAL-TIME TRADE FEED & STATISTICS
      </text>
      <text attributes={TextAttributes.DIM}> | Symbols: {symbols.join(", ")}</text>
    </box>
    <box>
      <text fg="cyan" attributes={TextAttributes.BOLD}>
        {"═".repeat(120)}
      </text>
    </box>
  </box>
)

/**
 * SplitView - Displays trades and statistics side by side.
 *
 * @category Components
 * @since 0.1.0
 */
export const SplitView: React.FC<{
  state: UIState.UIState
  showEnhancedMetrics: boolean
}> = ({ state, showEnhancedMetrics }) => (
  <box>
    <box width="60%" borderStyle="single" borderColor="gray">
      <TradeList trades={state.recentTrades} />
    </box>
    <box width="40%" borderStyle="single" borderColor="gray">
      <StatisticsPanel
        symbols={state.symbols}
        statistics={state.statistics}
        showEnhanced={showEnhancedMetrics}
      />
    </box>
  </box>
)

/**
 * App - Main application component with reactive state.
 *
 * This component uses Atom for reactive updates via useAtomValue.
 * The UI automatically re-renders when the Atom state changes.
 *
 * @category Components
 * @since 0.1.0
 */
export const App: React.FC<{
  stateAtom: Atom.Atom<Result.Result<UIState.UIState>>
  showEnhancedMetrics?: boolean
}> = ({ stateAtom, showEnhancedMetrics = true }) => {
  const result = useAtomValue(stateAtom)
  const state = Result.getOrElse(result, () => ({
    recentTrades: [],
    statistics: new Map(),
    symbols: [],
    maxTrades: 20,
  }))

  return (
    <box flexDirection="column">
      <Header symbols={state.symbols} />
      <SplitView state={state} showEnhancedMetrics={showEnhancedMetrics} />
    </box>
  )
}
