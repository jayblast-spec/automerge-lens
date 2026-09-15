import { getAllChanges, decodeChange, type Doc } from "@automerge/automerge";

export interface ChangeSummary {
  hash: string;
  actor: string;
  seq: number;
  deps: string[];
  opsCount: number;
  message: string | null;
  time: number;
}

/**
 * The full causal history of a document, topologically sorted by `deps` so
 * that every change appears after everything it depends on -- regardless of
 * what order `getAllChanges` happens to return them in internally.
 */
export function getCausalHistory<T>(doc: Doc<T>): ChangeSummary[] {
  const decoded = getAllChanges(doc).map(decodeChange);
  const byHash = new Map(decoded.map((c) => [c.hash, c]));

  const visited = new Set<string>();
  const ordered: typeof decoded = [];

  function visit(hash: string) {
    if (visited.has(hash)) return;
    visited.add(hash);
    const change = byHash.get(hash);
    if (!change) return; // dep outside this document's change set (already compacted away)
    for (const dep of change.deps) visit(dep);
    ordered.push(change);
  }

  for (const change of decoded) visit(change.hash);

  return ordered.map((c) => ({
    hash: c.hash,
    actor: c.actor,
    seq: c.seq,
    deps: c.deps,
    opsCount: c.ops.length,
    message: c.message,
    time: c.time,
  }));
}
