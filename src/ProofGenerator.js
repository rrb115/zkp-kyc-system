const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");
const { randomBytes } = require("crypto");

class ProofGenerator {
    constructor() {
        this.wasmPath = path.join(__dirname, "../circuits/build/Over18_js/Over18.wasm");
        this.zkeyPath = path.join(__dirname, "../circuits/build/Over18_final.zkey");
        this.vkeyPath = path.join(__dirname, "../circuits/build/verification_key.json");
        this.poseidon = null;
    }

    async init() {
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

    generateSecret() {
        return BigInt("0x" + randomBytes(31).toString("hex"));
    }

    generateSecretHash(secret) {
        if (!this.poseidon) throw new Error("Poseidon not initialized");
        const hash = this.poseidon([secret]);
        return this.poseidon.F.toObject(hash);
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

    async generateOver18Proof(aadhaarData, secret, requestIdentifier, verifierIdentifier) {
        try {
            const { aadhaarNumber, birthYear, birthMonth, birthDay, salt } = aadhaarData;
            const currentDate = this.getCurrentDate();

            const aadhaarHash = this.generateAadhaarHash(aadhaarNumber, birthYear, birthMonth, birthDay, salt);
            const secretHash = this.generateSecretHash(secret);

            const circuitInput = {
                // Private
                aadhaarNumber: BigInt(aadhaarNumber),
                birthYear: BigInt(birthYear),
                birthMonth: BigInt(birthMonth),
                birthDay: BigInt(birthDay),
                salt: BigInt(salt),
                secret: BigInt(secret),
                // Public
                currentYear: BigInt(currentDate.currentYear),
                currentMonth: BigInt(currentDate.currentMonth),
                currentDay: BigInt(currentDate.currentDay),
                aadhaarHash: BigInt(aadhaarHash),
                secretHash: BigInt(secretHash),
                requestIdentifier: BigInt(requestIdentifier),
                verifierIdentifier: BigInt(verifierIdentifier)
            };

            console.log("Circuit input:", circuitInput);

            const tmpDir = path.join(__dirname, "../tmp");
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
            const witnessPath = path.join(tmpDir, `witness_${aadhaarNumber}_${requestIdentifier}_${verifierIdentifier}.wtns`);

            await snarkjs.wtns.calculate(circuitInput, this.wasmPath, witnessPath);
            const { proof, publicSignals } = await snarkjs.groth16.prove(this.zkeyPath, witnessPath);

            return { proof, publicSignals, success: true };

        } catch (error) {
            console.error("Error generating proof:", error);
            return { error: error.message, success: false };
        }
    }
}

module.exports = ProofGenerator;