// frontend/src/app/EthersProvider.tsx
'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers, Signer, JsonRpcProvider } from 'ethers';

interface EthersContextType {
  provider: JsonRpcProvider | null;
  signers: Signer[];
  selectedSigner: Signer | null;
  setSelectedSigner: (signer: Signer) => void;
}

const EthersContext = createContext<EthersContextType | undefined>(undefined);

export const EthersProvider = ({ children }: { children: ReactNode }) => {
  const [provider, setProvider] = useState<JsonRpcProvider | null>(null);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [selectedSigner, setSelectedSigner] = useState<Signer | null>(null);

  useEffect(() => {
    const initEthers = async () => {
      try {
        const rpcProvider = new ethers.JsonRpcProvider('http://127.0.0.1:8545/');
        setProvider(rpcProvider);
        const accounts = await rpcProvider.listAccounts();
        const signerInstances = await Promise.all(accounts.map(account => rpcProvider.getSigner(account.address)));
        setSigners(signerInstances);
        if (signerInstances.length > 0) {
          setSelectedSigner(signerInstances[0]);
        }
      } catch (error) {
        console.error("Failed to connect to Hardhat node:", error);
      }
    };
    initEthers();
  }, []);

  return (
    <EthersContext.Provider value={{ provider, signers, selectedSigner, setSelectedSigner }}>
      {children}
    </EthersContext.Provider>
  );
};

export const useEthers = () => {
  const context = useContext(EthersContext);
  if (context === undefined) {
    throw new Error('useEthers must be used within an EthersProvider');
  }
  return context;
};