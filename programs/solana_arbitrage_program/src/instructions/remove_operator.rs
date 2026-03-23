use anchor_lang::prelude::*;
use crate::errors::ArbError;
use crate::state::{Config, Operator};

#[derive(Accounts)]
#[instruction(operator_pubkey: Pubkey)]
pub struct RemoveOperator<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
        constraint = config.admin == admin.key() @ ArbError::NotAdmin,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        close = admin,
        seeds = [Operator::SEED, operator_pubkey.as_ref()],
        bump = operator.bump,
    )]
    pub operator: Account<'info, Operator>,
}

impl<'info> RemoveOperator<'info> {
    pub fn process(_ctx: Context<RemoveOperator>, _operator_pubkey: Pubkey) -> Result<()> {
        Ok(())
    }
}
