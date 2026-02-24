import { createContext, use } from 'react';

export interface WalletContextType {
  address: string | null;
  walletName: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = use(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
