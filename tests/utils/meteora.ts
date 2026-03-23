import { Connection, PublicKey, AccountMeta } from "@solana/web3.js";
import {
  METEORA_PROGRAM,
  METEORA_LB_PAIR,
  METEORA_ORACLE,
  METEORA_EVENT_AUTHORITY,
  METEORA_RESERVE_X,
  METEORA_RESERVE_Y,
} from "../accounts/meteora";

const BINS_PER_ARRAY = 70;

// active_id is i32 at byte offset 76 in LbPair account data
// Layout: discriminator(8) + StaticParameters(32) + VariableParameters(32) + bump(1) + bin_step_seed(2) + pair_type(1) + active_id(4)
const ACTIVE_ID_OFFSET = 76;

function binArrayIndex(binId: number): number {
  // Rust div_floor: rounds toward negative infinity (not toward zero)
  return Math.floor(binId / BINS_PER_ARRAY);
}

function deriveBinArrayPda(index: number): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(index));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bin_array"), METEORA_LB_PAIR.toBuffer(), buf],
    METEORA_PROGRAM
  )[0];
}

/** Reads LbPair on-chain, returns all existing bin arrays around the active bin. */
export async function getActiveBinArrays(connection: Connection): Promise<PublicKey[]> {
  const info = await connection.getAccountInfo(METEORA_LB_PAIR);
  if (!info) throw new Error("LbPair account not found");

  const activeId = info.data.readInt32LE(ACTIVE_ID_OFFSET);
  const activeIndex = binArrayIndex(activeId);

  // Check wider range — swap may traverse many arrays
  const range: number[] = [];
  for (let i = activeIndex - 3; i <= activeIndex + 5; i++) range.push(i);

  const candidates = range.map(deriveBinArrayPda);
  const accounts = await connection.getMultipleAccountsInfo(candidates);

  const existing = candidates.filter((_, i) => accounts[i] !== null);
  if (existing.length === 0) throw new Error("No active bin arrays found for LbPair");
  return existing;
}

// Memo program — required by Meteora swap2 for Token-2022 support
const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export interface MeteoraSwapAccounts {
  meteoraLbPair: PublicKey;
  meteoraBinArrayBitmapExtension: PublicKey;
  meteoraReserveX: PublicKey;
  meteoraReserveY: PublicKey;
  meteoraOracle: PublicKey;
  meteoraHostFeeIn: PublicKey;
  meteoraMemoProgram: PublicKey;
  meteoraEventAuthority: PublicKey;
  meteoraProgram: PublicKey;
}

export function meteoraSwapAccounts(): MeteoraSwapAccounts {
  return {
    meteoraLbPair:                   METEORA_LB_PAIR,
    meteoraBinArrayBitmapExtension:  METEORA_PROGRAM, // program ID = None (placeholder)
    meteoraReserveX:                 METEORA_RESERVE_X,
    meteoraReserveY:                 METEORA_RESERVE_Y,
    meteoraOracle:                   METEORA_ORACLE,
    meteoraHostFeeIn:                METEORA_PROGRAM, // program ID = no host fee
    meteoraMemoProgram:              MEMO_PROGRAM,
    meteoraEventAuthority:           METEORA_EVENT_AUTHORITY,
    meteoraProgram:                  METEORA_PROGRAM,
  };
}

/** Converts bin array pubkeys to remainingAccounts format for Anchor. */
export function binArraysToRemainingAccounts(binArrays: PublicKey[]): AccountMeta[] {
  return binArrays.map((pubkey) => ({
    pubkey,
    isWritable: true,
    isSigner: false,
  }));
}
