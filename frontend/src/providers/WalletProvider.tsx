import React, { useEffect, useState, useRef } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  FREIGHTER_ID,
  xBullModule,
  LobstrModule,
  LOBSTR_ID,
} from '@creit.tech/stellar-wallets-kit';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../hooks/useNotification';
import { WalletContext } from '../hooks/useWallet';

const LAST_WALLET_STORAGE_KEY = 'payd:last_wallet_name';
const SUPPORTED_MODAL_WALLETS = [FREIGHTER_ID, LOBSTR_ID] as const;

type SelectableWallet = {
  id: string;
  name: string;
  icon?: string;
  isAvailable: boolean;
};

function hasAnyWalletExtension(): boolean {
  if (typeof window === 'undefined') return true;
  const extendedWindow = window as Window &
    typeof globalThis & {
      freighterApi?: unknown;
      xBullSDK?: unknown;
      lobstr?: unknown;
    };

  return Boolean(extendedWindow.freighterApi || extendedWindow.xBullSDK || extendedWindow.lobstr);
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletExtensionAvailable, setWalletExtensionAvailable] = useState(true);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletOptions, setWalletOptions] = useState<SelectableWallet[]>([]);
  const kitRef = useRef<StellarWalletsKit | null>(null);
  const { t } = useTranslation();
  const { notifyWalletEvent } = useNotification();

  useEffect(() => {
    setWalletExtensionAvailable(hasAnyWalletExtension());

    const newKit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      modules: [new FreighterModule(), new xBullModule(), new LobstrModule()],
    });
    kitRef.current = newKit;

    const attemptSilentReconnect = async () => {
      const lastWalletName = localStorage.getItem(LAST_WALLET_STORAGE_KEY);
      if (!lastWalletName) {
        setIsInitialized(true);
        return;
      }

      setWalletName(lastWalletName);
      setIsConnecting(true);

      try {
        newKit.setWallet(lastWalletName);
        const account = await newKit.getAddress();
        if (account?.address) {
          setAddress(account.address);
          notifyWalletEvent(
            'reconnected',
            `${account.address.slice(0, 6)}...${account.address.slice(-4)} via ${lastWalletName}`
          );
        }
      } catch {
        // Silent reconnection should not block app flow.
      } finally {
        setIsConnecting(false);
        setIsInitialized(true);
      }
    };

    void attemptSilentReconnect();
  }, [notifyWalletEvent]);

  const loadWalletOptions = async (): Promise<SelectableWallet[]> => {
    const kit = kitRef.current;
    if (!kit) return [];
    const supported = await kit.getSupportedWallets();
    const options = supported
      .filter((wallet) =>
        SUPPORTED_MODAL_WALLETS.includes(wallet.id as (typeof SUPPORTED_MODAL_WALLETS)[number])
      )
      .map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        icon: wallet.icon,
        isAvailable: wallet.isAvailable,
      }));
    setWalletOptions(options);
    setWalletExtensionAvailable(options.some((wallet) => wallet.isAvailable));
    return options;
  };

  const connectWithWallet = async (selectedWalletId: string): Promise<string | null> => {
    const kit = kitRef.current;
    if (!kit) return null;

    setIsConnecting(true);
    try {
      kit.setWallet(selectedWalletId);
      const { address } = await kit.getAddress();
      setAddress(address);
      setWalletName(selectedWalletId);
      localStorage.setItem(LAST_WALLET_STORAGE_KEY, selectedWalletId);
      notifyWalletEvent(
        'connected',
        `${address.slice(0, 6)}...${address.slice(-4)} via ${selectedWalletId}`
      );
      return address;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      notifyWalletEvent(
        'connection_failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
      return null;
    } finally {
      setIsConnecting(false);
      setWalletModalOpen(false);
    }
  };

  const connect = async (): Promise<string | null> => {
    const options = await loadWalletOptions();
    if (options.length === 0) {
      notifyWalletEvent('connection_failed', 'No supported wallet providers were found.');
      return null;
    }
    setWalletModalOpen(true);
    return null;
  };

  const requireWallet = async (): Promise<string | null> => {
    if (address) return address;
    notifyWalletEvent('required', 'Connect your wallet to continue with this contract action.');
    return connect();
  };

  const disconnect = () => {
    const kit = kitRef.current;
    if (kit) {
      void kit.disconnect();
    }
    setAddress(null);
    setWalletName(null);
    localStorage.removeItem(LAST_WALLET_STORAGE_KEY);
    notifyWalletEvent('disconnected');
  };

  const signTransaction = async (xdr: string) => {
    const kit = kitRef.current;
    if (!kit) throw new Error('Wallet kit not initialized');
    const result = await kit.signTransaction(xdr);
    return result.signedTxXdr;
  };

  return (
    <>
      {!walletExtensionAvailable && (
        <div className="sticky top-0 z-50 w-full border-b border-amber-600/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          Wallet extension not detected. Install Freighter, xBull, or Lobstr to sign transactions.
        </div>
      )}

      {walletModalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-hi bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">{t('wallet.modalTitle') || 'Select a wallet'}</h3>
              <button
                onClick={() => setWalletModalOpen(false)}
                className="rounded-lg border border-hi px-2 py-1 text-xs text-muted hover:text-text"
              >
                Close
              </button>
            </div>
            <div className="space-y-2">
              {walletOptions.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => void connectWithWallet(wallet.id)}
                  disabled={!wallet.isAvailable || isConnecting}
                  className="flex w-full items-center justify-between rounded-xl border border-hi bg-black/20 px-4 py-3 text-left transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    {wallet.icon ? (
                      <img src={wallet.icon} alt={wallet.name} className="h-6 w-6 rounded" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-white/10" />
                    )}
                    <div>
                      <p className="text-sm font-bold">{wallet.name}</p>
                      <p className="text-[11px] text-muted">
                        {wallet.isAvailable ? 'Detected on this device' : 'Not available'}
                      </p>
                    </div>
                  </div>
                  {isConnecting && <span className="text-xs text-muted">Connecting…</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <WalletContext
        value={{
          address,
          walletName,
          isConnecting,
          isInitialized,
          walletExtensionAvailable,
          connect,
          requireWallet,
          disconnect,
          signTransaction,
        }}
      >
        {isInitialized ? (
          children
        ) : (
          <div className="w-full px-4 py-3 text-xs text-zinc-400">Restoring wallet session...</div>
        )}
      </WalletContext>
    </>
  );
};
