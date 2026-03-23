use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

use crate::state::{Config, Operator};

#[derive(Accounts)]
pub struct ExecuteArb<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [Operator::SEED, user.key().as_ref()], bump = operator.bump)]
    pub operator: Account<'info, Operator>,

    #[account(seeds = [Config::SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    /// CHECK: LIA mint (Token-2022)
    pub base_mint: UncheckedAccount<'info>,
    /// CHECK: WSOL mint
    pub quote_mint: UncheckedAccount<'info>,

    #[account(mut, token::authority = user)]
    pub user_base_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::authority = user)]
    pub user_quote_ata: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Token-2022 program
    pub base_token_program: UncheckedAccount<'info>,
    /// CHECK: SPL Token program
    pub quote_token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    /// CHECK: Associated Token program
    pub associated_token_program: UncheckedAccount<'info>,

    // ── PumpFun ──────────────────────────────────────────────────────────────
    /// CHECK: PumpFun pool
    #[account(mut)] pub pump_pool: UncheckedAccount<'info>,
    /// CHECK: PumpFun global config
    #[account(mut)] pub pump_global_config: UncheckedAccount<'info>,
    /// CHECK: pool base vault
    #[account(mut)] pub pump_pool_base_vault: UncheckedAccount<'info>,
    /// CHECK: pool quote vault
    #[account(mut)] pub pump_pool_quote_vault: UncheckedAccount<'info>,
    /// CHECK: protocol fee recipient
    pub pump_protocol_fee_recipient: UncheckedAccount<'info>,
    /// CHECK: protocol fee recipient ATA
    #[account(mut)] pub pump_protocol_fee_recipient_ata: UncheckedAccount<'info>,
    /// CHECK: PumpFun event authority PDA
    pub pump_event_authority: UncheckedAccount<'info>,
    /// CHECK: PumpFun program
    pub pump_program: UncheckedAccount<'info>,
    /// CHECK: coin creator vault ATA
    #[account(mut)] pub pump_coin_creator_vault_ata: UncheckedAccount<'info>,
    /// CHECK: coin creator vault authority PDA
    pub pump_coin_creator_vault_authority: UncheckedAccount<'info>,
    /// CHECK: global volume accumulator PDA
    #[account(mut)] pub pump_global_volume_accumulator: UncheckedAccount<'info>,
    /// CHECK: user volume accumulator PDA
    #[account(mut)] pub pump_user_volume_accumulator: UncheckedAccount<'info>,
    /// CHECK: fee config PDA
    pub pump_fee_config: UncheckedAccount<'info>,
    /// CHECK: Pump Fees program
    pub pump_fee_program: UncheckedAccount<'info>,
    /// CHECK: extra writable account A
    #[account(mut)] pub pump_extra_account_a: UncheckedAccount<'info>,
    /// CHECK: extra writable account B
    #[account(mut)] pub pump_extra_account_b: UncheckedAccount<'info>,
    /// CHECK: static readonly account
    pub pump_static_account: UncheckedAccount<'info>,

    // ── Meteora DLMM ─────────────────────────────────────────────────────────
    /// CHECK: LbPair account
    #[account(mut)] pub meteora_lb_pair: UncheckedAccount<'info>,
    /// CHECK: BinArrayBitmapExtension PDA
    pub meteora_bin_array_bitmap_extension: UncheckedAccount<'info>,
    /// CHECK: Reserve X token account (LIA vault)
    #[account(mut)] pub meteora_reserve_x: UncheckedAccount<'info>,
    /// CHECK: Reserve Y token account (WSOL vault)
    #[account(mut)] pub meteora_reserve_y: UncheckedAccount<'info>,
    /// CHECK: Oracle PDA
    #[account(mut)] pub meteora_oracle: UncheckedAccount<'info>,
    /// CHECK: Host fee recipient ATA
    #[account(mut)] pub meteora_host_fee_in: UncheckedAccount<'info>,
    /// CHECK: Event authority PDA
    pub meteora_event_authority: UncheckedAccount<'info>,
    /// CHECK: Memo program (required by swap2)
    pub meteora_memo_program: UncheckedAccount<'info>,
    /// CHECK: Meteora DLMM program
    pub meteora_program: UncheckedAccount<'info>,
    // Bin arrays via ctx.remaining_accounts
}
