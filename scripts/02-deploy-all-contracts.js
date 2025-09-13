const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployAllContracts() {
    console.log("🚀 Deploying all contracts...\n");
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    try {
        // --- Deploy Attester Contract (Central Authority) ---
        console.log("✅ Deploying AttesterContract...");
        const AttesterContract = await ethers.getContractFactory("AttesterContract");
        const attesterContract = await AttesterContract.deploy();
        await attesterContract.waitForDeployment();
        const attesterAddress = await attesterContract.getAddress();
        console.log("   -> AttesterContract deployed to:", attesterAddress);

        // --- Deploy Over18 System ---
        console.log("\n✅ Deploying Over18 System...");
        const Over18Groth16 = await ethers.getContractFactory("Groth16Verifier");
        const over18Groth16 = await Over18Groth16.deploy();
        await over18Groth16.waitForDeployment();
        const over18Groth16Address = await over18Groth16.getAddress();
        
        const Over18Verifier = await ethers.getContractFactory("Over18Verifier");
        const over18Verifier = await Over18Verifier.deploy(attesterAddress, over18Groth16Address);
        await over18Verifier.waitForDeployment();
        const over18ContractAddress = await over18Verifier.getAddress();
        console.log("   -> Over18Verifier deployed to:", over18ContractAddress);

        // --- Deploy StateOfResidence System ---
        console.log("\n✅ Deploying StateOfResidence System...");
        const StateOfResidenceGroth16Verifier = await ethers.getContractFactory("StateOfResidenceGroth16Verifier");
        const stateGroth16 = await StateOfResidenceGroth16Verifier.deploy();
        await stateGroth16.waitForDeployment();
        const stateGroth16Address = await stateGroth16.getAddress();

        const StateOfResidenceVerifier = await ethers.getContractFactory("StateOfResidenceVerifier");
        const stateOfResidenceVerifier = await StateOfResidenceVerifier.deploy(attesterAddress, stateGroth16Address);
        await stateOfResidenceVerifier.waitForDeployment();
        const stateContractAddress = await stateOfResidenceVerifier.getAddress();
        console.log("   -> StateOfResidenceVerifier deployed to:", stateContractAddress);

        // --- Save Deployment Info ---
        const deploymentData = {
            attesterContract: attesterAddress,
            over18Verifier: over18ContractAddress,
            stateOfResidenceVerifier: stateContractAddress,
            deployer: deployer.address,
            network: await ethers.provider.getNetwork(),
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(path.join(__dirname, '../deployments.json'), JSON.stringify(deploymentData, null, 2));
        console.log("\n📄 Deployment info saved to deployments.json");
        console.log("\n🎉 All contracts deployed successfully!");

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    deployAllContracts().catch(console.error);
}