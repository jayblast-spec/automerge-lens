import { describe, expect, it } from "vitest";
import * as Automerge from "@automerge/automerge";
import { getCausalHistory } from "../src/history.js";
import { explainConflicts } from "../src/conflicts.js";
import { historyToMermaid, conflictsToMermaid } from "../src/mermaid.js";

describe("historyToMermaid", () => {
  it("produces a valid graph TD with one node per change and edges matching deps", () => {
    let doc1 = Automerge.init<{ items: string[] }>("aaaaaaaa");
    doc1 = Automerge.change(doc1, (d) => {
      d.items = ["a"];
    });
    let doc2 = Automerge.merge(Automerge.init<{ items: string[] }>("bbbbbbbb"), Automerge.clone(doc1));
    doc2 = Automerge.change(doc2, (d) => {
      d.items.push("b");
    });
    doc1 = Automerge.merge(doc1, Automerge.clone(doc2));

    const history = getCausalHistory(doc1);
    const mermaid = historyToMermaid(history);

    expect(mermaid).toMatch(/^graph TD/);
    // One node line per change.
    for (const change of history) {
      expect(mermaid).toContain(`#${change.seq}`);
    }
    // One edge per dependency.
    const edgeCount = (mermaid.match(/-->/g) ?? []).length;
    const expectedEdges = history.reduce((sum, c) => sum + c.deps.length, 0);
    expect(edgeCount).toBe(expectedEdges);
  });

  it("produces syntactically distinct node IDs for different hashes", () => {
    let doc = Automerge.init<{ x: number }>();
    doc = Automerge.change(doc, (d) => {
      d.x = 1;
    });
    doc = Automerge.change(doc, (d) => {
      d.x = 2;
    });
    const mermaid = historyToMermaid(getCausalHistory(doc));
    const nodeIds = [...mermaid.matchAll(/^ {2}(n\w+)\[/gm)].map((m) => m[1]);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
  });
});

describe("conflictsToMermaid", () => {
  it("marks the winning value with the 'won' class and losers with 'lost'", () => {
    let doc1 = Automerge.init<{ pets: Array<{ name: string }> }>("aaaaaaaa");
    doc1 = Automerge.change(doc1, (d) => {
      d.pets = [{ name: "Lassie" }];
    });
    let doc2 = Automerge.merge(Automerge.init<{ pets: Array<{ name: string }> }>("bbbbbbbb"), Automerge.clone(doc1));
    doc2 = Automerge.change(doc2, (d) => {
      d.pets[0]!.name = "Beethoven";
    });
    doc1 = Automerge.change(doc1, (d) => {
      d.pets[0]!.name = "Babe";
    });
    const merged = Automerge.merge(doc1, doc2);

    const reports = explainConflicts(merged);
    const mermaid = conflictsToMermaid(reports);

    expect(mermaid).toContain("classDef won");
    expect(mermaid).toContain("classDef lost");
    expect((mermaid.match(/class \S+ won/g) ?? []).length).toBe(1);
    expect((mermaid.match(/class \S+ lost/g) ?? []).length).toBe(1);
  });

  it("produces an empty-but-valid graph for no conflicts", () => {
    const mermaid = conflictsToMermaid([]);
    expect(mermaid).toMatch(/^graph TD/);
  });
});
