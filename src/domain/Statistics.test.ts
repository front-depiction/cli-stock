import { describe, it, expect } from "bun:test"
import * as Statistics from "./Statistics"
import { mockStats } from "../test-utils/fixtures"

describe("Statistics", () => {
  describe("Branded Types", () => {
    describe("WindowSize", () => {
      it("should create a valid WindowSize", () => {
        const size = Statistics.WindowSize(20)
        expect(size).toBe(20 as Statistics.WindowSize)
      })

      it("should throw error for zero", () => {
        expect(() => Statistics.WindowSize(0)).toThrow()
      })

      it("should throw error for negative value", () => {
        expect(() => Statistics.WindowSize(-5)).toThrow()
      })

      it("should throw error for non-integer", () => {
        expect(() => Statistics.WindowSize(20.5)).toThrow()
      })
    })

    describe("TimeWindow", () => {
      it("should create a valid TimeWindow", () => {
        const window = Statistics.TimeWindow(30_000)
        expect(window).toBe(30_000 as Statistics.TimeWindow)
      })

      it("should throw error for zero", () => {
        expect(() => Statistics.TimeWindow(0)).toThrow()
      })

      it("should throw error for negative value", () => {
        expect(() => Statistics.TimeWindow(-1000)).toThrow()
      })
    })
  })

  describe("WindowConfig", () => {
    it("should create EventBased config", () => {
      const config: Statistics.WindowConfig = { _tag: "EventBased", size: 20 }
      expect(config._tag).toBe("EventBased")
      expect(config.size).toBe(20)
    })

    it("should create TimeBased config", () => {
      const config: Statistics.WindowConfig = { _tag: "TimeBased", durationMs: 30_000 }
      expect(config._tag).toBe("TimeBased")
      expect(config.durationMs).toBe(30_000)
    })

    it("should create Hybrid config", () => {
      const config: Statistics.WindowConfig = {
        _tag: "Hybrid",
        size: 20,
        durationMs: 30_000,
      }
      expect(config._tag).toBe("Hybrid")
      expect(config.size).toBe(20)
      expect(config.durationMs).toBe(30_000)
    })
  })

  describe("emptyStats", () => {
    it("should create empty stats with default EventBased window", () => {
      const stats = Statistics.emptyStats()

      expect(stats.count).toBe(0)
      expect(stats.sum).toBe(0)
      expect(stats.sumSquares).toBe(0)
      expect(stats.min).toBe(Infinity)
      expect(stats.max).toBe(-Infinity)
      expect(stats.recentPrices).toEqual([])
      expect(stats.pricePoints).toEqual([])
      expect(stats.windowConfig._tag).toBe("EventBased")
    })

    it("should create empty stats with custom window config", () => {
      const config: Statistics.WindowConfig = { _tag: "TimeBased", durationMs: 60_000 }
      const stats = Statistics.emptyStats(config)

      expect(stats.windowConfig._tag).toBe("TimeBased")
      if (stats.windowConfig._tag === "TimeBased") {
        expect(stats.windowConfig.durationMs).toBe(60_000)
      }
    })
  })

  describe("updateStats", () => {
    describe("EventBased window", () => {
      it("should update stats with a single price", () => {
        const stats = Statistics.emptyStats({ _tag: "EventBased", size: 5 })
        const updated = Statistics.updateStats(stats, 150, 100, Date.now())

        expect(updated.count).toBe(1)
        expect(updated.sum).toBe(150)
        expect(updated.min).toBe(150)
        expect(updated.max).toBe(150)
        expect(updated.recentPrices).toEqual([150])
      })

      it("should maintain sliding window of correct size", () => {
        let stats = Statistics.emptyStats({ _tag: "EventBased", size: 3 })
        const baseTime = Date.now()

        stats = Statistics.updateStats(stats, 100, 100, baseTime)
        stats = Statistics.updateStats(stats, 110, 100, baseTime + 1000)
        stats = Statistics.updateStats(stats, 120, 100, baseTime + 2000)
        stats = Statistics.updateStats(stats, 130, 100, baseTime + 3000)

        expect(stats.recentPrices.length).toBe(3)
        expect(stats.recentPrices).toEqual([110, 120, 130])
        expect(stats.count).toBe(4)
      })

      it("should track min and max across all prices", () => {
        let stats = Statistics.emptyStats({ _tag: "EventBased", size: 3 })
        const baseTime = Date.now()

        stats = Statistics.updateStats(stats, 150, 100, baseTime)
        stats = Statistics.updateStats(stats, 120, 100, baseTime + 1000)
        stats = Statistics.updateStats(stats, 180, 100, baseTime + 2000)

        expect(stats.min).toBe(120)
        expect(stats.max).toBe(180)
      })
    })

    describe("TimeBased window", () => {
      it("should filter old prices outside time window", () => {
        let stats = Statistics.emptyStats({ _tag: "TimeBased", durationMs: 5000 })
        const baseTime = Date.now()

        stats = Statistics.updateStats(stats, 100, 100, baseTime)
        stats = Statistics.updateStats(stats, 110, 100, baseTime + 2000)
        stats = Statistics.updateStats(stats, 120, 100, baseTime + 6000) // Beyond window

        // Only last two prices should be in window
        expect(stats.recentPrices.length).toBe(2)
        expect(stats.recentPrices).toEqual([110, 120])
      })

      it("should keep all prices within time window", () => {
        let stats = Statistics.emptyStats({ _tag: "TimeBased", durationMs: 10000 })
        const baseTime = Date.now()

        stats = Statistics.updateStats(stats, 100, 100, baseTime)
        stats = Statistics.updateStats(stats, 110, 100, baseTime + 2000)
        stats = Statistics.updateStats(stats, 120, 100, baseTime + 4000)

        expect(stats.recentPrices.length).toBe(3)
        expect(stats.recentPrices).toEqual([100, 110, 120])
      })
    })

    describe("Hybrid window", () => {
      it("should apply both time and event constraints", () => {
        let stats = Statistics.emptyStats({
          _tag: "Hybrid",
          size: 2,
          durationMs: 10000,
        })
        const baseTime = Date.now()

        stats = Statistics.updateStats(stats, 100, 100, baseTime)
        stats = Statistics.updateStats(stats, 110, 100, baseTime + 2000)
        stats = Statistics.updateStats(stats, 120, 100, baseTime + 4000)
        stats = Statistics.updateStats(stats, 130, 100, baseTime + 6000)

        // Should only keep last 2 prices (event constraint)
        expect(stats.recentPrices.length).toBe(2)
        expect(stats.recentPrices).toEqual([120, 130])
      })
    })
  })

  describe("calculateMean", () => {
    it("should calculate mean of prices", () => {
      const stats = mockStats([100, 110, 120])
      const mean = Statistics.calculateMean(stats)
      expect(mean).toBe(110)
    })

    it("should return 0 for empty stats", () => {
      const stats = Statistics.emptyStats()
      const mean = Statistics.calculateMean(stats)
      expect(mean).toBe(0)
    })

    it("should handle single price", () => {
      const stats = mockStats([150])
      const mean = Statistics.calculateMean(stats)
      expect(mean).toBe(150)
    })
  })

  describe("calculateStdDev", () => {
    it("should calculate standard deviation", () => {
      const stats = mockStats([100, 110, 120])
      const stdDev = Statistics.calculateStdDev(stats)

      // Manual calculation: mean = 110, variance = ((10^2 + 0^2 + 10^2) / 3) = 66.67, stdDev = ~8.165
      expect(stdDev).toBeCloseTo(8.165, 2)
    })

    it("should return 0 for empty stats", () => {
      const stats = Statistics.emptyStats()
      const stdDev = Statistics.calculateStdDev(stats)
      expect(stdDev).toBe(0)
    })

    it("should return 0 for single price", () => {
      const stats = mockStats([150])
      const stdDev = Statistics.calculateStdDev(stats)
      expect(stdDev).toBe(0)
    })

    it("should return 0 for identical prices", () => {
      const stats = mockStats([100, 100, 100])
      const stdDev = Statistics.calculateStdDev(stats)
      expect(stdDev).toBe(0)
    })
  })

  describe("calculateVolatility", () => {
    it("should calculate annualized volatility", () => {
      const stats = mockStats([100, 105, 110, 108, 112])
      const volatility = Statistics.calculateVolatility(stats)

      expect(volatility).toBeGreaterThan(0)
      expect(typeof volatility).toBe("number")
    })

    it("should return 0 for insufficient data", () => {
      const stats = mockStats([100])
      const volatility = Statistics.calculateVolatility(stats)
      expect(volatility).toBe(0)
    })

    it("should return 0 for empty stats", () => {
      const stats = Statistics.emptyStats()
      const volatility = Statistics.calculateVolatility(stats)
      expect(volatility).toBe(0)
    })
  })

  describe("calculateMomentum", () => {
    it("should calculate positive momentum", () => {
      const stats = mockStats([100, 110, 120])
      const momentum = Statistics.calculateMomentum(stats)

      expect(momentum).toBe(20) // (120 - 100) / 100 * 100 = 20%
    })

    it("should calculate negative momentum", () => {
      const stats = mockStats([120, 110, 100])
      const momentum = Statistics.calculateMomentum(stats)

      expect(momentum).toBeCloseTo(-16.67, 2) // (100 - 120) / 120 * 100
    })

    it("should return 0 for insufficient data", () => {
      const stats = mockStats([100])
      const momentum = Statistics.calculateMomentum(stats)
      expect(momentum).toBe(0)
    })

    it("should return 0 for no price change", () => {
      const stats = mockStats([100, 100, 100])
      const momentum = Statistics.calculateMomentum(stats)
      expect(momentum).toBe(0)
    })
  })

  describe("calculateTradeVelocity", () => {
    it("should calculate trades per second", () => {
      let stats = Statistics.emptyStats()
      const baseTime = Date.now()

      // Add 10 trades over 5 seconds
      for (let i = 0; i < 10; i++) {
        stats = Statistics.updateStats(stats, 100 + i, 100, baseTime + i * 500)
      }

      const velocity = Statistics.calculateTradeVelocity(stats)

      // 10 trades / 4.5 seconds = ~2.22 trades/sec
      expect(velocity).toBeCloseTo(2.22, 1)
    })

    it("should return 0 for insufficient data", () => {
      const stats = mockStats([100])
      const velocity = Statistics.calculateTradeVelocity(stats)
      expect(velocity).toBe(0)
    })
  })

  describe("calculateVWAP", () => {
    it("should calculate volume-weighted average price", () => {
      let stats = Statistics.emptyStats()
      const baseTime = Date.now()

      stats = Statistics.updateStats(stats, 100, 100, baseTime)
      stats = Statistics.updateStats(stats, 110, 200, baseTime + 1000)
      stats = Statistics.updateStats(stats, 120, 100, baseTime + 2000)

      const vwap = Statistics.calculateVWAP(stats)

      // VWAP = (100*100 + 110*200 + 120*100) / (100 + 200 + 100)
      // = (10000 + 22000 + 12000) / 400 = 44000 / 400 = 110
      expect(vwap).toBeCloseTo(110, 2)
    })

    it("should return 0 for empty stats", () => {
      const stats = Statistics.emptyStats()
      const vwap = Statistics.calculateVWAP(stats)
      expect(vwap).toBe(0)
    })

    it("should handle zero volume", () => {
      let stats = Statistics.emptyStats()
      const baseTime = Date.now()

      stats = Statistics.updateStats(stats, 100, 0, baseTime)

      const vwap = Statistics.calculateVWAP(stats)
      expect(vwap).toBe(0)
    })
  })

  describe("calculateSpreadApprox", () => {
    it("should estimate bid-ask spread", () => {
      const stats = mockStats([100, 105, 95, 110])
      const spread = Statistics.calculateSpreadApprox(stats)

      // min = 95, max = 110, mid = 102.5, spread = (110-95)/102.5 * 100 = ~14.63%
      expect(spread).toBeCloseTo(14.63, 1)
    })

    it("should return 0 for insufficient data", () => {
      const stats = mockStats([100])
      const spread = Statistics.calculateSpreadApprox(stats)
      expect(spread).toBe(0)
    })

    it("should return 0 for identical prices", () => {
      const stats = mockStats([100, 100, 100])
      const spread = Statistics.calculateSpreadApprox(stats)
      expect(spread).toBe(0)
    })
  })

  describe("calculateTradingMetrics", () => {
    it("should calculate all metrics at once", () => {
      const stats = mockStats([100, 105, 110, 108, 112])
      const metrics = Statistics.calculateTradingMetrics(stats)

      expect(metrics).toHaveProperty("volatility")
      expect(metrics).toHaveProperty("momentum")
      expect(metrics).toHaveProperty("tradeVelocity")
      expect(metrics).toHaveProperty("vwap")
      expect(metrics).toHaveProperty("spreadApprox")

      expect(typeof metrics.volatility).toBe("number")
      expect(typeof metrics.momentum).toBe("number")
      expect(typeof metrics.tradeVelocity).toBe("number")
      expect(typeof metrics.vwap).toBe("number")
      expect(typeof metrics.spreadApprox).toBe("number")
    })
  })

  describe("getMin and getMax", () => {
    it("should return min price from recent prices", () => {
      const stats = mockStats([100, 90, 110, 95])
      const min = Statistics.getMin(stats)
      expect(min).toBe(90)
    })

    it("should return max price from recent prices", () => {
      const stats = mockStats([100, 90, 110, 95])
      const max = Statistics.getMax(stats)
      expect(max).toBe(110)
    })

    it("should return 0 for empty stats", () => {
      const stats = Statistics.emptyStats()
      expect(Statistics.getMin(stats)).toBe(0)
      expect(Statistics.getMax(stats)).toBe(0)
    })
  })

  describe("toTradeStatistics", () => {
    it("should convert Stats to TradeStatistics", () => {
      const stats = mockStats([100, 110, 120])
      const tradeStats = Statistics.toTradeStatistics(stats, "AAPL")

      expect(tradeStats.symbol).toBe("AAPL")
      expect(tradeStats.mean).toBe(110)
      expect(tradeStats.count).toBe(3)
      expect(tradeStats.min).toBe(100)
      expect(tradeStats.max).toBe(120)
      expect(tradeStats.recentPrices).toEqual([100, 110, 120])
      expect(typeof tradeStats.stdDev).toBe("number")
    })

    it("should work with piped syntax", () => {
      const stats = mockStats([100, 110, 120])
      const tradeStats = Statistics.toTradeStatistics("AAPL")(stats)

      expect(tradeStats.symbol).toBe("AAPL")
      expect(tradeStats.count).toBe(3)
    })
  })

  describe("isTradeStatistics", () => {
    it("should validate correct TradeStatistics", () => {
      const stats = mockStats([100, 110, 120])
      const tradeStats = Statistics.toTradeStatistics(stats, "AAPL")

      expect(Statistics.isTradeStatistics(tradeStats)).toBe(true)
    })

    it("should reject invalid data", () => {
      const invalid = { symbol: "AAPL", mean: 100 }
      expect(Statistics.isTradeStatistics(invalid)).toBe(false)
    })
  })

  describe("Predicates", () => {
    describe("hasSufficientData", () => {
      it("should return true when sufficient data", () => {
        const stats = mockStats([100, 110, 120])
        expect(Statistics.hasSufficientData(3)(stats)).toBe(true)
      })

      it("should return false when insufficient data", () => {
        const stats = mockStats([100, 110])
        expect(Statistics.hasSufficientData(5)(stats)).toBe(false)
      })
    })

    describe("isEmpty", () => {
      it("should return true for empty stats", () => {
        const stats = Statistics.emptyStats()
        expect(Statistics.isEmpty(stats)).toBe(true)
      })

      it("should return false for non-empty stats", () => {
        const stats = mockStats([100])
        expect(Statistics.isEmpty(stats)).toBe(false)
      })
    })

    describe("isAtCapacity", () => {
      it("should return true when at capacity", () => {
        const stats = mockStats([100, 110, 120])
        expect(Statistics.isAtCapacity(3)(stats)).toBe(true)
      })

      it("should return false when below capacity", () => {
        const stats = mockStats([100, 110])
        expect(Statistics.isAtCapacity(5)(stats)).toBe(false)
      })
    })
  })

  describe("Edge Cases", () => {
    it("should handle very large prices", () => {
      const stats = mockStats([1000000, 1000100, 1000200])
      const mean = Statistics.calculateMean(stats)
      expect(mean).toBe(1000100)
    })

    it("should handle very small prices", () => {
      const stats = mockStats([0.001, 0.002, 0.003])
      const mean = Statistics.calculateMean(stats)
      expect(mean).toBeCloseTo(0.002, 5)
    })

    it("should handle rapid price changes", () => {
      const stats = mockStats([100, 200, 50, 300, 25])
      const stdDev = Statistics.calculateStdDev(stats)
      expect(stdDev).toBeGreaterThan(0)
    })
  })
})
