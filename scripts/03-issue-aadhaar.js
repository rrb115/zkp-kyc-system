const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");

const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function issueAadhaarCards() {
    console.log("🏛️  Aadhaar Organization: Issuing Aadhaar Cards\n");

    try {
        // Load deployment addresses
        const deploymentsPath = path.join(__dirname, '../deployments.json');
        const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));

        const [aadhaarOrg, alice, bob, company] = await ethers.getSigners();
        
        console.log("Accounts:");
        console.log("🏛️  Aadhaar Organization:", Utils.formatAddress(aadhaarOrg.address));
        console.log("👤 Alice:", Utils.formatAddress(alice.address));
        console.log("👤 Bob:", Utils.formatAddress(bob.address));
        console.log("🏢 Company:", Utils.formatAddress(company.address));

        // Get contract instances
        const { attesterContract } = await Utils.getContracts(
            deployments.attesterContract,
            deployments.over18Verifier
        );

        const proofGenerator = new ProofGenerator();
        await proofGenerator.init();
        
        // Generate Aadhaar data for Alice (over 18)
        console.log("\n📋 Generating Aadhaar data for Alice (over 18)...");
        const aliceData = Utils.generateMockAadhaarData("Alice", true);
        const aliceSalt = proofGenerator.generateSalt();
        const aliceHash = proofGenerator.generateAadhaarHash(
            aliceData.aadhaarNumber,
            aliceData.birthYear,
            aliceData.birthMonth,
            aliceData.birthDay,
            aliceSalt
        );

        console.log("Alice's Data:");
        console.log(`  Name: ${aliceData.name}`);
        console.log(`  Aadhaar Number: ${aliceData.aadhaarNumber}`);
        console.log(`  Birth Date: ${aliceData.birthDay}/${aliceData.birthMonth}/${aliceData.birthYear}`);
        console.log(`  Age: ${Utils.calculateAge(aliceData.birthYear, aliceData.birthMonth, aliceData.birthDay)} years`);
        console.log(`  Salt: ${aliceSalt}`);
        console.log(`  Hash: ${aliceHash.toString()}`);

        // Issue Aadhaar card for Alice
        console.log("\n🎫 Issuing Aadhaar card for Alice...");
        const aliceTx = await attesterContract.issueAadhaarCard(
            alice.address,
            `AADHAAR_${aliceData.aadhaarNumber}`,
            aliceHash.toString()
        );
        await Utils.waitForTransaction(aliceTx, "Alice's Aadhaar issuance");

        // Generate Aadhaar data for Bob (under 18)
        console.log("\n📋 Generating Aadhaar data for Bob (under 18)...");
        const bobData = Utils.generateMockAadhaarData("Bob", false);
        const bobSalt = proofGenerator.generateSalt();
        const bobHash = proofGenerator.generateAadhaarHash(
            bobData.aadhaarNumber,
            bobData.birthYear,
            bobData.birthMonth,
            bobData.birthDay,
            bobSalt
        );

        console.log("Bob's Data:");
        console.log(`  Name: ${bobData.name}`);
        console.log(`  Aadhaar Number: ${bobData.aadhaarNumber}`);
        console.log(`  Birth Date: ${bobData.birthDay}/${bobData.birthMonth}/${bobData.birthYear}`);
        console.log(`  Age: ${Utils.calculateAge(bobData.birthYear, bobData.birthMonth, bobData.birthDay)} years`);
        console.log(`  Salt: ${bobSalt}`);
        console.log(`  Hash: ${bobHash.toString()}`);

        // Issue Aadhaar card for Bob
        console.log("\n🎫 Issuing Aadhaar card for Bob...");
        const bobTx = await attesterContract.issueAadhaarCard(
            bob.address,
            `AADHAAR_${bobData.aadhaarNumber}`,
            bobHash.toString()
        );
        await Utils.waitForTransaction(bobTx, "Bob's Aadhaar issuance");

        // Save user data for later use
        const userData = {
            alice: {
                address: alice.address,
                ...aliceData,
                salt: aliceSalt.toString(),
                hash: aliceHash.toString()
            },
            bob: {
                address: bob.address,
                ...bobData,
                salt: bobSalt.toString(),
                hash: bobHash.toString()
            },
            company: {
                address: company.address
            }
        };

        const userDataPath = path.join(__dirname, '../userData.json');
        fs.writeFileSync(userDataPath, JSON.stringify(userData, null, 2));

        console.log("\n📄 User data saved to userData.json");
        console.log("\n🎉 Aadhaar cards issued successfully!");

    } catch (error) {
        console.error("❌ Error issuing Aadhaar cards:", error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    issueAadhaarCards()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { issueAadhaarCards };