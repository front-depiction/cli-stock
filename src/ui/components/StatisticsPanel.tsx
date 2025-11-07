import * as React from "react"
import { TextAttributes } from "@opentui/core"
import * as Statistics from "../../domain/Statistics"

/**
 * StatRow - Displays statistics for a single symbol with enhanced metrics.
 *
 * @category Components
 * @since 0.2.0
 */
export const StatRow: React.FC<{
  symbol: string
  stats: Statistics.Stats
  showEnhanced: boolean
}> = ({ symbol, stats, showEnhanced }) => {
  const mean = Statistics.calculateMean(stats)
  const stdDev = Statistics.calculateStdDev(stats)
  const min = Statistics.getMin(stats)
  const max = Statistics.getMax(stats)
  const count = stats.recentPrices.length

  const windowInfo = (() => {
    switch (stats.windowConfig._tag) {
      case "EventBased":
        return `n=${count}/${stats.windowConfig.size}`
      case "TimeBased":
        const durationSec = stats.windowConfig.durationMs / 1000
        return `t=${durationSec}s n=${count}`
      case "Hybrid":
        const hybridSec = stats.windowConfig.durationMs / 1000
        return `t=${hybridSec}s n=${count}/${stats.windowConfig.size}`
    }
  })()

  if (!showEnhanced) {
    return (
      <box flexDirection="column" marginBottom={1}>
        <box>
          <text fg="cyan" attributes={TextAttributes.BOLD}>
            {symbol}
          </text>
          <text attributes={TextAttributes.DIM}> ({windowInfo})</text>
        </box>
        <box paddingLeft={2}>
          <box width={20}>
            <text fg="green">Mean: ${mean.toFixed(2)}</text>
          </box>
          <box width={20}>
            <text fg="yellow">StdDev: ${stdDev.toFixed(4)}</text>
          </box>
          <box width={15}>
            <text fg="blue">Min: ${min.toFixed(2)}</text>
          </box>
          <box width={15}>
            <text fg="blue">Max: ${max.toFixed(2)}</text>
          </box>
        </box>
      </box>
    )
  }

  // Enhanced metrics
  const metrics = Statistics.calculateTradingMetrics(stats)

  return (
    <box flexDirection="column" marginBottom={1}>
      <box>
        <text fg="cyan" attributes={TextAttributes.BOLD}>
          {symbol}
        </text>
        <text attributes={TextAttributes.DIM}> ({windowInfo})</text>
      </box>
      <box paddingLeft={2} flexDirection="column">
        <box>
          <box width={20}>
            <text fg="green">Mean: ${mean.toFixed(2)}</text>
          </box>
          <box width={20}>
            <text fg="yellow">σ: ${stdDev.toFixed(3)}</text>
          </box>
          <box width={25}>
            <text fg="blue">
              [{min.toFixed(2)}-{max.toFixed(2)}]
            </text>
          </box>
        </box>
        <box>
          <box width={18}>
            <text fg="magenta">Vol: {metrics.volatility.toFixed(1)}%</text>
          </box>
          <box width={18}>
            <text fg="magenta">
              Mom: {metrics.momentum >= 0 ? "+" : ""}
              {metrics.momentum.toFixed(2)}%
            </text>
          </box>
          <box width={20}>
            <text fg="green">VWAP: ${metrics.vwap.toFixed(2)}</text>
          </box>
          <box width={20}>
            <text fg="yellow">Vel: {metrics.tradeVelocity.toFixed(1)}/s</text>
          </box>
        </box>
      </box>
    </box>
  )
}

/**
 * StatisticsPanel - Displays statistics for all tracked symbols.
 *
 * @category Components
 * @since 0.1.0
 */
export const StatisticsPanel: React.FC<{
  symbols: ReadonlyArray<string>
  statistics: ReadonlyMap<string, Statistics.Stats>
  showEnhanced?: boolean
}> = ({ symbols, statistics, showEnhanced = true }) => (
  <box flexDirection="column" padding={1}>
    <box marginBottom={1}>
      <text fg="cyan" attributes={TextAttributes.BOLD}>
        STATISTICS
      </text>
    </box>
    <box flexDirection="column">
      {symbols.length === 0 ? (
        <text attributes={TextAttributes.DIM}>No symbols tracked</text>
      ) : (
        symbols.map((symbol) => {
          const stats = statistics.get(symbol)
          return stats && stats.recentPrices.length > 0 ? (
            <StatRow key={symbol} symbol={symbol} stats={stats} showEnhanced={showEnhanced} />
          ) : (
            <box key={symbol}>
              <text attributes={TextAttributes.DIM}>{symbol}: Waiting for data...</text>
            </box>
          )
        })
      )}
    </box>
  </box>
)
