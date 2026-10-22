// Open editors register here so actions that end the session can wait for their pending saves.
const flushers = new Set<() => Promise<boolean>>();

export function registerFlush(flush: () => Promise<boolean>): () => void {
  flushers.add(flush);
  return () => flushers.delete(flush);
}

export async function flushPendingSaves(): Promise<boolean> {
  const results = await Promise.all([...flushers].map((flush) => flush()));
  return results.every(Boolean);
}

export const UNSAVED_CONFIRM = "Your latest changes could not be saved. Leave anyway?";
