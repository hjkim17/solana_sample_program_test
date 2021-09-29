// #5. program logic

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    program_pack::{Pack},
    pubkey::Pubkey,
};

use crate::{
    instruction::PriceUpdateInstruction,
    state::PriceLogger
};

pub struct Processor;
impl Processor {
    pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], instruction_data: &[u8]) -> ProgramResult {
        let instruction = PriceUpdateInstruction::unpack(instruction_data)?;

        match instruction {
            PriceUpdateInstruction::UpdatePrice { target_price } => {
                msg!("Instruction: Update Price");
                Self::update_price(accounts, target_price, program_id)
            }
        }
    }

    fn update_price(
    	accounts: &[AccountInfo],
    	target_price: u64,
    	program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let updater = next_account_info(account_info_iter)?;

        if !updater.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // The account must be owned by the program in order to modify its data
        if updater.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        let mut price_info = PriceLogger::unpack_unchecked(&updater.data.borrow())?;
        price_info.price = target_price;

        PriceLogger::pack(price_info, &mut updater.data.borrow_mut())?;

    	Ok(())
    }
}