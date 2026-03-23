use anchor_lang::prelude::*;

#[error_code]
pub enum ArbError {
    #[msg("No profit: WSOL balance did not increase")]
    NoProfit,

    #[msg("Invalid route: token_out of step N must equal token_in of step N+1")]
    InvalidRoute,

    #[msg("Route must start and end with WSOL")]
    InvalidRouteTokens,

    #[msg("Route must have at least 2 steps")]
    RouteTooShort,

    #[msg("Unauthorized: signer is not an operator")]
    NotOperator,

    #[msg("Unauthorized: signer is not the admin")]
    NotAdmin,
}
