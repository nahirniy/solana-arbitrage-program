use anchor_lang::prelude::*;

use crate::cpi::meteora::{self, MeteoraAccounts};
use crate::cpi::pumpfun::{self, PumpFunAccounts};
use crate::errors::ArbError;

use super::accounts::{ExecuteMeteoraArb, ExecutePumpArb};

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

impl<'info> ExecutePumpArb<'info> {
    pub fn process(ctx: Context<ExecutePumpArb<'info>>, routes: Vec<Route>, amount_in: u64) -> Result<()> {
        require!(!routes.is_empty(), ArbError::RouteTooShort);

        for i in 0..routes.len() - 1 {
            require!(
                routes[i].token_out == routes[i + 1].token_in,
                ArbError::InvalidRoute
            );
        }

        let wsol_mint = ctx.accounts.user_quote_ata.mint;

        let is_full_arb = routes[0].token_in == wsol_mint
            && routes[routes.len() - 1].token_out == wsol_mint;

        let wsol_before = ctx.accounts.user_quote_ata.amount;
        let mut current_amount = amount_in;

        for route in routes.iter() {
            let is_buy = route.token_in == wsol_mint;
            let accounts = ctx.accounts.pump_accounts();

            if is_buy {
                pumpfun::buy(&accounts, current_amount, 1)?;
                ctx.accounts.user_base_ata.reload()?;
                current_amount = ctx.accounts.user_base_ata.amount;
            } else {
                pumpfun::sell(&accounts, current_amount, 0)?;
                ctx.accounts.user_quote_ata.reload()?;
                current_amount = ctx.accounts.user_quote_ata.amount;
            }
        }

        if is_full_arb {
            ctx.accounts.user_quote_ata.reload()?;
            require!(
                ctx.accounts.user_quote_ata.amount > wsol_before,
                ArbError::NoProfit
            );
        }

        Ok(())
    }

    fn pump_accounts(&self) -> PumpFunAccounts<'info> {
        PumpFunAccounts {
            pool: self.pump_pool.to_account_info(),
            user: self.user.to_account_info(),
            global_config: self.pump_global_config.to_account_info(),
            base_mint: self.base_mint.to_account_info(),
            quote_mint: self.quote_mint.to_account_info(),
            user_base_ata: self.user_base_ata.to_account_info(),
            user_quote_ata: self.user_quote_ata.to_account_info(),
            pool_base_vault: self.pump_pool_base_vault.to_account_info(),
            pool_quote_vault: self.pump_pool_quote_vault.to_account_info(),
            protocol_fee_recipient: self.pump_protocol_fee_recipient.to_account_info(),
            protocol_fee_recipient_ata: self.pump_protocol_fee_recipient_ata.to_account_info(),
            base_token_program: self.base_token_program.to_account_info(),
            quote_token_program: self.quote_token_program.to_account_info(),
            system_program: self.system_program.to_account_info(),
            associated_token_program: self.associated_token_program.to_account_info(),
            event_authority: self.pump_event_authority.to_account_info(),
            pump_program: self.pump_program.to_account_info(),
            coin_creator_vault_ata: self.pump_coin_creator_vault_ata.to_account_info(),
            coin_creator_vault_authority: self.pump_coin_creator_vault_authority.to_account_info(),
            global_volume_accumulator: self.pump_global_volume_accumulator.to_account_info(),
            user_volume_accumulator: self.pump_user_volume_accumulator.to_account_info(),
            fee_config: self.pump_fee_config.to_account_info(),
            fee_program: self.pump_fee_program.to_account_info(),
            extra_account_a: self.pump_extra_account_a.to_account_info(),
            extra_account_b: self.pump_extra_account_b.to_account_info(),
            static_account: self.pump_static_account.to_account_info(),
        }
    }
}

impl<'info> ExecuteMeteoraArb<'info> {
    pub fn process(ctx: Context<'_, '_, '_, 'info, ExecuteMeteoraArb<'info>>, routes: Vec<Route>, amount_in: u64) -> Result<()> {
        require!(!routes.is_empty(), ArbError::RouteTooShort);

        for i in 0..routes.len() - 1 {
            require!(
                routes[i].token_out == routes[i + 1].token_in,
                ArbError::InvalidRoute
            );
        }

        let wsol_mint = ctx.accounts.user_quote_ata.mint;

        let is_full_arb = routes[0].token_in == wsol_mint
            && routes[routes.len() - 1].token_out == wsol_mint;

        let wsol_before = ctx.accounts.user_quote_ata.amount;
        let mut current_amount = amount_in;

        for route in routes.iter() {
            let is_buy = route.token_in == wsol_mint;
            let accounts = ctx.accounts.meteora_accounts(is_buy);
            meteora::swap(&accounts, ctx.remaining_accounts, current_amount, 0)?;

            if is_buy {
                ctx.accounts.user_base_ata.reload()?;
                current_amount = ctx.accounts.user_base_ata.amount;
            } else {
                ctx.accounts.user_quote_ata.reload()?;
                current_amount = ctx.accounts.user_quote_ata.amount;
            }
        }

        if is_full_arb {
            ctx.accounts.user_quote_ata.reload()?;
            require!(
                ctx.accounts.user_quote_ata.amount > wsol_before,
                ArbError::NoProfit
            );
        }

        Ok(())
    }

    fn meteora_accounts(&self, is_buy: bool) -> MeteoraAccounts<'info> {
        // token_x = LIA (base), token_y = WSOL (quote)
        let (user_token_in, user_token_out) = if is_buy {
            (self.user_quote_ata.to_account_info(), self.user_base_ata.to_account_info())
        } else {
            (self.user_base_ata.to_account_info(), self.user_quote_ata.to_account_info())
        };
        MeteoraAccounts {
            lb_pair: self.meteora_lb_pair.to_account_info(),
            bin_array_bitmap_extension: self.meteora_bin_array_bitmap_extension.to_account_info(),
            reserve_x: self.meteora_reserve_x.to_account_info(),
            reserve_y: self.meteora_reserve_y.to_account_info(),
            user_token_in,
            user_token_out,
            token_x_mint: self.base_mint.to_account_info(),
            token_y_mint: self.quote_mint.to_account_info(),
            oracle: self.meteora_oracle.to_account_info(),
            host_fee_in: self.meteora_host_fee_in.to_account_info(),
            user: self.user.to_account_info(),
            token_x_program: self.base_token_program.to_account_info(),
            token_y_program: self.quote_token_program.to_account_info(),
            memo_program: self.meteora_memo_program.to_account_info(),
            event_authority: self.meteora_event_authority.to_account_info(),
            meteora_program: self.meteora_program.to_account_info(),
        }
    }
}
