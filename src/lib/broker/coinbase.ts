/** Coinbase Pro (now Advanced Trade) API client for real-order execution.
 *  Wraps the Coinbase Commerce/API endpoints with error handling
 *  and response validation.  Secrets are read from environment variables
 *  only — never hard‑coded.
 */
export type CoinbaseConfig = {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  /** Optional: true‑sandbox for paper‑trading without real funds. */
  sandbox?: boolean;
}

/** Ticker data returned by Coinbase Pro. */
export type CoinbaseTicker = {
  price: string;
  size: string;
  bid: string;
  ask: string;
  /** 24h volume in base currency */
  volume_24h: string;
  /** 24h price change percent */
  price_change_24h: string;
}

/** Order response from Coinbase Pro. */
export type CoinbaseOrderResponse = {
  /** Order ID */
  id: string;
  /** Product ID, e.g. "BTC-USD" */
  product_id: string;
  /** Order side: "buy" or "sell" */
  side: string;
  /** Order type: "market", "limit", "stop", "limit_market" */
  order_type: string;
  /** Order status: "open", "done", "cancelled", etc. */
  status: string;
  /** Filled quantity */
  filled_size: string;
  /** Total order quantity */
  post_only: boolean;
  /** Side */
  side: string;
}

/** Place a new order on Coinbase Pro. */
export async function placeCoinbaseOrder(
  config: CoinbaseConfig,
  side: string,
  productId: string,
  size: number,
  price?: string
): Promise<CoinbaseOrderResponse> {
  const baseUrl = config.sandbox
    ? "https://api-public.sandbox.pro.coinbase.com"
    : "https://api.pro.coinbase.com";

  const payload: Record<string, string> = {
    side: side,
    product_id: productId,
    size: size.toString(),
  };

  if (price) {
    payload.price = price;
  }

  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CB-KEY": config.apiKey,
      "CB-SECRET": config.apiSecret,
      "CB-PASSPHRASE": config.passphrase,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Coinbase API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<CoinbaseOrderResponse>;
}

/** Fetch the latest ticker price from Coinbase Pro. */
export async function fetchCoinbaseTicker(productId: string): Promise<CoinbaseTicker> {
  const baseUrl = config.sandbox
    ? "https://api-public.sandbox.pro.coinbase.com"
    : "https://api.pro.coinbase.com";

  const response = await fetch(`${baseUrl}/products/${productId}/ticker`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Coinbase ticker error: ${response.statusText}`);
  }

  return response.json() as Promise<CoinbaseTicker>;
}

export type { CoinbaseConfig, CoinbaseTicker, CoinbaseOrderResponse };