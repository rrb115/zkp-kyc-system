pragma circom 2.0.0;

include "poseidon.circom";
include "comparators.circom";

// This circuit proves that a user's state of residence matches a required state.
// It also proves ownership of the credential and generates a one-time nullifier.
template StateOfResidence() {
    // --- Private Inputs ---
    // The user's private KYC data
    signal input userState; // The user's actual state of residence (e.g., Maharashtra = 27)
    signal input stateSalt; // A private salt to hide the userState in the commitment

    // The user's secret for nullifier generation
    signal input secret;

    // --- Public Inputs ---
    // The verifier's requirements
    signal input requiredState; // The state the verifier is checking for (e.g., 27)
    signal input requestIdentifier;
    signal input verifierIdentifier;

    // Data from the AttesterContract
    signal input stateCommitment; // A hash of the user's state and a private salt
    signal input secretHash;

    // --- Outputs ---
    signal output matchesState; // 1 if userState == requiredState, 0 otherwise
    signal output nullifierHash;

    // --- STATE COMMITMENT VERIFICATION ---
    // Prove that the private userState and stateSalt hash to the public stateCommitment.
    // This confirms the user's state is what was attested to by the authority.
    component stateHasher = Poseidon(2);
    stateHasher.inputs[0] <== userState;
    stateHasher.inputs[1] <== stateSalt;
    stateHasher.out === stateCommitment;

    // --- SECRET HASH VERIFICATION ---
    // Prove ownership of the secret corresponding to the on-chain secretHash.
    component secretHasher = Poseidon(1);
    secretHasher.inputs[0] <== secret;
    secretHasher.out === secretHash;

    // --- NULLIFIER GENERATION ---
    // Create a one-time proof identifier.
    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== requestIdentifier;
    nullifierHasher.inputs[2] <== verifierIdentifier;
    nullifierHash <== nullifierHasher.out;

    // --- PREDICATE LOGIC: STATE MATCH ---
    // Check if the user's private state is equal to the public required state.
    component stateMatcher = IsEqual();
    stateMatcher.in[0] <== userState;
    stateMatcher.in[1] <== requiredState;
    matchesState <== stateMatcher.out;
}

component main { public [requiredState, requestIdentifier, verifierIdentifier, stateCommitment, secretHash] } = StateOfResidence();