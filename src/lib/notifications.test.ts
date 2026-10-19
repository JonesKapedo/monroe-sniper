import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useNotifications } from "./notifications.ts";

describe("notification center", () => {
  beforeEach(() => {
    useNotifications.getState().clear();
  });

  it("records alerts newest-first and counts them unread", () => {
    const { notify } = useNotifications.getState();
    notify({ title: "First" });
    notify({ title: "Second" });
    const items = useNotifications.getState().items;
    assert.equal(items.length, 2);
    assert.equal(items[0].title, "Second");
    assert.equal(useNotifications.getState().items.filter((n) => !n.read).length, 2);
  });

  it("dedupes by tag inside the window so feed flaps do not spam", () => {
    const { notify } = useNotifications.getState();
    notify({ title: "Feed down", tag: "feed:binance" });
    notify({ title: "Feed down", tag: "feed:binance" });
    assert.equal(useNotifications.getState().items.length, 1);
    notify({ title: "Feed recovered", tag: "feedup:binance" });
    assert.equal(useNotifications.getState().items.length, 2);
  });

  it("markAllRead, dismiss and clear behave", () => {
    const store = useNotifications.getState();
    store.notify({ title: "A" });
    store.notify({ title: "B" });
    store.markAllRead();
    assert.equal(useNotifications.getState().items.every((n) => n.read), true);
    const first = useNotifications.getState().items[0];
    store.dismiss(first.id);
    assert.equal(useNotifications.getState().items.length, 1);
    store.clear();
    assert.equal(useNotifications.getState().items.length, 0);
  });

  it("caps the log so memory cannot grow without bound", () => {
    const { notify } = useNotifications.getState();
    for (let i = 0; i < 100; i++) notify({ title: `n${i}` });
    assert.equal(useNotifications.getState().items.length, 60);
  });
});
