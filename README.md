# Monroe Sniper

Professional paper-trading desk with live market data, multi-model risk engine, and readiness-gated path to real capital.

Paper mode runs a real $500-class demo book against authentic market feeds. Live mode uses the same risk, sizing, and exit logic against a connected wallet. **No fabricated fills, no phantom cross-venue P&L, no readiness theater.**

## Core principles

- **Authentic data only** — entry/exit prices are checkable against the source venue. Same-venue marking is enforced.
- **Hard risk rules** — on a $50 book total open exposure never exceeds $10. Progressive profit-lock (80/20 → 90/10) and equity-guard protect gains.
- **Readiness is earned** — 200 qualifying (TP/SL bracket-resolved) trades and a 65% win-rate floor. Sample-gated score so small samples cannot claim 90%+.
- **Four risk models** (configurable in Settings):
  - **Conservative** — capital preservation, high score/edge floor
  - **Sweet Spot** (default) — balanced daily driver that actually generates learning volume
  - **Aggressive Growth** — higher throughput
  - **Turbo Gambler** — timed high-intensity runs

## How a cycle works

1. Live market data (CEX + DEX + funding + whale moves) is loaded.
2. Avenues / Tape / Whale sources (toggleable) produce candidates.
3. Risk engine evaluates score, edge, stake budget, portfolio risk, execution cost, same-venue, stablecoin block, cooldown.
4. Size is the tightest of model risk fraction, tier stake budget, free cash, and conviction.
5. Bracket exits: stop, target, trailing, time, liquidity-drop, or opposing signal.
6. Qualifying closes update learning events and readiness. Regime shifts can raise learning rate briefly.

Live execution is intentionally unavailable until readiness and explicit operator enablement. The live-status UI states this clearly.

## Map

| Piece | Location |
| --- | --- |
| Desk state + entry paths | `src/lib/desk-store.ts` |
| Risk engine + models | `src/lib/sniper/risk-engine.ts`, `risk-models.ts` |
| Stake budget / tiers | `src/lib/sniper/tier-config.ts` |
| Profit lock / equity guard | `src/lib/sniper/profit-lock.ts`, `equity-guard.ts` |
| Portfolio risk + execution sim | `src/lib/trading/portfolio-risk.ts`, `execution-sim.ts` |
| Paper book + same-venue mark | `src/lib/paper.ts` |
| Avenues / readiness | `src/lib/avenues/engine.ts` |
| Settings (interop / capital / discipline) | `src/components/settings-view.tsx` |

## Tests & quality

```bash
npm test
npm run typecheck
npm run build
```

CI runs the full suite on every push (`.github/workflows/quality.yml`).

## Deploy notes

- Vercel Hobby: daily crons only. Engine cycle is driven by the open desk / API, not sub-daily crons.
- Production uses Neon (`DATABASE_URL`). Migrations apply on build.
- Set `HELIUS_API_KEY` as a server-only env var for the Solana Tape WebSocket.

## Live status

Live order submission is **off by default**. The desk reaches a real venue only
through `src/lib/trading/live/*` (server-signed CEX REST adapter); the browser
wallet stays read-only. Nothing can move funds until the server env below is set
**and** the order clears `checkLiveGuardrails`.

Arm it on the server (values are secret — set them in the Vercel dashboard, never
in the repo, never as `VITE_` vars):

| Var | Meaning |
| --- | --- |
| `SNIPER_LIVE_ENABLED` | `true` to allow live orders (default off). |
| `SNIPER_CEX_VENUE` | `kraken`, `binance`, or `coinbase`. |
| `SNIPER_CEX_API_KEY` / `SNIPER_CEX_API_SECRET` | Venue API credentials (Kraken key/secret, Binance key/secret, or Coinbase key name / EC private key PEM). |
| `SNIPER_BINANCE_BASE` | Optional Binance REST host override (e.g. `https://api.binance.us`). |
| `SNIPER_LIVE_MAX_NOTIONAL_USD` | Per-order cap (default 100). |
| `SNIPER_LIVE_DAILY_LOSS_USD` | Halt entries after this daily loss (default 50). |
| `SNIPER_LIVE_MAX_POSITIONS` | Max concurrent live positions (default 4). |
| `SNIPER_LIVE_ALLOWLIST` | Comma-separated symbols allowed live (empty = any). |
| `MONROE_WEBHOOK_TOKEN` | Optional shared secret for the TradingView intake (`?token=` or `x-webhook-token`). |
| `MONROE_TV_RELAY_URL` | Optional URL that normalized webhook signals are POSTed on to (webhook-out). |

> Validate the venue adapter with a minimum-size live smoke before trusting size —
> the Kraken pair mapping and order shape are wired but unproven with real funds.

**Alert routing & intake.** Telegram and Discord trade/price alerts are configured
in-app (Integrations panel / vault, verified live before use — credentials stay in
the browser, never on the server). Strategy alerts can be POSTed to
`/api/webhooks/tradingview` as JSON or plain text (`BUY BTCUSDT @ 64000`); the
endpoint validates and normalizes the signal and optionally relays it, but never
places an order — execution stays inside the desk.

---

[monroe-v2.vercel.app](https://monroe-v2.vercel.app)
