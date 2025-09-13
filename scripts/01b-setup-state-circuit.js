const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function setupStateCircuit() {
    const circuitName = 'StateOfResidence';
    console.log(`\n--- Setting up '${circuitName}' circuit ---`);

    const buildDir = path.join(__dirname, `../circuits/build`);
    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

    const circuitPath = path.join(__dirname, `../circuits/${circuitName}.circom`);
    const r1csPath = path.join(buildDir, `${circuitName}.r1cs`);
    const wasmPath = path.join(buildDir, `${circuitName}_js/${circuitName}.wasm`);
    const zkeyFinal = path.join(buildDir, `${circuitName}_final.zkey`);
    const vkeyPath = path.join(buildDir, `verification_key_${circuitName.toLowerCase()}.json`);
    
    // CORRECTED: The generated verifier now has a unique name to avoid overwriting the main logic contract.
    const verifierPath = path.join(__dirname, `../contracts/${circuitName}Groth16Verifier.sol`);

    try {
        console.log('📦 Compiling circuit...');
        await execAsync(`circom ${circuitPath} --r1cs --wasm --sym -o ${buildDir} -l node_modules/circomlib/circuits`);
        console.log('✅ Circuit compiled successfully');

        const ptauPath = path.join(buildDir, 'powersOfTau28_hez_final_12.ptau');
        if (!fs.existsSync(ptauPath)) {
            console.log('📥 Powers of tau file not found. Please run the main setup script first.');
            process.exit(1);
        } else {
            console.log('✅ Powers of tau file found.');
        }

        console.log('🔐 Setting up trusted setup...');
        const zkeyPath0 = path.join(buildDir, `${circuitName}_0000.zkey`);
        const zkeyPath1 = path.join(buildDir, `${circuitName}_0001.zkey`);

        await execAsync(`snarkjs groth16 setup ${r1csPath} ${ptauPath} ${zkeyPath0}`);
        console.log('✅ Phase 1 setup completed');

        await execAsync(`echo "another random entropy" | snarkjs zkey contribute ${zkeyPath0} ${zkeyPath1} --name="Second contribution" -v`);
        console.log('✅ Phase 2 contribution completed');

        await execAsync(`snarkjs zkey beacon ${zkeyPath1} ${zkeyFinal} 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"`);
        console.log('✅ Final setup completed');

        await execAsync(`snarkjs zkey export verificationkey ${zkeyFinal} ${vkeyPath}`);
        console.log('✅ Verification key exported');

        // IMPORTANT: We must rename the contract inside the generated Solidity file
        await execAsync(`snarkjs zkey export solidityverifier ${zkeyFinal} ${verifierPath}`);
        let verifierSol = fs.readFileSync(verifierPath, 'utf8');
        verifierSol = verifierSol.replace(/contract Groth16Verifier/g, `contract ${circuitName}Groth16Verifier`);
        fs.writeFileSync(verifierPath, verifierSol);
        console.log(`✅ Solidity verifier generated and renamed to '${circuitName}Groth16Verifier'`);

        console.log(`\n🎉 '${circuitName}' circuit setup completed successfully!`);

    } catch (error) {
        console.error(`❌ Error during '${circuitName}' setup:`, error);
        process.exit(1);
    }
}

if (require.main === module) {
    setupStateCircuit();
}

module.exports = { setupStateCircuit };