/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';
import BN = require("bn.js");

import {getPayer, getRpcUrl, createKeypairFromFile} from './utils';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer
 */
let payer: Keypair;
let logger: Keypair;

/**
 * target program id
 */
let programId: PublicKey;

/**
 * The public key of the logger account
 */
let loggerPubkey: PublicKey;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../../programs/so');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   - `npm run build:program-c`
 *   - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, process.argv[2]+'.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy programs/so/<constrct library>`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, process.argv[2]+'-keypair.json');

class PriceLogger {
  price = 0;
  constructor(fields: {price: number} | undefined = undefined) {
    if (fields) {
      this.price = fields.price;
    }
  }
}

/**
 * Borsh schema definition for PriceLogger account
 */
const PriceLoggerSchema = new Map([
  [PriceLogger, {kind: 'struct', fields: [['price', 'u64']]}],
]);

/**
 * The expected size of PriceLogger account.
 */
const LOGGER_SIZE = borsh.serialize(
  PriceLoggerSchema,
  new PriceLogger(),
).length;

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payer) {
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to fund the price logger
    fees += await connection.getMinimumBalanceForRentExemption(LOGGER_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    payer = await getPayer();
  }

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }

  console.log(
    'Using account',
    payer.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees',
  );
}

/**
 * Check if the target BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy programs/so/${process.argv[2]}.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy progams/so/' + process.argv[2] + '.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);

  // Derive the address (public key) of a price logger account from the program so that it's easy to find later.
  const LOGGER_SEED = process.argv[2];
  logger = new Keypair();
  loggerPubkey = logger.publicKey;

  // Check if the price logger account has already been created
  const priceLogger = await connection.getAccountInfo(loggerPubkey);
  if (priceLogger == null) {
    console.log(
      'Creating account',
      priceLogger.toBase58(),
      'to logging price',
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      LOGGER_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: LOGGER_SEED,
        newAccountPubkey: loggerPubkey,
        lamports,
        space: LOGGER_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
}

export async function updatePrice(price): Promise<void> {
  const instruction = new TransactionInstruction({
    programId: programId,
    keys: [
      {pubkey: loggerPubkey, isSigner: true, isWritable: true},
    ],
    data: Buffer.from(
      Uint8Array.of(...new BN(price).toArray("le", 8))
    ),
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [logger],
  );
}
