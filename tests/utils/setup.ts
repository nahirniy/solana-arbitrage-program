import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { SolanaArbitrageProgram } from "../../target/types/solana_arbitrage_program";
import { WSOL_MINT, LIA_MINT, PUMP_PROGRAM, PUMP_EVENT_AUTHORITY } from "../accounts/pumpfun";

export function deriveConfigPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
}

export function deriveOperatorPda(wallet: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("operator"), wallet.toBuffer()],
    programId
  )[0];
}

export function deriveUserVolumeAccumulator(wallet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), wallet.toBuffer()],
    PUMP_PROGRAM
  )[0];
}

// Creates all user accounts needed for PumpFun arb: WSOL ATA, LIA ATA,
// user_volume_accumulator PDA, program config + operator. Idempotent. */
export async function setupUser(
  provider: anchor.AnchorProvider,
  program: Program<SolanaArbitrageProgram>,
  wrapLamports = 100_000_000,
): Promise<{
  userWsolAta: PublicKey;
  userLiaAta: PublicKey;
  userVolumeAcc: PublicKey;
  userVolumeAccWsolAta: PublicKey;
  configPda: PublicKey;
  operatorPda: PublicKey;
}> {
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  const userWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, wallet.publicKey, false, TOKEN_PROGRAM_ID);
  const userLiaAta  = getAssociatedTokenAddressSync(LIA_MINT,  wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const userVolumeAcc = deriveUserVolumeAccumulator(wallet.publicKey);
  const userVolumeAccWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, userVolumeAcc, true, TOKEN_PROGRAM_ID);
  const configPda   = deriveConfigPda(program.programId);
  const operatorPda = deriveOperatorPda(wallet.publicKey, program.programId);

  // Create ATAs + wrap SOL
  const tx = new Transaction();
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey, userWsolAta, wallet.publicKey, WSOL_MINT, TOKEN_PROGRAM_ID,
    ),
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: userWsolAta,
      lamports: wrapLamports,
    }),
    createSyncNativeInstruction(userWsolAta, TOKEN_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey, userLiaAta, wallet.publicKey, LIA_MINT, TOKEN_2022_PROGRAM_ID,
    ),
  );
  await provider.sendAndConfirm(tx);

  // Initialize user_volume_accumulator on PumpFun (required before first buy)
  const userVolAccExists = await connection.getAccountInfo(userVolumeAcc);
  if (!userVolAccExists) {
    const INIT_DISC = Buffer.from([94, 6, 202, 115, 255, 96, 232, 183]);
    const initTx = new Transaction();
    initTx.add({
      programId: PUMP_PROGRAM,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  }, // payer
        { pubkey: wallet.publicKey, isSigner: true,  isWritable: false }, // user
        { pubkey: userVolumeAcc,    isSigner: false, isWritable: true  }, // user_volume_accumulator
        { pubkey: SystemProgram.programId,   isSigner: false, isWritable: false },
        { pubkey: PUMP_EVENT_AUTHORITY,      isSigner: false, isWritable: false },
        { pubkey: PUMP_PROGRAM,              isSigner: false, isWritable: false },
      ],
      data: INIT_DISC,
    });
    try {
      await provider.sendAndConfirm(initTx);
    } catch (_) { /* already initialized */ }
  }

  // Initialize program config
  try {
    await program.methods
      .initialize()
      .accountsPartial({ admin: wallet.publicKey, config: configPda, systemProgram: SystemProgram.programId })
      .rpc();
  } catch (_) { /* already initialized */ }

  // Add self as operator
  try {
    await program.methods
      .addOperator(wallet.publicKey)
      .accountsPartial({ admin: wallet.publicKey, config: configPda, operator: operatorPda, systemProgram: SystemProgram.programId })
      .rpc();
  } catch (_) { /* already added */ }

  return { userWsolAta, userLiaAta, userVolumeAcc, userVolumeAccWsolAta, configPda, operatorPda };
}
