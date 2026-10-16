# Monroe Sniper Roadmap

## Current status (2026-10-16)

Professional paper desk with live market data, four risk models (Conservative → Sweet Spot default → Aggressive Growth → Turbo Gambler), stake-budget enforcement, same-venue marking, progressive profit-lock, equity-guard, and readiness gates (200 qualifying trades / 65% WR floor, sample-capped).

No fabricated fills. No live order rail.

## Recently completed

- Platform + bot interoperability Settings (entry sources, engine cycle, whale floors, re-entry cooldown, block-stablecoins, capital protection, discipline targets)
- Cross-venue phantom win kill (ledger-level same-venue enforcement)
- Portfolio stake budget with target-proportional split
- Honest readiness + live-only avenues
- Risk models retuned so Sweet Spot produces real learning volume while hard micro-book rules ($10 on $50) remain

## Phase 1 — Finish paper foundation (in progress)

| Item | Status |
| --- | --- |
| Market discovery + dual security | Done |
| Fail-closed risk gate | Done |
| Paper position lifecycle | Done |
| Portfolio-level loss protection | Done |
| Execution-cost simulator | Done |
| Canonical ledger types | Done |
| Deterministic replay scaffolding | Done |
| Wire portfolio-risk + execution-sim into every entry path | Partial → complete |
| Unify all surfaces onto single ledger + RiskState | In progress |
| Historical market-data recording store | Remaining |
| Broader integration tests (stale prices, correlated losses) | Partial |

## Phase 2 — Real-time sniping engine

- Continuously running backend worker (UI-independent)
- On-chain event listener (one chain first)
- Launch / LP discovery pipeline
- Faster security evaluation queue
- Testnet / fork execution adapter
- Persistent event + signal + execution logs

## Phase 3 — Real-money execution (strict controls)

- Chain-specific execution adapter + **server-side** signing
- Transaction simulation before submit
- Fill confirmation + position reconciliation
- Emergency controls + operator alerts
- Explicit trading enablement flag and capital limits (disabled by default)
- Requires readiness gates cleared

## Phase 4 — Expand strategies and venues

- Additional chains / DEXs
- CEX adapters
- Independent strategy modules (shared risk engine)
- Out-of-sample / walk-forward backtests before capital

## Explicitly out of scope until later

Live mainnet trading, client-side private keys, full Solana security+execution path, futures/perps without readiness.
