import { describe, expect, it } from "vitest";
import * as Automerge from "@automerge/automerge";
import { checkConvergence } from "../src/convergence.js";

describe("checkConvergence", () => {
  it("confirms convergence for a normal set of concurrent edits", () => {
    let doc1 = Automerge.init<{ items: string[] }>("aaaaaaaa");
    doc1 = Automerge.change(doc1, (d) => {
      d.items = ["a"];
    });
    let doc2 = Automerge.merge(Automerge.init<{ items: string[] }>("bbbbbbbb"), Automerge.clone(doc1));
    doc2 = Automerge.change(doc2, (d) => {
      d.items.push("b");
    });
    doc1 = Automerge.change(doc1, (d) => {
      d.items.push("c");
    });

    const allChanges = [...Automerge.getAllChanges(doc1), ...Automerge.getAllChanges(doc2)];
    // De-duplicate by decoding hashes, since both replicas share the first change.
    const seen = new Set<string>();
    const unique = allChanges.filter((c) => {
      const hash = Automerge.decodeChange(c).hash;
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });

    const result = checkConvergence(unique, { orderings: 15 });
    expect(result.converged).toBe(true);
    expect(result.orderingsTried).toBe(15);
  });

  it("is deterministic for a given seed (same seed -> same result)", () => {
    let doc = Automerge.init<{ x: number }>();
    doc = Automerge.change(doc, (d) => {
      d.x = 1;
    });
    const changes = Automerge.getAllChanges(doc);

    const a = checkConvergence(changes, { orderings: 5, seed: 7 });
    const b = checkConvergence(changes, { orderings: 5, seed: 7 });
    expect(a).toEqual(b);
  });

  it("handles an empty change set as trivially converged", () => {
    const result = checkConvergence([], { orderings: 5 });
    expect(result.converged).toBe(true);
  });
});
