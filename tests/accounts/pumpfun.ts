import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

export const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const LIA_MINT  = new PublicKey("79dGFnR8XUusyDiK3n8yZ6FXhJjWLFgzdsi2SkUpump");

export const PUMP_PROGRAM          = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
export const PUMP_FEE_PROGRAM      = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
export const PUMP_POOL             = new PublicKey("8BhCzFjnHmFyZEdh6JNgoQNRHCS2R8KHKYpGviocNYSa");
export const PUMP_GLOBAL_CONFIG    = new PublicKey("ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw");
export const PUMP_EVENT_AUTHORITY  = new PublicKey("GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR");
export const PUMP_COIN_CREATOR_VAULT_ATA       = new PublicKey("FXxLh8XggMMAwYaioDvVbqd2NAM6P3qANj1Sgv1mR9U1");
export const PUMP_COIN_CREATOR_VAULT_AUTHORITY = new PublicKey("AWyhZXmWi4rpymebxphjbboJ72nBrq2TVXBALD7At1fN");
export const PUMP_FEE_CONFIG       = new PublicKey("5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx");
export const PUMP_STATIC_ACCOUNT   = new PublicKey("5c829Q6nZGDrD7Pfv2xFh5pMigfaoUgTGbbt1Z2t1FjY");
export const PUMP_GLOBAL_VOLUME_ACCUMULATOR = new PublicKey("C2aFPdENg4A2HQsmrd5rTw5TaYBX5Ku887cWjbFKtZpw");

// Protocol fee recipients differ for buy (WSOL fee) and sell (LIA fee)
export const PUMP_PROTOCOL_FEE_RECIPIENT_BUY     = new PublicKey("JCRGumoE9Qi5BBgULTgdgTLjSgkCMSbF62ZZfGs84JeU");
export const PUMP_PROTOCOL_FEE_RECIPIENT_ATA_BUY = new PublicKey("DWpvfqzGWuVy9jVSKSShdM2733nrEsnnhsUStYbkj6Nn");
export const PUMP_PROTOCOL_FEE_RECIPIENT_SELL     = new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV");
export const PUMP_PROTOCOL_FEE_RECIPIENT_ATA_SELL = new PublicKey("94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb");

// Pool vaults: ATAs owned by the pool PDA
export const PUMP_POOL_BASE_VAULT  = getAssociatedTokenAddressSync(LIA_MINT,  PUMP_POOL, true, TOKEN_2022_PROGRAM_ID);
export const PUMP_POOL_QUOTE_VAULT = getAssociatedTokenAddressSync(WSOL_MINT, PUMP_POOL, true, TOKEN_PROGRAM_ID);
