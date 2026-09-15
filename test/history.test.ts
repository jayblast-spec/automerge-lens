import { describe, expect, it } from "vitest";
import * as Automerge from "@automerge/automerge";
import { getCausalHistory } from "../src/history.js";

describe("getCausalHistory", () => {
  it("orders changes so every change appears after its dependencies", () => {
    let doc1 = Automerge.init<{ items: string[] }>();
    doc1 = Automerge.change(doc1, (d) => {
      d.items = ["a"];
    });

    let doc2 = Automerge.merge(Automerge.init<{ items: string[] }>(), Automerge.clone(doc1));
    doc2 = Automerge.change(doc2, (d) => {
      d.items.push("b");
    });

    doc1 = Automerge.merge(doc1, Automerge.clone(doc2));
    doc1 = Automerge.change(doc1, (d) => {
      d.items.push("c");
    });

    const history = getCausalHistory(doc1);
    const indexByHash = new Map(history.map((c, i) => [c.hash, i]));

    for (const change of history) {
      for (const dep of change.deps) {
        expect(indexByHash.get(dep)).toBeLessThan(indexByHash.get(change.hash)!);
      }
    }
    expect(history.length).toBe(3);
    expect(history.every((c) => c.opsCount > 0)).toBe(true);
  });

  it("captures actor id and seq correctly", () => {
    let doc = Automerge.init<{ x: number }>("aaaaaaaa");
    doc = Automerge.change(doc, (d) => {
      d.x = 1;
    });
    doc = Automerge.change(doc, (d) => {
      d.x = 2;
    });

    const history = getCausalHistory(doc);
    expect(history.map((c) => c.seq)).toEqual([1, 2]);
    expect(history.every((c) => c.actor === "aaaaaaaa")).toBe(true);
  });
});
