/**
 * PumpFun swap (buy or sell). Creates accounts if missing.
 *
 * yarn swap:pump:buy          — buy LIA for 0.001 SOL
 * yarn swap:pump:sell         — sell 10000 LIA
 * yarn swap:pump:buy:dry      — simulate buy
 * yarn swap:pump:sell:dry     — simulate sell
 * AMOUNT_SOL=0.01 yarn swap:pump:buy — custom amount
 */

import { Connection, TransactionInstruction, AccountMeta, ComputeBudgetProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import {
  LIA, WSOL, PUMP, PUMP_FEE, PUMP_POOL, PUMP_GLOBAL_CONFIG,
  PUMP_EVENT_AUTHORITY, PUMP_COIN_CREATOR_VAULT_ATA, PUMP_COIN_CREATOR_VAULT_AUTHORITY,
  PUMP_FEE_CONFIG, PUMP_STATIC_ACCOUNT, PUMP_GLOBAL_VOLUME_ACC,
  PUMP_PROTOCOL_FEE_RECIPIENT_BUY, PUMP_PROTOCOL_FEE_RECIPIENT_ATA_BUY,
  PUMP_PROTOCOL_FEE_RECIPIENT_SELL, PUMP_PROTOCOL_FEE_RECIPIENT_ATA_SELL,
  PUMP_POOL_BASE_VAULT, PUMP_POOL_QUOTE_VAULT,
  PUMP_BUY_DISC, PUMP_SELL_DISC,
  loadKeypair, getConfig, deriveUserAccounts, buildSetupIxs, sendOrSimulate,
} from "./utils";

async function main() {
  const { rpcUrl, direction, dryRun, amount } = getConfig();
  const kp = loadKeypair();
  const conn = new Connection(rpcUrl, "confirmed");
  const isBuy = direction === "buy";
  const { userWsol, userLia, userVolumeAcc, userVolumeAccWsol } = deriveUserAccounts(kp.publicKey);

  const amountIn = isBuy
    ? BigInt(Math.round(amount * 1e9))
    : BigInt(Math.round(amount * 1e6));

  console.log("Wallet:", kp.publicKey.toBase58());
  console.log("Direction:", direction, "| Amount:", amountIn.toString(), isBuy ? "lamports" : "LIA units");
  console.log("Dry run:", dryRun);

  const setupIxs = await buildSetupIxs(conn, kp.publicKey, isBuy, amountIn);

  // ── Swap instruction ───────────────────────────────────────────────────────

  let data: Buffer;
  if (isBuy) {
    data = Buffer.alloc(8 + 8 + 8 + 1);
    PUMP_BUY_DISC.copy(data, 0);
    data.writeBigUInt64LE(amountIn, 8);
    data.writeBigUInt64LE(BigInt(1), 16);
    data[24] = 0;
  } else {
    data = Buffer.alloc(8 + 8 + 8);
    PUMP_SELL_DISC.copy(data, 0);
    data.writeBigUInt64LE(amountIn, 8);
    data.writeBigUInt64LE(BigInt(0), 16);
  }

  const feeRecipient = isBuy ? PUMP_PROTOCOL_FEE_RECIPIENT_BUY : PUMP_PROTOCOL_FEE_RECIPIENT_SELL;
  const feeRecipientAta = isBuy ? PUMP_PROTOCOL_FEE_RECIPIENT_ATA_BUY : PUMP_PROTOCOL_FEE_RECIPIENT_ATA_SELL;

  const keys: AccountMeta[] = [
    { pubkey: PUMP_POOL, isWritable: true, isSigner: false },
    { pubkey: kp.publicKey, isWritable: true, isSigner: true },
    { pubkey: PUMP_GLOBAL_CONFIG, isWritable: !isBuy, isSigner: false },
    { pubkey: LIA, isWritable: false, isSigner: false },
    { pubkey: WSOL, isWritable: false, isSigner: false },
    { pubkey: userLia, isWritable: true, isSigner: false },
    { pubkey: userWsol, isWritable: true, isSigner: false },
    { pubkey: PUMP_POOL_BASE_VAULT, isWritable: true, isSigner: false },
    { pubkey: PUMP_POOL_QUOTE_VAULT, isWritable: true, isSigner: false },
    { pubkey: feeRecipient, isWritable: false, isSigner: false },
    { pubkey: feeRecipientAta, isWritable: true, isSigner: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: PUMP_EVENT_AUTHORITY, isWritable: false, isSigner: false },
    { pubkey: PUMP, isWritable: false, isSigner: false },
    { pubkey: PUMP_COIN_CREATOR_VAULT_ATA, isWritable: true, isSigner: false },
    { pubkey: PUMP_COIN_CREATOR_VAULT_AUTHORITY, isWritable: false, isSigner: false },
  ];

  if (isBuy) {
    keys.push(
      { pubkey: PUMP_GLOBAL_VOLUME_ACC, isWritable: true, isSigner: false },
      { pubkey: userVolumeAcc, isWritable: true, isSigner: false },
      { pubkey: PUMP_FEE_CONFIG, isWritable: false, isSigner: false },
      { pubkey: PUMP_FEE, isWritable: false, isSigner: false },
      { pubkey: userVolumeAccWsol, isWritable: true, isSigner: false },
      { pubkey: PUMP_STATIC_ACCOUNT, isWritable: false, isSigner: false },
    );
  } else {
    keys.push(
      { pubkey: PUMP_FEE_CONFIG, isWritable: false, isSigner: false },
      { pubkey: PUMP_FEE, isWritable: false, isSigner: false },
      { pubkey: userVolumeAccWsol, isWritable: true, isSigner: false },
      { pubkey: userVolumeAcc, isWritable: true, isSigner: false },
      { pubkey: PUMP_STATIC_ACCOUNT, isWritable: false, isSigner: false },
    );
  }

  const swapIx = new TransactionInstruction({ programId: PUMP, keys, data });

  await sendOrSimulate(conn, [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ...setupIxs,
    swapIx,
  ], kp, dryRun);
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
