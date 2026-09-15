import { getConflicts, type Doc } from "@automerge/automerge";

export type PathSegment = string | number;

export interface ConflictEntry {
  opId: string;
  actor: string;
  value: unknown;
  isCurrentValue: boolean;
}

export interface ConflictReport {
  path: PathSegment[];
  entries: ConflictEntry[];
}

function actorFromOpId(opId: string): string {
  const at = opId.lastIndexOf("@");
  return at === -1 ? opId : opId.slice(at + 1);
}

function isPlainObjectOrArray(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return true;
  if (value instanceof Date || value instanceof Uint8Array) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Recursively walks a materialized document, and for every key that has a
 * live conflict (a concurrent assignment automerge had to resolve), reports
 * every candidate value, which actor wrote it, and which one automerge
 * currently presents as the value -- so you can see not just *that* there
 * was a conflict but exactly what lost and why the current state looks the
 * way it does.
 */
export function explainConflicts<T>(doc: Doc<T>, maxDepth = 25): ConflictReport[] {
  const reports: ConflictReport[] = [];

  function visit(node: unknown, path: PathSegment[], depth: number) {
    if (depth > maxDepth || !isPlainObjectOrArray(node)) return;

    const keys = Array.isArray(node) ? node.map((_, i) => i) : Object.keys(node);
    for (const key of keys) {
      const value = (node as Record<PathSegment, unknown>)[key];

      let conflicts;
      try {
        conflicts = getConflicts(node as Doc<unknown>, key as string);
      } catch {
        conflicts = undefined;
      }

      if (conflicts && Object.keys(conflicts).length > 1) {
        reports.push({
          path: [...path, key],
          entries: Object.entries(conflicts).map(([opId, candidateValue]) => ({
            opId,
            actor: actorFromOpId(opId),
            value: candidateValue,
            isCurrentValue: JSON.stringify(candidateValue) === JSON.stringify(value),
          })),
        });
      }

      visit(value, [...path, key], depth + 1);
    }
  }

  visit(doc, [], 0);
  return reports;
}
