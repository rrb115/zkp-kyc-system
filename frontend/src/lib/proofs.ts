// frontend/src/lib/proofs.ts
import * as snarkjs from 'snarkjs';
import * as circomlibjs from 'circomlibjs';
import { ethers } from 'ethers';

let poseidon: any = null;

async function getPoseidon() {
  if (!poseidon) {
    poseidon = await circomlibjs.buildPoseidon();
  }
  return poseidon;
}

// Generate cryptographically secure random values
export function generateSalt(): bigint {
  const randomBytes = ethers.randomBytes(32);
  return BigInt(ethers.hexlify(randomBytes)) % BigInt(2 ** 254); // Keep within field size
}

export function generateSecret(): bigint {
  const randomBytes = ethers.randomBytes(32);
  return BigInt(ethers.hexlify(randomBytes)) % BigInt(2 ** 254);
}

// Use Poseidon hash for compatibility with Circom circuits
export async function generateAadhaarHash(
  aadhaarNumber: bigint,
  birthYear: bigint,
  birthMonth: bigint,
  birthDay: bigint,
  salt: bigint
): Promise<bigint> {
  const poseidonHash = await getPoseidon();
  const hash = poseidonHash([aadhaarNumber, birthYear, birthMonth, birthDay, salt]);
  return poseidonHash.F.toObject(hash);
}

export async function generateSecretHash(secret: bigint): Promise<bigint> {
  const poseidonHash = await getPoseidon();
  const hash = poseidonHash([secret]);
  return poseidonHash.F.toObject(hash);
}

export async function generateStateCommitment(state: bigint, salt: bigint): Promise<bigint> {
  const poseidonHash = await getPoseidon();
  const hash = poseidonHash([state, salt]);
  return poseidonHash.F.toObject(hash);
}

// Generate nullifier hash for one-time use
export async function generateNullifierHash(
  secret: bigint,
  requestId: bigint,
  verifierAddress: string
): Promise<bigint> {
  const poseidonHash = await getPoseidon();
  const verifierBigInt = BigInt(verifierAddress);
  const hash = poseidonHash([secret, requestId, verifierBigInt]);
  return poseidonHash.F.toObject(hash);
}

export async function generateOver18Proof(inputs: any): Promise<{ proof: any, publicSignals: string[] }> {
  console.log("Generating proof with inputs:", inputs);
  
  try {
    // Calculate current date for age verification
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
    const currentDay = currentDate.getDate();
    
    const birthYear = parseInt(inputs.birthYear);
    const birthMonth = parseInt(inputs.birthMonth);
    const birthDay = parseInt(inputs.birthDay);
    
    // Calculate age more precisely
    let age = currentYear - birthYear;
    if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
      age--;
    }
    
    const isOver18 = age >= 18 ? 1 : 0;
    
    // Generate nullifier for one-time use
    const secret = BigInt(inputs.secret);
    const requestId = BigInt(inputs.requestIdentifier);
    const verifierAddress = inputs.verifierIdentifier;
    
    const nullifierHash = await generateNullifierHash(secret, requestId, verifierAddress);
    
    // For demo purposes, create mock proof structure
    // In production, this would call actual snarkjs.groth16.fullProve()
    const mockProof = {
      pi_a: [
        "0x" + (BigInt("12345678901234567890123456789012345678901234567890123456789012345678")).toString(16),
        "0x" + (BigInt("98765432109876543210987654321098765432109876543210987654321098765432")).toString(16)
      ],
      pi_b: [
        [
          "0x" + (BigInt("11111111111111111111111111111111111111111111111111111111111111111111")).toString(16),
          "0x" + (BigInt("22222222222222222222222222222222222222222222222222222222222222222222")).toString(16)
        ],
        [
          "0x" + (BigInt("33333333333333333333333333333333333333333333333333333333333333333333")).toString(16),
          "0x" + (BigInt("44444444444444444444444444444444444444444444444444444444444444444444")).toString(16)
        ]
      ],
      pi_c: [
        "0x" + (BigInt("55555555555555555555555555555555555555555555555555555555555555555555")).toString(16),
        "0x" + (BigInt("66666666666666666666666666666666666666666666666666666666666666666666")).toString(16)
      ]
    };
    
    // Public signals matching your circuit's output
    const publicSignals = [
      isOver18.toString(),                           // over18 result
      nullifierHash.toString(),                      // nullifier hash
      requestId.toString(),                          // request ID
      BigInt(verifierAddress).toString(),            // verifier address as BigInt
      inputs.aadhaarHash.toString(),                 // aadhaar hash
      inputs.secretHash.toString()                   // secret hash
    ];
    
    console.log("Generated proof with public signals:", publicSignals);
    
    return { proof: mockProof, publicSignals };
    
  } catch (error) {
    console.error("Error generating proof:", error);
    throw error;
  }
}

export function formatProofForSolidity(proof: any) {
  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]], // Note: B coordinates are swapped for Solidity
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    pC: [proof.pi_c[0], proof.pi_c[1]]
  };
}