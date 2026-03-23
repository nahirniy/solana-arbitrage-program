import { PublicKey } from "@solana/web3.js";
import {
  PUMP_PROGRAM,
  PUMP_FEE_PROGRAM,
  PUMP_POOL,
  PUMP_GLOBAL_CONFIG,
  PUMP_EVENT_AUTHORITY,
  PUMP_COIN_CREATOR_VAULT_ATA,
  PUMP_COIN_CREATOR_VAULT_AUTHORITY,
  PUMP_FEE_CONFIG,
  PUMP_STATIC_ACCOUNT,
  PUMP_GLOBAL_VOLUME_ACCUMULATOR,
  PUMP_PROTOCOL_FEE_RECIPIENT_BUY,
  PUMP_PROTOCOL_FEE_RECIPIENT_ATA_BUY,
  PUMP_PROTOCOL_FEE_RECIPIENT_SELL,
  PUMP_PROTOCOL_FEE_RECIPIENT_ATA_SELL,
  PUMP_POOL_BASE_VAULT,
  PUMP_POOL_QUOTE_VAULT,
} from "../accounts/pumpfun";

export interface PumpFunSwapAccounts {
  pumpPool: PublicKey;
  pumpGlobalConfig: PublicKey;
  pumpPoolBaseVault: PublicKey;
  pumpPoolQuoteVault: PublicKey;
  pumpProtocolFeeRecipient: PublicKey;
  pumpProtocolFeeRecipientAta: PublicKey;
  pumpEventAuthority: PublicKey;
  pumpProgram: PublicKey;
  pumpCoinCreatorVaultAta: PublicKey;
  pumpCoinCreatorVaultAuthority: PublicKey;
  pumpGlobalVolumeAccumulator: PublicKey;
  pumpUserVolumeAccumulator: PublicKey;
  pumpFeeConfig: PublicKey;
  pumpFeeProgram: PublicKey;
  pumpExtraAccountA: PublicKey;
  pumpExtraAccountB: PublicKey;
  pumpStaticAccount: PublicKey;
}

/**
 * Assembles all PumpFun accounts needed for a buy (WSOL → LIA) CPI.
 * @param userVolumeAcc  - user_volume_accumulator PDA (seeds: ["user_volume_accumulator", user])
 * @param userVolumeAccWsolAta - WSOL ATA owned by the user_volume_accumulator PDA
 */
export function pumpFunBuyAccounts(
  userVolumeAcc: PublicKey,
  userVolumeAccWsolAta: PublicKey,
): PumpFunSwapAccounts {
  return {
    pumpPool:                       PUMP_POOL,
    pumpGlobalConfig:               PUMP_GLOBAL_CONFIG,
    pumpPoolBaseVault:              PUMP_POOL_BASE_VAULT,
    pumpPoolQuoteVault:             PUMP_POOL_QUOTE_VAULT,
    pumpProtocolFeeRecipient:       PUMP_PROTOCOL_FEE_RECIPIENT_BUY,
    pumpProtocolFeeRecipientAta:    PUMP_PROTOCOL_FEE_RECIPIENT_ATA_BUY,
    pumpEventAuthority:             PUMP_EVENT_AUTHORITY,
    pumpProgram:                    PUMP_PROGRAM,
    pumpCoinCreatorVaultAta:        PUMP_COIN_CREATOR_VAULT_ATA,
    pumpCoinCreatorVaultAuthority:  PUMP_COIN_CREATOR_VAULT_AUTHORITY,
    pumpGlobalVolumeAccumulator:    PUMP_GLOBAL_VOLUME_ACCUMULATOR,
    pumpUserVolumeAccumulator:      userVolumeAcc,
    pumpFeeConfig:                  PUMP_FEE_CONFIG,
    pumpFeeProgram:                 PUMP_FEE_PROGRAM,
    pumpExtraAccountA:              userVolumeAccWsolAta,  // #24 W — WSOL ATA of UVA
    pumpExtraAccountB:              PUMP_STATIC_ACCOUNT,   // #25 readonly (mapped to extra_account_b slot)
    pumpStaticAccount:              PUMP_STATIC_ACCOUNT,
  };
}

/**
 * Assembles all PumpFun accounts needed for a sell (LIA → WSOL) CPI.
 * @param userVolumeAcc  - user_volume_accumulator PDA (seeds: ["user_volume_accumulator", user])
 * @param userVolumeAccWsolAta - WSOL ATA owned by the user_volume_accumulator PDA
 */
export function pumpFunSellAccounts(
  userVolumeAcc: PublicKey,
  userVolumeAccWsolAta: PublicKey,
): PumpFunSwapAccounts {
  return {
    pumpPool:                       PUMP_POOL,
    pumpGlobalConfig:               PUMP_GLOBAL_CONFIG,
    pumpPoolBaseVault:              PUMP_POOL_BASE_VAULT,
    pumpPoolQuoteVault:             PUMP_POOL_QUOTE_VAULT,
    pumpProtocolFeeRecipient:       PUMP_PROTOCOL_FEE_RECIPIENT_SELL,
    pumpProtocolFeeRecipientAta:    PUMP_PROTOCOL_FEE_RECIPIENT_ATA_SELL,
    pumpEventAuthority:             PUMP_EVENT_AUTHORITY,
    pumpProgram:                    PUMP_PROGRAM,
    pumpCoinCreatorVaultAta:        PUMP_COIN_CREATOR_VAULT_ATA,
    pumpCoinCreatorVaultAuthority:  PUMP_COIN_CREATOR_VAULT_AUTHORITY,
    pumpGlobalVolumeAccumulator:    PUMP_GLOBAL_VOLUME_ACCUMULATOR,
    pumpUserVolumeAccumulator:      userVolumeAcc,
    pumpFeeConfig:                  PUMP_FEE_CONFIG,
    pumpFeeProgram:                 PUMP_FEE_PROGRAM,
    pumpExtraAccountA:              userVolumeAccWsolAta,  // #22 W — WSOL ATA of UVA
    pumpExtraAccountB:              userVolumeAcc,         // #23 W — UVA PDA itself
    pumpStaticAccount:              PUMP_STATIC_ACCOUNT,
  };
}
