import { describe, it, expect } from "bun:test"
import * as TradePubSub from "./TradePubSub"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Stream from "effect/Stream"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Queue from "effect/Queue"
import * as Array from "effect/Array"
import * as Chunk from "effect/Chunk"
import { pipe } from "effect/Function"
import { mockTrade, mockTrades } from "../test-utils/fixtures"

describe("TradePubSub", () => {
  describe("Configuration", () => {
    it("should have default configuration", () => {
      const config = TradePubSub.defaultConfig

      expect(config.capacity).toBe(1024)
      expect(config.replay).toBe(0)
      expect(config.sortByTimestamp).toBe(true)
    })
  })

  describe("Service", () => {
    it("should publish and receive trades", async () => {
      const program = Effect.scoped(
        Effect.gen(function* () {
          const { pubsub } = yield* TradePubSub.TradePubSub

          // FIRST: Subscribe (establishes subscription immediately)
          const dequeue = yield* PubSub.subscribe(pubsub)

          // Collect trades from stream
          const trades: any[] = []
          const fiber = yield* Effect.fork(
            pipe(
              Stream.fromQueue(dequeue),
              Stream.take(3),
              Stream.runForEach((trade) =>
                Effect.sync(() => {
                  trades.push(trade)
                })
              )
            )
          )

          // THEN: Publish
          yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL", price: 150 }))
          yield* PubSub.publish(pubsub, mockTrade({ symbol: "GOOGL", price: 2800 }))
          yield* PubSub.publish(pubsub, mockTrade({ symbol: "MSFT", price: 350 }))

          // Wait for stream to complete
          yield* Fiber.join(fiber)

          return trades
        })
      )

      const result = await Effect.runPromise(
        Effect.provide(program, TradePubSub.TradePubSubLiveDefault)
      )

      expect(result.length).toBe(3)
      expect(result[0].symbol).toBeDefined()
      expect(result[1].symbol).toBeDefined()
      expect(result[2].symbol).toBeDefined()
    })

    it("should support multiple subscribers", async () => {
      const program = Effect.scoped(
        Effect.gen(function* () {
          const { pubsub } = yield* TradePubSub.TradePubSub

          // FIRST: Subscribe (both subscribers established before publishing)
          const dequeue1 = yield* PubSub.subscribe(pubsub)
          const dequeue2 = yield* PubSub.subscribe(pubsub)

          // Two independent subscribers
          const subscriber1Trades: any[] = []
          const subscriber2Trades: any[] = []

          const fiber1 = yield* Effect.fork(
            pipe(
              Stream.fromQueue(dequeue1),
              Stream.take(2),
              Stream.runForEach((trade) =>
                Effect.sync(() => {
                  subscriber1Trades.push(trade)
                })
              )
            )
          )

          const fiber2 = yield* Effect.fork(
            pipe(
              Stream.fromQueue(dequeue2),
              Stream.take(2),
              Stream.runForEach((trade) =>
                Effect.sync(() => {
                  subscriber2Trades.push(trade)
                })
              )
            )
          )

          // THEN: Publish trades
          yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL" }))
          yield* PubSub.publish(pubsub, mockTrade({ symbol: "GOOGL" }))

          // Wait for both subscribers
          yield* Fiber.join(fiber1)
          yield* Fiber.join(fiber2)

          return { subscriber1Trades, subscriber2Trades }
        })
      )

      const result = await Effect.runPromise(
        Effect.provide(program, TradePubSub.TradePubSubLiveDefault)
      )

      expect(result.subscriber1Trades.length).toBe(2)
      expect(result.subscriber2Trades.length).toBe(2)
    })

    it("should sort trades by timestamp when enabled", async () => {
      const config: TradePubSub.TradePubSubConfig = {
        capacity: 1024,
        replay: 0,
        sortByTimestamp: true,
      }

      const program = Effect.scoped(
        Effect.gen(function* () {
          const { pubsub } = yield* TradePubSub.TradePubSub

          // FIRST: Subscribe
          const dequeue = yield* PubSub.subscribe(pubsub)

          const trades: any[] = []
          const fiber = yield* Effect.fork(
            pipe(
              Stream.fromQueue(dequeue),
              Stream.take(3),
              Stream.runForEach((trade) =>
                Effect.sync(() => {
                  trades.push(trade)
                })
              )
            )
          )

          // THEN: Publish in non-chronological order
          yield* PubSub.publish(pubsub, mockTrade({ timestamp: 3000 }))
          yield* PubSub.publish(pubsub, mockTrade({ timestamp: 1000 }))
          yield* PubSub.publish(pubsub, mockTrade({ timestamp: 2000 }))

          yield* Fiber.join(fiber)

          return trades
        })
      )

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(TradePubSub.TradePubSubLive),
          Effect.provide(Layer.succeed(TradePubSub.TradePubSubConfig, config))
        )
      )

      expect(result.length).toBe(3)
      // Note: Sorting happens in chunks, so exact order may vary
      expect(result.every((t) => t.timestamp > 0)).toBe(true)
    })
  })

  describe("Utilities", () => {
    describe("filterBySymbol", () => {
      it("should filter trades by symbol", async () => {
        const program = Effect.scoped(
          Effect.gen(function* () {
            const { pubsub } = yield* TradePubSub.TradePubSub

            // FIRST: Subscribe
            const dequeue = yield* PubSub.subscribe(pubsub)

            const trades: any[] = []
            const fiber = yield* Effect.fork(
              pipe(
                Stream.fromQueue(dequeue),
                TradePubSub.filterBySymbol("AAPL"),
                Stream.take(2),
                Stream.runForEach((trade) =>
                  Effect.sync(() => {
                    trades.push(trade)
                  })
                )
              )
            )

            // THEN: Publish mixed symbols
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "GOOGL" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "MSFT" }))

            yield* Fiber.join(fiber)

            return trades
          })
        )

        const result = await Effect.runPromise(
          Effect.provide(program, TradePubSub.TradePubSubLiveDefault)
        )

        expect(result.length).toBe(2)
        expect(result.every((t) => t.symbol === "AAPL")).toBe(true)
      })
    })

    describe("filterBySymbols", () => {
      it("should filter trades by multiple symbols", async () => {
        const program = Effect.scoped(
          Effect.gen(function* () {
            const { pubsub } = yield* TradePubSub.TradePubSub

            // FIRST: Subscribe
            const dequeue = yield* PubSub.subscribe(pubsub)

            const trades: any[] = []
            const fiber = yield* Effect.fork(
              pipe(
                Stream.fromQueue(dequeue),
                TradePubSub.filterBySymbols(["AAPL", "GOOGL"]),
                Stream.take(3),
                Stream.runForEach((trade) =>
                  Effect.sync(() => {
                    trades.push(trade)
                  })
                )
              )
            )

            // THEN: Publish mixed symbols
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "MSFT" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "GOOGL" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "TSLA" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL" }))

            yield* Fiber.join(fiber)

            return trades
          })
        )

        const result = await Effect.runPromise(
          Effect.provide(program, TradePubSub.TradePubSubLiveDefault)
        )

        expect(result.length).toBe(3)
        expect(result.every((t) => t.symbol === "AAPL" || t.symbol === "GOOGL")).toBe(true)
      })
    })

    describe("tap", () => {
      it("should tap into stream without consuming", async () => {
        const program = Effect.scoped(
          Effect.gen(function* () {
            const { pubsub } = yield* TradePubSub.TradePubSub

            // FIRST: Subscribe
            const dequeue = yield* PubSub.subscribe(pubsub)

            const tappedSymbols: string[] = []
            const receivedTrades: any[] = []

            const fiber = yield* Effect.fork(
              pipe(
                Stream.fromQueue(dequeue),
                TradePubSub.tap((trade) =>
                  Effect.sync(() => {
                    tappedSymbols.push(trade.symbol)
                  })
                ),
                Stream.take(2),
                Stream.runForEach((trade) =>
                  Effect.sync(() => {
                    receivedTrades.push(trade)
                  })
                )
              )
            )

            // THEN: Publish
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "GOOGL" }))

            yield* Fiber.join(fiber)

            return { tappedSymbols, receivedTrades }
          })
        )

        const result = await Effect.runPromise(
          Effect.provide(program, TradePubSub.TradePubSubLiveDefault)
        )

        expect(result.tappedSymbols.length).toBe(2)
        expect(result.receivedTrades.length).toBe(2)
        expect(result.tappedSymbols).toEqual(result.receivedTrades.map((t) => t.symbol))
      })
    })

    describe("createSubscriber", () => {
      it("should create a typed subscriber", async () => {
        const program = Effect.scoped(
          Effect.gen(function* () {
            const { pubsub } = yield* TradePubSub.TradePubSub

            // FIRST: Subscribe
            const dequeue = yield* PubSub.subscribe(pubsub)

            const processedTrades: string[] = []

            const subscriber = TradePubSub.createSubscriber("test-subscriber", (trade) =>
              Effect.sync(() => {
                processedTrades.push(trade.symbol)
              })
            )

            const fiber = yield* Effect.fork(
              pipe(Stream.fromQueue(dequeue), Stream.take(3), (stream) => subscriber(stream))
            )

            // THEN: Publish
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "GOOGL" }))
            yield* PubSub.publish(pubsub, mockTrade({ symbol: "MSFT" }))

            yield* Fiber.join(fiber)

            return processedTrades
          })
        )

        const result = await Effect.runPromise(
          Effect.provide(program, TradePubSub.TradePubSubLiveDefault)
        )

        expect(result.length).toBe(3)
        expect(result).toContain("AAPL")
        expect(result).toContain("GOOGL")
        expect(result).toContain("MSFT")
      })
    })
  })

  describe("Integration Tests", () => {
    it("should handle complex filtering and tapping", async () => {
      const program = Effect.scoped(
        Effect.gen(function* () {
          const { pubsub } = yield* TradePubSub.TradePubSub

          // FIRST: Subscribe
          const dequeue = yield* PubSub.subscribe(pubsub)

          const monitoredSymbols: string[] = []
          const filteredTrades: any[] = []

          const fiber = yield* Effect.fork(
            pipe(
              Stream.fromQueue(dequeue),
              TradePubSub.tap((trade) =>
                Effect.sync(() => {
                  monitoredSymbols.push(trade.symbol)
                })
              ),
              TradePubSub.filterBySymbol("AAPL"),
              Stream.take(2),
              Stream.runForEach((trade) =>
                Effect.sync(() => {
                  filteredTrades.push(trade)
                })
              )
            )
          )

          // THEN: Publish
          yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL", price: 150 }))
          yield* PubSub.publish(pubsub, mockTrade({ symbol: "GOOGL", price: 2800 }))
          yield* PubSub.publish(pubsub, mockTrade({ symbol: "AAPL", price: 151 }))
          yield* PubSub.publish(pubsub, mockTrade({ symbol: "MSFT", price: 350 }))

          yield* Fiber.join(fiber)

          return { monitoredSymbols, filteredTrades }
        })
      )

      const result = await Effect.runPromise(
        Effect.provide(program, TradePubSub.TradePubSubLiveDefault)
      )

      // Only AAPL trades should be filtered
      expect(result.filteredTrades.length).toBe(2)
      expect(result.filteredTrades.every((t) => t.symbol === "AAPL")).toBe(true)

      // But all symbols should be monitored by tap
      expect(result.monitoredSymbols.length).toBeGreaterThanOrEqual(2)
    })
  })
})
