# Solana Arbitrage Program — CLAUDE.md

## Project Overview

On-chain Solana arbitrage program (Anchor 0.32.x) that executes atomic cross-DEX arbitrage.
Single instruction `execute_arb` — buys on one DEX, sells on another, all in one V0 transaction with Address Lookup Table.
Profit check currently disabled for testing (TODO: re-enable for production).

**Program ID:** `An3HM7PCKigYDszLj8iWYK7mWRnnnhECfM2tRZwsBFV9`
**Deployed on:** mainnet-beta
**Admin/Operator:** `GVdR6i5kF45ZadiJfjGaM5EERCUv8hEe62yNMp9FMPFv`

## Token Pair

- **Base:** LIA (`79dGFnR8XUusyDiK3n8yZ6FXhJjWLFgzdsi2SkUpump`) — Token-2022, 6 decimals
- **Quote:** WSOL (`So11111111111111111111111111111111111111112`) — SPL Token, 9 decimals

## DEXes

- **PumpFun AMM** (`pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`)
  - Buy: `buy_exact_quote_in` — WSOL → LIA (25 accounts)
  - Sell: `sell` — LIA → WSOL (24 accounts)
  - Fee: 30 bps total (LP 20 + protocol 5 + creator 5)
  - Buy and sell have DIFFERENT account order (fee/volume accounts swap positions)
  - Buy and sell use DIFFERENT protocol_fee_recipient addresses

- **Meteora DLMM** (`LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`)
  - Instruction: `swap2` (Token-2022 compatible) — 16 fixed + remaining bin arrays
  - Same instruction for both buy and sell (direction = which ATA is token_in/token_out)
  - `host_fee_in` MUST be Meteora program ID, NOT user ATA
  - `bin_array_bitmap_extension` — pass Meteora program ID as placeholder if none exists

## Pool Addresses

- PumpFun pool: `8BhCzFjnHmFyZEdh6JNgoQNRHCS2R8KHKYpGviocNYSa`
- Meteora DLMM pool: `HPx4ySmLFFWWwwA8q7bgXZncoAmDgEmyJKdbSvucx7AJ`

## Role System

- **Admin** — stored in `Config` PDA. Can add/remove operators. Set once at `initialize`.
- **Operator** — one PDA per address. Only operators can call `execute_arb`.

### PDAs
- Config: `["config"]` — stores `admin: Pubkey, bump: u8`
- Operator: `["operator", user_pubkey]` — stores `authority: Pubkey, bump: u8`

### Instructions
- `initialize` — creates Config, caller becomes admin
- `add_operator(user: Pubkey)` — admin only, creates Operator PDA
- `remove_operator(user: Pubkey)` — admin only, closes Operator PDA
- `execute_arb(routes, amount_in)` — operator only, single instruction for full arb

## Instruction: execute_arb

### Args
```rust
routes: Vec<Route>   // exactly 2 routes (buy + sell)
amount_in: u64       // WSOL lamports to spend (0 = use current balance)
```

### Route struct
```rust
pub struct Route {
    pub dex: DexType,       // PumpFun = 0, Meteora = 1
    pub token_in: Pubkey,
    pub token_out: Pubkey,
}
```

### Flow
1. Validate: `routes.len() >= 2`, chain continuity, starts/ends with WSOL
2. Check Operator PDA exists for signer
3. Loop through routes — CPI to PumpFun or Meteora based on `dex`
4. After each CPI: reload both ATAs, update `current_amount`
5. Profit check (currently disabled — TODO re-enable)

### Accounts (~38 total)
- Shared (11): user, operator, config, base_mint, quote_mint, user_base_ata, user_quote_ata, base_token_program, quote_token_program, system_program, associated_token_program
- PumpFun (17): pool, global_config, pool_base_vault, pool_quote_vault, protocol_fee_recipient, protocol_fee_recipient_ata, event_authority, pump_program, coin_creator_vault_ata, coin_creator_vault_authority, global_volume_accumulator, user_volume_accumulator, fee_config, fee_program, extra_account_a, extra_account_b, static_account
- Meteora (9 + remaining): lb_pair, bitmap_extension, reserve_x, reserve_y, oracle, host_fee_in, event_authority, memo_program, meteora_program + bin arrays via remaining_accounts

### Direction-dependent PumpFun accounts
| Account | Buy (WSOL→LIA) | Sell (LIA→WSOL) |
|---|---|---|
| protocol_fee_recipient | `JCRGumo...` | `62qc2CN...` |
| protocol_fee_recipient_ata | `DWpvfqz...` | `94qWNrt...` |
| extra_account_a | userVolumeAccWsol | userVolumeAccWsol |
| extra_account_b | PUMP_STATIC_ACCOUNT | userVolumeAcc |

## Verified & Working

These have been tested on mainnet with real transactions:
- PumpFun buy CPI (25 accounts) ✅
- PumpFun sell CPI (24 accounts) ✅
- Meteora swap2 CPI with Token-2022 ✅
- execute_arb buy PumpFun → sell Meteora ✅
- execute_arb buy Meteora → sell PumpFun ✅
- V0 transaction with Address Lookup Table ✅
- Direct swaps via scripts (swap-pumpfun.ts, swap-meteora.ts) ✅
- Role system (initialize, add/remove operator) ✅
- Bankrun tests with mainnet fork ✅

## File Structure

```
programs/solana_arbitrage_program/src/
  lib.rs                        ← declare_id! + instruction dispatchers
  instructions/
    accounts.rs                 ← ExecuteArb struct (all 38 accounts)
    execute_arb.rs              ← Route validation + CPI loop + helpers
    initialize.rs               ← create Config PDA
    add_operator.rs             ← admin adds operator
    remove_operator.rs          ← admin removes operator
  cpi/
    pumpfun.rs                  ← buy() and sell() with exact account order
    meteora.rs                  ← swap2() CPI wrapper
  state/
    config.rs                   ← Config { admin, bump }
    operator.rs                 ← Operator { authority, bump }
  errors.rs

scripts/
  utils.ts                      ← ALL shared constants, addresses, helpers
  execute-arb.ts                ← Execute arb via program (V0 + LUT)
  init-program.ts               ← Initialize + add operator (run once)
  swap-pumpfun.ts               ← Direct PumpFun swap (not via program)
  swap-meteora.ts               ← Direct Meteora swap (not via program)

tests/
  solana_arbitrage_program.ts   ← Arb tests (execute_arb both directions + role system)
  swaps.ts                      ← Individual swap tests (PumpFun + Meteora)
  fixtures/bankrun-setup.ts     ← Bankrun context + LUT injection + V0 helper
  accounts/pumpfun.ts           ← PumpFun addresses (exports)
  accounts/meteora.ts           ← Meteora addresses (exports)
  utils/pumpfun.ts              ← PumpFun test account builders
  utils/meteora.ts              ← Meteora test account builders
  utils/arb-helpers.ts          ← shared(), collectLutAddresses(), injectWsolBonus()
  utils/account-fork.ts         ← Download mainnet state to fixtures/
```

## Commands

```bash
yarn install && anchor build     # Setup
yarn init                        # Initialize program (once after deploy)
yarn arb                         # Execute arb (buy PumpFun → sell Meteora)
yarn arb:reverse                 # Execute arb (buy Meteora → sell PumpFun)
yarn arb:dry                     # Simulate arb (shows WSOL/LIA delta)
yarn swap:pump:buy               # Direct PumpFun buy
yarn swap:pump:sell              # Direct PumpFun sell (10000 LIA)
yarn swap:meteora:buy            # Direct Meteora buy
yarn swap:meteora:sell           # Direct Meteora sell (10000 LIA)
yarn fork                        # Download mainnet accounts to fixtures
yarn test                        # Run bankrun tests
```

Add `:dry` to any swap command for simulation. Use `AMOUNT_SOL=X` to change amount.
Use `LUT_ADDRESS=<addr>` to reuse existing LUT (saves ~2s + SOL).

## Meteora Bin Arrays

Bin arrays are dynamic — they change as price moves.

```typescript
const ACTIVE_ID_OFFSET = 76;  // offset in LbPair account data (i32 LE)
const BINS_PER_ARRAY = 70;
active_bin_array_index = Math.floor(active_id / BINS_PER_ARRAY);
// PDA: seeds["bin_array", lb_pair, index_i64_le]
```

Always fetch fresh bin arrays before arb. Use `getActiveBinArrays()` from `scripts/utils.ts`.

## Known Issues & Gotchas

1. **Profit check disabled** — `execute_arb.rs` line 38-39. Re-enable before production.
2. **PumpFun buy vs sell account order** — different positions for fee/volume accounts. See `cpi/pumpfun.rs`.
3. **Meteora host_fee_in** — MUST pass Meteora program ID, not user ATA. Passing user ATA causes IncorrectProgramId.
4. **Meteora bin_array_bitmap_extension** — pass Meteora program ID as placeholder (this pool has none).
5. **V0 + LUT required** — 38 accounts don't fit in legacy transaction. Always use V0 with LUT.
6. **LUT creation costs ~0.003 SOL** — reuse with `LUT_ADDRESS` env var.
7. **Bin arrays change** — always fetch fresh before arb, stale bin arrays = tx failure.

## Jupiter Flash Loan (external)

Flash loan is handled by the transaction builder (off-chain), not by the program.
Transaction layout: `[flashloan_borrow, execute_arb, flashloan_payback]`

- Program ID: `jupgfSgfuAXv4B6R2Uxu85Z1qdzgju79s6MfZekN6XS`
- CPI is forbidden — both instructions must be top-level (stack height = 1)
- Fee: currently 0% (governance-configurable, max 0.5%)

## Tech Stack

- Anchor 0.32.x
- Token-2022 for LIA, SPL Token for WSOL
- V0 transactions with Address Lookup Tables
- Bankrun (anchor-bankrun) for testing
- Surfpool for integration testing with mainnet fork

## Documentation

- `README.md` — setup, deployment, all commands, estimation guide
- `DIRECT_SWAPS.md` — exact account order for direct PumpFun/Meteora swaps (for bot integration)

## Skills

Always apply the Solana development skill:
- @.claude/SKILL.md

## References (load when relevant)

- Anchor programs: @.claude/references/programs-anchor.md
- Testing strategy: @.claude/references/testing.md
- Surfpool: @.claude/references/surfpool.md
- Surfpool cheatcodes: @.claude/references/surfpool-cheatcodes.md
- Security checklist: @.claude/references/security.md
- Common errors: @.claude/references/common-errors.md
- Compatibility matrix: @.claude/references/compatibility-matrix.md
- Token-2022: @.claude/references/kit/programs/token-2022.md
- SPL Token: @.claude/references/kit/programs/token.md
- IDL + codegen: @.claude/references/idl-codegen.md
