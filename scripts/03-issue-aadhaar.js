const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function issueAadhaarCards() {
    console.log("🏛️  Aadhaar Organization: Issuing Aadhaar Cards with Secrets\n");

    try {
        const deploymentsPath = path.join(__dirname, '../deployments.json');
        const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));

        const [aadhaarOrg, alice, bob, company] = await ethers.getSigners();
        
        const { attesterContract } = await Utils.getContracts(
            deployments.attesterContract,
            deployments.over18Verifier
        );

        const proofGenerator = new ProofGenerator();
        await proofGenerator.init();
        
        // --- Alice (over 18) ---
        console.log("\n📋 Generating data for Alice (over 18)...");
        const aliceData = Utils.generateMockAadhaarData("Alice", true);
        const aliceSalt = proofGenerator.generateSalt();
        const aliceSecret = proofGenerator.generateSecret();
        const aliceAadhaarHash = proofGenerator.generateAadhaarHash(
            aliceData.aadhaarNumber, aliceData.birthYear, aliceData.birthMonth, aliceData.birthDay, aliceSalt
        );
        const aliceSecretHash = proofGenerator.generateSecretHash(aliceSecret);

        console.log("Alice's Data:");
        console.log(`  - Hash: ${aliceAadhaarHash.toString()}`);
        console.log(`  - Secret Hash: ${aliceSecretHash.toString()}`);

        console.log("🎫 Issuing Aadhaar card for Alice...");
        const aliceTx = await attesterContract.issueAadhaarCard(
            alice.address,
            `AADHAAR_${aliceData.aadhaarNumber}`,
            aliceAadhaarHash.toString(),
            aliceSecretHash.toString()
        );
        await Utils.waitForTransaction(aliceTx, "Alice's Aadhaar issuance");

        // --- Bob (under 18) ---
        console.log("\n📋 Generating data for Bob (under 18)...");
        const bobData = Utils.generateMockAadhaarData("Bob", false);
        const bobSalt = proofGenerator.generateSalt();
        const bobSecret = proofGenerator.generateSecret();
        const bobAadhaarHash = proofGenerator.generateAadhaarHash(
            bobData.aadhaarNumber, bobData.birthYear, bobData.birthMonth, bobData.birthDay, bobSalt
        );
        const bobSecretHash = proofGenerator.generateSecretHash(bobSecret);

        console.log("Bob's Data:");
        console.log(`  - Hash: ${bobAadhaarHash.toString()}`);
        console.log(`  - Secret Hash: ${bobSecretHash.toString()}`);

        console.log("🎫 Issuing Aadhaar card for Bob...");
        const bobTx = await attesterContract.issueAadhaarCard(
            bob.address,
            `AADHAAR_${bobData.aadhaarNumber}`,
            bobAadhaarHash.toString(),
            bobSecretHash.toString()
        );
        await Utils.waitForTransaction(bobTx, "Bob's Aadhaar issuance");

        // Save user data for later use
        const userData = {
            alice: {
                address: alice.address, ...aliceData,
                salt: aliceSalt.toString(),
                secret: aliceSecret.toString(),
                hash: aliceAadhaarHash.toString(),
                secretHash: aliceSecretHash.toString()
            },
            bob: {
                address: bob.address, ...bobData,
                salt: bobSalt.toString(),
                secret: bobSecret.toString(),
                hash: bobAadhaarHash.toString(),
                secretHash: bobSecretHash.toString()
            },
            company: { address: company.address }
        };

        const userDataPath = path.join(__dirname, '../userData.json');
        fs.writeFileSync(userDataPath, JSON.stringify(userData, null, 2));

        console.log("\n📄 User data (including private secrets) saved to userData.json");
        console.log("\n🎉 Aadhaar cards issued successfully!");

    } catch (error) {
        console.error("❌ Error issuing Aadhaar cards:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    issueAadhaarCards().catch(console.error);
}