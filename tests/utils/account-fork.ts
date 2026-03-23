import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ─── Token mints ────────────────────────────────────────────────────────────

const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const LIA_MINT = new PublicKey("79dGFnR8XUusyDiK3n8yZ6FXhJjWLFgzdsi2SkUpump");

// ─── PumpFun addresses ─────────────────────────────────────────────────────

const PUMP_PROGRAM = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
const PUMP_FEE_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
const PUMP_POOL = new PublicKey("8BhCzFjnHmFyZEdh6JNgoQNRHCS2R8KHKYpGviocNYSa");

const PUMPFUN_KEYS: Record<string, string> = {
  pool: PUMP_POOL.toBase58(),
  global_config: "ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw",
  event_authority: "GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR",
  coin_creator_vault_ata: "FXxLh8XggMMAwYaioDvVbqd2NAM6P3qANj1Sgv1mR9U1",
  coin_creator_vault_authority: "AWyhZXmWi4rpymebxphjbboJ72nBrq2TVXBALD7At1fN",
  fee_config: "5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx",
  static_account: "5c829Q6nZGDrD7Pfv2xFh5pMigfaoUgTGbbt1Z2t1FjY",
  global_volume_accumulator: "C2aFPdENg4A2HQsmrd5rTw5TaYBX5Ku887cWjbFKtZpw",
  protocol_fee_recipient_buy: "JCRGumoE9Qi5BBgULTgdgTLjSgkCMSbF62ZZfGs84JeU",
  protocol_fee_recipient_ata_buy: "DWpvfqzGWuVy9jVSKSShdM2733nrEsnnhsUStYbkj6Nn",
  protocol_fee_recipient_sell: "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV",
  protocol_fee_recipient_ata_sell: "94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb",
  pool_base_vault: getAssociatedTokenAddressSync(LIA_MINT, PUMP_POOL, true, TOKEN_2022_PROGRAM_ID).toBase58(),
  pool_quote_vault: getAssociatedTokenAddressSync(WSOL_MINT, PUMP_POOL, true, TOKEN_PROGRAM_ID).toBase58(),
  lia_mint: LIA_MINT.toBase58(),
  wsol_mint: WSOL_MINT.toBase58(),
};

// ─── Meteora addresses ──────────────────────────────────────────────────────

const METEORA_PROGRAM = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
const METEORA_LB_PAIR = new PublicKey("HPx4ySmLFFWWwwA8q7bgXZncoAmDgEmyJKdbSvucx7AJ");

const METEORA_KEYS: Record<string, string> = {
  lb_pair: METEORA_LB_PAIR.toBase58(),
  reserve_x: "6QeFdPn8opr9oC5WaZ984ova7LwhQzfM5n5JeEqVTAUw",
  reserve_y: "CFooADfpnUiQjzFJUqKpaxV5mPowb7UGSksExTqTMd21",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.resolve(process.cwd(), "tests/fixtures");

async function fetchAndSave(
  connection: Connection,
  keys: Record<string, string>,
  subDir: string,
) {
  const dir = path.join(FIXTURES_DIR, subDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const pubkeys = Object.values(keys).map((k) => new PublicKey(k));
  const names = Object.keys(keys);
  console.log(`Downloading ${pubkeys.length} accounts for ${subDir}...`);

  const accounts = await connection.getMultipleAccountsInfo(pubkeys);

  accounts.forEach((info, i) => {
    const pubkey = pubkeys[i].toBase58();
    if (info) {
      const accountData = {
        pubkey,
        lamports: info.lamports,
        data: [info.data.toString("base64"), "base64"],
        owner: info.owner.toBase58(),
        executable: info.executable,
      };
      fs.writeFileSync(
        path.join(dir, `${pubkey}.json`),
        JSON.stringify(accountData, null, 2),
      );
      console.log(`  [${subDir}] ${names[i]}: ${pubkey}`);
    } else {
      console.warn(`  [${subDir}] SKIP (not found): ${names[i]} ${pubkey}`);
    }
  });
}

function dumpProgram(programId: string, filename: string) {
  const outPath = path.join(FIXTURES_DIR, filename);
  if (fs.existsSync(outPath)) {
    console.log(`  ${filename} already exists, skipping dump`);
    return;
  }
  console.log(`Dumping ${filename}...`);
  try {
    execSync(
      `solana program dump ${programId} ${outPath} --url mainnet-beta`,
      { stdio: "inherit" },
    );
    console.log(`  ${filename} saved`);
  } catch (e) {
    console.error(`  Failed to dump ${filename}. Make sure 'solana' CLI is installed.`);
    throw e;
  }
}

// ─── Meteora: fork bin arrays dynamically ───────────────────────────────────

const BINS_PER_ARRAY = 70;
const ACTIVE_ID_OFFSET = 76;

function deriveBinArrayPda(lbPair: PublicKey, index: number): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(index));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bin_array"), lbPair.toBuffer(), buf],
    METEORA_PROGRAM,
  )[0];
}

async function forkMeteoraBinArrays(connection: Connection) {
  console.log("Fetching Meteora LbPair to discover bin arrays...");
  const info = await connection.getAccountInfo(METEORA_LB_PAIR);
  if (!info) throw new Error("LbPair account not found on mainnet");

  const activeId = info.data.readInt32LE(ACTIVE_ID_OFFSET);
  const activeIndex = Math.floor(activeId / BINS_PER_ARRAY);
  console.log(`  active_id=${activeId}, active_bin_array_index=${activeIndex}`);

  // Derive oracle PDA
  const [oraclePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle"), METEORA_LB_PAIR.toBuffer()],
    METEORA_PROGRAM,
  );

  // Check range of bin arrays
  const range: number[] = [];
  for (let i = activeIndex - 3; i <= activeIndex + 3; i++) range.push(i);

  const candidates = range.map((i) => deriveBinArrayPda(METEORA_LB_PAIR, i));
  const accounts = await connection.getMultipleAccountsInfo(candidates);

  const binArrayKeys: Record<string, string> = {
    oracle: oraclePda.toBase58(),
  };
  candidates.forEach((pubkey, i) => {
    if (accounts[i] !== null) {
      binArrayKeys[`bin_array_${range[i]}`] = pubkey.toBase58();
    }
  });

  await fetchAndSave(connection, binArrayKeys, "meteora");

  // Save metadata for test helpers
  const existingArrays = range
    .map((idx, i) => ({ index: idx, address: candidates[i].toBase58(), exists: accounts[i] !== null }))
    .filter((a) => a.exists);

  const metadata = {
    lbPair: METEORA_LB_PAIR.toBase58(),
    oracle: oraclePda.toBase58(),
    activeId,
    activeBinArrayIndex: activeIndex,
    binArrays: existingArrays.map((a) => ({
      index: a.index,
      address: a.address,
    })),
  };

  fs.writeFileSync(
    path.join(FIXTURES_DIR, "meteora", "metadata.json"),
    JSON.stringify(metadata, null, 2),
  );
  console.log("  Saved meteora/metadata.json");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

  // 1. Dump program binaries (.so)
  console.log("\n=== Dumping program binaries ===");
  dumpProgram(PUMP_PROGRAM.toBase58(), "pumpfun.so");
  dumpProgram(PUMP_FEE_PROGRAM.toBase58(), "pumpfun_fee.so");
  dumpProgram(METEORA_PROGRAM.toBase58(), "meteora_dlmm.so");
  dumpProgram("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", "spl_memo.so");

  // 2. Fork PumpFun account state
  console.log("\n=== Forking PumpFun accounts ===");
  await fetchAndSave(connection, PUMPFUN_KEYS, "pumpfun");

  // 3. Fork Meteora account state + dynamic bin arrays
  console.log("\n=== Forking Meteora accounts ===");
  // Clear old meteora fixtures
  const meteoraDir = path.join(FIXTURES_DIR, "meteora");
  if (fs.existsSync(meteoraDir)) {
    fs.readdirSync(meteoraDir).forEach((f) => fs.unlinkSync(path.join(meteoraDir, f)));
  }
  await fetchAndSave(connection, METEORA_KEYS, "meteora");
  await forkMeteoraBinArrays(connection);

  console.log("\nFork complete! Run tests with: anchor test");
}

main().catch(console.error);
