// Simple IndexedDB-backed draft storage for the Images-to-Video studio.
// Stores serializable settings + image blobs so a browser refresh
// doesn't wipe the user's work.

const DB_NAME = "orbit-i2v";
const STORE = "kv";
const KEY_SETTINGS = "settings";
const KEY_IMAGES = "images";

export type DraftImage = {
  id: string;
  name: string;
  motion: string;
  transition: string;
  blob: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveDraftSettings(settings: Record<string, unknown>) {
  try {
    await idbSet(KEY_SETTINGS, settings);
  } catch {
    /* ignore quota errors */
  }
}

export async function loadDraftSettings<T = Record<string, unknown>>(): Promise<T | undefined> {
  try {
    return await idbGet<T>(KEY_SETTINGS);
  } catch {
    return undefined;
  }
}

export async function saveDraftImages(images: DraftImage[]) {
  try {
    await idbSet(KEY_IMAGES, images);
  } catch {
    /* ignore */
  }
}

export async function loadDraftImages(): Promise<DraftImage[]> {
  try {
    return (await idbGet<DraftImage[]>(KEY_IMAGES)) ?? [];
  } catch {
    return [];
  }
}

export async function clearDraft() {
  try {
    await idbSet(KEY_SETTINGS, undefined);
    await idbSet(KEY_IMAGES, []);
  } catch {
    /* ignore */
  }
}
