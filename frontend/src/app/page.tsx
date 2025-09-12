// frontend/src/app/page.tsx
'use client';

import { Header } from '@/components/Header';
import { StatCard } from '@/components/StatCard';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { useEthers } from '@/app/EthersProvider';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import deployments from '@/contracts/deployments.json';
import Over18VerifierABI from '@/contracts/artifacts/Over18Verifier.sol/Over18Verifier.json';
import AttesterContractABI from '@/contracts/artifacts/AttesterContract.sol/AttesterContract.json';
import { formatProofForSolidity, generateOver18Proof } from '@/lib/proofs';

export default function UserDashboard() {
  const { provider, selectedSigner } = useEthers();
  const [hasValidCard, setHasValidCard] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isProving, setIsProving] = useState<string | null>(null);
  const [proofsGenerated, setProofsGenerated] = useState(0);
  const [contractError, setContractError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (provider && selectedSigner) {
        try {
          const userAddress = await selectedSigner.getAddress();
          
          // Check if contracts exist at the addresses
          const attesterCode = await provider.getCode(deployments.attesterContract);
          const verifierCode = await provider.getCode(deployments.over18Verifier);
          
          if (attesterCode === '0x' || verifierCode === '0x') {
            setContractError('Contracts not deployed at specified addresses. Please deploy contracts first.');
            return;
          }

          const attesterContract = new ethers.Contract(deployments.attesterContract, AttesterContractABI.abi, provider);
          const verifierContract = new ethers.Contract(deployments.over18Verifier, Over18VerifierABI.abi, provider);

          // Try to call hasValidCard - use a try-catch in case the function doesn't exist
          try {
            const validCard = await attesterContract.hasValidCard(userAddress);
            setHasValidCard(validCard);
          } catch (error) {
            console.warn("hasValidCard function not available, defaulting to false");
            setHasValidCard(false);
          }

          // Try to get pending requests
          try {
            const requests = await verifierContract.getPendingRequests(userAddress);
            setPendingRequests(requests);
          } catch (error) {
            console.warn("getPendingRequests function not available, defaulting to empty array");
            setPendingRequests([]);
          }

          setContractError(null);
        } catch (error) {
          console.error("Error fetching data:", error);
          setContractError('Error connecting to contracts. Please check if they are deployed.');
        }
      }
    };
    
    const interval = setInterval(fetchData, 5000); 
    fetchData();

    return () => clearInterval(interval); 
  }, [provider, selectedSigner]);

  const handleGenerateProof = async (requestId: bigint, requesterAddress: string) => {
    if (!selectedSigner) return;
    setIsProving(requestId.toString());
    
    try {
      // For demo, we'll use sample data - in production this would be from secure storage
      const sampleUserData = {
        aadhaarNumber: "123456789012",
        birthYear: "1990", // Over 18 for demo
        birthMonth: "5",
        birthDay: "15",
        salt: "12345",
        secret: "67890"
      };
      
      // Show input dialog for demo purposes
      const userDataJson = prompt(
        "Enter your private data as JSON (or press OK to use demo data):\n" + 
        JSON.stringify(sampleUserData, null, 2)
      );
      
      if (userDataJson === null) {
        // User cancelled
        setIsProving(null);
        return;
      }
      
      const userData = userDataJson ? JSON.parse(userDataJson) : sampleUserData;
      const userAddress = await selectedSigner.getAddress();

      // Fetch commitments from contract
      console.log("Fetching user commitments from contract...");
      const attesterContract = new ethers.Contract(deployments.attesterContract, AttesterContractABI.abi, selectedSigner);
      const [aadhaarHash, secretHash] = await attesterContract.getPublicCommitments(userAddress);

      console.log("Retrieved commitments:", { aadhaarHash: aadhaarHash.toString(), secretHash: secretHash.toString() });

      // Prepare circuit inputs with proper formatting
      const circuitInputs = {
        ...userData,
        aadhaarHash: aadhaarHash.toString(),
        secretHash: secretHash.toString(),
        requestIdentifier: requestId.toString(),
        verifierIdentifier: requesterAddress,
      };

      console.log("Generating proof with inputs:", circuitInputs);
      const { proof, publicSignals } = await generateOver18Proof(circuitInputs);
      
      console.log("Generated proof:", proof);
      console.log("Generated public signals:", publicSignals);
      
      const formattedProof = formatProofForSolidity(proof);
      const verifierContract = new ethers.Contract(deployments.over18Verifier, Over18VerifierABI.abi, selectedSigner);
      
      console.log("Submitting proof to contract...");
      console.log("Formatted proof:", formattedProof);
      console.log("Public signals:", publicSignals);
      
      // Estimate gas first
      const gasEstimate = await verifierContract.completeVerification.estimateGas(
        requestId,
        formattedProof.pA,
        formattedProof.pB,
        formattedProof.pC,
        publicSignals
      );
      
      console.log("Gas estimate:", gasEstimate.toString());
      
      const tx = await verifierContract.completeVerification(
        requestId,
        formattedProof.pA,
        formattedProof.pB,
        formattedProof.pC,
        publicSignals,
        { gasLimit: gasEstimate + BigInt(100000) } // Add buffer
      );
      
      const receipt = await tx.wait();
      console.log("Proof submitted successfully! Block:", receipt.blockNumber);
      
      setProofsGenerated(prev => prev + 1);
      alert("Proof submitted successfully!");
      
      // Refresh pending requests
      const requests = await verifierContract.getPendingRequests(userAddress);
      setPendingRequests(requests);
      
    } catch (error) {
      console.error("Proof generation failed:", error);
      
      let errorMsg = "Unknown error occurred";
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      
      // Handle specific contract errors
      if (errorMsg.includes("execution reverted")) {
        errorMsg = "Contract validation failed. Check if your private data matches the issued credential.";
      } else if (errorMsg.includes("Invalid ZK proof")) {
        errorMsg = "ZK proof validation failed. Please check your private data.";
      } else if (errorMsg.includes("Proof has already been used")) {
        errorMsg = "This proof has already been submitted.";
      }
      
      alert(`Error: ${errorMsg}`);
    } finally {
      setIsProving(null);
    }
  };

  const RequestItem = ({ requestId }: { requestId: bigint }) => {
    const [requester, setRequester] = useState('Loading...');
    
    useEffect(() => {
      const getRequester = async () => {
        if (provider) {
          try {
            const verifierContract = new ethers.Contract(deployments.over18Verifier, Over18VerifierABI.abi, provider);
            const requestDetails = await verifierContract.verificationRequests(requestId);
            setRequester(requestDetails.requester);
          } catch (error) {
            console.error("Error fetching requester:", error);
            setRequester('Error loading');
          }
        }
      };
      getRequester();
    }, [requestId]);

    return (
      <li className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <p className="font-semibold text-gray-800">Age Verification Request</p>
          <p className="text-sm text-gray-600 font-mono">ID: {requestId.toString()}</p>
          <p className="text-sm text-gray-600 font-mono">From: {requester.slice(0, 10)}...</p>
        </div>
        <button
          onClick={() => handleGenerateProof(requestId, requester)}
          disabled={isProving === requestId.toString()}
          className="bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isProving === requestId.toString() ? 'Generating...' : 'Generate Proof'}
        </button>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <Header title="ZKP-KYC User Dashboard" role="User" />
      <main className="p-8">
        {/* Role Switcher */}
        <div className="mb-8">
          <RoleSwitcher />
        </div>

        {/* Contract Error Alert */}
        {contractError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-red-400">⚠️</div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Contract Connection Error</h3>
                <p className="text-sm text-red-700 mt-1">{contractError}</p>
                <p className="text-xs text-red-600 mt-1">
                  Run: <code className="bg-red-100 px-1 rounded">npm run deploy:local</code> to deploy contracts locally.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard value={hasValidCard ? 1 : 0} label="Verified Credentials" />
          <StatCard value={proofsGenerated} label="Proofs Generated" />
          <StatCard value={pendingRequests.length} label="Pending Requests" />
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Pending Verification Requests</h2>
          {!selectedSigner ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Please select an account to view pending requests</p>
            </div>
          ) : pendingRequests.length > 0 ? (
            <ul className="space-y-4">
              {pendingRequests.map((reqId) => (
                <RequestItem key={reqId.toString()} requestId={reqId} />
              ))}
            </ul>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No pending verification requests</p>
              <p className="text-sm text-gray-400 mt-2">
                {hasValidCard ? "You can receive requests from verifiers" : "You need a valid credential first"}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}