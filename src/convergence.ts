import { init, applyChanges, getHeads, type Change } from "@automerge/automerge";

export interface ConvergenceResult {
  converged: boolean;
  orderingsTried: number;
  /** Present only when converged is false: two orderings that produced different final state. */
  divergence?: { headsA: string[]; headsB: string[] };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// A small deterministic PRNG (mulberry32) so a failing run is reproducible from its seed.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The one guarantee a CRDT makes is convergence: applying the same set of
 * changes in any order, to any starting replica, produces the same final
 * state. This empirically fuzzes application order for a flat set of changes
 * (gathered from any number of diverged replicas) and asserts every ordering
 * converges to the same heads. A failure here means something -- almost
 * always non-deterministic or side-effecting code inside a `change()`
 * callback -- has broken that guarantee, which automerge itself cannot
 * detect for you.
 */
export function checkConvergence(changes: Change[], options: { orderings?: number; seed?: number } = {}): ConvergenceResult {
  const orderings = options.orderings ?? 20;
  const rand = mulberry32(options.seed ?? 42);

  let referenceHeads: string[] | undefined;

  for (let i = 0; i < orderings; i++) {
    const order = shuffle(changes, rand);
    const doc = applyChanges(init(), order)[0];
    const heads = [...getHeads(doc)].sort();

    if (!referenceHeads) {
      referenceHeads = heads;
      continue;
    }

    if (JSON.stringify(heads) !== JSON.stringify(referenceHeads)) {
      return { converged: false, orderingsTried: i + 1, divergence: { headsA: referenceHeads, headsB: heads } };
    }
  }

  return { converged: true, orderingsTried: orderings };
}
