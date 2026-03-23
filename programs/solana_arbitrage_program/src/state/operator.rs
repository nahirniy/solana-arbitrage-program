use anchor_lang::prelude::*;

#[account]
pub struct Operator {
    pub authority: Pubkey,
    pub bump: u8,
}

impl Operator {
    pub const SEED: &'static [u8] = b"operator";
    pub const SPACE: usize = 8 + 32 + 1;
}
