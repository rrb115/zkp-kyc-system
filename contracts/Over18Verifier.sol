// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AttesterContract.sol";
import "./Groth16Verifier.sol";

contract Over18Verifier {
    
    struct VerificationRequest {
        address requester;
        address user;
        uint256 requestTimestamp;
        bool isCompleted;
        bool result;
        uint256 fee;
    }
    
    AttesterContract public immutable attesterContract;
    Groth16Verifier public immutable groth16Verifier;
    
    mapping(uint256 => VerificationRequest) public verificationRequests;
    mapping(address => uint256[]) public userRequests;
    mapping(address => uint256[]) public requesterRequests;
    mapping(uint256 => bool) public usedNullifiers;
    
    uint256 public nextRequestId = 1;
    uint256 public verificationFee = 0.001 ether;
    
    event VerificationRequested(uint256 indexed requestId, address indexed requester, address indexed user, uint256 fee);
    event VerificationCompleted(uint256 indexed requestId, address indexed user, bool result);
    event VerificationRejected(uint256 indexed requestId, address indexed user);
    
    constructor(address _attesterContract, address _groth16Verifier) {
        attesterContract = AttesterContract(_attesterContract);
        groth16Verifier = Groth16Verifier(_groth16Verifier);
    }
    
    function requestVerification(address user) external payable returns (uint256) {
        require(msg.value >= verificationFee, "Insufficient fee");
        require(attesterContract.hasValidCard(user), "User has no valid Aadhaar card");
        
        uint256 requestId = nextRequestId++;
        
        verificationRequests[requestId] = VerificationRequest({
            requester: msg.sender,
            user: user,
            requestTimestamp: block.timestamp,
            isCompleted: false,
            result: false,
            fee: msg.value
        });
        
        userRequests[user].push(requestId);
        requesterRequests[msg.sender].push(requestId);
        
        emit VerificationRequested(requestId, msg.sender, user, msg.value);
        
        return requestId;
    }
    
    function completeVerification(
        uint256 requestId,
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[9] calldata publicSignals
    ) external {
        VerificationRequest storage request = verificationRequests[requestId];
        
        require(request.user == msg.sender, "Only user can complete");
        require(!request.isCompleted, "Already completed");
        require(block.timestamp <= request.requestTimestamp + 1 days, "Expired");

        uint256 nullifierHash = publicSignals[1];
        require(!usedNullifiers[nullifierHash], "Proof has already been used");
        
        // Call the new, correct function and ignore the last return value
        (uint256 userAadhaarHash, uint256 userSecretHash, ) = attesterContract.getPublicCommitments(msg.sender);
        
        require(!attesterContract.isSecretHashRevoked(userSecretHash), "Credential has been revoked");

        // Public signals order: [isOver18, nullifierHash, currentYear, currentMonth, currentDay, aadhaarHash, secretHash, requestIdentifier, verifierIdentifier]
        require(publicSignals[5] == userAadhaarHash, "Aadhaar hash mismatch");
        require(publicSignals[6] == userSecretHash, "Secret hash mismatch");
        require(publicSignals[7] == requestId, "Request ID mismatch");
        require(publicSignals[8] == uint256(uint160(request.requester)), "Verifier ID mismatch");
        
        bool proofValid = groth16Verifier.verifyProof(pA, pB, pC, publicSignals);
        require(proofValid, "Invalid ZK proof");
        
        usedNullifiers[nullifierHash] = true;
        request.isCompleted = true;
        request.result = (publicSignals[0] == 1);
        
        emit VerificationCompleted(requestId, msg.sender, request.result);
        
        uint256 userReward = request.fee / 10;
        if (userReward > 0) {
            payable(msg.sender).transfer(userReward);
        }
    }
    
    function rejectVerification(uint256 requestId) external {
        VerificationRequest storage request = verificationRequests[requestId];
        
        require(request.user == msg.sender, "Only user can reject");
        require(!request.isCompleted, "Already completed");
        
        request.isCompleted = true;
        request.result = false;
        
        emit VerificationRejected(requestId, msg.sender);
        
        payable(request.requester).transfer(request.fee);
    }
    
    function getVerificationResult(uint256 requestId) 
        external 
        view 
        returns (bool isCompleted, bool result) 
    {
        VerificationRequest memory request = verificationRequests[requestId];
        require(
            request.requester == msg.sender || request.user == msg.sender,
            "Not authorized"
        );
        
        return (request.isCompleted, request.result);
    }
    
    function getPendingRequests(address user) external view returns (uint256[] memory) {
        uint256[] memory allRequests = userRequests[user];
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (!verificationRequests[allRequests[i]].isCompleted) {
                pendingCount++;
            }
        }
        
        uint256[] memory pendingRequests = new uint256[](pendingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (!verificationRequests[allRequests[i]].isCompleted) {
                pendingRequests[index] = allRequests[i];
                index++;
            }
        }
        
        return pendingRequests;
    }
    
    function setVerificationFee(uint256 newFee) external {
        verificationFee = newFee;
    }
    
    function withdrawFees() external {
        payable(msg.sender).transfer(address(this).balance);
    }
}