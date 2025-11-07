import * as React from "react"
import { TextAttributes } from "@opentui/core"
import type * as Trade from "../../domain/Trade"

/**
 * Format timestamp as HH:MM:SS.mmm.
 */
const formatTime = (millis: number): string => {
  const date = new Date(millis)
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  const milliseconds = date.getMilliseconds().toString().padStart(3, "0")
  return `${hours}:${minutes}:${seconds}.${milliseconds}`
}

/**
 * Get color based on latency.
 */
const getLatencyColor = (latency: number): string => {
  if (latency < 100) return "green"
  if (latency < 500) return "yellow"
  return "magenta"
}

/**
 * TradeRow - Displays a single trade.
 *
 * @category Components
 * @since 0.1.0
 */
export const TradeRow: React.FC<{ trade: Trade.TradeData }> = ({ trade }) => (
  <box>
    <text attributes={TextAttributes.DIM}>{formatTime(trade.timestamp)}</text>
    <text> </text>
    <text fg="cyan">{trade.symbol.padEnd(15)}</text>
    <text> </text>
    <text fg="green">${trade.price.toFixed(2).padStart(10)}</text>
    <text> </text>
    <text fg="yellow">{trade.volume.toString().padStart(8)}</text>
    <text> </text>
    <text fg={getLatencyColor(trade.latency)}>{trade.latency}ms</text>
  </box>
)

/**
 * TradeList - Displays a list of recent trades.
 *
 * @category Components
 * @since 0.1.0
 */
export const TradeList: React.FC<{
  trades: ReadonlyArray<Trade.TradeData>
}> = ({ trades }) => (
  <box flexDirection="column" padding={1}>
    <box marginBottom={1}>
      <text fg="cyan" attributes={TextAttributes.BOLD}>
        RECENT TRADES
      </text>
    </box>
    <box marginBottom={1}>
      <text attributes={TextAttributes.DIM}>Time Symbol Price Volume Latency</text>
    </box>
    <box flexDirection="column">
      {trades.length === 0 ? (
        <text attributes={TextAttributes.DIM}>Waiting for trades...</text>
      ) : (
        trades.map((trade, index) => <TradeRow key={`${trade.timestamp}-${index}`} trade={trade} />)
      )}
    </box>
  </box>
)
