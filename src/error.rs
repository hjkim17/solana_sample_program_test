// #4. program specific errors

use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum PriceUpdateError {
    /// Invalid Owner
    #[error("Owner Does Not Match")]
    InvalidOwner,
    /// Invalid instruction
    #[error("Invalid Instruction")]
    InvalidInstruction,
}

impl From<PriceUpdateError> for ProgramError {
    fn from(e: PriceUpdateError) -> Self {
        ProgramError::Custom(e as u32)
    }
}