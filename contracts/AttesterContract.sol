// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AttesterContract is Ownable {
    
    struct AadhaarCard {
        uint256 aadhaarHash;        // Poseidon hash of Aadhaar data
        uint256 issueTimestamp;     // When card was issued
        bool isActive;              // Whether card is still valid
        string cardId;              // Unique card identifier
    }
    
    // Mapping from user address to their Aadhaar card
    mapping(address => AadhaarCard) public aadhaarCards;
    
    // Mapping from card ID to user address
    mapping(string => address) public cardToUser;
    
    // Events
    event AadhaarCardIssued(
        address indexed user, 
        string cardId, 
        uint256 aadhaarHash
    );
    
    event AadhaarCardRevoked(address indexed user, string cardId);
    
    constructor() Ownable() {}
    
    /**
     * @dev Issues a new Aadhaar card to a user
     * @param user The user's wallet address
     * @param cardId Unique identifier for the card
     * @param aadhaarHash Poseidon hash of Aadhaar data + salt
     */
    function issueAadhaarCard(
        address user,
        string memory cardId,
        uint256 aadhaarHash
    ) external onlyOwner {
        require(bytes(cardId).length > 0, "Card ID cannot be empty");
        require(aadhaarHash != 0, "Invalid Aadhaar hash");
        require(!aadhaarCards[user].isActive, "User already has active card");
        require(cardToUser[cardId] == address(0), "Card ID already exists");
        
        aadhaarCards[user] = AadhaarCard({
            aadhaarHash: aadhaarHash,
            issueTimestamp: block.timestamp,
            isActive: true,
            cardId: cardId
        });
        
        cardToUser[cardId] = user;
        
        emit AadhaarCardIssued(user, cardId, aadhaarHash);
    }
    
    /**
     * @dev Revokes an Aadhaar card
     * @param user The user whose card to revoke
     */
    function revokeAadhaarCard(address user) external onlyOwner {
        require(aadhaarCards[user].isActive, "User has no active card");
        
        string memory cardId = aadhaarCards[user].cardId;
        aadhaarCards[user].isActive = false;
        delete cardToUser[cardId];
        
        emit AadhaarCardRevoked(user, cardId);
    }
    
    /**
     * @dev Gets user's Aadhaar hash for verification
     * @param user The user's address
     * @return The Aadhaar hash
     */
    function getAadhaarHash(address user) external view returns (uint256) {
        require(aadhaarCards[user].isActive, "User has no active Aadhaar card");
        return aadhaarCards[user].aadhaarHash;
    }
    
    /**
     * @dev Checks if user has valid Aadhaar card
     * @param user The user's address
     * @return Whether user has valid card
     */
    function hasValidCard(address user) external view returns (bool) {
        return aadhaarCards[user].isActive;
    }
    
    /**
     * @dev Gets card details for a user
     * @param user The user's address
     * @return AadhaarCard struct
     */
    function getCardDetails(address user) external view returns (AadhaarCard memory) {
        require(aadhaarCards[user].isActive, "User has no active card");
        return aadhaarCards[user];
    }
    
}