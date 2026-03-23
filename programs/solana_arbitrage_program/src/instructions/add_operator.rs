use anchor_lang::prelude::*;
use crate::errors::ArbError;
use crate::state::{Config, Operator};

#[derive(Accounts)]
#[instruction(operator_pubkey: Pubkey)]
pub struct AddOperator<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
        constraint = config.admin == admin.key() @ ArbError::NotAdmin,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = admin,
        space = Operator::SPACE,
        seeds = [Operator::SEED, operator_pubkey.as_ref()],
        bump,
    )]
    pub operator: Account<'info, Operator>,

    pub system_program: Program<'info, System>,
}

impl<'info> AddOperator<'info> {
    pub fn process(ctx: Context<AddOperator>, operator_pubkey: Pubkey) -> Result<()> {
        let operator = &mut ctx.accounts.operator;
        operator.authority = operator_pubkey;
        operator.bump = ctx.bumps.operator;
        Ok(())
    }
}
