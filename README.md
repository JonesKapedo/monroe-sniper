# Monroe Sniper

Paper trading desk. It simulates a market minute on a cadence, sizes risk, and updates a small model after every close.

This is not a broker. The wallet and executions are paper simulations; no real deposits, withdrawals, or orders are possible. Nothing here promises a daily profit.

## How a minute works

1. Prices step on a stylized path. A small, learnable drift sits under the noise.
2. Three desks score each name:
   - **Invo** — copy-flow / crowd lean
   - **Finviz** — trend and RSI screen
   - **Simul8or** — walk-forward model
3. The ensemble only fires when agreement clears the confidence gate.
4. Size is the tighter of percent-risk, free cash per slot, and quarter-Kelly.
5. Bracket exits: stop, target, time stop, or an opposing signal.
6. The close trains the model. A regime shift lifts the learning rate for a few trades.

The reference sites are not scraped and no live order is sent. Wiring a real broker would be a separate, explicit step.

## Map

| Piece | File |
| --- | --- |
| Minute loop | `src/lib/sniper/engine.ts` |
| Signal desks | `src/lib/sniper/signals.ts` |
| Stops, Kelly, size | `src/lib/sniper/risk.ts` |
| Bracket exits | `src/lib/sniper/exit.ts` |
| Online model | `src/lib/sniper/model.ts` |
| Catch-up window | `src/lib/sniper/catchup.ts` |
| Paper wallet | `src/lib/sniper/wallet.ts` |
| Desk state | `src/lib/sniper/store.ts` |

While the desk is open it keeps stepping. If you leave and come back, `dueTicks` in
`catchup.ts` catches up missed minutes from the timestamp saved on this device,
capped at four hours, and answers zero (never a negative count) if the clock rolls
back behind the saved timestamp.

## Tests

The pure math carries the risk: `risk.ts` sizes and brackets, `exit.ts` picks the
barrier, `model.ts` trains, and `catchup.ts` decides how many minutes are due. Each
has a matching `*.test.ts` next to it. The TypeScript suites run under `npm test`
with `tsx` because the environment's built-in Node type-stripping is unavailable.
Run the direct suite with `npx tsx --test src/lib/sniper/*.test.ts`.

## Live market intelligence prototype

The **Scanner** workspace adds public market-data adapters in `src/lib/data/market-sources.ts`.
It normalizes DexScreener token pairs, provides CoinGecko search and price helpers, and checks
supported token contracts with GoPlus and honeypot.is. SEC EDGAR search is best-effort enrichment
only and is not treated as token-security evidence.

The composite score uses 35% liquidity, 25% momentum, 20% security, and 20% pair novelty.
A score of 70 is necessary but not sufficient for paper-gate eligibility. Honeypot detection,
unlocked liquidity, mint/freeze authority, excessive tax, thin liquidity, and incomplete security
evidence prevent a candidate from passing. Missing security data is always unverified.

Public APIs can be rate-limited and browser CORS policies may block some endpoints. The scanner
shows provider health and degrades visibly when a source cannot be reached. It does not submit
orders or connect opportunities to the existing simulated stock-trading engine. Paper-gate
eligibility is informational only; this prototype is not a live trading bot.

Run `npm test` to exercise normalization, chain mapping, scoring, and fail-closed security gates.

## Paper risk gate and execution loop

The Scanner now routes every candidate through an auditable, paper-only risk verdict before an entry can be simulated. The gate checks the 70/100 composite threshold, clean and recent dual-provider security evidence, known buy/sell tax, hard-reject flags, quote freshness, minimum liquidity, duplicate positions, available cash, and exposure limits.

Paper sizing is capped at 5% of current equity per idea, three simultaneous positions, and 15% aggregate exposure. Open positions use the guide's hard stop at -8%, half-position scale-out at +20%, a 10% trailing stop after the scale-out, a six-hour time stop, and a liquidity-drop guard when observed pool liquidity falls more than 30% from its peak. Decisions, simulated fills, and exit history persist in this browser.

The Scanner refreshes held-token quotes roughly every 30 seconds while the page is open. If it is closed, the browser does not run a background trading process; time-based exits are checked again when the Scanner is opened. This remains a simulation and never sends live orders.

## Solana live swap chart

The Tape page defaults to a server-side Helius WebSocket feed for confirmed SOL/USDC swaps. It
subscribes to the highest-liquidity direct SOL/USDC pool found for Raydium and PumpSwap, fetches
confirmed transactions from Helius, and builds candles and the recent-swap tape only from observed
signer token-balance changes. Candles begin with the first swap received after connecting; no
synthetic prices or historical bars are substituted. The CEX tab remains a separate public
Binance/Kraken candle view.

Set `HELIUS_API_KEY` as a server-only Vercel environment variable for Production (and Preview, if
needed). Never expose it through a `VITE_` variable. The key is used only by the server stream
route; paper positions and fills remain simulations and are not connected to DEX execution.

## Persisted paper learning

Each simulated position close is recorded in `trade_learning_events`, with the entry/exit prices, size, outcome, and market conditions used at entry. The server updates the aggregate learning threshold in the same database operation and restores that state when the desk opens. Production uses Neon through `DATABASE_URL`; local preview uses the existing PGLite fallback. The database is enabled for deployment in `.grok/app-env.json`.

## Live trading status

Live execution is intentionally unavailable. The app has no broker integration, signing keys, funding address, or real order rail. The live-status UI explains this explicitly; it does not accept real funds or activate live trading.

## Appearance

Settings offers Monroe, Paper, and Midnight color themes and a toggle for the
human-skull desk mascot. It reacts briefly to page interactions and wallet
simulator actions.
