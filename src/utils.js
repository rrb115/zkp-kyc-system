const { ethers } = require("hardhat");

class Utils {
    /**
     * Deploy contracts
     */
    static async deployContracts() {
        console.log("Deploying contracts...");
        
        // Deploy Attester Contract
        const AttesterContract = await ethers.getContractFactory("AttesterContract");
        const attesterContract = await AttesterContract.deploy();
        await attesterContract.waitForDeployment();
        
        console.log("AttesterContract deployed to:", await attesterContract.getAddress());
        
        // Deploy Over18 Verifier Contract
        const Over18Verifier = await ethers.getContractFactory("Over18Verifier");
        const over18Verifier = await Over18Verifier.deploy(await attesterContract.getAddress());
        await over18Verifier.waitForDeployment();
        
        console.log("Over18Verifier deployed to:", await over18Verifier.getAddress());
        
        return {
            attesterContract,
            over18Verifier
        };
    }

    /**
     * Get contract instances
     */
    static async getContracts(attesterAddress, verifierAddress) {
        const AttesterContract = await ethers.getContractFactory("AttesterContract");
        const Over18Verifier = await ethers.getContractFactory("Over18Verifier");
        
        const attesterContract = AttesterContract.attach(attesterAddress);
        const over18Verifier = Over18Verifier.attach(verifierAddress);
        
        return {
            attesterContract,
            over18Verifier
        };
    }

    /**
     * Generate mock Aadhaar data
     */
    static generateMockAadhaarData(name, isOver18 = true) {
    const currentYear = new Date().getFullYear();
    const aadhaarNumber = (Math.floor(Math.random() * 900000000000) + 100000000000).toString(); // string now
    
    let birthYear;
    if (isOver18) {
        birthYear = currentYear - 20 - Math.floor(Math.random() * 30); // 20-50 years old
    } else {
        birthYear = currentYear - 10 - Math.floor(Math.random() * 7); // 10-17 years old
    }
    
    const birthMonth = Math.floor(Math.random() * 12) + 1;
    const birthDay = Math.floor(Math.random() * 28) + 1;
    
    return {
        name,
        aadhaarNumber,  // string
        birthYear,
        birthMonth,
        birthDay
    };
}


    /**
     * Calculate age
     */
    static calculateAge(birthYear, birthMonth, birthDay) {
        const today = new Date();
        const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
        
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    /**
     * Format address for display
     */
    static formatAddress(address) {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    /**
     * Wait for transaction confirmation
     */
    static async waitForTransaction(tx, description = "Transaction") {
        console.log(`${description} hash:`, tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log(`${description} confirmed in block:`, receipt.blockNumber);
        
        return receipt;
    }

    /**
     * Convert proof format for contract
     */
    static formatProofForSolidity(proof) {
        return {
            pA: [proof.pi_a[0], proof.pi_a[1]],
            pB: [
                [proof.pi_b[0][1], proof.pi_b[0][0]],
                [proof.pi_b[1][1], proof.pi_b[1][0]]
            ],
            pC: [proof.pi_c[0], proof.pi_c[1]]
        };
    }
}

module.exports = Utils;