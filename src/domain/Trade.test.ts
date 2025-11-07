import { describe, it, expect } from "bun:test"
import * as Trade from "./Trade"
import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import { mockTrade, mockTrades } from "../test-utils/fixtures"

describe("Trade", () => {
  describe("Branded Types", () => {
    describe("Symbol", () => {
      it("should create a Symbol brand", () => {
        const symbol = Trade.Symbol("AAPL")
        expect(symbol).toBe("AAPL" as Trade.Symbol)
      })
    })

    describe("Price", () => {
      it("should create a valid Price brand", () => {
        const price = Trade.Price(150.25)
        expect(price).toBe(150.25 as Trade.Price)
      })

      it("should accept zero price", () => {
        const price = Trade.Price(0)
        expect(price).toBe(0 as Trade.Price)
      })

      it("should throw error for negative price", () => {
        expect(() => Trade.Price(-10)).toThrow()
      })
    })

    describe("Volume", () => {
      it("should create a valid Volume brand", () => {
        const volume = Trade.Volume(1000)
        expect(volume).toBe(1000 as Trade.Volume)
      })

      it("should accept zero volume", () => {
        const volume = Trade.Volume(0)
        expect(volume).toBe(0 as Trade.Volume)
      })

      it("should throw error for negative volume", () => {
        expect(() => Trade.Volume(-100)).toThrow()
      })
    })

    describe("Timestamp", () => {
      it("should create a valid Timestamp brand", () => {
        const timestamp = Trade.Timestamp(Date.now())
        expect(timestamp).toBeGreaterThan(0)
      })

      it("should throw error for zero timestamp", () => {
        expect(() => Trade.Timestamp(0)).toThrow()
      })

      it("should throw error for negative timestamp", () => {
        expect(() => Trade.Timestamp(-1000)).toThrow()
      })
    })

    describe("Latency", () => {
      it("should create a valid Latency brand", () => {
        const latency = Trade.Latency(50)
        expect(latency).toBe(50 as Trade.Latency)
      })

      it("should accept zero latency", () => {
        const latency = Trade.Latency(0)
        expect(latency).toBe(0 as Trade.Latency)
      })

      it("should throw error for negative latency", () => {
        expect(() => Trade.Latency(-10)).toThrow()
      })
    })
  })

  describe("TradeData", () => {
    describe("isTradeData", () => {
      it("should validate correct TradeData", () => {
        const trade = mockTrade()
        expect(Trade.isTradeData(trade)).toBe(true)
      })

      it("should reject invalid data", () => {
        const invalid = { symbol: "AAPL", price: 150 }
        expect(Trade.isTradeData(invalid)).toBe(false)
      })

      it("should accept TradeData without conditions", () => {
        const trade = mockTrade({ conditions: undefined })
        expect(Trade.isTradeData(trade)).toBe(true)
      })
    })

    describe("TradeEquivalence", () => {
      it("should consider structurally equal trades as equal", () => {
        const trade1 = mockTrade({ symbol: "AAPL", price: 150, volume: 100, timestamp: 1000 })
        const trade2 = mockTrade({ symbol: "AAPL", price: 150, volume: 100, timestamp: 1000 })
        expect(Trade.TradeEquivalence(trade1, trade2)).toBe(true)
      })

      it("should consider trades with different symbols as unequal", () => {
        const trade1 = mockTrade({ symbol: "AAPL", price: 150, volume: 100, timestamp: 1000 })
        const trade2 = mockTrade({ symbol: "GOOGL", price: 150, volume: 100, timestamp: 1000 })
        expect(Trade.TradeEquivalence(trade1, trade2)).toBe(false)
      })

      it("should consider trades with different prices as unequal", () => {
        const trade1 = mockTrade({ symbol: "AAPL", price: 150, volume: 100, timestamp: 1000 })
        const trade2 = mockTrade({ symbol: "AAPL", price: 151, volume: 100, timestamp: 1000 })
        expect(Trade.TradeEquivalence(trade1, trade2)).toBe(false)
      })

      it("should ignore latency in equivalence check", () => {
        const trade1 = mockTrade({ latency: 5 })
        const trade2 = mockTrade({ latency: 10 })
        // Note: mockTrade generates same timestamp/price/volume by default
        expect(Trade.TradeEquivalence(trade1, trade2)).toBe(true)
      })
    })
  })

  describe("Orders", () => {
    describe("OrderByTimestamp", () => {
      it("should sort trades by timestamp ascending", () => {
        const trades = [
          mockTrade({ timestamp: 3000 }),
          mockTrade({ timestamp: 1000 }),
          mockTrade({ timestamp: 2000 }),
        ]

        const sorted = pipe(trades, Array.sort(Trade.OrderByTimestamp))

        expect(sorted[0].timestamp).toBe(1000)
        expect(sorted[1].timestamp).toBe(2000)
        expect(sorted[2].timestamp).toBe(3000)
      })
    })

    describe("OrderByPrice", () => {
      it("should sort trades by price ascending", () => {
        const trades = [
          mockTrade({ price: 150 }),
          mockTrade({ price: 145 }),
          mockTrade({ price: 155 }),
        ]

        const sorted = pipe(trades, Array.sort(Trade.OrderByPrice))

        expect(sorted[0].price).toBe(145)
        expect(sorted[1].price).toBe(150)
        expect(sorted[2].price).toBe(155)
      })
    })

    describe("OrderBySymbol", () => {
      it("should sort trades by symbol alphabetically", () => {
        const trades = [
          mockTrade({ symbol: "MSFT" }),
          mockTrade({ symbol: "AAPL" }),
          mockTrade({ symbol: "GOOGL" }),
        ]

        const sorted = pipe(trades, Array.sort(Trade.OrderBySymbol))

        expect(sorted[0].symbol).toBe("AAPL")
        expect(sorted[1].symbol).toBe("GOOGL")
        expect(sorted[2].symbol).toBe("MSFT")
      })
    })

    describe("OrderByLatency", () => {
      it("should sort trades by latency ascending", () => {
        const trades = [
          mockTrade({ latency: 100 }),
          mockTrade({ latency: 50 }),
          mockTrade({ latency: 200 }),
        ]

        const sorted = pipe(trades, Array.sort(Trade.OrderByLatency))

        expect(sorted[0].latency).toBe(50)
        expect(sorted[1].latency).toBe(100)
        expect(sorted[2].latency).toBe(200)
      })
    })
  })

  describe("Destructors", () => {
    const trade = mockTrade({
      symbol: "AAPL",
      price: 150.25,
      volume: 1000,
      timestamp: 123456789,
      latency: 42,
    })

    it("should extract symbol", () => {
      expect(Trade.getSymbol(trade)).toBe("AAPL")
    })

    it("should extract price", () => {
      expect(Trade.getPrice(trade)).toBe(150.25)
    })

    it("should extract volume", () => {
      expect(Trade.getVolume(trade)).toBe(1000)
    })

    it("should extract timestamp", () => {
      expect(Trade.getTimestamp(trade)).toBe(123456789)
    })

    it("should extract latency", () => {
      expect(Trade.getLatency(trade)).toBe(42)
    })
  })

  describe("Predicates", () => {
    describe("hasLowLatency", () => {
      it("should return true for latency < 100ms", () => {
        const trade = mockTrade({ latency: 99 })
        expect(Trade.hasLowLatency(trade)).toBe(true)
      })

      it("should return false for latency >= 100ms", () => {
        const trade = mockTrade({ latency: 100 })
        expect(Trade.hasLowLatency(trade)).toBe(false)
      })

      it("should return true for zero latency", () => {
        const trade = mockTrade({ latency: 0 })
        expect(Trade.hasLowLatency(trade)).toBe(true)
      })
    })

    describe("hasMediumLatency", () => {
      it("should return true for latency between 100ms and 500ms", () => {
        const trade1 = mockTrade({ latency: 100 })
        const trade2 = mockTrade({ latency: 300 })
        const trade3 = mockTrade({ latency: 499 })

        expect(Trade.hasMediumLatency(trade1)).toBe(true)
        expect(Trade.hasMediumLatency(trade2)).toBe(true)
        expect(Trade.hasMediumLatency(trade3)).toBe(true)
      })

      it("should return false for latency < 100ms", () => {
        const trade = mockTrade({ latency: 99 })
        expect(Trade.hasMediumLatency(trade)).toBe(false)
      })

      it("should return false for latency >= 500ms", () => {
        const trade = mockTrade({ latency: 500 })
        expect(Trade.hasMediumLatency(trade)).toBe(false)
      })
    })

    describe("hasHighLatency", () => {
      it("should return true for latency >= 500ms", () => {
        const trade1 = mockTrade({ latency: 500 })
        const trade2 = mockTrade({ latency: 1000 })

        expect(Trade.hasHighLatency(trade1)).toBe(true)
        expect(Trade.hasHighLatency(trade2)).toBe(true)
      })

      it("should return false for latency < 500ms", () => {
        const trade = mockTrade({ latency: 499 })
        expect(Trade.hasHighLatency(trade)).toBe(false)
      })
    })

    describe("forSymbol", () => {
      it("should filter trades for specific symbol", () => {
        const trades = [
          mockTrade({ symbol: "AAPL" }),
          mockTrade({ symbol: "GOOGL" }),
          mockTrade({ symbol: "AAPL" }),
          mockTrade({ symbol: "MSFT" }),
        ]

        const appleTrades = pipe(trades, Array.filter(Trade.forSymbol("AAPL")))

        expect(appleTrades.length).toBe(2)
        expect(appleTrades.every((t) => t.symbol === "AAPL")).toBe(true)
      })

      it("should return empty array if no matches", () => {
        const trades = [mockTrade({ symbol: "AAPL" }), mockTrade({ symbol: "GOOGL" })]

        const teslaTrades = pipe(trades, Array.filter(Trade.forSymbol("TSLA")))

        expect(teslaTrades.length).toBe(0)
      })
    })
  })

  describe("Integration Tests", () => {
    it("should filter and sort trades by multiple criteria", () => {
      const trades = mockTrades(10)

      const result = pipe(
        trades,
        Array.filter(Trade.hasLowLatency),
        Array.filter(Trade.forSymbol("AAPL")),
        Array.sort(Trade.OrderByPrice)
      )

      expect(result.every(Trade.hasLowLatency)).toBe(true)
      expect(result.every((t) => t.symbol === "AAPL")).toBe(true)

      // Verify sorted
      for (let i = 1; i < result.length; i++) {
        expect(result[i].price).toBeGreaterThanOrEqual(result[i - 1].price)
      }
    })

    it("should handle empty trade array", () => {
      const trades: Trade.TradeData[] = []

      const result = pipe(trades, Array.filter(Trade.hasLowLatency), Array.sort(Trade.OrderByPrice))

      expect(result.length).toBe(0)
    })
  })
})
