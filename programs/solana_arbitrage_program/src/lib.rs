use anchor_lang::prelude::*;

pub mod cpi;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("An3HM7PCKigYDszLj8iWYK7mWRnnnhECfM2tRZwsBFV9");

#[program]
pub mod solana_arbitrage_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Initialize::process(ctx)
    }

    pub fn add_operator(ctx: Context<AddOperator>, operator_pubkey: Pubkey) -> Result<()> {
        AddOperator::process(ctx, operator_pubkey)
    }

    pub fn remove_operator(ctx: Context<RemoveOperator>, operator_pubkey: Pubkey) -> Result<()> {
        RemoveOperator::process(ctx, operator_pubkey)
    }

    pub fn execute_pump_arb(ctx: Context<ExecutePumpArb>, routes: Vec<Route>, amount_in: u64) -> Result<()> {
        ExecutePumpArb::process(ctx, routes, amount_in)
    }

    pub fn execute_meteora_arb<'info>(ctx: Context<'_, '_, '_, 'info, ExecuteMeteoraArb<'info>>, routes: Vec<Route>, amount_in: u64) -> Result<()> {
        ExecuteMeteoraArb::process(ctx, routes, amount_in)
    }
}
