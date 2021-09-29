// #1. registering modules

use arrayref::{
	array_mut_ref,
	array_ref,
};

use solana_program::{
    program_error::ProgramError,
    program_pack::{Pack, Sealed},
};

pub struct PriceLogger {
    pub price: u64,
}

impl Sealed for PriceLogger {}

impl Pack for PriceLogger {
	// 1 * 8 (u64) = 8
    const LEN: usize = 8;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let price = array_ref![src, 0, PriceLogger::LEN];

        Ok(PriceLogger {
            price: u64::from_le_bytes(*price),
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let price_dst = array_mut_ref![dst, 0, PriceLogger::LEN];

        let PriceLogger {
            price,
        } = self;

        *price_dst = price.to_le_bytes();
    }
}