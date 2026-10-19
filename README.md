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

Live order submission is disabled by design. There is no broker key, signing path, or funding rail that can place real orders until readiness gates and an explicit enablement flag are satisfied.

---

[monroe-v2.vercel.app](https://monroe-v2.vercel.app)
