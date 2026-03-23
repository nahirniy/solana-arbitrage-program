import {
  Connection, PublicKey, TransactionInstruction,
  Keypair, SystemProgram, AccountMeta, ComputeBudgetProgram,
  TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";

// ─── Token mints ─────────────────────────────────────────────────────────────

export const LIA = new PublicKey("79dGFnR8XUusyDiK3n8yZ6FXhJjWLFgzdsi2SkUpump");
export const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

// ─── PumpFun ─────────────────────────────────────────────────────────────────

export const PUMP = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
export const PUMP_FEE = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
export const PUMP_POOL = new PublicKey("8BhCzFjnHmFyZEdh6JNgoQNRHCS2R8KHKYpGviocNYSa");
export const PUMP_GLOBAL_CONFIG = new PublicKey("ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw");
export const PUMP_EVENT_AUTHORITY = new PublicKey("GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR");
export const PUMP_COIN_CREATOR_VAULT_ATA = new PublicKey("FXxLh8XggMMAwYaioDvVbqd2NAM6P3qANj1Sgv1mR9U1");
export const PUMP_COIN_CREATOR_VAULT_AUTHORITY = new PublicKey("AWyhZXmWi4rpymebxphjbboJ72nBrq2TVXBALD7At1fN");
export const PUMP_FEE_CONFIG = new PublicKey("5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx");
export const PUMP_STATIC_ACCOUNT = new PublicKey("5c829Q6nZGDrD7Pfv2xFh5pMigfaoUgTGbbt1Z2t1FjY");
export const PUMP_GLOBAL_VOLUME_ACC = new PublicKey("C2aFPdENg4A2HQsmrd5rTw5TaYBX5Ku887cWjbFKtZpw");
export const PUMP_PROTOCOL_FEE_RECIPIENT_BUY = new PublicKey("JCRGumoE9Qi5BBgULTgdgTLjSgkCMSbF62ZZfGs84JeU");
export const PUMP_PROTOCOL_FEE_RECIPIENT_ATA_BUY = new PublicKey("DWpvfqzGWuVy9jVSKSShdM2733nrEsnnhsUStYbkj6Nn");
export const PUMP_PROTOCOL_FEE_RECIPIENT_SELL = new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV");
export const PUMP_PROTOCOL_FEE_RECIPIENT_ATA_SELL = new PublicKey("94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb");
export const PUMP_POOL_BASE_VAULT = getAssociatedTokenAddressSync(LIA, PUMP_POOL, true, TOKEN_2022_PROGRAM_ID);
export const PUMP_POOL_QUOTE_VAULT = getAssociatedTokenAddressSync(WSOL, PUMP_POOL, true, TOKEN_PROGRAM_ID);

export const PUMP_BUY_DISC = Buffer.from([198, 46, 21, 82, 180, 217, 232, 112]);
export const PUMP_SELL_DISC = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);
export const PUMP_INIT_UVA_DISC = Buffer.from([94, 6, 202, 115, 255, 96, 232, 183]);

// ─── Meteora DLMM ───────────────────────────────────────────────────────────

export const METEORA = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
export const METEORA_LB_PAIR = new PublicKey("HPx4ySmLFFWWwwA8q7bgXZncoAmDgEmyJKdbSvucx7AJ");
export const METEORA_RESERVE_X = new PublicKey("6QeFdPn8opr9oC5WaZ984ova7LwhQzfM5n5JeEqVTAUw");
export const METEORA_RESERVE_Y = new PublicKey("CFooADfpnUiQjzFJUqKpaxV5mPowb7UGSksExTqTMd21");
export const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export const METEORA_ORACLE = PublicKey.findProgramAddressSync(
  [Buffer.from("oracle"), METEORA_LB_PAIR.toBuffer()], METEORA,
)[0];
export const METEORA_EVENT_AUTH = PublicKey.findProgramAddressSync(
  [Buffer.from("__event_authority")], METEORA,
)[0];

export const SWAP2_DISC = Buffer.from([65, 75, 63, 76, 235, 91, 91, 136]);
export const BINS_PER_ARRAY = 70;
export const ACTIVE_ID_OFFSET = 76;

// ─── Config helpers ──────────────────────────────────────────────────────────

export function getDefaultKeypairPath(): string {
  try {
    const configPath = `${os.homedir()}/.config/solana/cli/config.yml`;
    const config = fs.readFileSync(configPath, "utf-8");
    const match = config.match(/keypair_path:\s*(.+)/);
    if (match) return match[1].trim();
  } catch {}
  return `${os.homedir()}/.config/solana/id.json`;
}

export function loadKeypair(walletPath?: string): Keypair {
  const p = walletPath || process.env.WALLET_PATH || getDefaultKeypairPath();
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8")))
  );
}

export function getConfig() {
  const direction = (process.env.DIRECTION || "buy").toLowerCase();
  return {
    rpcUrl: process.env.RPC_URL || "https://api.mainnet-beta.solana.com",
    direction,
    dryRun: process.env.DRY_RUN === "true",
    amount: parseFloat(process.env.AMOUNT_SOL || (direction === "buy" ? "0.001" : "10000")),
  };
}

// ─── User account helpers ────────────────────────────────────────────────────

export function deriveUserAccounts(user: PublicKey) {
  const userWsol = getAssociatedTokenAddressSync(WSOL, user, false, TOKEN_PROGRAM_ID);
  const userLia = getAssociatedTokenAddressSync(LIA, user, false, TOKEN_2022_PROGRAM_ID);
  const [userVolumeAcc] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()], PUMP,
  );
  const userVolumeAccWsol = getAssociatedTokenAddressSync(WSOL, userVolumeAcc, true, TOKEN_PROGRAM_ID);
  return { userWsol, userLia, userVolumeAcc, userVolumeAccWsol };
}

// ─── Setup instructions (ATAs, wrap SOL, init UVA) ───────────────────────────

export async function buildSetupIxs(
  conn: Connection,
  user: PublicKey,
  isBuy: boolean,
  amountIn: bigint,
): Promise<TransactionInstruction[]> {
  const { userWsol, userLia, userVolumeAcc, userVolumeAccWsol } = deriveUserAccounts(user);
  const ixs: TransactionInstruction[] = [];

  // Create ATAs (idempotent)
  ixs.push(
    createAssociatedTokenAccountIdempotentInstruction(user, userWsol, user, WSOL, TOKEN_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(user, userLia, user, LIA, TOKEN_2022_PROGRAM_ID),
  );

  // Wrap SOL for buy
  if (isBuy) {
    ixs.push(
      SystemProgram.transfer({ fromPubkey: user, toPubkey: userWsol, lamports: Number(amountIn) + 10_000 }),
      createSyncNativeInstruction(userWsol, TOKEN_PROGRAM_ID),
    );
  }

  // Init user_volume_accumulator (PumpFun) if missing
  const uvaInfo = await conn.getAccountInfo(userVolumeAcc);
  if (!uvaInfo) {
    ixs.push(new TransactionInstruction({
      programId: PUMP,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: false },
        { pubkey: userVolumeAcc, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: PUMP, isSigner: false, isWritable: false },
      ],
      data: PUMP_INIT_UVA_DISC,
    }));
  }

  // Create UVA WSOL ATA
  ixs.push(
    createAssociatedTokenAccountIdempotentInstruction(user, userVolumeAccWsol, userVolumeAcc, WSOL, TOKEN_PROGRAM_ID),
  );

  return ixs;
}

// ─── Meteora bin arrays ──────────────────────────────────────────────────────

export function deriveBinArrayPda(lbPair: PublicKey, index: number): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(index));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bin_array"), lbPair.toBuffer(), buf], METEORA,
  )[0];
}

export async function getActiveBinArrays(conn: Connection): Promise<PublicKey[]> {
  const info = await conn.getAccountInfo(METEORA_LB_PAIR);
  if (!info) throw new Error("LbPair not found");

  const activeId = info.data.readInt32LE(ACTIVE_ID_OFFSET);
  const activeIdx = Math.floor(activeId / BINS_PER_ARRAY);
  console.log("  active_id:", activeId, "bin_array_index:", activeIdx);

  const range: number[] = [];
  for (let i = activeIdx - 3; i <= activeIdx + 5; i++) range.push(i);

  const candidates = range.map((i) => deriveBinArrayPda(METEORA_LB_PAIR, i));
  const accounts = await conn.getMultipleAccountsInfo(candidates);

  const existing: PublicKey[] = [];
  candidates.forEach((pda, i) => {
    if (accounts[i]) {
      existing.push(pda);
      console.log(`  bin_array[${range[i]}]: ${pda.toBase58().slice(0, 20)}... EXISTS`);
    }
  });

  if (existing.length === 0) throw new Error("No bin arrays found");
  return existing;
}

// ─── Address Lookup Table ────────────────────────────────────────────────────

export { AddressLookupTableProgram } from "@solana/web3.js";
import { AddressLookupTableProgram, AddressLookupTableAccount } from "@solana/web3.js";

export async function createLookupTable(
  conn: Connection,
  kp: Keypair,
  addresses: PublicKey[],
): Promise<AddressLookupTableAccount> {
  const slot = await conn.getSlot();

  const [createIx, lutAddress] = AddressLookupTableProgram.createLookupTable({
    authority: kp.publicKey,
    payer: kp.publicKey,
    recentSlot: slot - 1,
  });

  // Extend in chunks of 20 (max per ix)
  const extendIxs: TransactionInstruction[] = [];
  for (let i = 0; i < addresses.length; i += 20) {
    extendIxs.push(AddressLookupTableProgram.extendLookupTable({
      lookupTable: lutAddress,
      authority: kp.publicKey,
      payer: kp.publicKey,
      addresses: addresses.slice(i, i + 20),
    }));
  }

  // Send create + first batch
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  const msg1 = new TransactionMessage({
    payerKey: kp.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx, ...extendIxs.slice(0, 1)],
  }).compileToV0Message();
  const tx1 = new VersionedTransaction(msg1);
  tx1.sign([kp]);
  const sig1 = await conn.sendTransaction(tx1);
  await conn.confirmTransaction({ signature: sig1, blockhash, lastValidBlockHeight }, "confirmed");
  console.log("LUT created:", lutAddress.toBase58());

  // Send remaining extend batches
  for (let i = 1; i < extendIxs.length; i++) {
    const { blockhash: bh, lastValidBlockHeight: lvbh } = await conn.getLatestBlockhash();
    const msg = new TransactionMessage({
      payerKey: kp.publicKey,
      recentBlockhash: bh,
      instructions: [extendIxs[i]],
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([kp]);
    const sig = await conn.sendTransaction(tx);
    await conn.confirmTransaction({ signature: sig, blockhash: bh, lastValidBlockHeight: lvbh }, "confirmed");
  }

  // Wait for LUT to activate (need to wait ~1 slot)
  console.log("Waiting for LUT activation...");
  await new Promise((r) => setTimeout(r, 2000));

  const lutAccount = await conn.getAddressLookupTable(lutAddress);
  if (!lutAccount.value) throw new Error("Failed to fetch LUT");
  console.log("LUT active with", lutAccount.value.state.addresses.length, "addresses");
  return lutAccount.value;
}

export async function sendOrSimulateWithLUT(
  conn: Connection,
  ixs: TransactionInstruction[],
  kp: Keypair,
  lookupTable: AddressLookupTableAccount,
  dryRun: boolean,
) {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: kp.publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message([lookupTable]);
  const tx = new VersionedTransaction(message);
  tx.sign([kp]);

  if (dryRun) {
    console.log("\nSimulating...");
    const sim = await conn.simulateTransaction(tx);
    if (sim.value.err) {
      console.log("❌ SIMULATION FAILED:", JSON.stringify(sim.value.err));
      for (const l of sim.value.logs || []) {
        if (l.includes("Error") || l.includes("log:")) console.log(" ", l);
      }
      process.exit(1);
    } else {
      console.log("✅ SIMULATION OK — CU:", sim.value.unitsConsumed);
    }
  } else {
    console.log("\nSending transaction...");
    const sig = await conn.sendTransaction(tx);
    console.log("Signature:", sig);
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    console.log("✅ Confirmed!");
  }
}

// ─── Transaction send/simulate ───────────────────────────────────────────────

export async function sendOrSimulate(
  conn: Connection,
  ixs: TransactionInstruction[],
  kp: Keypair,
  dryRun: boolean,
) {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: kp.publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([kp]);

  if (dryRun) {
    console.log("\nSimulating...");
    const sim = await conn.simulateTransaction(tx);
    if (sim.value.err) {
      console.log("❌ SIMULATION FAILED:", JSON.stringify(sim.value.err));
      for (const l of sim.value.logs || []) {
        if (l.includes("Error") || l.includes("log:")) console.log(" ", l);
      }
      process.exit(1);
    } else {
      console.log("✅ SIMULATION OK — CU:", sim.value.unitsConsumed);
    }
  } else {
    console.log("\nSending transaction...");
    const sig = await conn.sendTransaction(tx);
    console.log("Signature:", sig);
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    console.log("✅ Confirmed!");
  }
}
