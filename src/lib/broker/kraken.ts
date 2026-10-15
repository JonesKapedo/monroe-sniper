/** Kraken Spot API client for real-order execution.
 *  Wraps the Kraken API with error handling and response validation.
 *  Secrets are read from environment variables only.
 */
export type KrakenConfig = {
  apiKey: string;
  apiSecret: string;
};

/** Incoming ticker data from Kraken. */
export type KrakenTicker = {
  /** Trading pair, e.g. "XBT/USD" */
  pair: string;
  /** Last traded price */
  last: string;
  /** 24h volume */
  volume: string;
  /** 24h price change */
  priceChange: string;
  /** 24h low */
  low: string;
  /** 24h high */
  high: string;
  /** Opening price */
  openPrice: string;
};

/** Order response from Kraken. */
export type KrakenOrderResponse = {
  /** Order UUID */
  uuid: string;
  /** Status: "opened", "canceled", "expired", "rejected" */
  status: string;
  /** Order type: "market", "limit" */
  orderType: string;
  /** Side: "buy", "sell" */
  side: string;
  /** Quantity */
  quantity: string;
  /** Price */
  price: string;
  /** Fee */
  fee: string;
  /** Fee currency */
  feeCurrency: string;
};

/** Order side */
export type OrderSide = "BUY" | "SELL";

/** Order type */
export type OrderType = "MARKET" | "LIMIT";

/** Place a new order on Kraken. */
export async function placeKrakenOrder(
  config: KrakenConfig,
  side: OrderSide,
  pair: string,
  quantity: number,
  price?: number
): Promise<KrakenOrderResponse> {
  const url = "https://api.kraken.com/0/private/AddOrder";
  // Note: this function is now async due to crypto operations

  // Build the signed payload
  const nonce = Date.now().toString();
  const postData = [
    nonce,
    config.apiKey,
    "",
    quantity.toString(),
    side === "BUY" ? "buy" : "sell",
    pair,
    price !== undefined ? price.toString() : "0",
  ];

  // HMAC-SHA512 signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(config.apiSecret);
  const messageData = encoder.encode(postData.join("|"));

  let signature: string;
  if (typeof window !== "undefined" && typeof crypto !== "undefined" && crypto.subtle) {
    // Browser environment - use Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    signature = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } else {
    // Node.js environment fallback
    const crypto = await import("crypto");
    signature = crypto.createHmac("sha512", config.apiSecret).update(postData.join("|")).digest("hex");
  }

  const body = {
    nonce,
    apiKey: config.apiKey,
    postData: postData.join("|"),
    signature,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kraken API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (data.error && data.error.length) {
    throw new Error(`Kraken error: ${data.error.join(", ")}`);
  }

  return {
    uuid: data.result.uuid,
    status: data.result.status,
    orderType: data.result.descriptor.ordertype,
    side: data.result.descriptor.type,
    quantity: data.result.descriptor.ordernq,
    price: data.result.descriptor.price,
    fee: data.result.fees?.fee?.amount || "0",
    feeCurrency: data.result.fees?.fee?.currency || "XBT",
  };
};

/** Fetch the latest ticker from Kraken. */
export async function fetchKrakenTicker(pair: string): Promise<KrakenTicker> {
  const response = await fetch(`https://api.kraken.com/0/public?pair=${pair}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Kraken ticker error: ${response.statusText}`);
  }

  const data = await response.json();
  const ticker = data.result[Object.keys(data.result)[0]];
  return {
    pair,
    last: ticker.c[0].toString(),
    volume: ticker.v[0].toString(),
    priceChange: (Number(ticker.c[0]) - Number(ticker.o[0])).toString(),
    low: ticker.l[0].toString(),
    high: ticker.h[0].toString(),
    openPrice: ticker.o[0].toString(),
  };
}

