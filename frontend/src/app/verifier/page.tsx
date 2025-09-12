// frontend/src/app/verifier/page.tsx
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

export default function VerifierDashboard() {
  const { provider, selectedSigner } = useEthers();
  const [userToVerify, setUserToVerify] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [requestsSent, setRequestsSent] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [contractError, setContractError] = useState<string | null>(null);

  // Add contract validation
  useEffect(() => {
    const checkContracts = async () => {
      if (provider) {
        try {
          const attesterCode = await provider.getCode(deployments.attesterContract);
          const verifierCode = await provider.getCode(deployments.over18Verifier);
          
          if (attesterCode === '0x' || verifierCode === '0x') {
            setContractError('Contracts not deployed. Please deploy contracts first.');
          } else {
            setContractError(null);
          }
        } catch (error) {
          setContractError('Error connecting to contracts.');
        }
      }
    };
    
    checkContracts();
  }, [provider]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSigner) {
      setErrorMessage("Please select an account to act as the verifier.");
      return;
    }
    if (!ethers.isAddress(userToVerify)) {
      setErrorMessage("Please enter a valid Ethereum address.");
      return;
    }

    setIsLoading(true);
    setIsSuccess(false);
    setErrorMessage('');

    try {
      console.log("Creating verification request for:", userToVerify);
      
      // Check if contracts are deployed
      if (contractError) {
        throw new Error(contractError);
      }
      
      // First check if user has valid card
      const attesterContract = new ethers.Contract(deployments.attesterContract, AttesterContractABI.abi, provider);
      
      console.log("Checking if user has valid card...");
      const hasValidCard = await attesterContract.hasValidCard(userToVerify);
      console.log("User has valid card:", hasValidCard);
      
      if (!hasValidCard) {
        throw new Error("User does not have a valid Aadhaar credential. Please issue a credential first.");
      }

      const verifierContract = new ethers.Contract(deployments.over18Verifier, Over18VerifierABI.abi, selectedSigner);
      
      console.log("Sending verification request transaction...");
      console.log("Fee:", ethers.parseEther("0.001").toString());
      
      // Get gas estimate first to catch errors early
      const gasEstimate = await verifierContract.requestVerification.estimateGas(
        userToVerify,
        { value: ethers.parseEther("0.001") }
      );
      
      console.log("Gas estimate:", gasEstimate.toString());
      
      const tx = await verifierContract.requestVerification(userToVerify, {
        value: ethers.parseEther("0.001"),
        gasLimit: gasEstimate + BigInt(50000) // Add some buffer
      });
      
      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed in block:", receipt.blockNumber);
      
      setIsSuccess(true);
      setUserToVerify('');
      setRequestsSent(prev => prev + 1);
      
    } catch (error: any) {
      console.error("Failed to create verification request:", error);
      
      let errorMsg = "An unexpected error occurred";
      
      if (error.message.includes("User does not have a valid Aadhaar credential")) {
        errorMsg = "User does not have a valid Aadhaar credential. Please issue a credential first.";
      } else if (error.message.includes("execution reverted")) {
        errorMsg = "Transaction reverted. The user might not have a valid credential or the contract has an issue.";
      } else if (error.message) {
        errorMsg = error.message;
      } else if (error.reason) {
        errorMsg = error.reason;
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const checkResults = async () => {
    if (!selectedSigner) return;
    
    try {
      const verifierContract = new ethers.Contract(deployments.over18Verifier, Over18VerifierABI.abi, selectedSigner);
      // In a real implementation, you'd track request IDs and check their results
      console.log("Checking verification results...");
    } catch (error) {
      console.error("Error checking results:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="ZKP-KYC Verifier Dashboard" role="Verifier" />
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
                  Deploy contracts: <code className="bg-red-100 px-1 rounded">npm run deploy:local</code>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard value={requestsSent} label="Requests Sent" />
          <StatCard value={`${successRate}%`} label="Success Rate" />
          <StatCard value={0} label="Pending Verifications" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Request Form */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Create New Verification Request</h2>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label htmlFor="userAddress" className="block text-sm font-medium text-gray-700 mb-1">
                  User Address to Verify
                </label>
                <input 
                  id="userAddress"
                  type="text" 
                  placeholder="0x1234..." 
                  value={userToVerify}
                  onChange={e => setUserToVerify(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                  required 
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fee: 0.001 ETH (user receives 10% reward upon completion)
                </p>
              </div>
              
              <button 
                type="submit" 
                disabled={isLoading || !selectedSigner} 
                className="w-full bg-orange-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending Request...' : 'Request Age Verification (≥18)'}
              </button>
              
              {isSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-700 text-center font-semibold">
                    ✅ Verification request sent successfully!
                  </p>
                </div>
              )}
              
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-700 text-center font-semibold">
                    ❌ {errorMessage}
                  </p>
                </div>
              )}
            </form>
          </div>

          {/* Info Panel */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">How It Works</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <span className="font-bold text-orange-500">1.</span>
                <p>Enter the user's address and send a verification request</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-bold text-orange-500">2.</span>
                <p>System checks if user has valid Aadhaar credentials</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-bold text-orange-500">3.</span>
                <p>User generates ZK proof without revealing personal data</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-bold text-orange-500">4.</span>
                <p>You receive verification result (over 18: true/false)</p>
              </div>
            </div>
            
            <button 
              onClick={checkResults}
              className="mt-4 w-full bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
            >
              Check Results
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}