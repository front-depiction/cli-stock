# Finnhub Trades CLI

A command-line tool to stream real-time stock, forex, and crypto trades from Finnhub.io using WebSockets.

Built with:

- [Effect-TS](https://effect.website) for functional programming
- [Effect CLI](https://effect-ts.github.io/effect/docs/cli) for command-line interface
- [Effect Platform](https://effect-ts.github.io/effect/platform/Socket.ts.html) for WebSocket support
- [Bun](https://bun.sh) runtime

## Prerequisites

- [Bun](https://bun.sh) installed
- A [Finnhub.io](https://finnhub.io) API token (free tier available)

## Installation

```bash
bun install
```

## Usage

### Get Your API Token

1. Sign up for a free account at [Finnhub.io](https://finnhub.io/register)
2. Copy your API token from the dashboard

### Basic Usage

Stream trades for a single symbol (default: AAPL):

```bash
bun run dev --token YOUR_API_TOKEN
```

### Subscribe to Specific Symbols

Stream trades for specific stock symbols:

```bash
bun run dev --token YOUR_API_TOKEN --symbol "MSFT"
```

### Subscribe to Multiple Symbols

Use comma-separated symbols to monitor multiple securities:

```bash
bun run dev --token YOUR_API_TOKEN --symbol "AAPL,MSFT,TSLA"
```

### Subscribe to Crypto

Finnhub supports crypto pairs from various exchanges:

```bash
bun run dev --token YOUR_API_TOKEN --symbol "BINANCE:BTCUSDT,COINBASE:BTC-USD"
```

### Subscribe to Forex

Monitor forex pairs:

```bash
bun run dev --token YOUR_API_TOKEN --symbol "OANDA:EUR_USD,OANDA:GBP_USD"
```

### Using Short Options

```bash
bun run dev -t YOUR_API_TOKEN -s "AAPL,MSFT"
```

### Custom WebSocket URL

If you need to use a different endpoint:

```bash
bun run dev -t YOUR_API_TOKEN -u "wss://ws.finnhub.io"
```

## Command Options

- `--token`, `-t` (required): Your Finnhub.io API token
- `--symbol`, `-s` (optional): Symbol(s) to subscribe to, comma-separated (default: `AAPL`)
- `--url`, `-u` (optional): WebSocket URL (default: `wss://ws.finnhub.io`)

## Output Format

The CLI displays real-time trade data including:

- Timestamp (ISO 8601 format)
- Symbol
- Price
- Volume
- Trade conditions (if available)

Example output:

```
[2025-11-07T16:30:45.123Z] AAPL
  Price: $175.42 | Volume: 100

[2025-11-07T16:30:45.234Z] MSFT
  Price: $380.15 | Volume: 50 | Conditions: T, F

[2025-11-07T16:30:46.456Z] BINANCE:BTCUSDT
  Price: $43250.50 | Volume: 0.125
```

## Building for Production

Build the executable:

```bash
bun run build
```

Run the built version:

```bash
bun run start --token YOUR_API_TOKEN --symbol "AAPL,MSFT"
```

## Development

- `bun run dev` - Run in development mode
- `bun run build` - Build for production
- `bun run typecheck` - Type check the code
- `bun run format` - Format code with Prettier

## WebSocket Protocol

The CLI follows Finnhub.io's WebSocket protocol:

1. **Connect** to `wss://ws.finnhub.io?token=YOUR_API_TOKEN`
2. **Subscribe** to trades with `{"type":"subscribe","symbol":"AAPL"}`
3. **Receive** real-time trade data in the format:
   ```json
   {
     "type": "trade",
     "data": [
       {
         "p": 175.42,
         "s": "AAPL",
         "t": 1699372845123,
         "v": 100
       }
     ]
   }
   ```
4. **Unsubscribe** (optional) with `{"type":"unsubscribe","symbol":"AAPL"}`

For more details, see the [Finnhub WebSocket API documentation](https://finnhub.io/docs/api/websocket-trades).

## Supported Asset Classes

### US Stocks

- Use ticker symbols: `AAPL`, `MSFT`, `TSLA`, etc.

### Forex

- Format: `EXCHANGE:PAIR`
- Examples: `OANDA:EUR_USD`, `IC MARKETS:EUR/USD`

### Crypto

- Format: `EXCHANGE:PAIR`
- Examples: `BINANCE:BTCUSDT`, `COINBASE:BTC-USD`, `KRAKEN:BTC/USD`

## Notes

- **Free tier** available for US stocks, forex, and crypto
- Multiple symbols can be monitored simultaneously
- Real-time data is streamed as trades occur
- Press Ctrl+C to exit the stream
- WebSocket connection is automatically managed by Effect platform

## License

MIT
