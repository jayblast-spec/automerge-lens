export { getCausalHistory } from "./history.js";
export type { ChangeSummary } from "./history.js";

export { explainConflicts } from "./conflicts.js";
export type { ConflictReport, ConflictEntry, PathSegment } from "./conflicts.js";

export { checkConvergence } from "./convergence.js";
export type { ConvergenceResult } from "./convergence.js";

export { historyToMermaid, conflictsToMermaid } from "./mermaid.js";
export type { MermaidOptions } from "./mermaid.js";
