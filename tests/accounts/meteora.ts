import { PublicKey } from "@solana/web3.js";

export const METEORA_PROGRAM = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
export const METEORA_LB_PAIR = new PublicKey("HPx4ySmLFFWWwwA8q7bgXZncoAmDgEmyJKdbSvucx7AJ");

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
export const METEORA_RESERVE_X = new PublicKey("6QeFdPn8opr9oC5WaZ984ova7LwhQzfM5n5JeEqVTAUw");
export const METEORA_RESERVE_Y = new PublicKey("CFooADfpnUiQjzFJUqKpaxV5mPowb7UGSksExTqTMd21");
