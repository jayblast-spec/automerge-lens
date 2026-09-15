import { describe, expect, it } from "vitest";
import * as Automerge from "@automerge/automerge";
import { explainConflicts } from "../src/conflicts.js";

interface Profile {
  pets: Array<{ name: string; type: string }>;
}

describe("explainConflicts", () => {
  it("reports both candidate values and which one won, for the exact scenario from automerge's own docs", () => {
    let doc1 = Automerge.init<Profile>("aaaaaaaa");
    doc1 = Automerge.change(doc1, (d) => {
      d.pets = [{ name: "Lassie", type: "dog" }];
    });
    let doc2 = Automerge.init<Profile>("bbbbbbbb");
    doc2 = Automerge.merge(doc2, Automerge.clone(doc1));

    doc2 = Automerge.change(doc2, (d) => {
      d.pets[0]!.name = "Beethoven";
    });
    doc1 = Automerge.change(doc1, (d) => {
      d.pets[0]!.name = "Babe";
    });

    const merged = Automerge.merge(doc1, doc2);
    const reports = explainConflicts(merged);

    const nameConflict = reports.find((r) => r.path[r.path.length - 1] === "name");
    expect(nameConflict).toBeDefined();
    expect(nameConflict!.entries).toHaveLength(2);

    const values = nameConflict!.entries.map((e) => e.value).sort();
    expect(values).toEqual(["Babe", "Beethoven"]);

    const winners = nameConflict!.entries.filter((e) => e.isCurrentValue);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.value).toBe(merged.pets[0]!.name);

    for (const entry of nameConflict!.entries) {
      expect(["aaaaaaaa", "bbbbbbbb"]).toContain(entry.actor);
    }
  });

  it("reports no conflicts for a document with no concurrent writes", () => {
    let doc = Automerge.init<{ x: number }>();
    doc = Automerge.change(doc, (d) => {
      d.x = 1;
    });
    doc = Automerge.change(doc, (d) => {
      d.x = 2;
    });
    expect(explainConflicts(doc)).toEqual([]);
  });

  it("finds conflicts nested inside arrays and objects, not just at the root", () => {
    let doc1 = Automerge.init<Profile>("aaaaaaaa");
    doc1 = Automerge.change(doc1, (d) => {
      d.pets = [{ name: "Rex", type: "dog" }];
    });
    let doc2 = Automerge.merge(Automerge.init<Profile>("bbbbbbbb"), Automerge.clone(doc1));

    doc1 = Automerge.change(doc1, (d) => {
      d.pets[0]!.type = "wolf";
    });
    doc2 = Automerge.change(doc2, (d) => {
      d.pets[0]!.type = "canine";
    });

    const merged = Automerge.merge(doc1, doc2);
    const reports = explainConflicts(merged);
    const typeConflict = reports.find((r) => r.path[r.path.length - 1] === "type");
    expect(typeConflict).toBeDefined();
    expect(typeConflict!.path).toEqual(["pets", 0, "type"]);
  });
});
