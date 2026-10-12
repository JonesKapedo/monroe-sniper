export interface DepositNetwork {
  id: string;
  name: string;
  symbol: string;
  address: string;
  standard: string;
  confirmations: string;
  estimatedArrival: string;
  minDepositUsd: number;
  qrSvgPattern: string; // Deterministic clean SVG visual QR representation
  explorerUrl: string;
  feeUsd: number;
  note: string;
}

export const DEPOSIT_NETWORKS: DepositNetwork[] = [
  {
    id: "SOL",
    name: "Solana",
    symbol: "USDC / USDT / SOL",
    address: "Monr9qZ7YfX2mK8eL1uP4tW5vS3rN6bA8cD0eF2j4U9",
    standard: "SPL Token",
    confirmations: "32 Finalized Blocks",
    estimatedArrival: "~15 seconds",
    minDepositUsd: 20,
    qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 4h2v2h-2v-2zm4-4h2v6h-2v-6zm-4 0h2v2h-2v-2zm2 2h2v2h-2v-2z",
    explorerUrl: "https://solscan.io/account/",
    feeUsd: 0.05,
    note: "Fastest settlement. Send only USDC, USDT, or native SOL on Solana SPL.",
  },
  {
    id: "ETH",
    name: "Ethereum",
    symbol: "USDT / USDC / ETH",
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    standard: "ERC-20",
    confirmations: "12 Network Confirmations",
    estimatedArrival: "~2.5 minutes",
    minDepositUsd: 50,
    qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm12 2h2v2h-2v-2zm2-2h2v2h-2v-2zm-4 4h6v2h-6v-2zm0-4h2v2h-2v-2z",
    explorerUrl: "https://etherscan.io/address/",
    feeUsd: 1.5,
    note: "Send only ERC-20 stablecoins or ETH. Deposits below $50 cannot be recovered.",
  },
  {
    id: "ARB",
    name: "Arbitrum One",
    symbol: "USDC / USDT",
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    standard: "Arbitrum L2",
    confirmations: "20 L2 Batches",
    estimatedArrival: "~25 seconds",
    minDepositUsd: 10,
    qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 2h4v2h-4v-2zm2 4h4v2h-4v-2zm-2-2h2v2h-2v-2zm4 0h2v2h-2v-2z",
    explorerUrl: "https://arbiscan.io/address/",
    feeUsd: 0.15,
    note: "Lowest gas EVM rail. Send USDC (native) or USDT on Arbitrum One.",
  },
  {
    id: "BSC",
    name: "BNB Smart Chain",
    symbol: "USDT / USDC / BNB",
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    standard: "BEP-20",
    confirmations: "15 BSC Blocks",
    estimatedArrival: "~45 seconds",
    minDepositUsd: 20,
    qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h2v4h-2v-4zm4 0h2v6h-2v-6zm-2 4h2v2h-2v-2z",
    explorerUrl: "https://bscscan.com/address/",
    feeUsd: 0.2,
    note: "Send BEP-20 stablecoins. Do not send cross-chain bridges without BEP-20 wrap.",
  },
  {
    id: "BTC",
    name: "Bitcoin Native",
    symbol: "BTC",
    address: "bc1qm0nr0e5n1p3r8d35kc6634c0532925a3b844bc454e",
    standard: "Native SegWit (Bech32)",
    confirmations: "2 Confirmations",
    estimatedArrival: "~15-20 minutes",
    minDepositUsd: 50,
    qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm12 0h2v2h-2v-2zm-2 2h2v2h-2v-2zm4 2h2v2h-2v-2zm-4 2h6v2h-6v-2z",
    explorerUrl: "https://mempool.space/address/",
    feeUsd: 2.2,
    note: "Native Bitcoin SegWit address. Only send native BTC.",
  },
];
