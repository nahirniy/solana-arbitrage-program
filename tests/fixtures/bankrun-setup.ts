import * as anchor from "@coral-xyz/anchor";
import {
  Keypair, PublicKey, SystemProgram,
  AddressLookupTableAccount, TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import { startAnchor, BankrunProvider } from "anchor-bankrun";
import {
  AccountLayout,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { SolanaArbitrageProgram } from "../../target/types/solana_arbitrage_program";
import * as fs from "fs";
import * as path from "path";

// ─── Program IDs ────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey("An3HM7PCKigYDszLj8iWYK7mWRnnnhECfM2tRZwsBFV9");
export const PUMP_PROGRAM_ID = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
export const PUMP_FEE_PROGRAM_ID = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
export const METEORA_PROGRAM_ID = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

// ─── Token mints ────────────────────────────────────────────────────────────

export const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const LIA_MINT = new PublicKey("79dGFnR8XUusyDiK3n8yZ6FXhJjWLFgzdsi2SkUpump");

// ─── Fixture loader ─────────────────────────────────────────────────────────

function loadAccountsFromDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith(".json") && file !== "metadata.json")
    .map((file) => {
      const raw = JSON.parse(fs.readFileSync(path.join(dirPath, file), "utf8"));
      return {
        address: new PublicKey(raw.pubkey),
        info: {
          lamports: raw.lamports,
          data: Buffer.from(raw.data[0], "base64"),
          owner: new PublicKey(raw.owner),
          executable: raw.executable,
        },
      };
    });
}

export interface MeteoraMetadata {
  lbPair: string;
  oracle: string;
  activeId: number;
  activeBinArrayIndex: number;
  binArrays: { index: number; address: string }[];
}

export function loadMeteoraMetadata(): MeteoraMetadata {
  const metadataPath = path.join(__dirname, "meteora", "metadata.json");
  return JSON.parse(fs.readFileSync(metadataPath, "utf8"));
}

// ─── Token balance helper (bankrun doesn't support getTokenAccountBalance) ──

export async function getTokenBalance(
  context: any,
  tokenAccount: PublicKey,
): Promise<bigint> {
  const account = await context.banksClient.getAccount(tokenAccount);
  if (!account) return BigInt(0);
  const data = Buffer.from(account.data);
  return data.readBigUInt64LE(64);
}

// ─── Bankrun setup ──────────────────────────────────────────────────────────

export async function setupBankrun(adminKeypair: Keypair) {
  const fixturesDir = path.join(__dirname);

  const pumpfunAccounts = loadAccountsFromDir(path.join(fixturesDir, "pumpfun"));
  const meteoraAccounts = loadAccountsFromDir(path.join(fixturesDir, "meteora"));

  const context = await startAnchor(
    "",
    [
      { name: "pumpfun", programId: PUMP_PROGRAM_ID },
      { name: "pumpfun_fee", programId: PUMP_FEE_PROGRAM_ID },
      { name: "meteora_dlmm", programId: METEORA_PROGRAM_ID },
      { name: "spl_memo", programId: MEMO_PROGRAM_ID },
    ],
    [...pumpfunAccounts, ...meteoraAccounts],
  );

  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new BankrunProvider(context, wallet);
  const user = wallet.publicKey;

  // ── Inject missing PumpFun accounts (PDAs with zero lamports on mainnet) ─

  const PUMP_COIN_CREATOR_VAULT_AUTHORITY = new PublicKey(
    "AWyhZXmWi4rpymebxphjbboJ72nBrq2TVXBALD7At1fN",
  );
  const PUMP_STATIC_ACCOUNT = new PublicKey(
    "5c829Q6nZGDrD7Pfv2xFh5pMigfaoUgTGbbt1Z2t1FjY",
  );

  for (const addr of [PUMP_COIN_CREATOR_VAULT_AUTHORITY, PUMP_STATIC_ACCOUNT]) {
    context.setAccount(addr, {
      lamports: 1_000_000,
      data: Buffer.alloc(0),
      owner: PUMP_PROGRAM_ID,
      executable: false,
    });
  }

  // ── Fund user for tx fees (must be before any CPI calls) ─────────────────

  context.setAccount(user, {
    lamports: 10_000_000_000, // 10 SOL
    data: Buffer.alloc(0),
    owner: SystemProgram.programId,
    executable: false,
  });

  // ── Initialize PumpFun user_volume_accumulator via CPI ──────────────────

  const [userVolumeAcc] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    PUMP_PROGRAM_ID,
  );

  const PUMP_EVENT_AUTHORITY = new PublicKey("GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR");
  const INIT_UVA_DISC = Buffer.from([94, 6, 202, 115, 255, 96, 232, 183]);
  const initUvaTx = new anchor.web3.Transaction();
  initUvaTx.add({
    programId: PUMP_PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: false },
      { pubkey: userVolumeAcc, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: INIT_UVA_DISC,
  });
  await provider.sendAndConfirm(initUvaTx);

  // Create the WSOL ATA owned by the user_volume_accumulator PDA
  const userVolumeAccWsolAta = getAssociatedTokenAddressSync(
    WSOL_MINT, userVolumeAcc, true, TOKEN_PROGRAM_ID,
  );
  const uvaWsolData = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode(
    {
      mint: WSOL_MINT,
      owner: userVolumeAcc,
      amount: BigInt(0),
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1,
      isNativeOption: 0,
      isNative: BigInt(0),
      delegatedAmount: BigInt(0),
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    uvaWsolData,
  );
  context.setAccount(userVolumeAccWsolAta, {
    lamports: 2_039_280,
    data: uvaWsolData,
    owner: TOKEN_PROGRAM_ID,
    executable: false,
  });

  // ── Inject WSOL ATA with balance ────────────────────────────────────────

  const userWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, user, false, TOKEN_PROGRAM_ID);
  const wsolData = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode(
    {
      mint: WSOL_MINT,
      owner: user,
      amount: BigInt(100_000_000), // 0.1 SOL
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1,
      isNativeOption: 1,
      isNative: BigInt(2_039_280),
      delegatedAmount: BigInt(0),
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    wsolData,
  );
  context.setAccount(userWsolAta, {
    lamports: 100_000_000 + 2_039_280,
    data: wsolData,
    owner: TOKEN_PROGRAM_ID,
    executable: false,
  });

  // ── Inject LIA ATA (empty, Token-2022) ─────────────────────────────────

  const userLiaAta = getAssociatedTokenAddressSync(LIA_MINT, user, false, TOKEN_2022_PROGRAM_ID);
  const liaData = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode(
    {
      mint: LIA_MINT,
      owner: user,
      amount: BigInt(0),
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1,
      isNativeOption: 0,
      isNative: BigInt(0),
      delegatedAmount: BigInt(0),
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    liaData,
  );
  context.setAccount(userLiaAta, {
    lamports: 2_039_280,
    data: liaData,
    owner: TOKEN_2022_PROGRAM_ID,
    executable: false,
  });

  // ── Initialize program config + operator ────────────────────────────────

  const program = new anchor.Program<SolanaArbitrageProgram>(
    require("../../target/idl/solana_arbitrage_program.json"),
    provider,
  );

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID,
  );
  const [operatorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("operator"), user.toBuffer()],
    PROGRAM_ID,
  );

  await program.methods
    .initialize()
    .accountsPartial({
      admin: user,
      config: configPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  await program.methods
    .addOperator(user)
    .accountsPartial({
      admin: user,
      config: configPda,
      operator: operatorPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return {
    context,
    provider,
    program,
    user,
    userWsolAta,
    userLiaAta,
    userVolumeAcc,
    userVolumeAccWsolAta,
    configPda,
    operatorPda,
  };
}

// ─── Address Lookup Table helper ──────────────────────────────────────────

const ALT_PROGRAM_ID = new PublicKey("AddressLookupTab1e1111111111111111111111111");
const LOOKUP_TABLE_META_SIZE = 56;

/**
 * Injects an ALT account into bankrun context and returns the
 * AddressLookupTableAccount object for use in V0 transactions.
 */
export function injectLookupTable(
  context: any,
  addresses: PublicKey[],
  authority: PublicKey,
  slot?: number,
): AddressLookupTableAccount {
  const data = Buffer.alloc(LOOKUP_TABLE_META_SIZE + addresses.length * 32);

  // Slot must be <= current slot for addresses to be usable
  const lastExtendedSlot = BigInt(slot ?? 0);

  // type discriminator = 1 (LookupTable)
  data.writeUInt32LE(1, 0);
  // deactivation_slot = u64::MAX (active)
  data.writeBigUInt64LE(BigInt("18446744073709551615"), 4);
  // last_extended_slot
  data.writeBigUInt64LE(lastExtendedSlot, 12);
  // last_extended_slot_start_index = 0
  data[20] = 0;
  // has_authority = 1
  data[21] = 1;
  // authority pubkey
  authority.toBuffer().copy(data, 22);
  // addresses
  addresses.forEach((addr, i) => {
    addr.toBuffer().copy(data, LOOKUP_TABLE_META_SIZE + i * 32);
  });

  const lutAddress = Keypair.generate().publicKey;

  context.setAccount(lutAddress, {
    lamports: 1_000_000_000,
    data,
    owner: ALT_PROGRAM_ID,
    executable: false,
  });

  return new AddressLookupTableAccount({
    key: lutAddress,
    state: {
      deactivationSlot: BigInt("18446744073709551615"),
      lastExtendedSlot: Number(lastExtendedSlot),
      lastExtendedSlotStartIndex: 0,
      authority,
      addresses,
    },
  });
}

/**
 * Sends a V0 transaction with a lookup table via bankrun.
 */
export async function sendV0Tx(
  context: any,
  instructions: anchor.web3.TransactionInstruction[],
  payer: Keypair,
  lookupTable: AddressLookupTableAccount,
): Promise<void> {
  const blockhash = context.lastBlockhash;

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message([lookupTable]);

  const tx = new VersionedTransaction(message);
  tx.sign([payer]);

  const result = await context.banksClient.processTransaction(tx);
  if (result.result && result.result !== null) {
    const err = result.result;
    if (typeof err === "string" || (err && err.toString() !== "null")) {
      throw new Error(`Transaction failed: ${JSON.stringify(err)}`);
    }
  }
}
