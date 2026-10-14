import { createFileRoute } from "@tanstack/react-router";
import {
  parseSolanaSwap,
  selectSolUsdcPairs,
  SOL_MINT,
  type SolanaDexPair,
} from "@/lib/solana-swaps";

type RpcMessage = {
  id?: number;
  error?: { message?: string };
  result?: number;
  method?: string;
  params?: {
    subscription?: number;
    result?: { value?: { signature?: string; err?: unknown } };
  };
};

const encoder = new TextEncoder();
let pairCache: { fetchedAt: number; pairs: SolanaDexPair[] } | null = null;
const activeStreams = new Map<string, number>();
const MAX_STREAMS_PER_IP = 2;

async function getSolUsdcPairs(): Promise<SolanaDexPair[]> {
  if (pairCache && Date.now() - pairCache.fetchedAt < 30_000) return pairCache.pairs;
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SOL_MINT}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`DexScreener returned HTTP ${response.status}`);
  const body: unknown = await response.json();
  const pairs = selectSolUsdcPairs(
    body && typeof body === "object" && "pairs" in body ? body.pairs : null,
  );
  pairCache = { fetchedAt: Date.now(), pairs };
  return pairs;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/solana-swaps")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const origin = request.headers.get("origin");
        if (origin && origin !== requestUrl.origin) {
          return jsonResponse({ error: "Cross-origin requests are not allowed." }, 403);
        }

        const apiKey = process.env.HELIUS_API_KEY?.trim();
        if (!apiKey) {
          return jsonResponse(
            { error: "The server is missing its HELIUS_API_KEY deployment secret." },
            503,
          );
        }

        let pairs: SolanaDexPair[];
        try {
          pairs = await getSolUsdcPairs();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "DexScreener market lookup failed.";
          console.error("[solana-swaps] Pair discovery failed:", error);
          return jsonResponse({ error: message }, 502);
        }
        if (!pairs.length) {
          return jsonResponse(
            { error: "No liquid SOL/USDC pool was found on a supported Solana venue." },
            503,
          );
        }

        if (requestUrl.searchParams.get("check") === "1") {
          return jsonResponse({
            pairs: pairs.map(({ dexId, pairAddress, liquidityUsd, priceUsd }) => ({
              dexId,
              pairAddress,
              liquidityUsd,
              priceUsd,
            })),
          });
        }

        const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const activeForIp = activeStreams.get(clientIp) ?? 0;
        if (activeForIp >= MAX_STREAMS_PER_IP) {
          return Response.json(
            { error: "Too many active market streams from this address." },
            { status: 429, headers: { "retry-after": "30", "cache-control": "no-store" } },
          );
        }
        activeStreams.set(clientIp, activeForIp + 1);

        const socketUrl = new URL("wss://mainnet.helius-rpc.com/");
        socketUrl.searchParams.set("api-key", apiKey);

        let stopStream: (() => void) | undefined;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let stopped = false;
            let requestId = 0;
            const pendingPairs = new Map<number, SolanaDexPair>();
            const subscriptions = new Map<number, SolanaDexPair>();
            const signatures = new Set<string>();
            let transactionLookups = 0;
            // Bounded decode queue: bursts wait their turn instead of dropping.
            // A signature joins `signatures` only after decode-or-permanent-
            // reject, so a queued tick is never silently lost.
            const decodeQueue: Array<{ signature: string; pair: SolanaDexPair; attempts: number }> = [];
            const MAX_QUEUED = 200;
            const remember = (signature: string) => {
              signatures.add(signature);
              if (signatures.size > 500)
                signatures.delete(signatures.values().next().value as string);
            };
            const pumpQueue = () => {
              if (stopped) return;
              while (transactionLookups < 8 && decodeQueue.length > 0) {
                const next = decodeQueue.shift();
                if (!next) break;
                transactionLookups++;
                void fetchSwap(next.signature, next.pair)
                  .then(() => remember(next.signature))
                  .catch((error) => {
                    if (next.attempts < 1 && !stopped) {
                      decodeQueue.push({ ...next, attempts: next.attempts + 1 });
                    } else {
                      console.error("[solana-swaps] Transaction lookup failed:", error);
                      emit("feed-error", {
                        fatal: false,
                        message:
                          error instanceof Error
                            ? error.message
                            : "Unable to decode a confirmed Solana swap.",
                      });
                      remember(next.signature);
                    }
                  })
                  .finally(() => {
                    transactionLookups--;
                    pumpQueue();
                  });
              }
              if (decodeQueue.length >= MAX_QUEUED) {
                // Shed the oldest waiting (never decoded) rather than the
                // newest, and say so exactly once per burst.
                decodeQueue.splice(0, decodeQueue.length - MAX_QUEUED);
                emit("feed-error", {
                  fatal: false,
                  message: "Swap burst exceeded the decode queue; oldest waiting ticks shed.",
                });
              }
            };
            const encoderEvent = (type: string, data: unknown) =>
              encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
            const emit = (type: string, data: unknown) => {
              if (!stopped) controller.enqueue(encoderEvent(type, data));
            };
            const socket = new WebSocket(socketUrl);
            const heartbeat = setInterval(() => {
              if (!stopped) controller.enqueue(encoder.encode(": keepalive\n\n"));
            }, 10_000);

            const cleanup = () => {
              if (stopped) return;
              stopped = true;
              clearInterval(heartbeat);
              request.signal.removeEventListener("abort", cleanup);
              const remaining = (activeStreams.get(clientIp) ?? 1) - 1;
              if (remaining > 0) activeStreams.set(clientIp, remaining);
              else activeStreams.delete(clientIp);
              if (socket.readyState === WebSocket.OPEN) {
                socket.close();
              } else if (socket.readyState === WebSocket.CONNECTING) {
                socket.addEventListener("open", () => socket.close(), { once: true });
              }
            };
            stopStream = cleanup;
            request.signal.addEventListener("abort", cleanup, { once: true });

            const fetchSwap = async (signature: string, pair: SolanaDexPair) => {
              const response = await fetch(
                `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: ++requestId,
                    method: "getTransaction",
                    params: [
                      signature,
                      {
                        commitment: "confirmed",
                        encoding: "jsonParsed",
                        maxSupportedTransactionVersion: 0,
                      },
                    ],
                  }),
                  signal: AbortSignal.timeout(6000),
                },
              );
              if (!response.ok)
                throw new Error(`Helius transaction lookup returned HTTP ${response.status}`);
              const body = (await response.json()) as {
                result?: unknown;
                error?: { message?: string };
              };
              if (body.error)
                throw new Error(body.error.message || "Helius transaction lookup failed.");
              const swap = body.result ? parseSolanaSwap(body.result, pair, signature) : null;
              if (swap) emit("swap", swap);
            };

            const handleMessage = async (event: MessageEvent) => {
              let message: RpcMessage;
              try {
                const raw = typeof event.data === "string" ? event.data : await event.data.text();
                message = JSON.parse(raw) as RpcMessage;
              } catch (error) {
                console.error("[solana-swaps] Invalid Helius WebSocket message:", error);
                emit("feed-error", {
                  fatal: false,
                  message: "Helius sent an unreadable stream message.",
                });
                return;
              }

              if (typeof message.id === "number") {
                const pair = pendingPairs.get(message.id);
                pendingPairs.delete(message.id);
                if (message.error) {
                  console.error("[solana-swaps] Subscription rejected:", message.error.message);
                  emit("feed-error", {
                    fatal: false,
                    message: message.error.message || "Helius rejected a pool subscription.",
                  });
                } else if (pair && typeof message.result === "number") {
                  subscriptions.set(message.result, pair);
                }
                return;
              }

              const signature = message.params?.result?.value?.signature;
              const pair = message.params?.subscription
                ? subscriptions.get(message.params.subscription)
                : undefined;
              if (!signature || !pair || message.params?.result?.value?.err != null) return;
              if (signatures.has(signature)) return;
              decodeQueue.push({ signature, pair, attempts: 0 });
              pumpQueue();
            };

            socket.addEventListener("open", () => {
              if (stopped) {
                socket.close();
                return;
              }
              emit("ready", {
                network: "Solana mainnet",
                pairs: pairs.map(({ dexId, pairAddress, liquidityUsd, priceUsd }) => ({
                  dexId,
                  pairAddress,
                  liquidityUsd,
                  priceUsd,
                })),
              });
              for (const pair of pairs) {
                const id = ++requestId;
                pendingPairs.set(id, pair);
                socket.send(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id,
                    method: "logsSubscribe",
                    params: [{ mentions: [pair.pairAddress] }, { commitment: "confirmed" }],
                  }),
                );
              }
            });
            socket.addEventListener("message", (event) => void handleMessage(event));
            socket.addEventListener("error", (error) => {
              console.error("[solana-swaps] Helius WebSocket connection failed:", error);
              emit("feed-error", {
                fatal: true,
                message: "Could not connect to Helius. Check the deployment secret and try again.",
              });
            });
            socket.addEventListener("close", () => {
              if (!stopped) {
                emit("feed-error", {
                  fatal: true,
                  message: "Helius stream closed; reconnecting…",
                });
                cleanup();
                controller.close();
              }
            });
          },
          cancel() {
            stopStream?.();
          },
        });

        return new Response(stream, {
          headers: {
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "content-type": "text/event-stream; charset=utf-8",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});
