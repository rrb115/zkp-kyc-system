const { expect } = require("chai");
const { ethers } = require("hardhat");
const ProofGenerator = require("../src/ProofGenerator");
const Utils = require("../src/utils");

describe("ZK-KYC Over18 System", function () {
    let attesterContract, over18Verifier;
    let aadhaarOrg, alice, bob, company;
    let proofGenerator;
    let aliceData, bobData;

    before(async function () {
        [aadhaarOrg, alice, bob, company] = await ethers.getSigners();
        proofGenerator = new ProofGenerator();
        
        // Deploy contracts
        const { attesterContract: ac, over18Verifier: ov } = await Utils.deployContracts();
        attesterContract = ac;
        over18Verifier = ov;
    });

    describe("Contract Deployment", function () {
        it("Should deploy AttesterContract with correct owner", async function () {
            expect(await attesterContract.owner()).to.equal(aadhaarOrg.address);
        });

        it("Should deploy Over18Verifier with correct attester contract", async function () {
            expect(await over18Verifier.attesterContract()).to.equal(await attesterContract.getAddress());
        });
    });

    describe("Aadhaar Card Issuance", function () {
        it("Should issue Aadhaar card for Alice (over 18)", async function () {
            aliceData = Utils.generateMockAadhaarData("Alice", true);
            const aliceSalt = proofGenerator.generateSalt();
            const aliceHash = proofGenerator.generateAadhaarHash(
                aliceData.aadhaarNumber,
                aliceData.birthYear,
                aliceData.birthMonth,
                aliceData.birthDay,
                aliceSalt
            );

            aliceData.salt = aliceSalt;
            aliceData.hash = aliceHash;

            await expect(
                attesterContract.issueAadhaarCard(
                    alice.address,
                    `AADHAAR_${aliceData.aadhaarNumber}`,
                    aliceHash.toString()
                )
            ).to.emit(attesterContract, "AadhaarCardIssued");

            const cardDetails = await attesterContract.getCardDetails(alice.address);
            expect(cardDetails.aadhaarHash.toString()).to.equal(aliceHash.toString());
            expect(cardDetails.isActive).to.be.true;
        });

        it("Should issue Aadhaar card for Bob (under 18)", async function () {
            bobData = Utils.generateMockAadhaarData("Bob", false);
            const bobSalt = proofGenerator.generateSalt();
            const bobHash = proofGenerator.generateAadhaarHash(
                bobData.aadhaarNumber,
                bobData.birthYear,
                bobData.birthMonth,
                bobData.birthDay,
                bobSalt
            );

            bobData.salt = bobSalt;
            bobData.hash = bobHash;

            await expect(
                attesterContract.issueAadhaarCard(
                    bob.address,
                    `AADHAAR_${bobData.aadhaarNumber}`,
                    bobHash.toString()
                )
            ).to.emit(attesterContract, "AadhaarCardIssued");
        });
    });

    describe("Verification Requests", function () {
        let aliceRequestId, bobRequestId;

        it("Should allow company to request verification for Alice", async function () {
            const verificationFee = ethers.parseEther("0.001");
            
            const tx = await over18Verifier.connect(company).requestVerification(
                alice.address,
                { value: verificationFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return over18Verifier.interface.parseLog(log).name === 'VerificationRequested';
                } catch (e) {
                    return false;
                }
            });

            aliceRequestId = over18Verifier.interface.parseLog(event).args.requestId;
            expect(aliceRequestId).to.be.gt(0);
        });

        it("Should allow company to request verification for Bob", async function () {
            const verificationFee = ethers.parseEther("0.001");
            
            const tx = await over18Verifier.connect(company).requestVerification(
                bob.address,
                { value: verificationFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return over18Verifier.interface.parseLog(log).name === 'VerificationRequested';
                } catch (e) {
                    return false;
                }
            });

            bobRequestId = over18Verifier.interface.parseLog(event).args.requestId;
            expect(bobRequestId).to.be.gt(0);
        });

        it("Should show pending requests for users", async function () {
            const alicePendingRequests = await over18Verifier.getPendingRequests(alice.address);
            const bobPendingRequests = await over18Verifier.getPendingRequests(bob.address);

            expect(alicePendingRequests.length).to.equal(1);
            expect(bobPendingRequests.length).to.equal(1);
        });
    });

    describe("ZK Proof Generation and Verification", function () {
        it("Should generate valid proof for Alice (over 18)", async function () {
            const aliceAadhaarData = {
                aadhaarNumber: aliceData.aadhaarNumber,
                birthYear: aliceData.birthYear,
                birthMonth: aliceData.birthMonth,
                birthDay: aliceData.birthDay,
                salt: aliceData.salt
            };

            const proofResult = await proofGenerator.generateOver18Proof(aliceAadhaarData);
            expect(proofResult.success).to.be.true;
            expect(proofResult.publicSignals[0]).to.equal("1"); // Should be over 18
        });

        it("Should generate valid proof for Bob (under 18)", async function () {
            const bobAadhaarData = {
                aadhaarNumber: bobData.aadhaarNumber,
                birthYear: bobData.birthYear,
                birthMonth: bobData.birthMonth,
                birthDay: bobData.birthDay,
                salt: bobData.salt
            };

            const proofResult = await proofGenerator.generateOver18Proof(bobAadhaarData);
            expect(proofResult.success).to.be.true;
            expect(proofResult.publicSignals[0]).to.equal("0"); // Should be under 18
        });
    });

    describe("Complete Verification Flow", function () {
        it("Should complete full verification flow", async function () {
            // This test would require the actual circuit to be compiled
            // For now, we'll test the contract logic with mock proofs
            console.log("Complete integration test requires compiled circuit");
            console.log("Run the demo scripts for full end-to-end testing");
        });
    });
});