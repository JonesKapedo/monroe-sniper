import { createFileRoute } from "@tanstack/react-router";
import { parseTradingViewAlert } from "@/lib/trading/tv-webhook";

/**
 * TradingView (or any strategy runner) alert intake.
 *
 * Point a TradingView alert webhook at POST /api/webhooks/tradingview. The body
 * may be JSON or plain text ("BUY BTCUSDT @ 64000"). When MONROE_WEBHOOK_TOKEN
 * is set the caller must present it as ?token= or the x-webhook-token header.
 *
 * This endpoint validates and normalizes the signal, optionally relays it to
 * MONROE_TV_RELAY_URL (webhook-out), and returns it. It does not place orders:
 * execution stays inside the desk, which the operator keeps in control of.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/webhooks/tradingview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MONROE_WEBHOOK_TOKEN?.trim();
        if (token) {
          const url = new URL(request.url);
          const provided = url.searchParams.get("token") ?? request.headers.get("x-webhook-token") ?? "";
          if (provided !== token) return jsonResponse({ error: "Unauthorized webhook caller." }, 401);
        }

        const raw = await request.text().catch(() => "");
        let payload: unknown = raw;
        try {
          payload = JSON.parse(raw) as unknown;
        } catch {
          // keep raw text; the parser handles plain-text alerts
        }

        const parsed = parseTradingViewAlert(payload);
        if (!parsed.ok) return jsonResponse({ error: parsed.note }, 400);

        const signal = { ...parsed.signal, receivedAt: Date.now() };

        const relay = process.env.MONROE_TV_RELAY_URL?.trim();
        if (relay) {
          try {
            await fetch(relay, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(signal),
              signal: AbortSignal.timeout(6000),
            });
          } catch {
            // Relay is best-effort; the intake still succeeds.
          }
        }

        return jsonResponse({ ok: true, note: parsed.note, signal, relayed: Boolean(relay) });
      },
      GET: async () =>
        jsonResponse({
          ok: true,
          endpoint: "/api/webhooks/tradingview",
          method: "POST",
          auth: process.env.MONROE_WEBHOOK_TOKEN?.trim() ? "token required" : "open",
          example: { symbol: "BINANCE:BTCUSDT", action: "buy", price: 64000, notional_usd: 50 },
        }),
    },
  },
});
