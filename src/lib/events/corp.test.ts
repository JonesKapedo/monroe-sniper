import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyEvent, extractSymbols, parseRssItems } from "./corp.ts";

describe("corporate event radar", () => {
  it("classifies M&A, IPO, strike, and halt headlines", () => {
    assert.equal(classifyEvent("Acme to acquire Beta in $2B merger").kind, "ACQUISITION");
    assert.equal(classifyEvent("Crypto custodian files for IPO, debuts on Nasdaq").kind, "IPO");
    assert.equal(classifyEvent("Miners authorize strike over wage dispute").kind, "STRIKE");
    assert.equal(classifyEvent("Exchange suspends trading, cites halt").kind, "HALT");
    assert.equal(classifyEvent("Cloud firm reports Q3 earnings beat").kind, "EARNINGS");
    assert.equal(classifyEvent("Sunny weather expected tomorrow").kind, "OTHER");
  });

  it("parses RSS items with CDATA and atom links", () => {
    const items = parseRssItems(`<rss><channel>
      <item><title><![CDATA[Miners $BTC strike looms]]></title><link>https://x.test/1</link><pubDate>Mon, 13 Oct 2026 10:00:00 GMT</pubDate></item>
      <entry><title>IPO filed</title><link href="https://x.test/2"/><published>2026-10-13T09:00:00Z</published></entry>
    </channel></rss>`);
    assert.equal(items.length, 2);
    assert.equal(items[0].title, "Miners $BTC strike looms");
    assert.equal(items[0].link, "https://x.test/1");
    assert.equal(items[1].link, "https://x.test/2");
  });

  it("extracts $tags and universe symbols", () => {
    assert.deepEqual(extractSymbols("Whales rotate into $SOL and $BONK", ["SOL", "ETH"]), ["SOL", "BONK"]);
    assert.deepEqual(extractSymbols("nothing here", ["SOL"]), []);
  });
});
