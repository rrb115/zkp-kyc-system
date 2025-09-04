const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");

class ProofGenerator {
    constructor() {
        // Paths to compiled circuit artifacts
        this.wasmPath = path.join(__dirname, "../circuits/build/Over18_js/Over18.wasm");
        this.zkeyPath = path.join(__dirname, "../circuits/build/Over18_final.zkey");
        this.vkeyPath = path.join(__dirname, "../circuits/build/verification_key.json");
        this.poseidon = null;
    }

    async init() {
        // Initialize Poseidon hash
        this.poseidon = await circomlibjs.buildPoseidon();
    }

    generateAadhaarHash(aadhaarNumber, birthYear, birthMonth, birthDay, salt) {
        if (!this.poseidon) throw new Error("Poseidon not initialized");
        const inputs = [
            BigInt(aadhaarNumber),
            BigInt(birthYear),
            BigInt(birthMonth),
            BigInt(birthDay),
            BigInt(salt)
        ];
        return this.poseidon.F.toObject(this.poseidon(inputs));
    }

    generateSalt() {
        return Math.floor(Math.random() * 1_000_000_000);
    }

    getCurrentDate() {
        const now = new Date();
        return {
            currentYear: now.getFullYear(),
            currentMonth: now.getMonth() + 1,
            currentDay: now.getDate()
        };
    }

    /**
     * Generate Over18 proof
     */
    async generateOver18Proof(aadhaarData) {
        try {
            const { aadhaarNumber, birthYear, birthMonth, birthDay, salt } = aadhaarData;

            const currentDate = this.getCurrentDate();

            // Calculate Aadhaar hash (public input)
            const aadhaarHash = this.generateAadhaarHash(
                aadhaarNumber, birthYear, birthMonth, birthDay, salt
            );

            // Prepare full circuit input (all signals, private + public)
            const circuitInput = {
                aadhaarNumber: BigInt(aadhaarNumber),
                birthYear: BigInt(birthYear),
                birthMonth: BigInt(birthMonth),
                birthDay: BigInt(birthDay),
                salt: BigInt(salt),
                currentYear: BigInt(currentDate.currentYear),
                currentMonth: BigInt(currentDate.currentMonth),
                currentDay: BigInt(currentDate.currentDay),
                aadhaarHash: BigInt(aadhaarHash)
            };

            // Log input for debugging
            console.log("Circuit input:", circuitInput);

            // Make sure tmp directory exists
            const tmpDir = path.join(__dirname, "../tmp");
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

            // Path for witness file
            const witnessPath = path.join(tmpDir, `witness_${aadhaarNumber}.wtns`);

            // Generate witness
            await snarkjs.wtns.calculate(circuitInput, this.wasmPath, witnessPath);

            // Generate proof using Groth16
            const { proof, publicSignals } = await snarkjs.groth16.prove(this.zkeyPath, witnessPath);

            return { proof, publicSignals, success: true, aadhaarHash: aadhaarHash.toString() };

        } catch (error) {
            console.error("Error generating proof:", error);
            return { error: error.message, success: false };
        }
    }

    async verifyOver18Proof(proof, publicSignals) {
        try {
            const vKey = JSON.parse(fs.readFileSync(this.vkeyPath, "utf-8"));
            const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
            return {
                isValid,
                isOver18: publicSignals[0] === "1",
                aadhaarHash: publicSignals[3]
            };
        } catch (error) {
            console.error("Error verifying proof:", error);
            return { isValid: false, error: error.message };
        }
    }

    formatProofForContract(proof) {
    return {
        pA: [proof.pi_a[0].toString(), proof.pi_a[1].toString()],
        pB: [
            [proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString()],
            [proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString()]
        ],
        pC: [proof.pi_c[0].toString(), proof.pi_c[1].toString()]
    };
}


}

module.exports = ProofGenerator;
