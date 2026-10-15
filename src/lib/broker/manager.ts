/** Unified broker manager – selects the right exchange adapter and
 *  normalises order/ticker responses so the rest of the platform
 *  does not need to know which exchange is active.
 *
 *  Environment variables (Vercel or local .env):
 *    BROKER_BACKEND    – one of "binance", "coinbase", "kraken"
 *    BINANCE_API_KEY, BINANCE_API_SECRET
 *    COINBASE_API_KEY, COINBASE_API_SECRET, COINBASE_PASSPHRASE
 *    KRACKEN_API_KEY, KRACKEN_API_SECRET
 */
export type BrokerBackend = "binance" | "coinbase" | "kraken";

export type BrokerConfig = {
  backend: BrokerBackend;
  /** Testnet / sandbox mode – paper‑trading without real funds. */
  testnet?: boolean;
};

/** Normalised order response – independent of the underlying exchange. */
export type NormalisedOrder = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  status: "NEW" | "PARTIAL" | "FILLED" | "CANCELLED" | "REJECTED";
  quantity: number;
  price: number | null; // null for MARKET orders
  fee: number;
  feeCurrency: string;
  timestamp: number;
};

/** Normalised ticker data – independent of the underlying exchange. */
export type NormalisedTicker = {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  quoteVolume: number;
};

/** Read the chosen backend from env; fall back to "binance". */
function envBackend(): BrokerBackend {
  const chosen = (typeof process !== "undefined"
    ? process.env BROKER_BACKEND
    : undefined) as BrokerBackend | undefined;
  return chosen || "binance";
}

/** Load config for the selected backend. */
function loadConfig(backend: BrokerBackend, testnet?: boolean): any {
  switch (backend) {
    case "binance": {
      const key = process.env.BINANCE_API_KEY ?? "";
      const secret = process.env.BINANCE_API_SECRET ?? "";
      return { apiKey: key, apiSecret: secret, testnet: testnet ?? false };
    }
    case "coinbase": {
      const key = process.env.COINBASE_API_KEY ?? "";
      const secret = process.env.COINBASE_API_SECRET ?? "";
      const passphrase = process.env.COINBASE_PASSPHRASE ?? "";
      return { apiKey: key, apiSecret: secret, passphrase, sandbox: testnet ?? false };
    }
    case "kraken": {
      const key = process.env.KRACKEN_API_KEY ?? "";
      const secret = process.env.KRACKEN_API_SECRET ?? "";
      return { apiKey: key, apiSecret: secret };
    }
    default:
      return { apiKey: "", apiSecret: "" };
  }
}

/** Place an order on the selected broker and return a normalised response. */
export async function placeOrder(
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number,
  price?: number,
  orderType: "MARKET" | "LIMIT" = "MARKET"
): Promise<NormalisedOrder> {
  const backend = envBackend();
  const config = loadConfig(backend, false);
  switch (backend) {
    case "binance": {
      const resp = await (await import("./binance")).placeBinanceOrder(
        config,
        side,
        symbol,
        quantity,
        price,
        orderType
      );
      return {
        id: resp.orderId,
        symbol: resp.symbol,
        side,
        status: mapBinanceStatus(resp.status),
        quantity: parseFloat(resp.qty),
        price: price !== undefined ? parseFloat(resp.price) : null,
        fee: parseFloat(resp.commission),
        feeCurrency: resp.commissionAsset || "USDT",
        timestamp: resp.transactTime,
      };
    }
    case "coinbase": {
      const resp = await (await import("./coinbase")).placeCoinbaseOrder(
        config,
        side,
        symbol,
        quantity,
        price
      );
      const mapStatus = (s: string) =>
        s === "done" ? "FILLED" : s === "canceled" ? "CANCELLED" : "NEW";
      return {
        id: resp.id,
        symbol: resp.product_id,
        side,
        status: mapStatus(resp.status),
        quantity: parseFloat(resp.filled_size) || parseFloat(resp.post_only ? "0" : "0"),
        price: price !== undefined ? parseFloat(price) : parseFloat(resp.price || "0"),
        fee: parseFloat(resp.filled_size) > 0 ? parseFloat("0.001") : "0", // simplified
        feeCurrency: resp.product_id.split("-")[0].toUpperCase(),
        timestamp: Date.now(),
      };
    }
    case "kraken": {
      const resp = await (await import("./kraken")).placeKrakenOrder(
        config,
        side,
        symbol,
        quantity,
        price
      );
      return {
        id: resp.uuid,
        symbol: resp.pair.replace("/", ""),
        side,
        status: mapKrakenStatus(resp.status),
        quantity: parseFloat(resp.quantity),
        price: price !== undefined ? parseFloat(price) : parseFloat(resp.price),
        fee: parseFloat(resp.fee),
        feeCurrency: resp.feeCurrency,
        timestamp: Date.now(),
      };
    }
    default:
      throw new Error(`Unsupported broker backend: ${backend}`);
  }
}

/** Map Binance status to normalised status. */
function mapBinanceStatus(status: string): "NEW" | "PARTIAL" | "FILLED" | "CANCELLED" | "REJECTED" {
  switch (status) {
    case "NEW":
      return "NEW";
    case "PARTIALLY_FILLED":
      return "PARTIAL";
    case "FILLED":
      return "FILLED";
    case "CANCELLED":
      return "CANCELLED";
    case "REJECTED":
      return "REJECTED";
    default:
      return "NEW";
  }
}

/** Map Kraken status to normalised status. */
function mapKrakenStatus(status: string): "NEW" | "PARTIAL" | "FILLED" | "CANCELLED" | "REJECTED" {
  switch (status) {
    case "opened":
      return "NEW";
    case "canceled":
      return "CANCELLED";
    case "expired":
      return "CANCELLED";
    case "rejected":
      return "REJECTED";
    case "filled":
      return "FILLED";
    default:
      return "NEW";
  }
}

/** Fetch a normalised ticker from the selected broker. */
export async function fetchTicker(symbol: string): Promise<NormalisedTicker> {
  const backend = envBackend();
  switch (backend) {
    case "binance": {
      const resp = await (await import("./binance")).fetchBinanceTicker(symbol);
      return {
        symbol: resp.symbol,
        price: parseFloat(resp.price),
        changePercent: resp.changePercent,
        volume: parseFloat(resp.volume),
        quoteVolume: parseFloat(resp.quoteVolume),
      };
    }
    case "coinbase": {
      const resp = await (await import("./coinbase")).fetchCoinbaseTicker(symbol.replace("/", "-"));
      return {
        symbol: symbol,
        price: parseFloat(resp.price),
        changePercent: parseFloat(resp.price_change_24h),
        volume: parseFloat(resp.volume_24h),
        quoteVolume: "0",
      };
    }
    case "kraken": {
      const resp = await (await import("./kraken")).fetchKrakenTicker(symbol.replace("/", "/"));
      return {
        symbol: symbol,
        price: parseFloat(resp.last),
        changePercent: "0", // simplified
        volume: parseFloat(resp.volume),
        quoteVolume: "0",
      };
    }
    default:
      throw new Error(`Unsupported broker backend: ${backend}`);
  }
}

/** Check the on‑chain balance for a Solana address (SOL + USDC).
 *  Currently a stub – replace with a real RPC call (Helius, etc.).
 */
export async function checkSolBalance(address: string): Promise<{ sol: number; usdc: number }> {
  return { sol: 0, usdc: 0 };
}

/** Read the currently selected broker backend from localStorage so the
 *  user’s choice survives page refreshes. */
export function savePreferredBackend(backend: BrokerBackend): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("preferredBrokerBackend", backend);
}

/** Read the preferred backend from localStorage; fall back to env default. */
export function loadPreferredBackend(): BrokerBackend {
  if (typeof window === "undefined") return envBackend();
  const saved = localStorage.getItem("preferredBrokerBackend");
  return (saved as BrokerBackend) || envBackend();
}

/** Save the user’s testnet / sandbox preference. */
export function saveTestnetPreference(testnet: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("brokerTestnet", testnet ? "1" : "0");
}

/** Read the testnet / sandbox preference. */
export function loadTestnetPreference(): boolean {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("brokerTestnet");
  return saved === "1";
}

/** Reset all broker‑related localStorage keys (useful after a config change). */
export function clearBrokerStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("preferredBrokerBackend");
  localStorage.removeItem("brokerTestnet");
}