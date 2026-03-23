use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};

// Instruction discriminators from official PumpFun IDL
const BUY_DISCRIMINATOR: [u8; 8] = [198, 46, 21, 82, 180, 217, 232, 112];
const SELL_DISCRIMINATOR: [u8; 8] = [51, 230, 133, 164, 1, 127, 131, 173];

// All accounts needed for PumpFun buy/sell CPIs
// Verified against mainnet transactions on Solscan
pub struct PumpFunAccounts<'info> {
    // Shared accounts (same position in buy and sell)
    pub pool: AccountInfo<'info>,                         // #1  W
    pub user: AccountInfo<'info>,                         // #2  W S
    pub global_config: AccountInfo<'info>,                // #3  W(sell) / R(buy)
    pub base_mint: AccountInfo<'info>,                    // #4
    pub quote_mint: AccountInfo<'info>,                   // #5
    pub user_base_ata: AccountInfo<'info>,                // #6  W
    pub user_quote_ata: AccountInfo<'info>,               // #7  W
    pub pool_base_vault: AccountInfo<'info>,              // #8  W
    pub pool_quote_vault: AccountInfo<'info>,             // #9  W
    pub protocol_fee_recipient: AccountInfo<'info>,       // #10
    pub protocol_fee_recipient_ata: AccountInfo<'info>,   // #11 W
    pub base_token_program: AccountInfo<'info>,           // #12 Token-2022
    pub quote_token_program: AccountInfo<'info>,          // #13 SPL Token
    pub system_program: AccountInfo<'info>,               // #14
    pub associated_token_program: AccountInfo<'info>,     // #15
    pub event_authority: AccountInfo<'info>,              // #16
    pub pump_program: AccountInfo<'info>,                 // #17
    pub coin_creator_vault_ata: AccountInfo<'info>,       // #18 W
    pub coin_creator_vault_authority: AccountInfo<'info>, // #19
    // Buy-specific order: global_vol_acc, user_vol_acc, fee_config, fee_program
    // Sell-specific order: fee_config, fee_program (no vol accumulators before fee)
    pub global_volume_accumulator: AccountInfo<'info>,    // W (buy: #20, sell: after fee)
    pub user_volume_accumulator: AccountInfo<'info>,      // W (buy: #21, sell: after fee)
    pub fee_config: AccountInfo<'info>,                   // buy: #22, sell: #20
    pub fee_program: AccountInfo<'info>,                  // buy: #23, sell: #21
    // Extra writable account present in buy (#24) and sell (#22, #23)
    // TODO: identify exact purpose — likely per-user tracking PDAs
    pub extra_account_a: AccountInfo<'info>,              // W
    pub extra_account_b: AccountInfo<'info>,              // W (sell only, not in buy)
    // Static readonly account at the end of both buy and sell
    // Address: 5c829Q6nZGDrD7Pfv2xFh5pMigfaoUgTGbbt1Z2t1FjY
    pub static_account: AccountInfo<'info>,
}

pub fn buy<'info>(
    accounts: &PumpFunAccounts<'info>,
    amount_in: u64,    // WSOL lamports to spend
    min_base_out: u64, // minimum LIA to receive (0 = no slippage guard)
) -> Result<()> {
    // Args: spendable_quote_in: u64, min_base_amount_out: u64, track_volume: OptionBool (1 byte)
    let mut data = BUY_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_base_out.to_le_bytes());
    data.push(0); // track_volume = OptionBool::None

    invoke(
        &Instruction {
            program_id: accounts.pump_program.key(),
            accounts: buy_account_metas(accounts),
            data,
        },
        &buy_account_infos(accounts),
    )?;

    Ok(())
}

pub fn sell<'info>(
    accounts: &PumpFunAccounts<'info>,
    amount_in: u64,     // LIA amount to sell
    min_quote_out: u64, // minimum WSOL to receive (0 = no slippage guard)
) -> Result<()> {
    // Args: base_amount_in: u64, min_quote_amount_out: u64
    let mut data = SELL_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_quote_out.to_le_bytes());

    invoke(
        &Instruction {
            program_id: accounts.pump_program.key(),
            accounts: sell_account_metas(accounts),
            data,
        },
        &sell_account_infos(accounts),
    )?;

    Ok(())
}

// Buy: 25 accounts, global_config readonly, vol accumulators before fee accounts
fn buy_account_metas(accounts: &PumpFunAccounts) -> Vec<AccountMeta> {
    vec![
        AccountMeta::new(accounts.pool.key(), false),
        AccountMeta::new(accounts.user.key(), true),
        AccountMeta::new_readonly(accounts.global_config.key(), false), // readonly in buy
        AccountMeta::new_readonly(accounts.base_mint.key(), false),
        AccountMeta::new_readonly(accounts.quote_mint.key(), false),
        AccountMeta::new(accounts.user_base_ata.key(), false),
        AccountMeta::new(accounts.user_quote_ata.key(), false),
        AccountMeta::new(accounts.pool_base_vault.key(), false),
        AccountMeta::new(accounts.pool_quote_vault.key(), false),
        AccountMeta::new_readonly(accounts.protocol_fee_recipient.key(), false),
        AccountMeta::new(accounts.protocol_fee_recipient_ata.key(), false),
        AccountMeta::new_readonly(accounts.base_token_program.key(), false),
        AccountMeta::new_readonly(accounts.quote_token_program.key(), false),
        AccountMeta::new_readonly(accounts.system_program.key(), false),
        AccountMeta::new_readonly(accounts.associated_token_program.key(), false),
        AccountMeta::new_readonly(accounts.event_authority.key(), false),
        AccountMeta::new_readonly(accounts.pump_program.key(), false),
        AccountMeta::new(accounts.coin_creator_vault_ata.key(), false),
        AccountMeta::new_readonly(accounts.coin_creator_vault_authority.key(), false),
        AccountMeta::new(accounts.global_volume_accumulator.key(), false), // #20 in buy
        AccountMeta::new(accounts.user_volume_accumulator.key(), false),   // #21 in buy
        AccountMeta::new_readonly(accounts.fee_config.key(), false),       // #22 in buy
        AccountMeta::new_readonly(accounts.fee_program.key(), false),      // #23 in buy
        AccountMeta::new(accounts.extra_account_a.key(), false),           // #24 W
        AccountMeta::new_readonly(accounts.static_account.key(), false),   // #25
    ]
}

// Sell: 24 accounts, global_config writable, fee accounts before vol accumulators
fn sell_account_metas(accounts: &PumpFunAccounts) -> Vec<AccountMeta> {
    vec![
        AccountMeta::new(accounts.pool.key(), false),
        AccountMeta::new(accounts.user.key(), true),
        AccountMeta::new(accounts.global_config.key(), false), // writable in sell
        AccountMeta::new_readonly(accounts.base_mint.key(), false),
        AccountMeta::new_readonly(accounts.quote_mint.key(), false),
        AccountMeta::new(accounts.user_base_ata.key(), false),
        AccountMeta::new(accounts.user_quote_ata.key(), false),
        AccountMeta::new(accounts.pool_base_vault.key(), false),
        AccountMeta::new(accounts.pool_quote_vault.key(), false),
        AccountMeta::new_readonly(accounts.protocol_fee_recipient.key(), false),
        AccountMeta::new(accounts.protocol_fee_recipient_ata.key(), false),
        AccountMeta::new_readonly(accounts.base_token_program.key(), false),
        AccountMeta::new_readonly(accounts.quote_token_program.key(), false),
        AccountMeta::new_readonly(accounts.system_program.key(), false),
        AccountMeta::new_readonly(accounts.associated_token_program.key(), false),
        AccountMeta::new_readonly(accounts.event_authority.key(), false),
        AccountMeta::new_readonly(accounts.pump_program.key(), false),
        AccountMeta::new(accounts.coin_creator_vault_ata.key(), false),
        AccountMeta::new_readonly(accounts.coin_creator_vault_authority.key(), false),
        AccountMeta::new_readonly(accounts.fee_config.key(), false),       // #20 in sell
        AccountMeta::new_readonly(accounts.fee_program.key(), false),      // #21 in sell
        AccountMeta::new(accounts.extra_account_a.key(), false),           // #22 W
        AccountMeta::new(accounts.extra_account_b.key(), false),           // #23 W
        AccountMeta::new_readonly(accounts.static_account.key(), false),   // #24
    ]
}

fn buy_account_infos<'info>(accounts: &PumpFunAccounts<'info>) -> Vec<AccountInfo<'info>> {
    vec![
        accounts.pool.clone(),
        accounts.user.clone(),
        accounts.global_config.clone(),
        accounts.base_mint.clone(),
        accounts.quote_mint.clone(),
        accounts.user_base_ata.clone(),
        accounts.user_quote_ata.clone(),
        accounts.pool_base_vault.clone(),
        accounts.pool_quote_vault.clone(),
        accounts.protocol_fee_recipient.clone(),
        accounts.protocol_fee_recipient_ata.clone(),
        accounts.base_token_program.clone(),
        accounts.quote_token_program.clone(),
        accounts.system_program.clone(),
        accounts.associated_token_program.clone(),
        accounts.event_authority.clone(),
        accounts.pump_program.clone(),
        accounts.coin_creator_vault_ata.clone(),
        accounts.coin_creator_vault_authority.clone(),
        accounts.global_volume_accumulator.clone(),
        accounts.user_volume_accumulator.clone(),
        accounts.fee_config.clone(),
        accounts.fee_program.clone(),
        accounts.extra_account_a.clone(),
        accounts.static_account.clone(),
    ]
}

fn sell_account_infos<'info>(accounts: &PumpFunAccounts<'info>) -> Vec<AccountInfo<'info>> {
    vec![
        accounts.pool.clone(),
        accounts.user.clone(),
        accounts.global_config.clone(),
        accounts.base_mint.clone(),
        accounts.quote_mint.clone(),
        accounts.user_base_ata.clone(),
        accounts.user_quote_ata.clone(),
        accounts.pool_base_vault.clone(),
        accounts.pool_quote_vault.clone(),
        accounts.protocol_fee_recipient.clone(),
        accounts.protocol_fee_recipient_ata.clone(),
        accounts.base_token_program.clone(),
        accounts.quote_token_program.clone(),
        accounts.system_program.clone(),
        accounts.associated_token_program.clone(),
        accounts.event_authority.clone(),
        accounts.pump_program.clone(),
        accounts.coin_creator_vault_ata.clone(),
        accounts.coin_creator_vault_authority.clone(),
        accounts.fee_config.clone(),
        accounts.fee_program.clone(),
        accounts.extra_account_a.clone(),
        accounts.extra_account_b.clone(),
        accounts.static_account.clone(),
    ]
}
