# CLI Stock - Claude Code Agent Testing Project

> **Primary Purpose:** This project serves as a testbed for exploring and validating Claude Code agent configurations, agent collaboration patterns, and Effect-TS best practices.

A real-time stock trading CLI application built with Effect-TS, designed to test how specialized AI agents collaborate on complex TypeScript projects with proper functional programming patterns.

## 🤖 Agent Configuration Testing

This project was built to validate the following custom Claude Code agents:

### Agents Under Test

| Agent | Purpose | Key Responsibilities |
|-------|---------|---------------------|
| **effect-expert** | Effect services, layers, DI | Implements Effect services, dependency injection, scoped resources, and error handling following Effect best practices |
| **test-writer** | Comprehensive testing | Writes tests using @effect/vitest for Effect code and vitest for pure functions |
| **domain-modeler** | Type-safe domain models | Creates domain models using ADTs, unions, branded types, with comprehensive predicates and Schema derivation |
| **spec-writer** | Spec-driven development | Manages the workflow from instructions through requirements, design, and implementation planning |
| **react-expert** | Compositional React patterns | Implements React patterns with Effect Atom, component composition over boolean props |

### Agent Skills Tested

- **atom-state**: Reactive state management with Effect Atom
- **context-witness**: Context Tag witness vs capability patterns for DI
- **domain-predicates**: Generating typeclasses and predicates for domain types
- **layer-design**: Effect layer composition and dependency management
- **service-implementation**: Fine-grained Effect service design
- **typeclass-design**: Curried signatures and dual APIs

## 📚 Key Learnings & Patterns Validated

### 1. Effect PubSub Subscribe-Before-Publish Pattern

**Issue Discovered:** Tests were failing with race conditions where items were published before subscriptions were established.

**Solution:** Following Effect's documented pattern:
```typescript
const program = Effect.scoped(
  Effect.gen(function* () {
    const { pubsub } = yield* TradePubSub.TradePubSub

    // FIRST: Subscribe (establishes subscription immediately)
    const dequeue = yield* PubSub.subscribe(pubsub)

    // THEN: Publish
    yield* PubSub.publish(pubsub, trade)

    // FINALLY: Consume
    const trade = yield* Queue.take(dequeue)
  })
)
```

**Key Insight:** A subscriber only receives messages published while actively subscribed. This is a critical Effect pattern that was validated through agent collaboration.

### 2. Simplify Service Implementations

**Original Approach:** Wrapped PubSub with custom publish/subscribe methods (~30+ lines)

**Improved Approach:** Expose Effect primitives directly (~5 lines)
```typescript
export class TradePubSub extends Context.Tag("@services/TradePubSub")<
  TradePubSub,
  { readonly pubsub: PubSub.PubSub<Trade.TradeData> }
>() {}
```

**Lesson:** Don't over-abstract Effect primitives. Expose them directly and let consumers use Effect's APIs.

### 3. Scoped Resource Management

All subscriptions and resources properly managed using `Effect.scoped` and `Layer.scoped` patterns, ensuring no resource leaks.

### 4. Agent Collaboration Success

- **effect-expert** successfully debugged and fixed PubSub implementation issues
- **test-writer** identified the race condition through detailed investigation
- Agents effectively communicated findings through structured reports
- Iterative refinement led to simpler, more correct implementation

## 🏗️ Project Architecture

### Domain Models (Schema-based)
- `Trade.TradeData` - Real-time trade data with timestamp, symbol, price, volume
- `Statistics.Statistics` - Aggregate statistics (volume, prices, trade count)
- `Indicator.IndicatorValue` - Technical indicator results

### Services (Effect Layer-based)
- `TradePubSub` - PubSub for broadcasting trades to multiple subscribers
- `MarketDataProvider` - Abstract interface for market data (Finnhub, Polygon)
- `StatsCollector` - Real-time statistics aggregation
- `TradeDisplay` - Terminal UI rendering
- `WebSocketPublisher` - WebSocket server for web clients

### Technical Indicators
- Moving Average (SMA)
- RSI (Relative Strength Index)
- Bollinger Bands
- VWAP (Volume-Weighted Average Price)
- Volatility

## 🧪 Test Results

```
156 tests passing
0 tests failing
246 expect() calls

Test suites:
- Domain models: Trade, Statistics, Indicator
- Services: TradePubSub (8 tests including race condition fixes)
```

## 🚀 Usage (Secondary Purpose)

While the primary purpose is agent testing, this is a fully functional stock trading CLI.

### Prerequisites
- [Bun](https://bun.sh) installed
- [Finnhub.io](https://finnhub.io) API token (free tier available)

### Installation
```bash
bun install
```

### Development
```bash
# Run tests
bun test

# Type check
bun run typecheck

# Run CLI (requires Finnhub API token)
bun run dev --token YOUR_API_TOKEN --symbol "AAPL,MSFT"
```

### Basic Commands
```bash
# Single symbol
bun run dev --token YOUR_TOKEN --symbol "AAPL"

# Multiple symbols
bun run dev --token YOUR_TOKEN --symbol "AAPL,MSFT,TSLA"

# Crypto
bun run dev --token YOUR_TOKEN --symbol "BINANCE:BTCUSDT"

# Forex
bun run dev --token YOUR_TOKEN --symbol "OANDA:EUR_USD"
```

## 🛠️ Tech Stack

- **Runtime:** [Bun](https://bun.sh) (TypeScript execution and testing)
- **Framework:** [Effect-TS](https://effect.website) (Functional effect system)
- **Testing:** [@effect/vitest](https://effect.website/docs/other/testing) (Effect-aware testing)
- **Schema:** [Effect Schema](https://effect.website/docs/schema/introduction) (Type-safe data validation)
- **CLI:** [Effect CLI](https://effect-ts.github.io/effect/docs/cli) (Command-line interface)
- **WebSocket:** [Effect Platform](https://effect-ts.github.io/effect/platform/Socket.ts.html) (WebSocket support)

## 📁 Project Structure

```
.claude/
  agents/          # Custom agent configurations
  skills/          # Reusable agent skills
  instructions.md  # Project-specific instructions
  settings.json    # Agent settings

src/
  domain/          # Domain models with Schema
  services/        # Effect services (PubSub, Stats, etc.)
  indicators/      # Technical indicators
  providers/       # Market data providers (Finnhub, Polygon)
  layers/          # Effect layer compositions
  ui/              # React UI components (with Effect Atom)
  test-utils/      # Test fixtures and helpers
```

## 🎯 Testing Focus Areas

1. **PubSub Patterns**
   - Subscribe-before-publish race conditions
   - Multiple subscriber fan-out
   - Proper scoped resource management

2. **Effect Service Design**
   - Layer composition and DI
   - No requirement leakage
   - Clean service boundaries

3. **Stream Processing**
   - Real-time data pipelines
   - Backpressure handling
   - Stream transformations (filtering, sorting, aggregation)

4. **Type Safety**
   - Schema-based validation
   - Branded types for domain primitives
   - ADTs and pattern matching

## 🤝 Contributing

This is primarily a testing project, but contributions that help validate additional agent patterns or Effect-TS best practices are welcome!

## 📝 License

MIT

---

**Built with Claude Code agents to explore AI-assisted development patterns**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
