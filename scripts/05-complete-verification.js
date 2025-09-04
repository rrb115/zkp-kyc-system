
const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function completeVerifications() {
    console.log("👤 Users: Completing Age Verifications with ZK Proofs\n");

    try {
        // Load all data
        const deploymentsPath = path.join(__dirname, '../deployments.json');
        const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));
        
        const userDataPath = path.join(__dirname, '../userData.json');
        const userData = JSON.parse(fs.readFileSync(userDataPath, 'utf-8'));
        
        const requestDataPath = path.join(__dirname, '../requestData.json');
        const requestData = JSON.parse(fs.readFileSync(requestDataPath, 'utf-8'));

        const [aadhaarOrg, alice, bob, company] = await ethers.getSigners();
        
        // Get contract instances
        const { over18Verifier } = await Utils.getContracts(
            deployments.attesterContract,
            deployments.over18Verifier
        );

        // Instantiate the proof generator
        const proofGenerator = new ProofGenerator();
        
        // Initialize the generator ONCE to load cryptographic components
        console.log("🛠️  Initializing proof generator...");
        await proofGenerator.init();
        console.log("✅ Proof generator initialized.");

        // Alice completes verification
        console.log("\n👤 Alice generating ZK proof for age verification...");
        console.log(`   Request ID: ${requestData.alice.requestId}`);
        
        const aliceAadhaarData = {
            aadhaarNumber: userData.alice.aadhaarNumber,
            birthYear: userData.alice.birthYear,
            birthMonth: userData.alice.birthMonth,
            birthDay: userData.alice.birthDay,
            salt: userData.alice.salt
        };

        console.log("🔐 Generating Alice's proof...");
        const aliceProofResult = await proofGenerator.generateOver18Proof(aliceAadhaarData);
        
        if (!aliceProofResult.success) {
            throw new Error(`Alice proof generation failed: ${aliceProofResult.error}`);
        }

        console.log("✅ Alice's proof generated successfully");
        console.log(`   Is Over 18: ${aliceProofResult.publicSignals[0] === '1'}`);
        
        // Format proof for contract
        // const aliceFormattedProof = Utils.formatProofForSolidity(aliceProofResult.proof);
        
        // // Submit Alice's proof
        // console.log("📤 Submitting Alice's proof to contract...");
        // const aliceCompleteTx = await over18Verifier.connect(alice).completeVerification(
        //     requestData.alice.requestId,
        //     aliceFormattedProof.pA,
        //     aliceFormattedProof.pB,
        //     aliceFormattedProof.pC,
        //     aliceProofResult.publicSignals
        // );

        const aliceFormattedProof = Utils.formatProofForSolidity(aliceProofResult.proof);
//const alicePublicSignals = aliceProofResult.publicSignals.map(x => x.toString());

const alicePublicSignals = [
    aliceProofResult.publicSignals[0], // isOver18
    aliceProofResult.publicSignals[1], // currentYear
    aliceProofResult.publicSignals[2], // currentMonth
    aliceProofResult.publicSignals[4]  // aadhaarHash (skip currentDay)
].map(x => x.toString());


const aliceCompleteTx = await over18Verifier.connect(alice).completeVerification(
    requestData.alice.requestId,
    aliceFormattedProof.pA,
    aliceFormattedProof.pB,
    aliceFormattedProof.pC,
    alicePublicSignals
);

await Utils.waitForTransaction(aliceCompleteTx, "Alice verification completion");

        
        await Utils.waitForTransaction(aliceCompleteTx, "Alice verification completion");

        // Bob completes verification
        console.log("\n👤 Bob generating ZK proof for age verification...");
        console.log(`   Request ID: ${requestData.bob.requestId}`);
        
        const bobAadhaarData = {
            aadhaarNumber: userData.bob.aadhaarNumber,
            birthYear: userData.bob.birthYear,
            birthMonth: userData.bob.birthMonth,
            birthDay: userData.bob.birthDay,
            salt: userData.bob.salt
        };

        console.log("🔐 Generating Bob's proof...");
        const bobProofResult = await proofGenerator.generateOver18Proof(bobAadhaarData);
        
        if (!bobProofResult.success) {
            throw new Error(`Bob proof generation failed: ${bobProofResult.error}`);
        }

        console.log("✅ Bob's proof generated successfully");
        console.log(`   Is Over 18: ${bobProofResult.publicSignals[0] === '1'}`);
        
        // Format proof for contract
        // const bobFormattedProof = Utils.formatProofForSolidity(bobProofResult.proof);
        
        // // Submit Bob's proof
        // console.log("📤 Submitting Bob's proof to contract...");
        // const bobCompleteTx = await over18Verifier.connect(bob).completeVerification(
        //     requestData.bob.requestId,
        //     bobFormattedProof.pA,
        //     bobFormattedProof.pB,
        //     bobFormattedProof.pC,
        //     bobProofResult.publicSignals
        // );

        const bobFormattedProof = Utils.formatProofForSolidity(bobProofResult.proof);
//const bobPublicSignals = bobProofResult.publicSignals.map(x => x.toString());


const bobPublicSignals = [
    bobProofResult.publicSignals[0], // isOver18
    bobProofResult.publicSignals[1], // currentYear
    bobProofResult.publicSignals[2], // currentMonth
    bobProofResult.publicSignals[4]  // aadhaarHash (skip currentDay)
].map(x => x.toString());



const bobCompleteTx = await over18Verifier.connect(bob).completeVerification(
    requestData.bob.requestId,
    bobFormattedProof.pA,
    bobFormattedProof.pB,
    bobFormattedProof.pC,
    bobPublicSignals
);

await Utils.waitForTransaction(bobCompleteTx, "Bob verification completion");

        
        await Utils.waitForTransaction(bobCompleteTx, "Bob verification completion");

        // Check verification results
        console.log("\n🔍 Checking verification results...");
        
        const [aliceCompleted, aliceResult] = await over18Verifier.connect(company).getVerificationResult(requestData.alice.requestId);
        console.log(`Alice's verification: ${aliceCompleted ? 'Completed' : 'Pending'}, Result: ${aliceResult ? 'Over 18' : 'Under 18'}`);
        
        const [bobCompleted, bobResult] = await over18Verifier.connect(company).getVerificationResult(requestData.bob.requestId);
        console.log(`Bob's verification: ${bobCompleted ? 'Completed' : 'Pending'}, Result: ${bobResult ? 'Over 18' : 'Under 18'}`);

        console.log("\n🎉 All verifications completed successfully!");

    } catch (error) {
        console.error("❌ Error completing verifications:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    completeVerifications().catch(console.error);
}

module.exports = { completeVerifications };