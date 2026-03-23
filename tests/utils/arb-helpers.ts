import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AccountLayout,
} from "@solana/spl-token";
import { WSOL_MINT, LIA_MINT } from "../accounts/pumpfun";
import { pumpFunBuyAccounts, pumpFunSellAccounts } from "./pumpfun";
import { meteoraSwapAccounts } from "./meteora";

/** Shared accounts common to every arb instruction. */
export function shared(
  user: PublicKey,
  operatorPda: PublicKey,
  configPda: PublicKey,
  userLiaAta: PublicKey,
  userWsolAta: PublicKey,
) {
  return {
    user,
    operator: operatorPda,
    config: configPda,
    baseMint: LIA_MINT,
    quoteMint: WSOL_MINT,
    userBaseAta: userLiaAta,
    userQuoteAta: userWsolAta,
    baseTokenProgram: TOKEN_2022_PROGRAM_ID,
    quoteTokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  };
}

/** Collect all unique addresses for the LUT (both buy/sell PumpFun + Meteora). */
export function collectLutAddresses(
  user: PublicKey,
  operatorPda: PublicKey,
  configPda: PublicKey,
  userLiaAta: PublicKey,
  userWsolAta: PublicKey,
  userVolumeAcc: PublicKey,
  userVolumeAccWsolAta: PublicKey,
  binArrays: PublicKey[],
): PublicKey[] {
  const seen = new Set<string>();
  const out: PublicKey[] = [];
  const add = (pk: PublicKey) => {
    const k = pk.toBase58();
    if (!seen.has(k)) { seen.add(k); out.push(pk); }
  };

  add(user); add(operatorPda); add(configPda);
  add(LIA_MINT); add(WSOL_MINT);
  add(userLiaAta); add(userWsolAta);
  add(TOKEN_2022_PROGRAM_ID); add(TOKEN_PROGRAM_ID);
  add(SystemProgram.programId); add(ASSOCIATED_TOKEN_PROGRAM_ID);

  for (const accs of [
    pumpFunBuyAccounts(userVolumeAcc, userVolumeAccWsolAta),
    pumpFunSellAccounts(userVolumeAcc, userVolumeAccWsolAta),
  ]) {
    for (const v of Object.values(accs)) add(v as PublicKey);
  }

  for (const v of Object.values(meteoraSwapAccounts())) add(v as PublicKey);
  for (const ba of binArrays) add(ba);

  return out;
}

/** Inject bonus WSOL into user ATA so profit check passes in tests. */
export function injectWsolBonus(
  context: any,
  userWsolAta: PublicKey,
  user: PublicKey,
  currentAmount: bigint,
  bonus: number,
) {
  const newAmount = currentAmount + BigInt(bonus);
  const data = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode({
    mint: WSOL_MINT, owner: user, amount: newAmount,
    delegateOption: 0, delegate: PublicKey.default, state: 1,
    isNativeOption: 1, isNative: BigInt(2_039_280),
    delegatedAmount: BigInt(0), closeAuthorityOption: 0, closeAuthority: PublicKey.default,
  }, data);
  context.setAccount(userWsolAta, {
    lamports: Number(newAmount) + 2_039_280,
    data, owner: TOKEN_PROGRAM_ID, executable: false,
  });
}
