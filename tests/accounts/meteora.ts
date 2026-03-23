import { PublicKey } from "@solana/web3.js";

export const METEORA_PROGRAM = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
export const METEORA_LB_PAIR = new PublicKey("8ida4DAhywHBsH8qAaXhWYT316kaBaFLhVr3ZQc48pUf");

// PDAs derived at module load — deterministic, no RPC needed
export const METEORA_ORACLE = PublicKey.findProgramAddressSync(
  [Buffer.from("oracle"), METEORA_LB_PAIR.toBuffer()],
  METEORA_PROGRAM
)[0];

export const METEORA_BIN_ARRAY_BITMAP_EXTENSION = PublicKey.findProgramAddressSync(
  [Buffer.from("bitmap"), METEORA_LB_PAIR.toBuffer()],
  METEORA_PROGRAM
)[0];

export const METEORA_EVENT_AUTHORITY = PublicKey.findProgramAddressSync(
  [Buffer.from("__event_authority")],
  METEORA_PROGRAM
)[0];

// token_x = LIA (offset 88 in LbPair), token_y = WSOL (offset 120)
// reserve_x at offset 152, reserve_y at offset 184 — read from LbPair account data
export const METEORA_RESERVE_X = new PublicKey("FhLjTKC7CqZ2UqS12LiC8GHz3XKEqtdnHHtZU6cZ2DjV");
export const METEORA_RESERVE_Y = new PublicKey("924aNoaduCwtYxLB6ZncwRN3Ljiu291AekQGW69woLuu");
