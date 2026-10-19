const STABLE = /(USDT|USDC|BUSD|FDUSD|TUSD|DAI|USDP)$/;

/**
 * Map a tape symbol to a Binance spot symbol. CEX rows already carry the pair
 * (`BTCUSDT`); a bare base (`SOL`) gets the USDT quote appended.
 */
export function cexSymbol(symbol: string, venue?: string): string {
  const s = (symbol ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return "BTCUSDT";
  if (STABLE.test(s)) return s;
  if (venue === "binance") return `${s}USDT`;
  return `${s}USDT`;
}
