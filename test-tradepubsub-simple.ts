import * as TradePubSub from "./src/services/TradePubSub"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { mockTrade } from "./src/test-utils/fixtures"

const program = Effect.gen(function* () {
  const pubsub = yield* TradePubSub.TradePubSub

  console.log("Setting up subscriber...")
  const trades: any[] = []

  const fiber = yield* Effect.fork(
    Stream.runForEach(Stream.take(pubsub.subscribe(), 2), (trade) =>
      Effect.sync(() => {
        console.log("Received trade:", trade.symbol)
        trades.push(trade)
      })
    )
  )

  console.log("Publishing trades...")
  yield* pubsub.publish(mockTrade({ symbol: "AAPL", price: 150 }))
  console.log("Published AAPL")

  yield* pubsub.publish(mockTrade({ symbol: "GOOGL", price: 2800 }))
  console.log("Published GOOGL")

  console.log("Waiting for fiber...")
  yield* Effect.sleep("100 millis")

  console.log(`Collected ${trades.length} trades`)
  return trades
})

Effect.runPromise(Effect.provide(program, TradePubSub.TradePubSubLiveDefault)).then(
  (result) => {
    console.log("Success!", result.length, "trades")
    process.exit(0)
  },
  (error) => {
    console.error("Failed:", error)
    process.exit(1)
  }
)
