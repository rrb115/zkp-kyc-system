const { ethers } = require("hardhat");

class Utils {
    /**
     * Get contract instances from deployment addresses.
     * This function is designed to be flexible and will attach to whichever
     * contract addresses are provided in the deployments object.
     * @param {object} deployments - The parsed deployments.json object.
     * @returns {object} An object containing the attached contract instances.
     */
    static async getContracts(deployments) {
        const contracts = {};

        if (deployments.attesterContract) {
            const AttesterContract = await ethers.getContractFactory("AttesterContract");
            contracts.attesterContract = AttesterContract.attach(deployments.attesterContract);
        }
        if (deployments.over18Verifier) {
            const Over18Verifier = await ethers.getContractFactory("Over18Verifier");
            contracts.over18Verifier = Over18Verifier.attach(deployments.over18Verifier);
        }
        if (deployments.stateOfResidenceVerifier) {
            const StateOfResidenceVerifier = await ethers.getContractFactory("StateOfResidenceVerifier");
            contracts.stateOfResidenceVerifier = StateOfResidenceVerifier.attach(deployments.stateOfResidenceVerifier);
        }
        
        return contracts;
    }

    /**
     * Generate mock Aadhaar data for demonstration purposes.
     * @param {string} name - The name of the user.
     * @param {boolean} isOver18 - Whether the user should be over 18.
     * @returns {object} An object with mock user data.
     */
    static generateMockAadhaarData(name, isOver18 = true) {
        const currentYear = new Date().getFullYear();
        const aadhaarNumber = (Math.floor(Math.random() * 900000000000) + 100000000000).toString();
        
        let birthYear = isOver18
            ? currentYear - 20 - Math.floor(Math.random() * 30) // 20-50 years old
            : currentYear - 10 - Math.floor(Math.random() * 7); // 10-17 years old
        
        const birthMonth = Math.floor(Math.random() * 12) + 1;
        const birthDay = Math.floor(Math.random() * 28) + 1;
        
        return {
            name,
            aadhaarNumber,
            birthYear,
            birthMonth,
            birthDay
        };
    }

    /**
     * Calculate age based on date of birth.
     * @param {number} birthYear 
     * @param {number} birthMonth 
     * @param {number} birthDay 
     * @returns {number} The calculated age.
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
     * Format an Ethereum address for concise display.
     * @param {string} address - The full Ethereum address.
     * @returns {string} The formatted address (e.g., "0x1234...5678").
     */
    static formatAddress(address) {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    /**
     * Wait for a transaction to be confirmed and log its progress.
     * @param {object} tx - The transaction object returned by ethers.
     * @param {string} description - A description of the transaction for logging.
     * @returns {object} The transaction receipt.
     */
    static async waitForTransaction(tx, description = "Transaction") {
        console.log(`${description} hash:`, tx.hash);
        const receipt = await tx.wait();
        console.log(`${description} confirmed in block:`, receipt.blockNumber);
        return receipt;
    }

    /**
     * Convert a snarkjs proof object into the format expected by the Solidity verifier contract.
     * @param {object} proof - The proof object from snarkjs.
     * @returns {object} The formatted proof with pA, pB, and pC arrays.
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