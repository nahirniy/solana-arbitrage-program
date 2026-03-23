/**
 * Meteora DLMM swap2 (buy or sell). Creates accounts if missing.
 *
 * yarn swap:meteora:buy       — buy LIA for 0.001 SOL
 * yarn swap:meteora:sell      — sell 10000 LIA
 * yarn swap:meteora:buy:dry   — simulate buy
 * yarn swap:meteora:sell:dry  — simulate sell
 * AMOUNT_SOL=0.01 yarn swap:meteora:buy — custom amount
 */

import { Connection, TransactionInstruction, AccountMeta, ComputeBudgetProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  LIA, WSOL, METEORA, METEORA_LB_PAIR, METEORA_RESERVE_X, METEORA_RESERVE_Y,
  METEORA_ORACLE, METEORA_EVENT_AUTH, MEMO, SWAP2_DISC,
  loadKeypair, getConfig, deriveUserAccounts, buildSetupIxs,
  getActiveBinArrays, sendOrSimulate,
} from "./utils";

async function main() {
  const { rpcUrl, direction, dryRun, amount } = getConfig();
  const kp = loadKeypair();
  const conn = new Connection(rpcUrl, "confirmed");
  const isBuy = direction === "buy";
  const { userWsol, userLia } = deriveUserAccounts(kp.publicKey);

  const amountIn = isBuy
    ? BigInt(Math.round(amount * 1e9))
    : BigInt(Math.round(amount * 1e6));

  console.log("Wallet:", kp.publicKey.toBase58());
  console.log("Direction:", direction, "| Amount:", amountIn.toString(), isBuy ? "lamports" : "LIA units");
  console.log("Dry run:", dryRun);

  console.log("\nPool state:");
  const binArrays = await getActiveBinArrays(conn);

  const setupIxs = await buildSetupIxs(conn, kp.publicKey, isBuy, amountIn);

  // ── Swap instruction ───────────────────────────────────────────────────────

  const userTokenIn = isBuy ? userWsol : userLia;
  const userTokenOut = isBuy ? userLia : userWsol;

  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64LE(amountIn);
  const minOut = Buffer.alloc(8);
  minOut.writeBigUInt64LE(BigInt(0));
  const rai = Buffer.alloc(8);
  rai.writeUInt32LE(2, 0);
  rai[4] = 0; rai[5] = 0;
  rai[6] = 1; rai[7] = 0;
  const data = Buffer.concat([SWAP2_DISC, amtBuf, minOut, rai]);

  const keys: AccountMeta[] = [
    { pubkey: METEORA_LB_PAIR, isWritable: true, isSigner: false },
    { pubkey: METEORA, isWritable: false, isSigner: false },       // bitmap ext = None
    { pubkey: METEORA_RESERVE_X, isWritable: true, isSigner: false },
    { pubkey: METEORA_RESERVE_Y, isWritable: true, isSigner: false },
    { pubkey: userTokenIn, isWritable: true, isSigner: false },
    { pubkey: userTokenOut, isWritable: true, isSigner: false },
    { pubkey: LIA, isWritable: false, isSigner: false },
    { pubkey: WSOL, isWritable: false, isSigner: false },
    { pubkey: METEORA_ORACLE, isWritable: true, isSigner: false },
    { pubkey: METEORA, isWritable: false, isSigner: false },       // host_fee = None
    { pubkey: kp.publicKey, isWritable: true, isSigner: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: MEMO, isWritable: false, isSigner: false },
    { pubkey: METEORA_EVENT_AUTH, isWritable: false, isSigner: false },
    { pubkey: METEORA, isWritable: false, isSigner: false },
    ...binArrays.map((p) => ({ pubkey: p, isWritable: true, isSigner: false })),
  ];

  const swapIx = new TransactionInstruction({ programId: METEORA, keys, data });

  await sendOrSimulate(conn, [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ...setupIxs,
    swapIx,
  ], kp, dryRun);
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
