const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployContracts() {
    console.log("🚀 Deploying contracts...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    try {
        // Deploy Attester Contract (Aadhaar Organization)
        console.log("📋 Deploying AttesterContract...");
        const AttesterContract = await ethers.getContractFactory("AttesterContract");
        const attesterContract = await AttesterContract.deploy();
        await attesterContract.waitForDeployment();
        
        const attesterAddress = await attesterContract.getAddress();
        console.log("✅ AttesterContract deployed to:", attesterAddress);

        // Deploy Over18 Verifier Contract
        console.log("\n🔍 Deploying Over18Verifier...");
        const Over18Verifier = await ethers.getContractFactory("Over18Verifier");
        const over18Verifier = await Over18Verifier.deploy(attesterAddress);
        await over18Verifier.waitForDeployment();
        
        const verifierAddress = await over18Verifier.getAddress();
        console.log("✅ Over18Verifier deployed to:", verifierAddress);

        // Save deployment addresses
        const deploymentData = {
            attesterContract: attesterAddress,
            over18Verifier: verifierAddress,
            deployer: deployer.address,
            network: await ethers.provider.getNetwork(),
            timestamp: new Date().toISOString()
        };

        const deploymentsPath = path.join(__dirname, '../deployments.json');
        fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentData, null, 2));
        
        console.log("\n📄 Deployment info saved to deployments.json");
        console.log("\n🎉 All contracts deployed successfully!");
        
        return deploymentData;

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    deployContracts()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { deployContracts };