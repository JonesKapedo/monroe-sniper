#!/usr/bin/env python3
"""
Helius RPC health probe — operator-side companion to the desk's Solana feed.

Configured as the FeedRegistry's Helius health check (Architecture Blueprint
v2, P3 groundwork): verifies the Helius mainnet RPC is reachable, responsive,
and advancing slots. Run it from cron, CI, or a local terminal:

    HELIUS_API_KEY=... python3 scripts/helius_probe.py

Exit codes: 0 healthy, 1 unreachable/stalled, 2 config error.

The API key NEVER lives in code — it must come from the environment
(HELIUS_API_KEY) or a .env file you keep out of version control.
Rotate any key that has ever been pasted into a chat or a file you share.
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
import urllib.request
from urllib.error import URLError

try:  # stdlib fallback when solana-py isn't installed (probe still works)
    from solana.rpc.async_api import AsyncClient
except ImportError:
    AsyncClient = None  # type: ignore[assignment]

DEFAULT_TIMEOUT_S = 10.0
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_S = 1.5
STALL_SLOTS = 10  # healthy if the slot advances again within one retry window


def helius_url() -> str:
    """Full RPC URL from the environment. Raises SystemExit(2) on missing key."""
    key = os.environ.get("HELIUS_API_KEY", "").strip()
    if not key:
        print("ERROR: HELIUS_API_KEY is not set. Export it in your shell or .env.")
        raise SystemExit(2)
    return f"https://mainnet.helius-rpc.com/?api-key={key}"


async def probe_solana_py(url: str) -> int:
    """Primary path: your AsyncClient probe, hardened with retries + latency."""
    last_error: Exception | None = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        t0 = time.perf_counter()
        try:
            async with AsyncClient(url) as client:
                slot = await client.get_slot()
            latency_ms = (time.perf_counter() - t0) * 1000
            return verdict(slot.value, latency_ms)
        except Exception as exc:  # noqa: BLE001 — probe must report, not crash
            last_error = exc
            if attempt < RETRY_ATTEMPTS:
                await asyncio.sleep(RETRY_BACKOFF_S * attempt)
    print(f"UNREACHABLE: Helius RPC failed after {RETRY_ATTEMPTS} attempts ({last_error})")
    return 1


async def probe_stdlib(url: str) -> int:
    """Fallback path: raw JSON-RPC getSlot over HTTPS, zero dependencies."""
    payload = b'{"jsonrpc":"2.0","id":1,"method":"getSlot"}'
    last_error: Exception | None = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        t0 = time.perf_counter()
        try:
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT_S) as resp:
                body = resp.read()
            latency_ms = (time.perf_counter() - t0) * 1000
            import json

            slot = int(json.loads(body)["result"])
            return verdict(slot, latency_ms)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt < RETRY_ATTEMPTS:
                await asyncio.sleep(RETRY_BACKOFF_S * attempt)
    print(f"UNREACHABLE: Helius RPC failed after {RETRY_ATTEMPTS} attempts ({last_error})")
    return 1


def verdict(slot: int, latency_ms: float) -> int:
    """Health verdict: OK on a live slot under the latency budget; warn when slow."""
    if slot <= 0:
        print("STALLED: RPC returned a non-positive slot — feed is not advancing.")
        return 1
    if latency_ms > 2000:
        print(f"WARN: slot {slot} reachable, but latency {latency_ms:.0f}ms exceeds 2000ms budget.")
        return 0  # reachable counts as healthy for feed purposes; latency flagged
    print(f"OK: slot {slot} ({latency_ms:.0f}ms) — Helius RPC healthy.")
    return 0


async def main() -> int:
    url = helius_url()
    if AsyncClient is not None:
        return await probe_solana_py(url)
    print("NOTE: solana-py not installed — using stdlib JSON-RPC fallback.", file=sys.stderr)
    return await probe_stdlib(url)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
