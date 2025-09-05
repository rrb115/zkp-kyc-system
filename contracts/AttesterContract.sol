// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AttesterContract is Ownable {
    
    struct AadhaarCard {
        uint256 aadhaarHash;
        uint256 secretHash;
        uint256 issueTimestamp;
        bool isActive;
        string cardId;
    }
    
    mapping(address => AadhaarCard) public aadhaarCards;
    mapping(string => address) public cardToUser;
    mapping(uint256 => bool) public isSecretHashRevoked; // Revocation list

    event AadhaarCardIssued(
        address indexed user, 
        string cardId, 
        uint256 aadhaarHash
    );
    
    event AadhaarCardRevoked(address indexed user, string cardId, uint256 secretHash);
    
    constructor() Ownable() {}
    
    function issueAadhaarCard(
        address user,
        string memory cardId,
        uint256 aadhaarHash,
        uint256 secretHash
    ) external onlyOwner {
        require(bytes(cardId).length > 0, "Card ID cannot be empty");
        require(aadhaarHash != 0, "Invalid Aadhaar hash");
        require(secretHash != 0, "Invalid secret hash");
        require(!aadhaarCards[user].isActive, "User already has active card");
        require(cardToUser[cardId] == address(0), "Card ID already exists");
        
        aadhaarCards[user] = AadhaarCard({
            aadhaarHash: aadhaarHash,
            secretHash: secretHash,
            issueTimestamp: block.timestamp,
            isActive: true,
            cardId: cardId
        });
        
        cardToUser[cardId] = user;
        
        emit AadhaarCardIssued(user, cardId, aadhaarHash);
    }
    
    function revokeAadhaarCard(address user) external onlyOwner {
        require(aadhaarCards[user].isActive, "User has no active card");
        
        AadhaarCard storage card = aadhaarCards[user];
        string memory cardId = card.cardId;
        uint256 secretHashToRevoke = card.secretHash;

        card.isActive = false;
        isSecretHashRevoked[secretHashToRevoke] = true; // Add to revocation list
        delete cardToUser[cardId];
        
        emit AadhaarCardRevoked(user, cardId, secretHashToRevoke);
    }
    
    function getHashes(address user) external view returns (uint256 aadhaarHash_, uint256 secretHash_) {
        require(aadhaarCards[user].isActive, "User has no active Aadhaar card");
        return (aadhaarCards[user].aadhaarHash, aadhaarCards[user].secretHash);
    }
    
    function hasValidCard(address user) external view returns (bool) {
        return aadhaarCards[user].isActive;
    }
    
    function getCardDetails(address user) external view returns (AadhaarCard memory) {
        require(aadhaarCards[user].isActive, "User has no active card");
        return aadhaarCards[user];
    }
}