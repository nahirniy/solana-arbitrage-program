import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SolanaArbitrageProgram } from "../target/types/solana_arbitrage_program";
import { assert } from "chai";

import { WSOL_MINT, LIA_MINT } from "./accounts/pumpfun";
import { setupUser } from "./utils/setup";
import { pumpFunBuyAccounts, pumpFunSellAccounts } from "./utils/pumpfun";
import {
  meteoraSwapAccounts,
  getActiveBinArrays,
  binArraysToRemainingAccounts,
} from "./utils/meteora";

const sharedAccounts = (
  wallet: anchor.Wallet,
  operatorPda: PublicKey,
  configPda: PublicKey,
  userLiaAta: PublicKey,
  userWsolAta: PublicKey,
) => ({
  user: wallet.publicKey,
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
});

describe("PumpFun swaps via execute_pump_arb", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaArbitrageProgram as Program<SolanaArbitrageProgram>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  let userWsolAta: PublicKey;
  let userLiaAta: PublicKey;
  let userVolumeAcc: PublicKey;
  let userVolumeAccWsolAta: PublicKey;
  let configPda: PublicKey;
  let operatorPda: PublicKey;

  before(async () => {
    ({ userWsolAta, userLiaAta, userVolumeAcc, userVolumeAccWsolAta, configPda, operatorPda } =
      await setupUser(provider, program));
  });

  it("buy LIA with WSOL on PumpFun", async () => {
    const buyAccounts = pumpFunBuyAccounts(userVolumeAcc, userVolumeAccWsolAta);

    try {
      await program.methods
        .executePumpArb(
          // @ts-ignore
          [{ dex: { pumpFun: {} }, tokenIn: WSOL_MINT, tokenOut: LIA_MINT }],
          new anchor.BN(10_000_000)
        )
        .accountsPartial({
          ...sharedAccounts(wallet, operatorPda, configPda, userLiaAta, userWsolAta),
          ...buyAccounts,
        })
        .rpc();

      const liaBalance = (await connection.getTokenAccountBalance(userLiaAta)).value.uiAmount!;
      console.log("LIA received:", liaBalance);
      assert.isAbove(liaBalance, 0, "Should have received LIA tokens");
    } catch (e: any) {
      console.log("=== ERROR LOGS ===");
      console.log("logs:", JSON.stringify(e.logs));
      throw e;
    }
  });

  it("sell LIA back to WSOL on PumpFun", async () => {
    const liaAmount = (await connection.getTokenAccountBalance(userLiaAta)).value.amount;
    const wsolBefore = (await connection.getTokenAccountBalance(userWsolAta)).value.uiAmount!;
    const sellAccounts = pumpFunSellAccounts(userVolumeAcc, userVolumeAccWsolAta);

    await program.methods
      .executePumpArb(
        // @ts-ignore
        [{ dex: { pumpFun: {} }, tokenIn: LIA_MINT, tokenOut: WSOL_MINT }],
        new anchor.BN(liaAmount)
      )
      .accountsPartial({
        ...sharedAccounts(wallet, operatorPda, configPda, userLiaAta, userWsolAta),
        ...sellAccounts,
      })
      .rpc();

    const wsolAfter = (await connection.getTokenAccountBalance(userWsolAta)).value.uiAmount!;
    console.log("WSOL before:", wsolBefore, "WSOL after:", wsolAfter);
    assert.isAbove(wsolAfter, 0, "Should have received WSOL");
  });
});

describe("Meteora swaps via execute_meteora_arb", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaArbitrageProgram as Program<SolanaArbitrageProgram>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  let userWsolAta: PublicKey;
  let userLiaAta: PublicKey;
  let configPda: PublicKey;
  let operatorPda: PublicKey;

  before(async () => {
    ({ userWsolAta, userLiaAta, configPda, operatorPda } =
      await setupUser(provider, program));
  });

  it("buy LIA with WSOL on Meteora", async () => {
    const binArrays = await getActiveBinArrays(connection);
    console.log("Active bin arrays:", binArrays.map(b => b.toBase58()));

    try {
      await program.methods
        .executeMeteoraArb(
          // @ts-ignore
          [{ dex: { meteora: {} }, tokenIn: WSOL_MINT, tokenOut: LIA_MINT }],
          new anchor.BN(10_000_000)
        )
        .accountsPartial({
          ...sharedAccounts(wallet, operatorPda, configPda, userLiaAta, userWsolAta),
          ...meteoraSwapAccounts(),
        })
        .remainingAccounts(binArraysToRemainingAccounts(binArrays))
        .rpc();

      const liaBalance = (await connection.getTokenAccountBalance(userLiaAta)).value.uiAmount!;
      console.log("LIA received:", liaBalance);
      assert.isAbove(liaBalance, 0, "Should have received LIA tokens");
    } catch (e: any) {
      console.log("=== ERROR LOGS ===");
      console.log("logs:", JSON.stringify(e.logs));
      throw e;
    }
  });

  it("sell LIA back to WSOL on Meteora", async () => {
    const liaAmount = (await connection.getTokenAccountBalance(userLiaAta)).value.amount;
    const wsolBefore = (await connection.getTokenAccountBalance(userWsolAta)).value.uiAmount!;
    const binArrays = await getActiveBinArrays(connection);

    await program.methods
      .executeMeteoraArb(
        // @ts-ignore
        [{ dex: { meteora: {} }, tokenIn: LIA_MINT, tokenOut: WSOL_MINT }],
        new anchor.BN(liaAmount)
      )
      .accountsPartial({
        ...sharedAccounts(wallet, operatorPda, configPda, userLiaAta, userWsolAta),
        ...meteoraSwapAccounts(),
      })
      .remainingAccounts(binArraysToRemainingAccounts(binArrays))
      .rpc();

    const wsolAfter = (await connection.getTokenAccountBalance(userWsolAta)).value.uiAmount!;
    console.log("WSOL before:", wsolBefore, "WSOL after:", wsolAfter);
    assert.isAbove(wsolAfter, 0, "Should have received WSOL");
  });
});
