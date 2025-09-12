// frontend/src/app/attester/page.tsx
'use client';

import { Header } from '@/components/Header';
import { StatCard } from '@/components/StatCard';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { useEthers } from '@/app/EthersProvider';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import deployments from '@/contracts/deployments.json';
import AttesterContractABI from '@/contracts/artifacts/AttesterContract.sol/AttesterContract.json';
import { generateAadhaarHash, generateSecret, generateSecretHash, generateStateCommitment, generateSalt } from '@/lib/proofs';

const STATE_MAPPING = {
  'Maharashtra': 27,
  'Karnataka': 29,
  'Delhi': 7,
  'Tamil Nadu': 33,
  'Gujarat': 24,
};

export default function AttesterDashboard() {
  const { provider, selectedSigner } = useEthers();
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [credentialsIssued, setCredentialsIssued] = useState(0);
  const [formData, setFormData] = useState({ 
    userAddress: '', 
    aadhaarNumber: '', 
    birthYear: '', 
    birthMonth: '', 
    birthDay: '', 
    stateName: 'Maharashtra' 
  });
  const [contractError, setContractError] = useState<string | null>(null);

  useEffect(() => {
    const checkOwner = async () => {
      if (provider && selectedSigner) {
        try {
          // Check if contract exists
          const contractCode = await provider.getCode(deployments.attesterContract);
          if (contractCode === '0x') {
            setContractError('Attester contract not deployed. Please deploy contracts first.');
            return;
          }

          const attesterContract = new ethers.Contract(deployments.attesterContract, AttesterContractABI.abi, provider);
          
          // Try to get owner - handle if function doesn't exist
          try {
            const ownerAddress = await attesterContract.owner();
            const selectedAddress = await selectedSigner.getAddress();
            setIsOwner(ownerAddress.toLowerCase() === selectedAddress.toLowerCase());
            setContractError(null);
          } catch (error) {
            console.warn("owner function not available or contract not deployed properly");
            setIsOwner(false);
            setContractError('Contract owner function not available. Contract may not be properly deployed.');
          }
        } catch (error) {
          console.error("Error checking owner:", error);
          setContractError('Error connecting to attester contract.');
        }
      }
    };
    checkOwner();
  }, [provider, selectedSigner]);

  const handleIssueCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !selectedSigner) return;
    
    setIsLoading(true);
    setIsSuccess(false);
    setErrorMessage('');

    try {
      const salt = generateSalt();
      const stateSalt = generateSalt();
      const secret = generateSecret();
      const userState = STATE_MAPPING[formData.stateName as keyof typeof STATE_MAPPING];

      const aadhaarHash = await generateAadhaarHash(
        BigInt(formData.aadhaarNumber), 
        BigInt(formData.birthYear), 
        BigInt(formData.birthMonth), 
        BigInt(formData.birthDay), 
        salt
      );
      const secretHash = await generateSecretHash(secret);
      const stateCommitment = await generateStateCommitment(BigInt(userState), stateSalt);

      // Generate private data for user (they need this to generate proofs)
      const privateUserData = {
        aadhaarNumber: formData.aadhaarNumber,
        birthYear: formData.birthYear,
        birthMonth: formData.birthMonth,
        birthDay: formData.birthDay,
        salt: salt.toString(),
        secret: secret.toString(),
        userState: userState.toString(),
        stateSalt: stateSalt.toString(),
      };

      console.log("🔐 PRIVATE USER DATA (User must save this to generate proofs):");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(JSON.stringify(privateUserData, null, 2));
      console.log("═══════════════════════════════════════════════════════════");

      const attesterContract = new ethers.Contract(deployments.attesterContract, AttesterContractABI.abi, selectedSigner);
      const tx = await attesterContract.issueAadhaarCard(
        formData.userAddress, 
        `AADHAAR_${formData.aadhaarNumber}`, 
        aadhaarHash, 
        secretHash, 
        stateCommitment
      );
      await tx.wait();
      
      setIsSuccess(true);
      setCredentialsIssued(prev => prev + 1);
      setFormData({ 
        userAddress: '', 
        aadhaarNumber: '', 
        birthYear: '', 
        birthMonth: '', 
        birthDay: '', 
        stateName: 'Maharashtra' 
      });
      
      // Show private data in alert for demo
      alert(
        "Credential issued successfully!\n\n" +
        "IMPORTANT: The private data has been logged to the browser console.\n" +
        "In a real system, this would be securely provided to the user.\n\n" +
        "User needs this data to generate zero-knowledge proofs."
      );
      
    } catch (error: any) {
      console.error("Failed to issue credential:", error);
      setErrorMessage(`Transaction failed: ${error.reason || error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedSigner) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header title="ZKP-KYC Attester" role="Attester" />
        <main className="p-8">
          <div className="mb-8">
            <RoleSwitcher />
          </div>
          <div className="text-center">
            <h1 className="text-2xl text-gray-500 font-bold">Please select an account to continue</h1>
          </div>
        </main>
      </div>
    );
  }

  if (contractError) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header title="ZKP-KYC Attester" role="Attester" />
        <main className="p-8">
          <div className="mb-8">
            <RoleSwitcher />
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
            <h1 className="text-xl text-red-700 font-bold mb-2">Contract Error</h1>
            <p className="text-red-600 mb-4">{contractError}</p>
            <p className="text-sm text-red-500">
              Please deploy the contracts first by running: <code className="bg-red-100 px-1 rounded">npm run deploy:local</code>
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header title="ZKP-KYC Attester" role="Attester" />
        <main className="p-8">
          <div className="mb-8">
            <RoleSwitcher />
          </div>
          <div className="text-center">
            <h1 className="text-2xl text-red-500 font-bold">
              Access Denied: Only the contract owner can issue credentials
            </h1>
            <p className="text-gray-600 mt-2">
              Please select Account #0 (contract deployer) to use this page.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="ZKP-KYC Attester Dashboard" role="Attester" />
      <main className="p-8">
        {/* Role Switcher - Only show if user is owner */}
        {isOwner && (
          <div className="mb-8">
            <RoleSwitcher />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard value={credentialsIssued} label="Credentials Issued" />
          <StatCard value={0} label="Active Users" />
          <StatCard value={0} label="Verification Requests" />
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Issue New Aadhaar Credential</h2>
          <form onSubmit={handleIssueCredential} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User Address</label>
              <input 
                type="text" 
                placeholder="0x..." 
                value={formData.userAddress} 
                onChange={e => setFormData({...formData, userAddress: e.target.value})} 
                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Number</label>
              <input 
                type="text" 
                placeholder="123456789012 (12 digits)" 
                value={formData.aadhaarNumber} 
                onChange={e => setFormData({...formData, aadhaarNumber: e.target.value})} 
                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                pattern="\d{12}"
                required 
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birth Year</label>
                <input 
                  type="number" 
                  placeholder="1990" 
                  min="1950" 
                  max="2010"
                  value={formData.birthYear} 
                  onChange={e => setFormData({...formData, birthYear: e.target.value})} 
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <input 
                  type="number" 
                  placeholder="1-12" 
                  min="1" 
                  max="12"
                  value={formData.birthMonth} 
                  onChange={e => setFormData({...formData, birthMonth: e.target.value})} 
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <input 
                  type="number" 
                  placeholder="1-31" 
                  min="1" 
                  max="31"
                  value={formData.birthDay} 
                  onChange={e => setFormData({...formData, birthDay: e.target.value})} 
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  required 
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State of Residence</label>
              <select 
                value={formData.stateName} 
                onChange={e => setFormData({...formData, stateName: e.target.value})} 
                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {Object.keys(STATE_MAPPING).map(state => (
                  <option key={state} value={state}>{state} (Code: {STATE_MAPPING[state as keyof typeof STATE_MAPPING]})</option>
                ))}
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Issuing Credential...' : 'Issue Aadhaar Credential'}
            </button>
            
            {isSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-700 text-center font-semibold">
                  ✅ Credential issued successfully! Check browser console for private data.
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
      </main>
    </div>
  );
}