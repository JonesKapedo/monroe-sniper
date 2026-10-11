# Monroe Sniper

Paper trading desk. It simulates a market minute on a cadence, sizes risk, and updates a small model after every close.

This is not a broker. Deposits and withdrawals are play money kept in the browser. Nothing here promises a daily profit.

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
has a matching `*.test.ts` next to it. The TypeScript suites run under
`npm test` on a Node build with type stripping; run them directly with
`node --experimental-strip-types --test src/lib/sniper/*.test.ts`.
