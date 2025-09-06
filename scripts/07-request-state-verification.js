const { ethers } = require("hardhat");
const Utils = require("../src/utils");
const fs = require("fs");
const path = require("path");

async function requestStateVerifications() {
    console.log("🏢 Company: Requesting State of Residence Verifications\n");
    const deployments = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployments.json'), 'utf-8'));
    const userData = JSON.parse(fs.readFileSync(path.join(__dirname, '../userData.json'), 'utf-8'));
    const [, alice, bob, company] = await ethers.getSigners();
    
    // Correctly pass the deployments object to get the contract instance
    const { stateOfResidenceVerifier } = await Utils.getContracts(deployments);

    const verificationFee = ethers.parseEther("0.001");
    const requiredState = userData.stateMapping["Maharashtra"];

    // Request verification for Alice (should match)
    console.log(`📨 Requesting verification for Alice: Is state Maharashtra (${requiredState})?`);
    const aliceTx = await stateOfResidenceVerifier.connect(company).requestStateVerification(alice.address, requiredState, { value: verificationFee });
    const aliceReceipt = await aliceTx.wait();
    const aliceEvent = aliceReceipt.logs.find(log => { try { return stateOfResidenceVerifier.interface.parseLog(log).name === 'StateVerificationRequested'; } catch { return false; } });
    const aliceRequestId = stateOfResidenceVerifier.interface.parseLog(aliceEvent).args.requestId;
    console.log(`✅ Alice request sent. Request ID: ${aliceRequestId}`);

    // Request verification for Bob (should not match)
    console.log(`\n📨 Requesting verification for Bob: Is state Maharashtra (${requiredState})?`);
    const bobTx = await stateOfResidenceVerifier.connect(company).requestStateVerification(bob.address, requiredState, { value: verificationFee });
    const bobReceipt = await bobTx.wait();
    const bobEvent = bobReceipt.logs.find(log => { try { return stateOfResidenceVerifier.interface.parseLog(log).name === 'StateVerificationRequested'; } catch { return false; } });
    const bobRequestId = stateOfResidenceVerifier.interface.parseLog(bobEvent).args.requestId;
    console.log(`✅ Bob request sent. Request ID: ${bobRequestId}`);

    // Save request data
    const requestData = {
        alice: { requestId: aliceRequestId.toString(), requester: company.address, user: alice.address, requiredState },
        bob: { requestId: bobRequestId.toString(), requester: company.address, user: bob.address, requiredState }
    };
    fs.writeFileSync(path.join(__dirname, '../stateRequestData.json'), JSON.stringify(requestData, null, 2));
    console.log("\n📄 State request data saved to stateRequestData.json");
}

if (require.main === module) {
    requestStateVerifications().catch(console.error);
}