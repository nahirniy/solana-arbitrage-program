use anchor_lang::prelude::*;

use crate::cpi::meteora::{self, MeteoraAccounts};
use crate::cpi::pumpfun::{self, PumpFunAccounts};
use crate::errors::ArbError;

use super::accounts::ExecuteArb;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum DexType {
    PumpFun = 0,
    Meteora = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Route {
    pub dex: DexType,
    pub token_in: Pubkey,
    pub token_out: Pubkey,
}

impl<'info> ExecuteArb<'info> {
    pub fn process(
        ctx: Context<'_, '_, '_, 'info, ExecuteArb<'info>>,
        routes: Vec<Route>,
        amount_in: u64,
    ) -> Result<()> {
        require!(routes.len() >= 2, ArbError::RouteTooShort);
        validate_route_chain(&routes)?;

        let wsol_mint = ctx.accounts.user_quote_ata.mint;
        require!(
            routes[0].token_in == wsol_mint
                && routes[routes.len() - 1].token_out == wsol_mint,
            ArbError::InvalidRouteTokens
        );

        // TODO: re-enable profit check for production
        // let wsol_before = ctx.accounts.user_quote_ata.amount;

        let mut current_amount = if amount_in == 0 {
            ctx.accounts.user_quote_ata.amount
        } else {
            amount_in
        };

        for route in routes.iter() {
            let is_buy = route.token_in == wsol_mint;

            match route.dex {
                DexType::PumpFun => {
                    let accounts = build_pump_accounts(&ctx.accounts);
                    if is_buy {
                        pumpfun::buy(&accounts, current_amount, 1)?;
                    } else {
                        pumpfun::sell(&accounts, current_amount, 0)?;
                    }
                }
                DexType::Meteora => {
                    let accounts = build_meteora_accounts(&ctx.accounts, is_buy);
                    meteora::swap(&accounts, ctx.remaining_accounts, current_amount, 0)?;
                }
            }

            // Reload both ATAs after each CPI to get fresh balances
            ctx.accounts.user_base_ata.reload()?;
            ctx.accounts.user_quote_ata.reload()?;

            current_amount = if is_buy {
                ctx.accounts.user_base_ata.amount
            } else {
                ctx.accounts.user_quote_ata.amount
            };
        }

        // TODO: re-enable profit check for production
        // ctx.accounts.user_quote_ata.reload()?;
        // require!(ctx.accounts.user_quote_ata.amount > wsol_before, ArbError::NoProfit);

        Ok(())
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn validate_route_chain(routes: &[Route]) -> Result<()> {
    for i in 0..routes.len() - 1 {
        require!(routes[i].token_out == routes[i + 1].token_in, ArbError::InvalidRoute);
    }
    Ok(())
}

fn build_pump_accounts<'info>(ctx: &ExecuteArb<'info>) -> PumpFunAccounts<'info> {
    PumpFunAccounts {
        pool: ctx.pump_pool.to_account_info(),
        user: ctx.user.to_account_info(),
        global_config: ctx.pump_global_config.to_account_info(),
        base_mint: ctx.base_mint.to_account_info(),
        quote_mint: ctx.quote_mint.to_account_info(),
        user_base_ata: ctx.user_base_ata.to_account_info(),
        user_quote_ata: ctx.user_quote_ata.to_account_info(),
        pool_base_vault: ctx.pump_pool_base_vault.to_account_info(),
        pool_quote_vault: ctx.pump_pool_quote_vault.to_account_info(),
        protocol_fee_recipient: ctx.pump_protocol_fee_recipient.to_account_info(),
        protocol_fee_recipient_ata: ctx.pump_protocol_fee_recipient_ata.to_account_info(),
        base_token_program: ctx.base_token_program.to_account_info(),
        quote_token_program: ctx.quote_token_program.to_account_info(),
        system_program: ctx.system_program.to_account_info(),
        associated_token_program: ctx.associated_token_program.to_account_info(),
        event_authority: ctx.pump_event_authority.to_account_info(),
        pump_program: ctx.pump_program.to_account_info(),
        coin_creator_vault_ata: ctx.pump_coin_creator_vault_ata.to_account_info(),
        coin_creator_vault_authority: ctx.pump_coin_creator_vault_authority.to_account_info(),
        global_volume_accumulator: ctx.pump_global_volume_accumulator.to_account_info(),
        user_volume_accumulator: ctx.pump_user_volume_accumulator.to_account_info(),
        fee_config: ctx.pump_fee_config.to_account_info(),
        fee_program: ctx.pump_fee_program.to_account_info(),
        extra_account_a: ctx.pump_extra_account_a.to_account_info(),
        extra_account_b: ctx.pump_extra_account_b.to_account_info(),
        static_account: ctx.pump_static_account.to_account_info(),
    }
}

fn build_meteora_accounts<'info>(ctx: &ExecuteArb<'info>, is_buy: bool) -> MeteoraAccounts<'info> {
    let (user_token_in, user_token_out) = if is_buy {
        (ctx.user_quote_ata.to_account_info(), ctx.user_base_ata.to_account_info())
    } else {
        (ctx.user_base_ata.to_account_info(), ctx.user_quote_ata.to_account_info())
    };
    MeteoraAccounts {
        lb_pair: ctx.meteora_lb_pair.to_account_info(),
        bin_array_bitmap_extension: ctx.meteora_bin_array_bitmap_extension.to_account_info(),
        reserve_x: ctx.meteora_reserve_x.to_account_info(),
        reserve_y: ctx.meteora_reserve_y.to_account_info(),
        user_token_in,
        user_token_out,
        token_x_mint: ctx.base_mint.to_account_info(),
        token_y_mint: ctx.quote_mint.to_account_info(),
        oracle: ctx.meteora_oracle.to_account_info(),
        host_fee_in: ctx.meteora_host_fee_in.to_account_info(),
        user: ctx.user.to_account_info(),
        token_x_program: ctx.base_token_program.to_account_info(),
        token_y_program: ctx.quote_token_program.to_account_info(),
        memo_program: ctx.meteora_memo_program.to_account_info(),
        event_authority: ctx.meteora_event_authority.to_account_info(),
        meteora_program: ctx.meteora_program.to_account_info(),
    }
}
