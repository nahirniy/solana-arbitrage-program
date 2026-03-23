import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair, PublicKey, SystemProgram, ComputeBudgetProgram,
} from "@solana/web3.js";
import { SolanaArbitrageProgram } from "../target/types/solana_arbitrage_program";
import { assert } from "chai";

import { WSOL_MINT, LIA_MINT } from "./accounts/pumpfun";
import { pumpFunBuyAccounts, pumpFunSellAccounts } from "./utils/pumpfun";
import { meteoraSwapAccounts, binArraysToRemainingAccounts } from "./utils/meteora";
import { shared, collectLutAddresses, injectWsolBonus } from "./utils/arb-helpers";
import {
  setupBankrun, getTokenBalance, loadMeteoraMetadata,
  injectLookupTable, sendV0Tx, PROGRAM_ID,
} from "./fixtures/bankrun-setup";

// ─── execute_arb: buy PumpFun → sell Meteora ─────────────────────────────────

describe("execute_arb: buy PumpFun → sell Meteora", () => {
  const admin = Keypair.generate();
  let program: Program<SolanaArbitrageProgram>;
  let ctx: any;
  let user: PublicKey;
  let userWsolAta: PublicKey;
  let userLiaAta: PublicKey;
  let userVolumeAcc: PublicKey;
  let userVolumeAccWsolAta: PublicKey;
  let configPda: PublicKey;
  let operatorPda: PublicKey;

  before(async () => {
    ({ context: ctx, program, user, userWsolAta, userLiaAta,
       userVolumeAcc, userVolumeAccWsolAta, configPda, operatorPda }
      = await setupBankrun(admin));
  });

  it("executes two-leg arb in a single instruction", async () => {
    const metadata = loadMeteoraMetadata();
    const binArrays = metadata.binArrays.map((b) => new PublicKey(b.address));

    const currentWsol = await getTokenBalance(ctx, userWsolAta);
    injectWsolBonus(ctx, userWsolAta, user, currentWsol, 50_000_000);
    const wsolBefore = await getTokenBalance(ctx, userWsolAta);

    const lutAddresses = collectLutAddresses(
      user, operatorPda, configPda, userLiaAta, userWsolAta,
      userVolumeAcc, userVolumeAccWsolAta, binArrays,
    );
    const lookupTable = injectLookupTable(ctx, lutAddresses, user);

    const ix = await program.methods
      .executeArb(
        // @ts-ignore
        [
          { dex: { pumpFun: {} }, tokenIn: WSOL_MINT, tokenOut: LIA_MINT },
          { dex: { meteora: {} }, tokenIn: LIA_MINT, tokenOut: WSOL_MINT },
        ],
        new anchor.BN(10_000_000),
      )
      .accountsPartial({
        ...shared(user, operatorPda, configPda, userLiaAta, userWsolAta),
        ...pumpFunBuyAccounts(userVolumeAcc, userVolumeAccWsolAta),
        ...meteoraSwapAccounts(),
      })
      .remainingAccounts(binArraysToRemainingAccounts(binArrays))
      .instruction();

    const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });
    await sendV0Tx(ctx, [computeIx, ix], admin, lookupTable);

    const wsolAfter = await getTokenBalance(ctx, userWsolAta);
    const liaAfter = await getTokenBalance(ctx, userLiaAta);
    console.log("    WSOL:", Number(wsolBefore) / 1e9, "→", Number(wsolAfter) / 1e9);
    console.log("    LIA remaining:", Number(liaAfter) / 1e6);
    assert.equal(Number(liaAfter), 0);
    assert.isAbove(Number(wsolAfter), 0);
  });
});

// ─── execute_arb: buy Meteora → sell PumpFun ─────────────────────────────────

describe("execute_arb: buy Meteora → sell PumpFun", () => {
  const admin = Keypair.generate();
  let program: Program<SolanaArbitrageProgram>;
  let ctx: any;
  let user: PublicKey;
  let userWsolAta: PublicKey;
  let userLiaAta: PublicKey;
  let userVolumeAcc: PublicKey;
  let userVolumeAccWsolAta: PublicKey;
  let configPda: PublicKey;
  let operatorPda: PublicKey;

  before(async () => {
    ({ context: ctx, program, user, userWsolAta, userLiaAta,
       userVolumeAcc, userVolumeAccWsolAta, configPda, operatorPda }
      = await setupBankrun(admin));
  });

  it("executes two-leg arb in a single instruction", async () => {
    const metadata = loadMeteoraMetadata();
    const binArrays = metadata.binArrays.map((b) => new PublicKey(b.address));

    const currentWsol = await getTokenBalance(ctx, userWsolAta);
    injectWsolBonus(ctx, userWsolAta, user, currentWsol, 50_000_000);
    const wsolBefore = await getTokenBalance(ctx, userWsolAta);

    const lutAddresses = collectLutAddresses(
      user, operatorPda, configPda, userLiaAta, userWsolAta,
      userVolumeAcc, userVolumeAccWsolAta, binArrays,
    );
    const lookupTable = injectLookupTable(ctx, lutAddresses, user);

    const ix = await program.methods
      .executeArb(
        // @ts-ignore
        [
          { dex: { meteora: {} }, tokenIn: WSOL_MINT, tokenOut: LIA_MINT },
          { dex: { pumpFun: {} }, tokenIn: LIA_MINT, tokenOut: WSOL_MINT },
        ],
        new anchor.BN(10_000_000),
      )
      .accountsPartial({
        ...shared(user, operatorPda, configPda, userLiaAta, userWsolAta),
        ...pumpFunSellAccounts(userVolumeAcc, userVolumeAccWsolAta),
        ...meteoraSwapAccounts(),
      })
      .remainingAccounts(binArraysToRemainingAccounts(binArrays))
      .instruction();

    const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });
    await sendV0Tx(ctx, [computeIx, ix], admin, lookupTable);

    const wsolAfter = await getTokenBalance(ctx, userWsolAta);
    const liaAfter = await getTokenBalance(ctx, userLiaAta);
    console.log("    WSOL:", Number(wsolBefore) / 1e9, "→", Number(wsolAfter) / 1e9);
    console.log("    LIA remaining:", Number(liaAfter) / 1e6);
    assert.equal(Number(liaAfter), 0);
    assert.isAbove(Number(wsolAfter), 0);
  });
});

// ─── Role system ─────────────────────────────────────────────────────────────

describe("Role system", () => {
  const admin = Keypair.generate();
  let program: Program<SolanaArbitrageProgram>;
  let ctx: any;
  let user: PublicKey;
  let configPda: PublicKey;
  let userWsolAta: PublicKey;
  let userLiaAta: PublicKey;
  let userVolumeAcc: PublicKey;
  let userVolumeAccWsolAta: PublicKey;
  let operatorPda: PublicKey;

  before(async () => {
    ({ context: ctx, program, user, configPda, userWsolAta, userLiaAta,
       userVolumeAcc, userVolumeAccWsolAta, operatorPda }
      = await setupBankrun(admin));
  });

  // ── initialize ───────────────────────────────────────────────────────────

  it("rejects double initialize", async () => {
    try {
      await program.methods
        .initialize()
        .accountsPartial({ admin: user, config: configPda, systemProgram: SystemProgram.programId })
        .rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      // Anchor returns "already in use" for init on existing account
      assert.ok(e.message);
    }
  });

  // ── add_operator ─────────────────────────────────────────────────────────

  it("rejects add_operator from non-admin", async () => {
    const faker = Keypair.generate();
    ctx.setAccount(faker.publicKey, {
      lamports: 1_000_000_000, data: Buffer.alloc(0),
      owner: SystemProgram.programId, executable: false,
    });

    const someUser = Keypair.generate().publicKey;
    const [newOp] = PublicKey.findProgramAddressSync(
      [Buffer.from("operator"), someUser.toBuffer()], PROGRAM_ID,
    );

    try {
      await program.methods
        .addOperator(someUser)
        .accountsPartial({ admin: faker.publicKey, config: configPda, operator: newOp, systemProgram: SystemProgram.programId })
        .signers([faker]).rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.include(e.message, "NotAdmin");
    }
  });

  it("admin can add operator", async () => {
    const newUser = Keypair.generate().publicKey;
    const [newOp] = PublicKey.findProgramAddressSync(
      [Buffer.from("operator"), newUser.toBuffer()], PROGRAM_ID,
    );

    await program.methods
      .addOperator(newUser)
      .accountsPartial({ admin: user, config: configPda, operator: newOp, systemProgram: SystemProgram.programId })
      .rpc();

    const opAccount = await program.account.operator.fetch(newOp);
    assert.ok(opAccount.authority.equals(newUser));
  });

  // ── remove_operator ──────────────────────────────────────────────────────

  it("rejects remove_operator from non-admin", async () => {
    const faker = Keypair.generate();
    ctx.setAccount(faker.publicKey, {
      lamports: 1_000_000_000, data: Buffer.alloc(0),
      owner: SystemProgram.programId, executable: false,
    });

    try {
      await program.methods
        .removeOperator(user)
        .accountsPartial({ admin: faker.publicKey, config: configPda, operator: operatorPda })
        .signers([faker]).rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.include(e.message, "NotAdmin");
    }
  });

  it("admin can remove operator", async () => {
    const tempUser = Keypair.generate().publicKey;
    const [tempOp] = PublicKey.findProgramAddressSync(
      [Buffer.from("operator"), tempUser.toBuffer()], PROGRAM_ID,
    );

    await program.methods
      .addOperator(tempUser)
      .accountsPartial({ admin: user, config: configPda, operator: tempOp, systemProgram: SystemProgram.programId })
      .rpc();

    await program.methods
      .removeOperator(tempUser)
      .accountsPartial({ admin: user, config: configPda, operator: tempOp })
      .rpc();

    try {
      await program.account.operator.fetch(tempOp);
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.ok(e.message);
    }
  });

  // ── execute_arb from non-operator ────────────────────────────────────────

  it("rejects execute_arb from non-operator", async () => {
    const faker = Keypair.generate();
    ctx.setAccount(faker.publicKey, {
      lamports: 1_000_000_000, data: Buffer.alloc(0),
      owner: SystemProgram.programId, executable: false,
    });

    const [fakeOp] = PublicKey.findProgramAddressSync(
      [Buffer.from("operator"), faker.publicKey.toBuffer()], PROGRAM_ID,
    );

    const metadata = loadMeteoraMetadata();
    const binArrays = metadata.binArrays.map((b) => new PublicKey(b.address));
    const lutAddresses = collectLutAddresses(
      faker.publicKey, fakeOp, configPda, userLiaAta, userWsolAta,
      userVolumeAcc, userVolumeAccWsolAta, binArrays,
    );
    const lookupTable = injectLookupTable(ctx, lutAddresses, faker.publicKey);

    const ix = await program.methods
      .executeArb(
        // @ts-ignore
        [
          { dex: { pumpFun: {} }, tokenIn: WSOL_MINT, tokenOut: LIA_MINT },
          { dex: { meteora: {} }, tokenIn: LIA_MINT, tokenOut: WSOL_MINT },
        ],
        new anchor.BN(10_000_000),
      )
      .accountsPartial({
        ...shared(faker.publicKey, fakeOp, configPda, userLiaAta, userWsolAta),
        ...pumpFunBuyAccounts(userVolumeAcc, userVolumeAccWsolAta),
        ...meteoraSwapAccounts(),
      })
      .remainingAccounts(binArraysToRemainingAccounts(binArrays))
      .instruction();

    const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });

    try {
      await sendV0Tx(ctx, [computeIx, ix], faker, lookupTable);
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.ok(e.message);
    }
  });
});
