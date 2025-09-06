const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

// Simple mapping for demo purposes. In reality, these would be official codes.
const stateMapping = { "Maharashtra": 27, "Karnataka": 29, "Delhi": 7 };

async function issueAadhaarCards() {
    console.log("🏛️  Aadhaar Org: Issuing credentials with age and state data\n");
    const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployments.json'), 'utf-8'));
    const [aadhaarOrg, alice, bob, company] = await ethers.getSigners();
    const { attesterContract } = await Utils.getContracts(deployments);
    const proofGenerator = new ProofGenerator();
    await proofGenerator.init();

    // --- Alice (Over 18, Maharashtra) ---
    const aliceData = Utils.generateMockAadhaarData("Alice", true);
    aliceData.userState = stateMapping["Maharashtra"];
    aliceData.stateSalt = proofGenerator.generateSalt();
    const aliceSalt = proofGenerator.generateSalt();
    const aliceSecret = proofGenerator.generateSecret();
    const aliceAadhaarHash = proofGenerator.generateAadhaarHash(aliceData.aadhaarNumber, aliceData.birthYear, aliceData.birthMonth, aliceData.birthDay, aliceSalt);
    const aliceSecretHash = proofGenerator.generateSecretHash(aliceSecret);
    const aliceStateCommitment = proofGenerator.generateStateCommitment(aliceData.userState, aliceData.stateSalt);

    await attesterContract.issueAadhaarCard(alice.address, `AADHAAR_${aliceData.aadhaarNumber}`, aliceAadhaarHash, aliceSecretHash, aliceStateCommitment);
    console.log(`✅ Issued card for Alice (State: Maharashtra)`);

    // --- Bob (Under 18, Karnataka) ---
    const bobData = Utils.generateMockAadhaarData("Bob", false);
    bobData.userState = stateMapping["Karnataka"];
    bobData.stateSalt = proofGenerator.generateSalt();
    const bobSalt = proofGenerator.generateSalt();
    const bobSecret = proofGenerator.generateSecret();
    const bobAadhaarHash = proofGenerator.generateAadhaarHash(bobData.aadhaarNumber, bobData.birthYear, bobData.birthMonth, bobData.birthDay, bobSalt);
    const bobSecretHash = proofGenerator.generateSecretHash(bobSecret);
    const bobStateCommitment = proofGenerator.generateStateCommitment(bobData.userState, bobData.stateSalt);

    await attesterContract.issueAadhaarCard(bob.address, `AADHAAR_${bobData.aadhaarNumber}`, bobAadhaarHash, bobSecretHash, bobStateCommitment);
    console.log(`✅ Issued card for Bob (State: Karnataka)`);

    // Save user data
    const userData = {
        alice: { address: alice.address, ...aliceData, salt: aliceSalt.toString(), secret: aliceSecret.toString() },
        bob: { address: bob.address, ...bobData, salt: bobSalt.toString(), secret: bobSecret.toString() },
        company: { address: company.address },
        stateMapping
    };
    fs.writeFileSync(path.join(__dirname, '../userData.json'), JSON.stringify(userData, null, 2));
    console.log("\n📄 User data saved to userData.json");
}

if (require.main === module) {
    issueAadhaarCards().catch(console.error);
}