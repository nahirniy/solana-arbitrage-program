use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};

// anchor idl fetch LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo --provider.cluster mainnet
// swap2: Token-2022 compatible version
const SWAP2_DISCRIMINATOR: [u8; 8] = [65, 75, 63, 76, 235, 91, 91, 136];

/// All fixed accounts for Meteora DLMM `swap2` (accounts #1–#16).
/// Bin arrays go into `bin_arrays` and are appended as remaining_accounts.
pub struct MeteoraAccounts<'info> {
    pub lb_pair: AccountInfo<'info>,                      // #1  W
    pub bin_array_bitmap_extension: AccountInfo<'info>,   // #2  R
    pub reserve_x: AccountInfo<'info>,                    // #3  W  (token_x = LIA)
    pub reserve_y: AccountInfo<'info>,                    // #4  W  (token_y = WSOL)
    pub user_token_in: AccountInfo<'info>,                // #5  W
    pub user_token_out: AccountInfo<'info>,               // #6  W
    pub token_x_mint: AccountInfo<'info>,                 // #7  R  (LIA, Token-2022)
    pub token_y_mint: AccountInfo<'info>,                 // #8  R  (WSOL, SPL Token)
    pub oracle: AccountInfo<'info>,                       // #9  W
    pub host_fee_in: AccountInfo<'info>,                  // #10 W  (program ID = no host fee)
    pub user: AccountInfo<'info>,                         // #11 S
    pub token_x_program: AccountInfo<'info>,              // #12 R
    pub token_y_program: AccountInfo<'info>,              // #13 R
    pub memo_program: AccountInfo<'info>,                 // #14 R  (swap2 only)
    pub event_authority: AccountInfo<'info>,              // #15 R
    pub meteora_program: AccountInfo<'info>,              // #16 R
    // bin arrays are passed separately as ctx.remaining_accounts
}

pub fn swap<'info>(
    accounts: &MeteoraAccounts<'info>,
    bin_arrays: &[AccountInfo<'info>],
    amount_in: u64,
    min_amount_out: u64,
) -> Result<()> {
    let mut data = SWAP2_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_amount_out.to_le_bytes());
    // remaining_accounts_info: RemainingAccountsInfo { slices: [
    //   { accounts_type: TransferHookX(0), length: 0 },
    //   { accounts_type: TransferHookY(1), length: 0 },
    // ]}
    data.extend_from_slice(&2u32.to_le_bytes()); // Vec len = 2
    data.push(0); // TransferHookX enum variant
    data.push(0); // length = 0
    data.push(1); // TransferHookY enum variant
    data.push(0); // length = 0

    let mut metas: Vec<AccountMeta> = vec![
        AccountMeta::new(accounts.lb_pair.key(), false),
        AccountMeta::new_readonly(accounts.bin_array_bitmap_extension.key(), false),
        AccountMeta::new(accounts.reserve_x.key(), false),
        AccountMeta::new(accounts.reserve_y.key(), false),
        AccountMeta::new(accounts.user_token_in.key(), false),
        AccountMeta::new(accounts.user_token_out.key(), false),
        AccountMeta::new_readonly(accounts.token_x_mint.key(), false),
        AccountMeta::new_readonly(accounts.token_y_mint.key(), false),
        AccountMeta::new(accounts.oracle.key(), false),
        AccountMeta::new_readonly(accounts.host_fee_in.key(), false),
        AccountMeta::new(accounts.user.key(), true),
        AccountMeta::new_readonly(accounts.token_x_program.key(), false),
        AccountMeta::new_readonly(accounts.token_y_program.key(), false),
        AccountMeta::new_readonly(accounts.memo_program.key(), false),
        AccountMeta::new_readonly(accounts.event_authority.key(), false),
        AccountMeta::new_readonly(accounts.meteora_program.key(), false),
    ];
    for ba in bin_arrays {
        metas.push(AccountMeta::new(ba.key(), false));
    }

    let mut infos: Vec<AccountInfo> = vec![
        accounts.lb_pair.clone(),
        accounts.bin_array_bitmap_extension.clone(),
        accounts.reserve_x.clone(),
        accounts.reserve_y.clone(),
        accounts.user_token_in.clone(),
        accounts.user_token_out.clone(),
        accounts.token_x_mint.clone(),
        accounts.token_y_mint.clone(),
        accounts.oracle.clone(),
        accounts.host_fee_in.clone(),
        accounts.user.clone(),
        accounts.token_x_program.clone(),
        accounts.token_y_program.clone(),
        accounts.memo_program.clone(),
        accounts.event_authority.clone(),
        accounts.meteora_program.clone(),
    ];
    for ba in bin_arrays {
        infos.push(ba.clone());
    }

    invoke(
        &Instruction {
            program_id: accounts.meteora_program.key(),
            accounts: metas,
            data,
        },
        &infos,
    )?;

    Ok(())
}
