/**
 * Execute arbitrage: buy on one DEX, sell on the other.
 * Uses V0 transaction with Address Lookup Table.
 *
 * Usage:
 *   npx ts-node --skip-project scripts/execute-arb.ts
 *
 * Env:
 *   RPC_URL      — Solana RPC (default: mainnet-beta)
 *   AMOUNT_SOL   — SOL amount to arb (default: 0.001)
 *   ROUTE        — "pump-meteora" or "meteora-pump" (default: pump-meteora)
 *   DRY_RUN      — "true" to only simulate (default: false)
 *   LUT_ADDRESS  — reuse existing LUT (skip creation)
 */

import {
  Connection, PublicKey, ComputeBudgetProgram, AccountMeta,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import {
  LIA, WSOL, PUMP, PUMP_FEE, PUMP_POOL, PUMP_GLOBAL_CONFIG,
  PUMP_EVENT_AUTHORITY, PUMP_COIN_CREATOR_VAULT_ATA, PUMP_COIN_CREATOR_VAULT_AUTHORITY,
  PUMP_FEE_CONFIG, PUMP_STATIC_ACCOUNT, PUMP_GLOBAL_VOLUME_ACC,
  PUMP_PROTOCOL_FEE_RECIPIENT_BUY, PUMP_PROTOCOL_FEE_RECIPIENT_ATA_BUY,
  PUMP_PROTOCOL_FEE_RECIPIENT_SELL, PUMP_PROTOCOL_FEE_RECIPIENT_ATA_SELL,
  PUMP_POOL_BASE_VAULT, PUMP_POOL_QUOTE_VAULT,
  METEORA, METEORA_LB_PAIR, METEORA_RESERVE_X, METEORA_RESERVE_Y,
  METEORA_ORACLE, METEORA_EVENT_AUTH, MEMO,
  loadKeypair, deriveUserAccounts, buildSetupIxs,
  getActiveBinArrays, createLookupTable, sendOrSimulateWithLUT,
} from "./utils";

const PROGRAM_ID = new PublicKey("An3HM7PCKigYDszLj8iWYK7mWRnnnhECfM2tRZwsBFV9");

async function main() {
  const rpcUrl = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
  const dryRun = process.env.DRY_RUN === "true";
  const route = (process.env.ROUTE || "pump-meteora").toLowerCase();
  const amountSol = parseFloat(process.env.AMOUNT_SOL || "0.001");
  const amountIn = BigInt(Math.round(amountSol * 1e9));
  const lutAddressEnv = process.env.LUT_ADDRESS;

  const kp = loadKeypair();
  const conn = new Connection(rpcUrl, "confirmed");
  const { userWsol, userLia, userVolumeAcc, userVolumeAccWsol } = deriveUserAccounts(kp.publicKey);

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
  const [operatorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("operator"), kp.publicKey.toBuffer()], PROGRAM_ID,
  );

  const buyOnPump = route === "pump-meteora";

  console.log("Wallet:", kp.publicKey.toBase58());
  console.log("Route:", buyOnPump ? "buy PumpFun → sell Meteora" : "buy Meteora → sell PumpFun");
  console.log("Amount:", amountSol, "SOL (", amountIn.toString(), "lamports )");
  console.log("Dry run:", dryRun);

  // ── Fetch bin arrays ───────────────────────────────────────────────────────

  console.log("\nMeteora pool:");
  const binArrays = await getActiveBinArrays(conn);

  // ── Setup instructions ─────────────────────────────────────────────────────

  const setupIxs = await buildSetupIxs(conn, kp.publicKey, true, amountIn);

  // ── Build arb instruction via Anchor ───────────────────────────────────────

  const wallet = new anchor.Wallet(kp);
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
  const idl = JSON.parse(fs.readFileSync("target/idl/solana_arbitrage_program.json", "utf-8"));
  const program = new anchor.Program(idl, provider);

  // PumpFun accounts depend on direction (buy vs sell use different fee recipients)
  const pumpAccounts = buyOnPump
    ? {
        pumpProtocolFeeRecipient: PUMP_PROTOCOL_FEE_RECIPIENT_BUY,
        pumpProtocolFeeRecipientAta: PUMP_PROTOCOL_FEE_RECIPIENT_ATA_BUY,
        pumpExtraAccountA: userVolumeAccWsol,
        pumpExtraAccountB: PUMP_STATIC_ACCOUNT,
      }
    : {
        pumpProtocolFeeRecipient: PUMP_PROTOCOL_FEE_RECIPIENT_SELL,
        pumpProtocolFeeRecipientAta: PUMP_PROTOCOL_FEE_RECIPIENT_ATA_SELL,
        pumpExtraAccountA: userVolumeAccWsol,
        pumpExtraAccountB: userVolumeAcc,
      };

  const routes = buyOnPump
    ? [
        { dex: { pumpFun: {} }, tokenIn: WSOL, tokenOut: LIA },
        { dex: { meteora: {} }, tokenIn: LIA, tokenOut: WSOL },
      ]
    : [
        { dex: { meteora: {} }, tokenIn: WSOL, tokenOut: LIA },
        { dex: { pumpFun: {} }, tokenIn: LIA, tokenOut: WSOL },
      ];

  const arbIx = await program.methods
    .executeArb(routes, new anchor.BN(amountIn.toString()))
    .accountsPartial({
      user: kp.publicKey,
      operator: operatorPda,
      config: configPda,
      baseMint: LIA,
      quoteMint: WSOL,
      userBaseAta: userLia,
      userQuoteAta: userWsol,
      baseTokenProgram: TOKEN_2022_PROGRAM_ID,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      // PumpFun
      pumpPool: PUMP_POOL,
      pumpGlobalConfig: PUMP_GLOBAL_CONFIG,
      pumpPoolBaseVault: PUMP_POOL_BASE_VAULT,
      pumpPoolQuoteVault: PUMP_POOL_QUOTE_VAULT,
      pumpEventAuthority: PUMP_EVENT_AUTHORITY,
      pumpProgram: PUMP,
      pumpCoinCreatorVaultAta: PUMP_COIN_CREATOR_VAULT_ATA,
      pumpCoinCreatorVaultAuthority: PUMP_COIN_CREATOR_VAULT_AUTHORITY,
      pumpGlobalVolumeAccumulator: PUMP_GLOBAL_VOLUME_ACC,
      pumpUserVolumeAccumulator: userVolumeAcc,
      pumpFeeConfig: PUMP_FEE_CONFIG,
      pumpFeeProgram: PUMP_FEE,
      pumpStaticAccount: PUMP_STATIC_ACCOUNT,
      ...pumpAccounts,
      // Meteora
      meteoraLbPair: METEORA_LB_PAIR,
      meteoraBinArrayBitmapExtension: METEORA,
      meteoraReserveX: METEORA_RESERVE_X,
      meteoraReserveY: METEORA_RESERVE_Y,
      meteoraOracle: METEORA_ORACLE,
      meteoraHostFeeIn: METEORA, // must be program ID, not userWsol
      meteoraEventAuthority: METEORA_EVENT_AUTH,
      meteoraMemoProgram: MEMO,
      meteoraProgram: METEORA,
    })
    .remainingAccounts(
      binArrays.map((p) => ({ pubkey: p, isWritable: true, isSigner: false } as AccountMeta))
    )
    .instruction();

  // ── Collect all addresses for LUT ──────────────────────────────────────────

  const allAddrs = new Set<string>();
  const lutAddrs: PublicKey[] = [];
  const addAddr = (pk: PublicKey) => {
    const k = pk.toBase58();
    if (!allAddrs.has(k)) { allAddrs.add(k); lutAddrs.push(pk); }
  };

  for (const key of arbIx.keys) addAddr(key.pubkey);
  for (const ix of setupIxs) {
    for (const key of ix.keys) addAddr(key.pubkey);
  }

  // ── Get or create LUT ──────────────────────────────────────────────────────

  let lookupTable;
  if (lutAddressEnv) {
    console.log("\nUsing existing LUT:", lutAddressEnv);
    const result = await conn.getAddressLookupTable(new PublicKey(lutAddressEnv));
    if (!result.value) throw new Error("LUT not found");
    lookupTable = result.value;
  } else {
    console.log("\nCreating LUT with", lutAddrs.length, "addresses...");
    lookupTable = await createLookupTable(conn, kp, lutAddrs);
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  const allIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
    ...setupIxs,
    arbIx,
  ];

  await sendOrSimulateWithLUT(conn, allIxs, kp, lookupTable, dryRun);

  console.log("\nLUT address (reuse with LUT_ADDRESS env):", lookupTable.key.toBase58());
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
