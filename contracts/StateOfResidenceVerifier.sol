// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity ^0.8.19;

contract StateOfResidenceVerifier {
    struct StateVerificationRequest {
        address requester;
        address user;
        uint256 requiredState;
        uint256 requestTimestamp;
        bool isCompleted;
        bool result;
        uint256 fee;
    }
    
    address public attester;
    address public groth16Verifier;
    
    mapping(uint256 => StateVerificationRequest) public stateVerificationRequests;
    mapping(address => uint256[]) public userStateRequests;
    mapping(address => uint256[]) public requesterStateRequests;
    mapping(uint256 => bool) public usedStateNullifiers;
    
    uint256 public nextStateRequestId = 1;
    uint256 public stateVerificationFee = 0.001 ether;
    
    event StateVerificationRequested(uint256 indexed requestId, address indexed requester, address indexed user, uint256 requiredState, uint256 fee);
    event StateVerificationCompleted(uint256 indexed requestId, address indexed user, bool result);
    event StateVerificationRejected(uint256 indexed requestId, address indexed user);
    
    constructor(address _attester, address _groth16Verifier) {
        attester = _attester;
        groth16Verifier = _groth16Verifier;
    }

    function requestStateVerification(address user, uint state) public payable returns (bool) {
        require(msg.value >= stateVerificationFee, "Insufficient fee");
        
        // Check if user has valid Aadhaar card through AttesterContract
        (bool success, bytes memory data) = attester.call(
            abi.encodeWithSignature("hasValidCard(address)", user)
        );
        require(success && abi.decode(data, (bool)), "User has no valid Aadhaar card");
        
        uint256 requestId = nextStateRequestId++;
        
        stateVerificationRequests[requestId] = StateVerificationRequest({
            requester: msg.sender,
            user: user,
            requiredState: state,
            requestTimestamp: block.timestamp,
            isCompleted: false,
            result: false,
            fee: msg.value
        });
        
        userStateRequests[user].push(requestId);
        requesterStateRequests[msg.sender].push(requestId);
        
        emit StateVerificationRequested(requestId, msg.sender, user, state, msg.value);
        
        return true;
    }
    
    function completeStateVerification(
        uint256 requestId,
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[7] calldata publicSignals
    ) external {
        StateVerificationRequest storage request = stateVerificationRequests[requestId];
        
        require(request.user == msg.sender, "Only user can complete");
        require(!request.isCompleted, "Already completed");
        require(block.timestamp <= request.requestTimestamp + 1 days, "Expired");

        uint256 nullifierHash = publicSignals[1];
        require(!usedStateNullifiers[nullifierHash], "Proof has already been used");
        
        // Get user's state commitment from AttesterContract
        (bool success, bytes memory data) = attester.call(
            abi.encodeWithSignature("getPublicCommitments(address)", msg.sender)
        );
        require(success, "Failed to get user commitments");
        (,, uint256 userStateCommitment) = abi.decode(data, (uint256, uint256, uint256));
        
        // Verify public signals match request and user data
        require(publicSignals[2] == request.requiredState, "Required state mismatch");
        require(publicSignals[3] == requestId, "Request ID mismatch");
        require(publicSignals[4] == uint256(uint160(request.requester)), "Verifier ID mismatch");
        require(publicSignals[5] == userStateCommitment, "State commitment mismatch");
        
        // Verify the ZK proof
        bool proofValid = StateOfResidenceGroth16Verifier(groth16Verifier).verifyProof(pA, pB, pC, publicSignals);
        require(proofValid, "Invalid ZK proof");
        
        usedStateNullifiers[nullifierHash] = true;
        request.isCompleted = true;
        request.result = (publicSignals[0] == 1); // stateMatches from circuit
        
        emit StateVerificationCompleted(requestId, msg.sender, request.result);
        
        // Reward user with 10% of the fee
        uint256 userReward = request.fee / 10;
        if (userReward > 0) {
            payable(msg.sender).transfer(userReward);
        }
    }
    
    function rejectStateVerification(uint256 requestId) external {
        StateVerificationRequest storage request = stateVerificationRequests[requestId];
        
        require(request.user == msg.sender, "Only user can reject");
        require(!request.isCompleted, "Already completed");
        
        request.isCompleted = true;
        request.result = false;
        
        emit StateVerificationRejected(requestId, msg.sender);
        
        // Refund requester
        payable(request.requester).transfer(request.fee);
    }
    
    function getStateVerificationResult(uint256 requestId) 
        external 
        view 
        returns (bool isCompleted, bool result) 
    {
        StateVerificationRequest memory request = stateVerificationRequests[requestId];
        require(
            request.requester == msg.sender || request.user == msg.sender,
            "Not authorized"
        );
        
        return (request.isCompleted, request.result);
    }
    
    function getPendingStateRequests(address user) external view returns (uint256[] memory) {
        uint256[] memory allRequests = userStateRequests[user];
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (!stateVerificationRequests[allRequests[i]].isCompleted) {
                pendingCount++;
            }
        }
        
        uint256[] memory pendingRequests = new uint256[](pendingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (!stateVerificationRequests[allRequests[i]].isCompleted) {
                pendingRequests[index] = allRequests[i];
                index++;
            }
        }
        
        return pendingRequests;
    }
    
    function setStateVerificationFee(uint256 newFee) external {
        stateVerificationFee = newFee;
    }
    
    function withdrawStateFees() external {
        payable(msg.sender).transfer(address(this).balance);
    }
}

contract StateOfResidenceGroth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 6300276138726926029815856116022077406197730658598722214400344969881887571179;
    uint256 constant deltax2 = 16942327329173459354467521158152219484272467981303747108526402042599779566718;
    uint256 constant deltay1 = 1965802880101090934137769670784838777099380392455937742547315031922222409080;
    uint256 constant deltay2 = 20390951612903145067328918359808934716487362635162468623410125716358300617242;

    
    uint256 constant IC0x = 17744756417868707395488055917777929553847246770346611829061379607723251047577;
    uint256 constant IC0y = 21156921367591067741322230147665121439261996923868421864913456209528660933487;
    
    uint256 constant IC1x = 17829317937731966915118234542987955629961839681349714952188630429350296679845;
    uint256 constant IC1y = 19531121727953577755010349947650719376235354213009607529501071285423958901742;
    
    uint256 constant IC2x = 1537324663861187782797597154026572131734532919068949812848493520344025069362;
    uint256 constant IC2y = 9250846636262396525851549135511592862181589235894099190851707080022345454097;
    
    uint256 constant IC3x = 7999716687463592365415572885845455649108334245533468374560148831744935011816;
    uint256 constant IC3y = 1167909965073464061474781201449410672156181770261002299906664796737308946356;
    
    uint256 constant IC4x = 2204920981029077691563593615017312923776919874887406435307662791255131992753;
    uint256 constant IC4y = 18536953480709550636997455735467447608798753145731933317727092327697885264022;
    
    uint256 constant IC5x = 766709202134300004347854524653271471632621847377112704866656519315434212876;
    uint256 constant IC5y = 3656944192023516700837213897501360985999249639560996712076470271150377297990;
    
    uint256 constant IC6x = 16833709686623246013506200546584564103360153762217873562531079189687023484021;
    uint256 constant IC6y = 3290929350618469149309859945373461770430315352685266798626788599702014319769;
    
    uint256 constant IC7x = 13954960952627678622431333067508070708228640780284595927942862400668634998793;
    uint256 constant IC7y = 449324799441306714509150638724627629599656198186346957581056839960285546359;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[7] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
