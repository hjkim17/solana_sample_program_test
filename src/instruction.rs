// #3. program API, (de)serializing instruction data

/// instruction.rs is responsible for decoding instruction_data so that's that we'll do next.
use solana_program::program_error::ProgramError;
use std::convert::TryInto;

use crate::error::PriceUpdateError::InvalidInstruction;

pub enum PriceUpdateInstruction {
	UpdatePrice {
		target_price: u64
	},
}
impl PriceUpdateInstruction {
	pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
		Ok(Self::UpdatePrice {
			target_price: Self::unpack_price(input)?,
		})
	}
	fn unpack_price(input: &[u8]) -> Result<u64, ProgramError> {
		let v = input
			.get(..8)
            .and_then(|slice| slice.try_into().ok())
            .map(u64::from_le_bytes)
            .ok_or(InvalidInstruction)?;
        Ok(v)
	}
}