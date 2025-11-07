import { describe, it, expect } from "bun:test"
import * as Indicator from "./Indicator"
import * as DateTime from "effect/DateTime"
import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import {
  mockBuySignal,
  mockSellSignal,
  mockHoldSignal,
  mockIndicatorState,
} from "../test-utils/fixtures"

describe("Indicator", () => {
  describe("Signal Types", () => {
    describe("Buy Signal", () => {
      it("should create a Buy signal", () => {
        const signal: Indicator.Buy = {
          _tag: "buy",
          strength: 0.8,
          timestamp: DateTime.unsafeNow(),
          reason: "Test buy",
        }

        expect(signal._tag).toBe("buy")
        expect(signal.strength).toBe(0.8)
        expect(signal.reason).toBe("Test buy")
      })

      it("should validate with isSignal", () => {
        const signal = mockBuySignal()
        expect(Indicator.isSignal(signal)).toBe(true)
      })
    })

    describe("Sell Signal", () => {
      it("should create a Sell signal", () => {
        const signal: Indicator.Sell = {
          _tag: "sell",
          strength: 0.9,
          timestamp: DateTime.unsafeNow(),
          reason: "Test sell",
        }

        expect(signal._tag).toBe("sell")
        expect(signal.strength).toBe(0.9)
        expect(signal.reason).toBe("Test sell")
      })
    })

    describe("Hold Signal", () => {
      it("should create a Hold signal", () => {
        const signal: Indicator.Hold = {
          _tag: "hold",
          timestamp: DateTime.unsafeNow(),
        }

        expect(signal._tag).toBe("hold")
        expect(signal).toHaveProperty("timestamp")
      })
    })
  })

  describe("Signal Guards", () => {
    describe("isBuy", () => {
      it("should return true for buy signal", () => {
        const signal = mockBuySignal()
        expect(Indicator.isBuy(signal)).toBe(true)
      })

      it("should return false for sell signal", () => {
        const signal = mockSellSignal()
        expect(Indicator.isBuy(signal)).toBe(false)
      })

      it("should return false for hold signal", () => {
        const signal = mockHoldSignal()
        expect(Indicator.isBuy(signal)).toBe(false)
      })
    })

    describe("isSell", () => {
      it("should return true for sell signal", () => {
        const signal = mockSellSignal()
        expect(Indicator.isSell(signal)).toBe(true)
      })

      it("should return false for buy signal", () => {
        const signal = mockBuySignal()
        expect(Indicator.isSell(signal)).toBe(false)
      })
    })

    describe("isHold", () => {
      it("should return true for hold signal", () => {
        const signal = mockHoldSignal()
        expect(Indicator.isHold(signal)).toBe(true)
      })

      it("should return false for buy signal", () => {
        const signal = mockBuySignal()
        expect(Indicator.isHold(signal)).toBe(false)
      })
    })
  })

  describe("SignalEquivalence", () => {
    it("should consider identical buy signals equal", () => {
      const timestamp = DateTime.unsafeNow()
      const signal1 = mockBuySignal({ strength: 0.8, reason: "Test", timestamp })
      const signal2 = mockBuySignal({ strength: 0.8, reason: "Test", timestamp })

      expect(Indicator.SignalEquivalence(signal1, signal2)).toBe(true)
    })

    it("should consider different strengths unequal", () => {
      const signal1 = mockBuySignal({ strength: 0.8 })
      const signal2 = mockBuySignal({ strength: 0.9 })

      expect(Indicator.SignalEquivalence(signal1, signal2)).toBe(false)
    })

    it("should consider different tags unequal", () => {
      const signal1 = mockBuySignal()
      const signal2 = mockSellSignal()

      expect(Indicator.SignalEquivalence(signal1, signal2)).toBe(false)
    })

    it("should consider identical hold signals equal", () => {
      const timestamp = DateTime.unsafeNow()
      const signal1 = mockHoldSignal({ timestamp })
      const signal2 = mockHoldSignal({ timestamp })

      expect(Indicator.SignalEquivalence(signal1, signal2)).toBe(true)
    })
  })

  describe("matchSignal", () => {
    it("should match buy signal", () => {
      const signal = mockBuySignal({ strength: 0.8, reason: "Oversold" })

      const result = Indicator.matchSignal(signal, {
        buy: (s) => `BUY: ${s.reason} (${s.strength})`,
        sell: (s) => `SELL: ${s.reason} (${s.strength})`,
        hold: () => "HOLD",
      })

      expect(result).toBe("BUY: Oversold (0.8)")
    })

    it("should match sell signal", () => {
      const signal = mockSellSignal({ strength: 0.9, reason: "Overbought" })

      const result = Indicator.matchSignal(signal, {
        buy: (s) => `BUY: ${s.reason}`,
        sell: (s) => `SELL: ${s.reason}`,
        hold: () => "HOLD",
      })

      expect(result).toBe("SELL: Overbought")
    })

    it("should match hold signal", () => {
      const signal = mockHoldSignal()

      const result = Indicator.matchSignal(signal, {
        buy: () => "BUY",
        sell: () => "SELL",
        hold: () => "HOLD",
      })

      expect(result).toBe("HOLD")
    })
  })

  describe("Signal Orders", () => {
    describe("OrderByTimestamp", () => {
      it("should sort signals by timestamp", () => {
        const now = DateTime.unsafeNow()
        const later = DateTime.add(now, { seconds: 10 })
        const evenLater = DateTime.add(now, { seconds: 20 })

        const signals = [
          mockBuySignal({ timestamp: evenLater }),
          mockSellSignal({ timestamp: now }),
          mockHoldSignal({ timestamp: later }),
        ]

        const sorted = pipe(signals, Array.sort(Indicator.OrderByTimestamp))

        expect(DateTime.lessThanOrEqualTo(sorted[0].timestamp, sorted[1].timestamp)).toBe(true)
        expect(DateTime.lessThanOrEqualTo(sorted[1].timestamp, sorted[2].timestamp)).toBe(true)
      })
    })

    describe("OrderByStrength", () => {
      it("should sort signals by strength", () => {
        const signals: Indicator.Signal[] = [
          mockBuySignal({ strength: 0.5 }),
          mockSellSignal({ strength: 0.9 }),
          mockBuySignal({ strength: 0.3 }),
          mockHoldSignal(), // strength = 0
        ]

        const sorted = pipe(signals, Array.sort(Indicator.OrderByStrength))

        expect(Indicator.getStrength(sorted[0])).toBeLessThanOrEqual(
          Indicator.getStrength(sorted[1])
        )
        expect(Indicator.getStrength(sorted[1])).toBeLessThanOrEqual(
          Indicator.getStrength(sorted[2])
        )
      })
    })
  })

  describe("Signal Destructors", () => {
    describe("getTimestamp", () => {
      it("should extract timestamp from buy signal", () => {
        const timestamp = DateTime.unsafeNow()
        const signal = mockBuySignal({ timestamp })

        expect(DateTime.Equivalence(Indicator.getTimestamp(signal), timestamp)).toBe(true)
      })

      it("should extract timestamp from hold signal", () => {
        const timestamp = DateTime.unsafeNow()
        const signal = mockHoldSignal({ timestamp })

        expect(DateTime.Equivalence(Indicator.getTimestamp(signal), timestamp)).toBe(true)
      })
    })

    describe("getStrength", () => {
      it("should extract strength from buy signal", () => {
        const signal = mockBuySignal({ strength: 0.75 })
        expect(Indicator.getStrength(signal)).toBe(0.75)
      })

      it("should extract strength from sell signal", () => {
        const signal = mockSellSignal({ strength: 0.85 })
        expect(Indicator.getStrength(signal)).toBe(0.85)
      })

      it("should return 0 for hold signal", () => {
        const signal = mockHoldSignal()
        expect(Indicator.getStrength(signal)).toBe(0)
      })
    })
  })

  describe("Signal Predicates", () => {
    describe("isStrongBuy", () => {
      it("should return true for buy signal with strength > 0.7", () => {
        const signal = mockBuySignal({ strength: 0.8 })
        expect(Indicator.isStrongBuy(signal)).toBe(true)
      })

      it("should return false for buy signal with strength <= 0.7", () => {
        const signal = mockBuySignal({ strength: 0.7 })
        expect(Indicator.isStrongBuy(signal)).toBe(false)
      })

      it("should return false for sell signal", () => {
        const signal = mockSellSignal({ strength: 0.9 })
        expect(Indicator.isStrongBuy(signal)).toBe(false)
      })

      it("should return false for hold signal", () => {
        const signal = mockHoldSignal()
        expect(Indicator.isStrongBuy(signal)).toBe(false)
      })
    })

    describe("isStrongSell", () => {
      it("should return true for sell signal with strength > 0.7", () => {
        const signal = mockSellSignal({ strength: 0.8 })
        expect(Indicator.isStrongSell(signal)).toBe(true)
      })

      it("should return false for sell signal with strength <= 0.7", () => {
        const signal = mockSellSignal({ strength: 0.7 })
        expect(Indicator.isStrongSell(signal)).toBe(false)
      })

      it("should return false for buy signal", () => {
        const signal = mockBuySignal({ strength: 0.9 })
        expect(Indicator.isStrongSell(signal)).toBe(false)
      })
    })
  })

  describe("TriggerCondition", () => {
    describe("PriceAbove", () => {
      it("should create PriceAbove condition", () => {
        const condition: Indicator.PriceAbove = {
          _tag: "priceAbove",
          threshold: 200,
        }

        expect(condition._tag).toBe("priceAbove")
        expect(condition.threshold).toBe(200)
      })

      it("should validate with isTriggerCondition", () => {
        const condition: Indicator.PriceAbove = {
          _tag: "priceAbove",
          threshold: 200,
        }

        expect(Indicator.isTriggerCondition(condition)).toBe(true)
      })
    })

    describe("PriceBelow", () => {
      it("should create PriceBelow condition", () => {
        const condition: Indicator.PriceBelow = {
          _tag: "priceBelow",
          threshold: 100,
        }

        expect(condition._tag).toBe("priceBelow")
        expect(condition.threshold).toBe(100)
      })
    })

    describe("VolumeAbove", () => {
      it("should create VolumeAbove condition", () => {
        const condition: Indicator.VolumeAbove = {
          _tag: "volumeAbove",
          threshold: 10000,
        }

        expect(condition._tag).toBe("volumeAbove")
        expect(condition.threshold).toBe(10000)
      })
    })

    describe("VolatilityAbove", () => {
      it("should create VolatilityAbove condition", () => {
        const condition: Indicator.VolatilityAbove = {
          _tag: "volatilityAbove",
          threshold: 0.5,
        }

        expect(condition._tag).toBe("volatilityAbove")
        expect(condition.threshold).toBe(0.5)
      })
    })

    describe("CrossOver", () => {
      it("should create CrossOver condition", () => {
        const condition: Indicator.CrossOver = {
          _tag: "crossOver",
          fastPeriod: 20,
          slowPeriod: 50,
        }

        expect(condition._tag).toBe("crossOver")
        expect(condition.fastPeriod).toBe(20)
        expect(condition.slowPeriod).toBe(50)
      })
    })
  })

  describe("matchCondition", () => {
    it("should match priceAbove", () => {
      const condition: Indicator.PriceAbove = { _tag: "priceAbove", threshold: 200 }

      const result = Indicator.matchCondition(condition, {
        priceAbove: (c) => `Price above ${c.threshold}`,
        priceBelow: (c) => `Price below ${c.threshold}`,
        volumeAbove: (c) => `Volume above ${c.threshold}`,
        volatilityAbove: (c) => `Volatility above ${c.threshold}`,
        crossOver: (c) => `${c.fastPeriod} crossed ${c.slowPeriod}`,
      })

      expect(result).toBe("Price above 200")
    })

    it("should match crossOver", () => {
      const condition: Indicator.CrossOver = {
        _tag: "crossOver",
        fastPeriod: 20,
        slowPeriod: 50,
      }

      const result = Indicator.matchCondition(condition, {
        priceAbove: () => "Price above",
        priceBelow: () => "Price below",
        volumeAbove: () => "Volume above",
        volatilityAbove: () => "Volatility above",
        crossOver: (c) => `MA(${c.fastPeriod}) crossed MA(${c.slowPeriod})`,
      })

      expect(result).toBe("MA(20) crossed MA(50)")
    })
  })

  describe("IndicatorState", () => {
    describe("isIndicatorState", () => {
      it("should validate correct IndicatorState", () => {
        const state = mockIndicatorState()
        expect(Indicator.isIndicatorState(state)).toBe(true)
      })

      it("should reject invalid data", () => {
        const invalid = { id: "test", name: "Test" }
        expect(Indicator.isIndicatorState(invalid)).toBe(false)
      })
    })

    describe("updateValue", () => {
      it("should update indicator state value and timestamp", () => {
        const state = mockIndicatorState({ value: 50 })
        const newTimestamp = DateTime.add(state.lastUpdate, { seconds: 10 })
        const updated = Indicator.updateValue(state, 55, newTimestamp)

        expect(updated.value).toBe(55)
        expect(DateTime.Equivalence(updated.lastUpdate, newTimestamp)).toBe(true)
        expect(updated.id).toBe(state.id)
        expect(updated.name).toBe(state.name)
      })

      it("should work with piped syntax", () => {
        const state = mockIndicatorState({ value: 50 })
        const newTimestamp = DateTime.unsafeNow()
        const updated = Indicator.updateValue(60, newTimestamp)(state)

        expect(updated.value).toBe(60)
      })
    })
  })

  describe("IndicatorConfig", () => {
    describe("isIndicatorConfig", () => {
      it("should validate correct IndicatorConfig", () => {
        const config: Indicator.IndicatorConfig = {
          id: "rsi",
          name: "RSI",
          symbol: "AAPL",
          period: 14,
          params: {},
        }

        expect(Indicator.isIndicatorConfig(config)).toBe(true)
      })

      it("should validate config with params", () => {
        const config: Indicator.IndicatorConfig = {
          id: "ma",
          name: "Moving Average",
          symbol: "AAPL",
          period: 20,
          params: { type: "simple", smoothing: 2 },
        }

        expect(Indicator.isIndicatorConfig(config)).toBe(true)
      })

      it("should reject invalid config", () => {
        const invalid = { id: "test", period: 14 }
        expect(Indicator.isIndicatorConfig(invalid)).toBe(false)
      })
    })
  })

  describe("Integration Tests", () => {
    it("should filter strong signals", () => {
      const signals: Indicator.Signal[] = [
        mockBuySignal({ strength: 0.5 }),
        mockBuySignal({ strength: 0.8 }),
        mockSellSignal({ strength: 0.9 }),
        mockSellSignal({ strength: 0.6 }),
        mockHoldSignal(),
      ]

      const strongBuys = pipe(signals, Array.filter(Indicator.isStrongBuy))
      const strongSells = pipe(signals, Array.filter(Indicator.isStrongSell))

      expect(strongBuys.length).toBe(1)
      expect(strongSells.length).toBe(1)
    })

    it("should sort and filter signals", () => {
      const signals: Indicator.Signal[] = [
        mockBuySignal({ strength: 0.8 }),
        mockSellSignal({ strength: 0.9 }),
        mockBuySignal({ strength: 0.6 }),
        mockHoldSignal(),
      ]

      const strongSignals = pipe(
        signals,
        Array.filter((s) => Indicator.getStrength(s) > 0.7),
        Array.sort(Indicator.OrderByStrength)
      )

      expect(strongSignals.length).toBe(2)
      expect(Indicator.getStrength(strongSignals[0])).toBeLessThanOrEqual(
        Indicator.getStrength(strongSignals[1])
      )
    })
  })
})
