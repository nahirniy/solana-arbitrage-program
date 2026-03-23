/**
 * Initialize the arb program: create Config PDA + add caller as operator.
 * Run once after deploy.
 *
 * Usage:
 *   npx ts-node --skip-project scripts/init-program.ts
 *
 * Env:
 *   RPC_URL      — Solana RPC (default: mainnet-beta)
 *   DRY_RUN      — "true" to only simulate (default: false)
 */

import { Connection, PublicKey, SystemProgram, ComputeBudgetProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { loadKeypair, getDefaultKeypairPath, sendOrSimulate } from "./utils";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("An3HM7PCKigYDszLj8iWYK7mWRnnnhECfM2tRZwsBFV9");

async function main() {
  const rpcUrl = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
  const dryRun = process.env.DRY_RUN === "true";
  const kp = loadKeypair();
  const conn = new Connection(rpcUrl, "confirmed");

  const wallet = new anchor.Wallet(kp);
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
  const idl = JSON.parse(fs.readFileSync("target/idl/solana_arbitrage_program.json", "utf-8"));
  const program = new anchor.Program(idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
  const [operatorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("operator"), kp.publicKey.toBuffer()], PROGRAM_ID,
  );

  console.log("Wallet:", kp.publicKey.toBase58());
  console.log("Program:", PROGRAM_ID.toBase58());
  console.log("Config PDA:", configPda.toBase58());
  console.log("Operator PDA:", operatorPda.toBase58());
  console.log("RPC:", rpcUrl);
  console.log("Dry run:", dryRun);

  // Check if already initialized
  const configInfo = await conn.getAccountInfo(configPda);
  if (configInfo) {
    console.log("\n⚠️  Config already initialized. Skipping initialize.");
  } else {
    console.log("\n1/2 Initializing program...");
    const initIx = await program.methods
      .initialize()
      .accountsPartial({
        admin: kp.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    await sendOrSimulate(conn, [initIx], kp, dryRun);
    console.log("Config created. Admin:", kp.publicKey.toBase58());
  }

  // Check if operator already exists
  const operatorInfo = await conn.getAccountInfo(operatorPda);
  if (operatorInfo) {
    console.log("\n⚠️  Operator already added. Skipping add_operator.");
  } else {
    console.log("\n2/2 Adding self as operator...");
    const addOpIx = await program.methods
      .addOperator(kp.publicKey)
      .accountsPartial({
        admin: kp.publicKey,
        config: configPda,
        operator: operatorPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    await sendOrSimulate(conn, [addOpIx], kp, dryRun);
    console.log("Operator added:", kp.publicKey.toBase58());
  }

  console.log("\n✅ Done!");
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
