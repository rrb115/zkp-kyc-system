const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function completeStateVerifications() {
    console.log("👤 Users: Completing State Verifications with ZK Proofs\n");
    const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployments.json'), 'utf-8'));
    const userData = JSON.parse(fs.readFileSync(path.join(__dirname, '../userData.json'), 'utf-8'));
    const requestData = JSON.parse(fs.readFileSync(path.join(__dirname, '../stateRequestData.json'), 'utf-8'));
    const [, alice, bob, company] = await ethers.getSigners();
    
    // Correctly pass the deployments object to get the contract instance
    const { stateOfResidenceVerifier } = await Utils.getContracts(deployments);

    const proofGenerator = new ProofGenerator();
    await proofGenerator.init();

    // --- Alice completes verification (SUCCESS) ---
    console.log("👤 Alice generating proof for state verification...");
    const aliceStateData = { userState: userData.alice.userState, stateSalt: userData.alice.stateSalt };
    const aliceResult = await proofGenerator.generateStateProof(aliceStateData, userData.alice.secret, requestData.alice.requestId, requestData.alice.requester, requestData.alice.requiredState);
    const aliceFormattedProof = Utils.formatProofForSolidity(aliceResult.proof);
    const alicePublicSignals = aliceResult.publicSignals.map(p => p.toString());
    await stateOfResidenceVerifier.connect(alice).completeStateVerification(requestData.alice.requestId, aliceFormattedProof.pA, aliceFormattedProof.pB, aliceFormattedProof.pC, alicePublicSignals);
    console.log("✅ Alice submitted her proof.");

    // --- Bob completes verification (FAIL) ---
    console.log("\n👤 Bob generating proof for state verification...");
    const bobStateData = { userState: userData.bob.userState, stateSalt: userData.bob.stateSalt };
    const bobResult = await proofGenerator.generateStateProof(bobStateData, userData.bob.secret, requestData.bob.requestId, requestData.bob.requester, requestData.bob.requiredState);
    const bobFormattedProof = Utils.formatProofForSolidity(bobResult.proof);
    const bobPublicSignals = bobResult.publicSignals.map(p => p.toString());
    await stateOfResidenceVerifier.connect(bob).completeStateVerification(requestData.bob.requestId, bobFormattedProof.pA, bobFormattedProof.pB, bobFormattedProof.pC, bobPublicSignals);
    console.log("✅ Bob submitted his proof.");

    // --- Check results ---
    console.log("\n🔍 Company checking verification results...");
    const [aliceCompleted, aliceRes] = await stateOfResidenceVerifier.connect(company).getStateVerificationResult(requestData.alice.requestId);
    console.log(`Alice's result for Maharashtra: ${aliceRes} (Completed: ${aliceCompleted}, Expected: true)`);
    
    const [bobCompleted, bobRes] = await stateOfResidenceVerifier.connect(company).getStateVerificationResult(requestData.bob.requestId);
    console.log(`Bob's result for Maharashtra: ${bobRes} (Completed: ${bobCompleted}, Expected: false)`);
}

if (require.main === module) {
    completeStateVerifications().catch(console.error);
}