import { createFileRoute } from "@tanstack/react-router";
import { runTradingCycle } from "@/functions/trading-engine";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/trading-cycle")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Vercel Cron (or manual refresh) triggers one 5-minute engine cycle:
        // market refresh -> whale refresh -> equity guard -> profit lock -> persist.
        const cronSecret = process.env.CRON_SECRET?.trim();
        if (cronSecret) {
          const auth = request.headers.get("authorization");
          if (auth !== `Bearer ${cronSecret}`) {
            return jsonResponse({ error: "Unauthorized cron caller." }, 401);
          }
        }
        try {
          const result = await runTradingCycle({ data: undefined as never });
          return jsonResponse(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Trading cycle failed.";
          console.error("[trading-cycle] failed:", error);
          return jsonResponse({ error: message }, 500);
        }
      },
    },
  },
});
