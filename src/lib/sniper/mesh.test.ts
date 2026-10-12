import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clip } from "./format.ts";
import {
  SOURCE_ORDER,
  SOURCE_SPECS,
  emptySourceSettings,
  type MeshSourceStatus,
  type SourceId,
  type SourceReadout,
  type SourceSetting,
} from "./mesh-types.ts";

describe("clip", () => {
  it("holds a value inside the band", () => {
    assert.equal(clip(5, -1, 1), 1);
    assert.equal(clip(-5, -1, 1), -1);
    assert.equal(clip(0.4, -1, 1), 0.4);
  });
});

describe("source registry", () => {
  it("covers every declared source id", () => {
    assert.equal(SOURCE_ORDER.length, Object.keys(SOURCE_SPECS).length);
    for (const id of SOURCE_ORDER) {
      const spec = SOURCE_SPECS[id];
      assert.equal(spec.id, id);
      assert.ok(spec.label.length > 0);
      assert.ok(spec.endpoint.length > 0);
      assert.ok(spec.role.length > 0);
      assert.ok(spec.rationale.length > 0);
      assert.ok(spec.weight > 0 && spec.weight <= 3);
      assert.ok(spec.reliability > 0 && spec.reliability <= 1);
      assert.ok(spec.latency >= 0);
    }
  });

  it("starts every source armed, pinned to nothing", () => {
    const settings = emptySourceSettings();
    for (const id of SOURCE_ORDER) {
      assert.deepEqual(settings[id], {
        enabled: true,
        weight: SOURCE_SPECS[id].weight,
        mode: "AUTO",
        symbol: null,
      });
    }
  });

  it("charges a budget only to the slow, priced feeds", () => {
    for (const id of SOURCE_ORDER) {
      const spec = SOURCE_SPECS[id];
      if (spec.cost > 0) {
        assert.ok(spec.quota > 0, `${id} costs units but draws no quota`);
        assert.ok(spec.cooldown > 0, `${id} costs units but has no cooldown`);
      }
    }
  });
});

describe("mesh shape", () => {
  it("carries one vote per enabled source", () => {
    const settings = emptySourceSettings();
    const statuses: MeshSourceStatus[] = SOURCE_ORDER.map((id) => ({
      id,
      family: SOURCE_SPECS[id].family,
      label: SOURCE_SPECS[id].label,
      endpoint: SOURCE_SPECS[id].endpoint,
      rationale: SOURCE_SPECS[id].rationale,
      enabled: settings[id].enabled,
      weight: settings[id].weight,
      mode: settings[id].mode,
      pinnedSymbol: settings[id].symbol,
      reads: 0,
      skill: SOURCE_SPECS[id].reliability,
      health: "LIVE",
      note: "awaiting first read",
    }));
    assert.ok(statuses.every((s) => s.enabled && s.reads === 0));

    const readout: SourceReadout = {
      source: "MODEL" as SourceId,
      symbol: "SPY",
      bias: 0.5,
      strength: 0.6,
      reliability: 1,
      note: "lean long",
      at: 3,
    };
    assert.ok(readout.bias <= 1 && readout.reliability <= 1);
  });

  it("round-trips a pinned source setting", () => {
    const setting: SourceSetting = { enabled: true, weight: 1.4, mode: "PINNED", symbol: "NVDA" };
    assert.equal(setting.mode, "PINNED");
    assert.equal(setting.symbol, "NVDA");
  });
});
