/**
 * Two replicas concurrently edit the same pet's name, merge, and we explain
 * exactly what happened -- plus a convergence fuzz-check on the resulting
 * change set. Run with: npx tsx examples/demo.ts
 */
import * as Automerge from "@automerge/automerge";
import { getCausalHistory, explainConflicts, checkConvergence, historyToMermaid, conflictsToMermaid } from "../src/index.js";

interface Profile {
  pets: Array<{ name: string; type: string }>;
}

let doc1 = Automerge.init<Profile>("aaaaaaaa");
doc1 = Automerge.change(doc1, (d) => {
  d.pets = [{ name: "Lassie", type: "dog" }];
});

let doc2 = Automerge.merge(Automerge.init<Profile>("bbbbbbbb"), Automerge.clone(doc1));
doc2 = Automerge.change(doc2, (d) => {
  d.pets[0]!.name = "Beethoven";
});
doc1 = Automerge.change(doc1, (d) => {
  d.pets[0]!.name = "Babe";
});

const merged = Automerge.merge(doc1, doc2);

console.log("=== Causal history ===");
for (const c of getCausalHistory(merged)) {
  console.log(`${c.hash.slice(0, 8)}  actor=${c.actor}  seq=${c.seq}  ops=${c.opsCount}  deps=[${c.deps.map((d) => d.slice(0, 8)).join(", ")}]`);
}

console.log("\n=== Conflicts ===");
for (const report of explainConflicts(merged)) {
  console.log(`at ${JSON.stringify(report.path)}:`);
  for (const entry of report.entries) {
    console.log(`  ${entry.isCurrentValue ? "-> WON " : "  lost "} "${entry.value}" (actor ${entry.actor})`);
  }
}

console.log("\n=== Convergence check ===");
const allChanges = [...Automerge.getAllChanges(doc1), ...Automerge.getAllChanges(doc2)];
const seen = new Set<string>();
const uniqueChanges = allChanges.filter((c) => {
  const hash = Automerge.decodeChange(c).hash;
  if (seen.has(hash)) return false;
  seen.add(hash);
  return true;
});
const result = checkConvergence(uniqueChanges, { orderings: 20 });
console.log(`Converged: ${result.converged} (tried ${result.orderingsTried} random application orders)`);

console.log("\n=== Mermaid: causal history (paste into a ```mermaid block) ===");
console.log(historyToMermaid(getCausalHistory(merged)));

console.log("\n=== Mermaid: conflicts, winner in green (paste into a ```mermaid block) ===");
console.log(conflictsToMermaid(explainConflicts(merged)));
