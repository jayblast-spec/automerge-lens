import type { ChangeSummary } from "./history.js";
import type { ConflictReport } from "./conflicts.js";

function nodeId(hash: string): string {
  // First 12 hex chars is plenty unique for a visualization (not a security
  // boundary) and keeps the generated diagram source actually readable.
  return `n${hash.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "&quot;");
}

export interface MermaidOptions {
  /** Truncate hashes in labels to this many characters. Full hashes are still used as node IDs, so this is purely cosmetic. */
  hashLength?: number;
}

/**
 * Renders a causal history as a Mermaid `graph TD` flowchart -- paste the
 * output into a ```mermaid fenced block and GitHub (and most Markdown
 * renderers) will draw it natively, no library required. Each change is a
 * node labeled with its actor and op count; edges point from a dependency
 * to the change that depended on it, so concurrent branches (like two
 * actors editing after the same shared change) visibly fork and, if
 * merged, converge.
 */
export function historyToMermaid(history: ChangeSummary[], options: MermaidOptions = {}): string {
  const hashLength = options.hashLength ?? 8;
  const lines = ["graph TD"];

  for (const change of history) {
    const id = nodeId(change.hash);
    const label = escapeLabel(`${change.actor.slice(0, hashLength)} #${change.seq}\\n${change.opsCount} op(s)`);
    lines.push(`  ${id}["${label}"]`);
  }

  for (const change of history) {
    for (const dep of change.deps) {
      lines.push(`  ${nodeId(dep)} --> ${nodeId(change.hash)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Renders conflict reports as a Mermaid graph: the winning value in green,
 * losing candidates in red, grouped by the document path they conflict at.
 */
export function conflictsToMermaid(reports: ConflictReport[]): string {
  const lines = ["graph TD", "  classDef won fill:#1a7f37,stroke:#116329,color:#fff", "  classDef lost fill:#cf222e,stroke:#82071e,color:#fff"];

  reports.forEach((report, reportIdx) => {
    const pathLabel = escapeLabel(report.path.join("."));
    const pathId = `path${reportIdx}`;
    lines.push(`  ${pathId}["${pathLabel}"]`);

    report.entries.forEach((entry, entryIdx) => {
      const entryId = `${pathId}_e${entryIdx}`;
      const valueLabel = escapeLabel(`${JSON.stringify(entry.value)}\\n(${entry.actor.slice(0, 8)})`);
      lines.push(`  ${entryId}["${valueLabel}"]`);
      lines.push(`  ${pathId} --> ${entryId}`);
      lines.push(`  class ${entryId} ${entry.isCurrentValue ? "won" : "lost"}`);
    });
  });

  return lines.join("\n");
}
