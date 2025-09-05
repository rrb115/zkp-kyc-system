const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function completeVerifications() {
    console.log("👤 Users: Completing Verifications with One-Time ZK Proofs\n");

    try {
        const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployments.json'), 'utf-8'));
        const userData = JSON.parse(fs.readFileSync(path.join(__dirname, '../userData.json'), 'utf-8'));
        const requestData = JSON.parse(fs.readFileSync(path.join(__dirname, '../requestData.json'), 'utf-8'));

        const [, alice, bob, company] = await ethers.getSigners();
        
        const { over18Verifier } = await Utils.getContracts(
            deployments.attesterContract,
            deployments.over18Verifier
        );

        const proofGenerator = new ProofGenerator();
        console.log("🛠️  Initializing proof generator...");
        await proofGenerator.init();
        console.log("✅ Proof generator initialized.");

        // --- Alice completes verification ---
        console.log("\n👤 Alice generating ZK proof for her request...");
        const aliceProofResult = await proofGenerator.generateOver18Proof(
            userData.alice,
            userData.alice.secret,
            requestData.alice.requestId
        );
        
        if (!aliceProofResult.success) throw new Error(`Alice proof generation failed: ${aliceProofResult.error}`);
        console.log("✅ Alice's proof generated successfully");
        
        const aliceFormattedProof = Utils.formatProofForSolidity(aliceProofResult.proof);
        const alicePublicSignals = aliceProofResult.publicSignals.map(p => p.toString());
        
        console.log("📤 Submitting Alice's proof to contract...");
        const aliceCompleteTx = await over18Verifier.connect(alice).completeVerification(
            requestData.alice.requestId,
            aliceFormattedProof.pA,
            aliceFormattedProof.pB,
            aliceFormattedProof.pC,
            alicePublicSignals
        );
        await Utils.waitForTransaction(aliceCompleteTx, "Alice verification completion");

        // --- Bob completes verification ---
        console.log("\n👤 Bob generating ZK proof for his request...");
        const bobProofResult = await proofGenerator.generateOver18Proof(
            userData.bob,
            userData.bob.secret,
            requestData.bob.requestId
        );

        if (!bobProofResult.success) throw new Error(`Bob proof generation failed: ${bobProofResult.error}`);
        console.log("✅ Bob's proof generated successfully");

        const bobFormattedProof = Utils.formatProofForSolidity(bobProofResult.proof);
        const bobPublicSignals = bobProofResult.publicSignals.map(p => p.toString());

        console.log("📤 Submitting Bob's proof to contract...");
        const bobCompleteTx = await over18Verifier.connect(bob).completeVerification(
            requestData.bob.requestId,
            bobFormattedProof.pA,
            bobFormattedProof.pB,
            bobFormattedProof.pC,
            bobPublicSignals
        );
        await Utils.waitForTransaction(bobCompleteTx, "Bob verification completion");

        // --- Check verification results ---
        console.log("\n🔍 Company checking verification results...");
        
        const [aliceCompleted, aliceResult] = await over18Verifier.connect(company).getVerificationResult(requestData.alice.requestId);
        console.log(`Alice's verification (ID ${requestData.alice.requestId}): ${aliceCompleted ? 'Completed' : 'Pending'}, Result: ${aliceResult ? 'Over 18' : 'Under 18'}`);
        
        const [bobCompleted, bobResult] = await over18Verifier.connect(company).getVerificationResult(requestData.bob.requestId);
        console.log(`Bob's verification (ID ${requestData.bob.requestId}): ${bobCompleted ? 'Completed' : 'Pending'}, Result: ${bobResult ? 'Under 18' : 'Over 18'}`);

        console.log("\n🎉 All verifications completed successfully!");

    } catch (error) {
        console.error("❌ Error completing verifications:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    completeVerifications().catch(console.error);
}