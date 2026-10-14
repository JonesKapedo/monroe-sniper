import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, WalletConnectWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletAdapterNetwork, type Adapter } from "@solana/wallet-adapter-base";
import { endpointFor, useSolNetwork, walletConnectProjectId, type SolanaNetwork } from "./config";

function networkForWalletAdapter(
  network: SolanaNetwork,
): WalletAdapterNetwork.Mainnet | WalletAdapterNetwork.Devnet {
  return network === "mainnet-beta" ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;
}

/**
 * Solana connection + wallet context. Client-only render guard: wallet state
 * never participates in SSR. Switching networks remounts adapters (safe:
 * it always disconnects first).
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const network = useSolNetwork((s) => s.network);
  const customRpc = useSolNetwork((s) => s.customRpc);

  useEffect(() => {
    // Mount after first paint so SSR/prerender never touches wallet adapters.
    setMounted(true);
  }, []);

  const endpoint = useMemo(() => endpointFor(network, customRpc), [network, customRpc]);

  const wallets = useMemo<Adapter[]>(() => {
    const adapters: Adapter[] = [new PhantomWalletAdapter()];
    const projectId = walletConnectProjectId();
    if (projectId) {
      adapters.push(
        new WalletConnectWalletAdapter({
          network: networkForWalletAdapter(network),
          options: { projectId },
        }),
      );
    }
    return adapters;
  }, [network]);

  if (!mounted) return <>{children}</>;

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
