/**
 * Offline utilities — connection detection, data staleness, write queue.
 *
 * Provides hooks and helpers for offline-first PWA behavior:
 * - Online/offline detection with event listeners
 * - Staleness timestamps on cached data
 * - IndexedDB write queue for journal entries and quest completions
 */

/** Check if currently online */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Subscribe to online/offline events.
 * Returns an unsubscribe function.
 */
export function onConnectionChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

/**
 * Format a staleness timestamp for display.
 * e.g., "Updated 2 hours ago", "Updated just now"
 */
export function formatStaleness(lastFetched: number | null): string {
  if (!lastFetched) return "No data loaded";

  const diff = Date.now() - lastFetched;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

// ---- IndexedDB Write Queue ----

const DB_NAME = "drofbot-offline";
const DB_VERSION = 1;
const STORE_NAME = "write-queue";

interface QueuedWrite {
  id: string;
  type: "journal_entry" | "quest_completion";
  data: unknown;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Queue a write for later sync. */
export async function queueWrite(type: QueuedWrite["type"], data: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const entry: QueuedWrite = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    data,
    createdAt: Date.now(),
  };
  store.add(entry);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all queued writes. */
export async function getQueuedWrites(): Promise<QueuedWrite[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Remove a queued write after successful sync. */
export async function removeQueuedWrite(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Process queued writes when back online. */
export async function syncQueuedWrites(
  syncFn: (type: QueuedWrite["type"], data: unknown) => Promise<boolean>,
): Promise<number> {
  const writes = await getQueuedWrites();
  let synced = 0;

  for (const write of writes) {
    try {
      const success = await syncFn(write.type, write.data);
      if (success) {
        await removeQueuedWrite(write.id);
        synced++;
      }
    } catch {
      // Keep in queue for next sync attempt
    }
  }

  return synced;
}
