# Solana Arbitrage Program

On-chain Solana program that executes atomic cross-DEX arbitrage between PumpFun AMM and Meteora DLMM.

## How it works

Single instruction `execute_arb` — buys a token on one DEX, sells on another. If no profit → entire transaction reverts, only tx fee lost.

- **Pair:** LIA / WSOL
- **Route A:** Buy PumpFun → Sell Meteora
- **Route B:** Buy Meteora → Sell PumpFun
- **Transaction:** V0 with Address Lookup Table (38 accounts compressed)

## Quick Start

```bash
yarn install
anchor build
```

## Deploy & Initialize

```bash
# Deploy
solana program deploy target/deploy/solana_arbitrage_program.so \
  --program-id target/deploy/solana_arbitrage_program-keypair.json \
  -u mainnet-beta

# Initialize (once)
yarn init
```

## Usage

```bash
# Arbitrage
yarn arb                    # buy PumpFun → sell Meteora (0.001 SOL)
yarn arb:reverse            # buy Meteora → sell PumpFun
yarn arb:dry                # simulate (shows balance delta)
AMOUNT_SOL=0.01 yarn arb    # custom amount
LUT_ADDRESS=<addr> yarn arb # reuse LUT

# Direct swaps (without arb program)
yarn swap:pump:buy          # buy LIA on PumpFun
yarn swap:pump:sell         # sell LIA on PumpFun
yarn swap:meteora:buy       # buy LIA on Meteora
yarn swap:meteora:sell      # sell LIA on Meteora
```

Add `:dry` to any command for simulation.

## Testing

```bash
yarn fork    # download mainnet accounts (one time)
yarn test    # run bankrun tests
```

## Tech Stack

- Anchor 0.32.x
- Token-2022 (LIA) + SPL Token (WSOL)
- V0 transactions + Address Lookup Tables
- Bankrun for testing
